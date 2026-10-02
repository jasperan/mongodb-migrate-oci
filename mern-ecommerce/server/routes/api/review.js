const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const Review = require('../../models/review');
const Product = require('../../models/product');
const User = require('../../models/user');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const checkAuth = require('../../utils/auth');
const { REVIEW_STATUS, ROLES } = require('../../constants');
const { asyncHandler, httpError, pick, parsePagination, isObjectId } = require('../../utils/http');

const EDITABLE_FIELDS = ['title', 'review', 'rating', 'isRecommended'];

// Validates and normalises the author-editable fields; `partial` allows an
// edit that sends only some of them.
const readReviewFields = (body, { partial }) => {
  const fields = pick(body, EDITABLE_FIELDS);

  if (!partial || 'rating' in fields) {
    if (!Number.isInteger(fields.rating) || fields.rating < 1 || fields.rating > 5) {
      throw httpError(400, 'Rating must be a whole number between 1 and 5.');
    }
  }
  for (const key of ['title', 'review']) {
    if (key in fields && (typeof fields[key] !== 'string' || fields[key].length > 2000)) {
      throw httpError(400, `Your ${key} is not valid.`);
    }
  }
  if ('isRecommended' in fields && typeof fields.isRecommended !== 'boolean') {
    throw httpError(400, 'isRecommended must be true or false.');
  }
  return fields;
};

// The caller may edit or delete a review when they wrote it or are an admin.
const findManageableReview = async req => {
  if (!isObjectId(req.params.id)) throw httpError(404, 'Review not found.');

  const reviewDoc = await Review.findById(req.params.id);
  const isOwner = reviewDoc && String(reviewDoc.user) === String(req.user._id);
  if (!reviewDoc || (!isOwner && req.user.role !== ROLES.Admin)) {
    throw httpError(404, 'Review not found.');
  }
  return reviewDoc;
};

router.post(
  '/add',
  auth,
  asyncHandler(async (req, res) => {
    const fields = readReviewFields(req.body, { partial: false });
    const { product } = req.body;

    if (!isObjectId(product) || !(await Product.exists({ _id: product }))) {
      throw httpError(400, 'That product does not exist.');
    }

    const review = new Review({
      ...fields,
      product,
      user: req.user._id,
      status: REVIEW_STATUS.Waiting_Approval
    });
    const reviewDoc = await review.save();

    res.status(200).json({
      success: true,
      message: `Your review has been added successfully and will appear when approved!`,
      review: reviewDoc
    });
  })
);

// fetch all reviews api: the public sees approved reviews only, an admin sees
// every status and can filter by it.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    const payload = await checkAuth(req);
    const caller = payload && isObjectId(String(payload.id))
      ? await User.findById(payload.id).select('role')
      : null;
    const isAdmin = Boolean(caller && caller.role === ROLES.Admin);

    const filter = { status: REVIEW_STATUS.Approved };
    if (isAdmin) {
      delete filter.status;
      if (typeof req.query.status === 'string' && req.query.status) {
        if (!Object.values(REVIEW_STATUS).includes(req.query.status)) {
          throw httpError(400, 'Unknown review status.');
        }
        filter.status = req.query.status;
      }
    }

    const reviews = await Review.find(filter)
      .sort('-created')
      .populate({
        path: 'user',
        select: 'firstName'
      })
      .populate({
        path: 'product',
        select: 'name slug imageUrl'
      })
      .limit(limit)
      .skip(skip)
      .exec();

    const count = await Review.countDocuments(filter);

    res.status(200).json({
      reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      count
    });
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const productDoc = await Product.findOne({ slug: String(req.params.slug) }).populate({
      path: 'brand',
      select: 'isActive'
    });

    const hasNoBrand =
      productDoc?.brand === null || productDoc?.brand?.isActive === false;

    if (!productDoc || hasNoBrand) {
      throw httpError(404, 'No product found.');
    }

    const reviews = await Review.find({
      product: productDoc._id,
      status: REVIEW_STATUS.Approved
    })
      .populate({
        path: 'user',
        select: 'firstName'
      })
      .sort('-created');

    res.status(200).json({
      reviews
    });
  })
);

router.put(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const reviewDoc = await findManageableReview(req);
    const fields = readReviewFields(req.body, { partial: true });

    // Any edit goes back through moderation, including an admin's own.
    reviewDoc.set({
      ...fields,
      status: REVIEW_STATUS.Waiting_Approval,
      updated: Date.now()
    });
    await reviewDoc.save();

    res.status(200).json({
      success: true,
      message: 'review has been updated successfully!'
    });
  })
);

const moderate = status =>
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.reviewId)) throw httpError(404, 'Review not found.');

    const reviewDoc = await Review.findOneAndUpdate(
      { _id: req.params.reviewId },
      { status, updated: Date.now() },
      { new: true }
    );
    if (!reviewDoc) throw httpError(404, 'Review not found.');

    res.status(200).json({
      success: true
    });
  });

// approve review
router.put(
  '/approve/:reviewId',
  auth,
  role.check(ROLES.Admin),
  moderate(REVIEW_STATUS.Approved)
);

// reject review
router.put(
  '/reject/:reviewId',
  auth,
  role.check(ROLES.Admin),
  moderate(REVIEW_STATUS.Rejected)
);

router.delete(
  '/delete/:id',
  auth,
  asyncHandler(async (req, res) => {
    const reviewDoc = await findManageableReview(req);
    const review = await Review.deleteOne({ _id: reviewDoc._id });

    res.status(200).json({
      success: true,
      message: `review has been deleted successfully!`,
      review
    });
  })
);

module.exports = router;
