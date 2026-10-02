const express = require('express');
const router = express.Router();

// Bring in Models & Utils
const Brand = require('../../models/brand');
const Product = require('../../models/product');
const Merchant = require('../../models/merchant');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const store = require('../../utils/store');
const { asyncHandler, httpError, isObjectId, pick } = require('../../utils/http');
const { ROLES, MERCHANT_STATUS } = require('../../constants');

const notFound = id => httpError(404, `Cannot find brand with the id: ${id}.`);

// Filter for the brands a manager may touch: all of them for an admin, only their
// own for a merchant. A merchant account without a merchant link owns nothing
// (`{ merchant: undefined }` would drop the condition and match every brand).
const managedBrands = user => {
  if (user.role !== ROLES.Merchant) return {};
  return user.merchant ? { merchant: user.merchant } : { _id: { $in: [] } };
};

const parseText = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

router.post(
  '/add',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const name = parseText(req.body.name);
    const description = parseText(req.body.description);
    const isActive = req.body.isActive === undefined ? true : req.body.isActive;

    if (!description || !name) {
      throw httpError(400, 'You must enter description & name.');
    }
    if (typeof isActive !== 'boolean') {
      throw httpError(400, 'isActive must be true or false.');
    }

    const brandDoc = await new Brand({ name, description, isActive }).save();

    res.status(200).json({
      success: true,
      message: `Brand has been added successfully!`,
      brand: brandDoc
    });
  })
);

// fetch store brands api
router.get(
  '/list',
  asyncHandler(async (req, res) => {
    const [brands, counts] = await Promise.all([
      Brand.find({ isActive: true }).populate('merchant', 'name'),
      Product.aggregate([
        { $match: { isActive: true, brand: { $ne: null } } },
        { $group: { _id: '$brand', count: { $sum: 1 } } }
      ])
    ]);

    const productCounts = new Map(counts.map(row => [String(row._id), row.count]));

    res.status(200).json({
      brands: brands.map(brand => ({
        ...brand.toObject(),
        productCount: productCounts.get(String(brand._id)) || 0
      }))
    });
  })
);

// fetch brands api
router.get(
  '/',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const brands = await Brand.find(managedBrands(req.user)).populate('merchant', 'name');

    res.status(200).json({
      brands
    });
  })
);

// Public read: a deactivated brand is not served and the owning merchant is not
// disclosed. Managers read their brands through the authenticated lists.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const brandId = req.params.id;

    const brandDoc = isObjectId(brandId)
      ? await Brand.findOne({ _id: brandId, isActive: true })
      : null;

    if (!brandDoc) throw notFound(brandId);

    res.status(200).json({
      brand: brandDoc
    });
  })
);

router.get(
  '/list/select',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const brands = await Brand.find(managedBrands(req.user), 'name');

    res.status(200).json({
      brands
    });
  })
);

router.put(
  '/:id',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!isObjectId(brandId)) throw notFound(brandId);

    // Activation goes through /:id/active (it also switches the products), and
    // the merchant link is never client-writable.
    const update = pick(req.body.brand, ['name', 'slug', 'description']);
    for (const [key, value] of Object.entries(update)) {
      if (!parseText(value)) throw httpError(400, `Invalid ${key}.`);
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, 'There is nothing to update.');
    }

    if (update.slug) {
      const foundBrand = await Brand.findOne({ slug: update.slug });
      if (foundBrand && String(foundBrand._id) !== brandId) {
        throw httpError(400, 'Slug is already in use.');
      }
    }

    const updated = await Brand.findOneAndUpdate(
      { _id: brandId, ...managedBrands(req.user) },
      update,
      { new: true }
    );
    if (!updated) throw notFound(brandId);

    res.status(200).json({
      success: true,
      message: 'Brand has been updated successfully!'
    });
  })
);

router.put(
  '/:id/active',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!isObjectId(brandId)) throw notFound(brandId);

    const { isActive } = req.body.brand || {};
    if (typeof isActive !== 'boolean') {
      throw httpError(400, 'isActive must be true or false.');
    }

    const query = { _id: brandId, ...managedBrands(req.user) };
    if (!(await Brand.exists(query))) throw notFound(brandId);

    // disable brand(brandId) products
    if (!isActive) {
      const products = await Product.find({ brand: brandId });
      await store.disableProducts(products);
    }

    await Brand.findOneAndUpdate(query, { isActive }, { new: true });

    res.status(200).json({
      success: true,
      message: 'Brand has been updated successfully!'
    });
  })
);

router.delete(
  '/delete/:id',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!isObjectId(brandId)) throw notFound(brandId);

    await deactivateMerchant(brandId);
    const brand = await Brand.deleteOne({ _id: brandId });

    res.status(200).json({
      success: true,
      message: `Brand has been deleted successfully!`,
      brand
    });
  })
);

const deactivateMerchant = async brandId => {
  const brandDoc = await Brand.findOne({ _id: brandId }).populate(
    'merchant',
    '_id'
  );
  if (!brandDoc || !brandDoc.merchant) return;
  const merchantId = brandDoc.merchant._id;
  const query = { _id: merchantId };
  const update = {
    status: MERCHANT_STATUS.Waiting_Approval,
    isActive: false,
    brand: null
  };
  return await Merchant.findOneAndUpdate(query, update, {
    new: true
  });
};

module.exports = router;
