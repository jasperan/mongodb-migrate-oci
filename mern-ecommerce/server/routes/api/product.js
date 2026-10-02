const express = require('express');
const router = express.Router();
const multer = require('multer');

// Bring in Models & Utils
const Product = require('../../models/product');
const Brand = require('../../models/brand');
const Category = require('../../models/category');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const checkAuth = require('../../utils/auth');
const { escapeRegex } = require('../../utils/utils');
const { s3Upload } = require('../../utils/storage');
const { getStoreProductsQuery } = require('../../utils/queries');
const {
  asyncHandler,
  httpError,
  isObjectId,
  parsePagination
} = require('../../utils/http');
const { ROLES } = require('../../constants');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(httpError(400, 'The product image must be an image file.'));
  }
});

// multer reports its own limit errors without an HTTP status.
const uploadImage = (req, res, next) =>
  upload.single('image')(req, res, error => {
    if (!error) return next();
    if (error.status) return next(error);
    next(httpError(400, `The product image could not be uploaded (${error.code || 'invalid'}).`));
  });

// Query-string values arrive as strings, but `?x[$ne]=1` parses to an object.
const textParam = (query, key) => {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw httpError(400, `Invalid ${key} filter.`);
  return value.trim() || undefined;
};

const MAX_PRICE_FILTER = 1e9;

// Clamped to [low, high]: the Oracle Database API for MongoDB answers 500 for a
// number beyond its NUMBER range (about 1e126) that MongoDB compares happily.
// Infinity clamps too, so 1e126 and 1e400 filter alike.
const numberParam = (query, key, low, high) => {
  const value = textParam(query, key);
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : Math.min(high, Math.max(low, number));
};

const SORT_FIELDS = ['created', 'price', 'name', 'averageRating'];

// `sortOrder` is client JSON: only whitelisted fields with 1/-1 survive, and `_id`
// closes the sort so equal keys page deterministically.
const parseSortOrder = raw => {
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const sort = {};
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [field, direction] of Object.entries(parsed)) {
      if (SORT_FIELDS.includes(field) && (direction === 1 || direction === -1)) {
        sort[field] = direction;
      }
    }
  }
  if (Object.keys(sort).length === 0) sort.created = -1;

  return { ...sort, _id: 1 };
};

const parseMoney = value => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : null;
};

const parseStock = value => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isInteger(number) && number >= 0 ? number : null;
};

const parseBoolean = value => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const parseText = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

// The brand filter of a merchant is their own brand(s); admins are unscoped (null).
// A merchant account without a merchant link owns nothing: `find({ merchant:
// undefined })` would otherwise drop the condition and match every brand.
const brandScope = async user => {
  if (user.role !== ROLES.Merchant) return null;
  if (!user.merchant) return { $in: [] };

  const brands = await Brand.find({ merchant: user.merchant }).select('_id');
  return { $in: brands.map(brand => brand._id) };
};

const scopedQuery = (scope, query) => (scope ? { ...query, brand: scope } : query);

// fetch product slug api
router.get(
  '/item/:slug',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    const productDoc = await Product.findOne({ slug, isActive: true }).populate({
      path: 'brand',
      select: 'name isActive slug'
    });

    const hasNoBrand =
      productDoc?.brand === null || productDoc?.brand?.isActive === false;

    if (!productDoc || hasNoBrand) {
      throw httpError(404, 'No product found.');
    }

    res.status(200).json({
      product: productDoc
    });
  })
);

// fetch product name search api
router.get(
  '/list/search/:name',
  asyncHandler(async (req, res) => {
    const name = req.params.name;

    // The case-insensitivity flag has to live on the RegExp: the Oracle Database
    // API for MongoDB ignores the separate $options field of a find filter, which
    // silently turned every storefront search case-sensitive.
    const products = await Product.find(
      { name: { $regex: new RegExp(escapeRegex(name), 'i') }, isActive: true },
      { name: 1, slug: 1, imageUrl: 1, price: 1, _id: 0 }
    )
      .sort({ name: 1, _id: 1 })
      .limit(20);

    res.status(200).json({
      products
    });
  })
);

// fetch store products by advanced filters api
router.get(
  '/list',
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const category = textParam(req.query, 'category');
    const brand = textParam(req.query, 'brand');
    const name = textParam(req.query, 'name');
    const sort = parseSortOrder(textParam(req.query, 'sortOrder'));

    const filters = {
      min: numberParam(req.query, 'min', 0, MAX_PRICE_FILTER),
      max: numberParam(req.query, 'max', 0, MAX_PRICE_FILTER),
      rating: numberParam(req.query, 'rating', 0, 5) ?? 0
    };
    if (name) filters.name = new RegExp(escapeRegex(name.slice(0, 100)), 'i');

    // A slug that matches nothing means "nothing in that category/brand", not
    // "ignore the filter".
    const none = { products: [], totalPages: 0, currentPage: 1, count: 0 };

    if (category) {
      const categoryDoc = await Category.findOne({ slug: category, isActive: true });
      if (!categoryDoc) return res.status(200).json(none);
      filters.productIds = Array.from(categoryDoc.products);
    }

    if (brand) {
      const brandDoc = await Brand.findOne({ slug: brand, isActive: true });
      if (!brandDoc) return res.status(200).json(none);
      filters.brandId = brandDoc._id;
    }

    const [counted] = await Product.aggregate([
      ...getStoreProductsQuery(filters),
      { $count: 'count' }
    ]);
    const count = counted?.count ?? 0;
    if (count === 0) return res.status(200).json(none);

    const totalPages = Math.ceil(count / limit);
    const currentPage = Math.min(page, totalPages);

    const user = await checkAuth(req);
    const userId = user && isObjectId(user.id) ? user.id : undefined;

    const products = await Product.aggregate([
      ...getStoreProductsQuery({ ...filters, userId }),
      { $sort: sort },
      { $skip: (currentPage - 1) * limit },
      { $limit: limit }
    ]);

    res.status(200).json({
      products,
      totalPages,
      currentPage,
      count
    });
  })
);

router.get(
  '/list/select',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const scope = await brandScope(req.user);
    const products = await Product.find(scopedQuery(scope, {}), 'name');

    res.status(200).json({
      products
    });
  })
);

// add product api
router.post(
  '/add',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  uploadImage,
  asyncHandler(async (req, res) => {
    const sku = parseText(req.body.sku);
    const name = parseText(req.body.name);
    const description = parseText(req.body.description);
    const quantity = parseStock(req.body.quantity);
    const price = parseMoney(req.body.price);
    const taxable = req.body.taxable === undefined ? false : parseBoolean(req.body.taxable);
    const isActive = req.body.isActive === undefined ? true : parseBoolean(req.body.isActive);

    if (!sku) throw httpError(400, 'You must enter sku.');
    if (!description || !name) {
      throw httpError(400, 'You must enter description & name.');
    }
    if (quantity === null) {
      throw httpError(400, 'Quantity must be a whole number, 0 or more.');
    }
    if (price === null) throw httpError(400, 'You must enter a price above 0.');
    if (taxable === null || isActive === null) {
      throw httpError(400, 'Taxable and active must be true or false.');
    }

    // A merchant can only list under their own brand.
    let brand = req.body.brand;
    if (req.user.role === ROLES.Merchant) {
      const scope = await brandScope(req.user);
      brand = scope.$in[0];
      if (!brand) throw httpError(403, 'Your account has no brand to list products under.');
    } else if (brand !== undefined && brand !== '') {
      if (!isObjectId(brand) || !(await Brand.exists({ _id: brand }))) {
        throw httpError(400, 'Unknown brand.');
      }
    } else {
      brand = undefined;
    }

    if (await Product.findOne({ sku })) {
      throw httpError(400, 'This sku is already in use.');
    }

    const { imageUrl, imageKey } = await s3Upload(req.file);

    const savedProduct = await new Product({
      sku,
      name,
      description,
      quantity,
      price,
      taxable,
      isActive,
      brand,
      imageUrl,
      imageKey
    }).save();

    res.status(200).json({
      success: true,
      message: `Product has been added successfully!`,
      product: savedProduct
    });
  })
);

// fetch products api
router.get(
  '/',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const scope = await brandScope(req.user);

    const products = await Product.find(scopedQuery(scope, {})).populate({
      path: 'brand',
      populate: {
        path: 'merchant',
        model: 'Merchant'
      }
    });

    res.status(200).json({
      products
    });
  })
);

// fetch product api
router.get(
  '/:id',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const scope = await brandScope(req.user);

    const productDoc = isObjectId(productId)
      ? await Product.findOne(scopedQuery(scope, { _id: productId })).populate({
          path: 'brand',
          select: 'name'
        })
      : null;

    if (!productDoc) {
      throw httpError(404, 'No product found.');
    }

    res.status(200).json({
      product: productDoc
    });
  })
);

// Dashboard edits send only the fields that changed, so every field is optional
// and the uniqueness checks cover just the keys present. `brand` is admin-only.
const parseProductUpdate = (body, user) => {
  const input = body && typeof body === 'object' ? body : {};
  const update = {};
  const rules = {
    sku: [parseText, 'sku'],
    name: [parseText, 'name'],
    slug: [parseText, 'slug'],
    description: [parseText, 'description'],
    quantity: [parseStock, 'quantity (a whole number, 0 or more)'],
    price: [parseMoney, 'price (above 0)'],
    taxable: [parseBoolean, 'taxable'],
    isActive: [parseBoolean, 'isActive']
  };

  for (const [field, [parse, label]] of Object.entries(rules)) {
    if (input[field] === undefined) continue;
    const value = parse(input[field]);
    if (value === null) throw httpError(400, `Invalid ${label}.`);
    update[field] = value;
  }

  if (input.brand !== undefined && user.role === ROLES.Admin) {
    if (!isObjectId(input.brand)) throw httpError(400, 'Invalid brand.');
    update.brand = input.brand;
  }

  return update;
};

router.put(
  '/:id',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    if (!isObjectId(productId)) throw httpError(404, 'No product found.');

    const update = parseProductUpdate(req.body.product, req.user);
    if (Object.keys(update).length === 0) {
      throw httpError(400, 'There is nothing to update.');
    }

    const unique = ['sku', 'slug'].filter(key => update[key]).map(key => ({ [key]: update[key] }));
    if (unique.length > 0) {
      const foundProduct = await Product.findOne({ $or: unique });
      if (foundProduct && String(foundProduct._id) !== productId) {
        throw httpError(400, 'Sku or slug is already in use.');
      }
    }

    const scope = await brandScope(req.user);
    const updated = await Product.findOneAndUpdate(
      scopedQuery(scope, { _id: productId }),
      update,
      { new: true, runValidators: true }
    );
    if (!updated) throw httpError(404, 'No product found.');

    res.status(200).json({
      success: true,
      message: 'Product has been updated successfully!'
    });
  })
);

router.put(
  '/:id/active',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const isActive = parseBoolean(req.body.product?.isActive);
    if (!isObjectId(productId)) throw httpError(404, 'No product found.');
    if (isActive === null) throw httpError(400, 'isActive must be true or false.');

    const scope = await brandScope(req.user);
    const updated = await Product.findOneAndUpdate(
      scopedQuery(scope, { _id: productId }),
      { isActive },
      { new: true }
    );
    if (!updated) throw httpError(404, 'No product found.');

    res.status(200).json({
      success: true,
      message: 'Product has been updated successfully!'
    });
  })
);

router.delete(
  '/delete/:id',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    if (!isObjectId(productId)) throw httpError(404, 'No product found.');

    const scope = await brandScope(req.user);
    const product = await Product.deleteOne(scopedQuery(scope, { _id: productId }));
    if (product.deletedCount === 0) throw httpError(404, 'No product found.');

    res.status(200).json({
      success: true,
      message: `Product has been deleted successfully!`,
      product
    });
  })
);

module.exports = router;
