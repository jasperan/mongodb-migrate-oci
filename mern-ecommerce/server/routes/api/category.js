const express = require('express');
const router = express.Router();

// Bring in Models & Utils
const Category = require('../../models/category');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const store = require('../../utils/store');
const { asyncHandler, httpError, isObjectId, pick } = require('../../utils/http');
const { ROLES } = require('../../constants');

const notFound = () => httpError(404, 'No Category found.');

const parseText = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

const parseProducts = value =>
  Array.isArray(value) && value.every(isObjectId) ? value : null;

router.post(
  '/add',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const name = parseText(req.body.name);
    const description = parseText(req.body.description);
    const products = req.body.products === undefined ? [] : parseProducts(req.body.products);
    const isActive = req.body.isActive === undefined ? true : req.body.isActive;

    if (!description || !name) {
      throw httpError(400, 'You must enter description & name.');
    }
    if (products === null) throw httpError(400, 'Invalid products.');
    if (typeof isActive !== 'boolean') {
      throw httpError(400, 'isActive must be true or false.');
    }

    const data = await new Category({ name, description, products, isActive }).save();

    res.status(200).json({
      success: true,
      message: `Category has been added successfully!`,
      category: data
    });
  })
);

// fetch store categories api
router.get(
  '/list',
  asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true });
    res.status(200).json({
      categories
    });
  })
);

// fetch categories api (manager list, inactive ones included)
router.get(
  '/',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const categories = await Category.find({});
    res.status(200).json({
      categories
    });
  })
);

// fetch category api
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const categoryId = req.params.id;

    const categoryDoc = isObjectId(categoryId)
      ? await Category.findOne({ _id: categoryId, isActive: true }).populate({
          path: 'products',
          select: 'name'
        })
      : null;

    if (!categoryDoc) throw notFound();

    res.status(200).json({
      category: categoryDoc
    });
  })
);

router.put(
  '/:id',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    if (!isObjectId(categoryId)) throw notFound();

    const update = pick(req.body.category, ['name', 'slug', 'description', 'products']);
    for (const key of ['name', 'slug', 'description']) {
      if (key in update && !parseText(update[key])) throw httpError(400, `Invalid ${key}.`);
    }
    if ('products' in update && parseProducts(update.products) === null) {
      throw httpError(400, 'Invalid products.');
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, 'There is nothing to update.');
    }

    if (update.slug) {
      const foundCategory = await Category.findOne({ slug: update.slug });
      if (foundCategory && String(foundCategory._id) !== categoryId) {
        throw httpError(400, 'Slug is already in use.');
      }
    }

    const updated = await Category.findOneAndUpdate({ _id: categoryId }, update, {
      new: true
    });
    if (!updated) throw notFound();

    res.status(200).json({
      success: true,
      message: 'Category has been updated successfully!'
    });
  })
);

router.put(
  '/:id/active',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    if (!isObjectId(categoryId)) throw notFound();

    const { isActive } = req.body.category || {};
    if (typeof isActive !== 'boolean') {
      throw httpError(400, 'isActive must be true or false.');
    }

    // disable category(categoryId) products
    if (!isActive) {
      const categoryDoc = await Category.findOne(
        { _id: categoryId, isActive: true },
        'products -_id'
      ).populate('products');

      if (categoryDoc) await store.disableProducts(categoryDoc.products);
    }

    const updated = await Category.findOneAndUpdate(
      { _id: categoryId },
      { isActive },
      { new: true }
    );
    if (!updated) throw notFound();

    res.status(200).json({
      success: true,
      message: 'Category has been updated successfully!'
    });
  })
);

router.delete(
  '/delete/:id',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    if (!isObjectId(categoryId)) throw notFound();

    const product = await Category.deleteOne({ _id: categoryId });
    if (product.deletedCount === 0) throw notFound();

    res.status(200).json({
      success: true,
      message: `Category has been deleted successfully!`,
      product
    });
  })
);

module.exports = router;
