const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const User = require('../../models/user');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const { ROLES } = require('../../constants');
const { escapeRegex } = require('../../utils/utils');
const { asyncHandler, httpError, pick, parsePagination } = require('../../utils/http');

// Credentials and account-linking data never leave the server.
const HIDDEN_FIELDS =
  '-password -resetPasswordToken -resetPasswordExpires -googleId -facebookId';

const PROFILE_FIELDS = ['firstName', 'lastName', 'phoneNumber', 'avatar'];

// search users api
router.get(
  '/search',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const { search } = req.query;

    if (typeof search !== 'string' || !search.trim()) {
      throw httpError(400, 'You must enter a search term.');
    }

    const regex = new RegExp(escapeRegex(search.trim()), 'i');

    const users = await User.find({
      $or: [
        { firstName: { $regex: regex } },
        { lastName: { $regex: regex } },
        { email: { $regex: regex } }
      ]
    })
      .select(`${HIDDEN_FIELDS} -_id`)
      .populate('merchant', 'name')
      .limit(50);

    res.status(200).json({ users });
  })
);

// fetch users api
router.get(
  '/',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    const users = await User.find()
      .select(`${HIDDEN_FIELDS} -_id`)
      .sort('-created')
      .populate('merchant', 'name')
      .limit(limit)
      .skip(skip)
      .exec();

    const count = await User.countDocuments();

    res.status(200).json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      count
    });
  })
);

router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user._id)
      .select(HIDDEN_FIELDS)
      .populate({
        path: 'merchant',
        model: 'Merchant',
        populate: {
          path: 'brand',
          model: 'Brand'
        }
      });

    res.status(200).json({
      user: userDoc
    });
  })
);

router.put(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const update = pick(req.body.profile, PROFILE_FIELDS);

    for (const value of Object.values(update)) {
      if (typeof value !== 'string') {
        throw httpError(400, 'Your profile is not valid.');
      }
    }

    update.updated = Date.now();

    let userDoc;
    try {
      userDoc = await User.findOneAndUpdate({ _id: req.user._id }, update, {
        new: true,
        runValidators: true
      }).select(HIDDEN_FIELDS);
    } catch (error) {
      throw httpError(400, 'Your profile is not valid.');
    }

    res.status(200).json({
      success: true,
      message: 'Your profile is successfully updated!',
      user: userDoc
    });
  })
);

module.exports = router;
