const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Bring in Models & Helpers
const { EMAIL_PROVIDER, MERCHANT_STATUS, ROLES } = require('../../constants');
const Merchant = require('../../models/merchant');
const User = require('../../models/user');
const Brand = require('../../models/brand');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const { authLimiter, formLimiter } = require('../../middleware/rateLimit');
const mailgun = require('../../services/mailgun');
const keys = require('../../config/keys');
const { escapeRegex, isEmail, normalizeEmail } = require('../../utils/utils');
const { asyncHandler, httpError, pick, parsePagination, isObjectId } = require('../../utils/http');

const SIGNUP_TOKEN_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

const isText = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const merchantIdParam = req => {
  if (!isObjectId(req.params.id)) throw httpError(404, 'Merchant not found.');
  return req.params.id;
};

// add merchant api
router.post(
  '/add',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { name, business, phoneNumber, email, brandName } = req.body;

    if (!isText(name, 100) || !isEmail(email)) {
      return res
        .status(400)
        .json({ error: 'You must enter your name and a valid email.' });
    }

    if (!isText(business, 2000)) {
      return res
        .status(400)
        .json({ error: 'You must enter a business description.' });
    }

    if (!isText(phoneNumber, 40)) {
      return res
        .status(400)
        .json({ error: 'You must enter a phone number and an email address.' });
    }

    if (brandName !== undefined && !isText(brandName, 100)) {
      return res.status(400).json({ error: 'Your brand name is not valid.' });
    }

    const merchantEmail = normalizeEmail(email);
    const existingMerchant = await Merchant.findOne({ email: merchantEmail });

    if (existingMerchant) {
      return res
        .status(400)
        .json({ error: 'That email address is already in use.' });
    }

    const merchant = new Merchant({
      name,
      email: merchantEmail,
      business,
      phoneNumber,
      brandName
    });
    const merchantDoc = await merchant.save();

    await mailgun.sendEmailSafely(merchantEmail, 'merchant-application');

    res.status(200).json({
      success: true,
      message: `We received your request! we will reach you on your phone number ${phoneNumber}!`,
      merchant: merchantDoc
    });
  })
);

// search merchants api
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

    const merchants = await Merchant.find({
      $or: [
        { phoneNumber: { $regex: regex } },
        { email: { $regex: regex } },
        { name: { $regex: regex } },
        { brandName: { $regex: regex } },
        { status: { $regex: regex } }
      ]
    })
      .populate('brand', 'name')
      .limit(50);

    res.status(200).json({
      merchants
    });
  })
);

// fetch all merchants api
router.get(
  '/',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    const merchants = await Merchant.find()
      .populate('brand')
      .sort('-created')
      .limit(limit)
      .skip(skip)
      .exec();

    const count = await Merchant.countDocuments();

    res.status(200).json({
      merchants,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      count
    });
  })
);

// disable merchant account
router.put(
  '/:id/active',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const merchantId = merchantIdParam(req);
    const update = pick(req.body.merchant, ['isActive']);

    if (typeof update.isActive !== 'boolean') {
      throw httpError(400, 'isActive must be true or false.');
    }

    const merchantDoc = await Merchant.findOneAndUpdate(
      { _id: merchantId },
      { ...update, updated: Date.now() },
      { new: true }
    );
    if (!merchantDoc) throw httpError(404, 'Merchant not found.');

    if (!update.isActive) {
      await deactivateBrand(merchantId);
      await mailgun.sendEmailSafely(merchantDoc.email, 'merchant-deactivate-account');
    }

    res.status(200).json({
      success: true
    });
  })
);

// approve merchant
router.put(
  '/approve/:id',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const merchantId = merchantIdParam(req);
    const merchantDoc = await Merchant.findById(merchantId);
    if (!merchantDoc) throw httpError(404, 'Merchant not found.');

    // Checked before anything is written: approving must never demote or
    // re-link an administrator who applied (or was entered) with their address.
    const existingUser = await User.findOne({ email: merchantDoc.email });
    if (existingUser && existingUser.role === ROLES.Admin) {
      throw httpError(409, 'That email belongs to an administrator account.');
    }

    merchantDoc.set({
      status: MERCHANT_STATUS.Approved,
      isActive: true,
      updated: Date.now()
    });
    await merchantDoc.save();

    await createMerchantUser(merchantDoc, existingUser);

    res.status(200).json({
      success: true
    });
  })
);

// reject merchant
router.put(
  '/reject/:id',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const merchantDoc = await Merchant.findOneAndUpdate(
      { _id: merchantIdParam(req) },
      { status: MERCHANT_STATUS.Rejected, updated: Date.now() },
      { new: true }
    );
    if (!merchantDoc) throw httpError(404, 'Merchant not found.');

    res.status(200).json({
      success: true
    });
  })
);

router.post(
  '/signup/:token',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, firstName, lastName, password } = req.body;

    if (!isEmail(email)) {
      return res
        .status(400)
        .json({ error: 'You must enter an email address.' });
    }

    if (!isText(firstName, 100) || !isText(lastName, 100)) {
      return res.status(400).json({ error: 'You must enter your full name.' });
    }

    if (!isText(password, 200)) {
      return res.status(400).json({ error: 'You must enter a password.' });
    }

    const token = String(req.params.token);
    const userDoc = await User.findOne({
      email: normalizeEmail(email),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!userDoc) {
      return res
        .status(400)
        .json({ error: 'Your signup link is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // The token is consumed atomically: a replay (or a concurrent second
    // request) finds nothing to update. `undefined` would be dropped by
    // Mongoose, so the fields are removed with $unset.
    const consumed = await User.findOneAndUpdate(
      { _id: userDoc._id, resetPasswordToken: token },
      {
        $set: { firstName, lastName, password: hash, updated: Date.now() },
        $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 }
      }
    );
    if (!consumed) {
      return res
        .status(400)
        .json({ error: 'Your signup link is invalid or has expired.' });
    }

    const merchantDoc = await Merchant.findOne({ email: userDoc.email });
    if (merchantDoc) await createMerchantBrand(merchantDoc);

    res.status(200).json({
      success: true
    });
  })
);

router.delete(
  '/delete/:id',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const merchantId = merchantIdParam(req);
    await deactivateBrand(merchantId);
    const merchant = await Merchant.deleteOne({ _id: merchantId });

    res.status(200).json({
      success: true,
      message: `Merchant has been deleted successfully!`,
      merchant
    });
  })
);

const deactivateBrand = async merchantId => {
  const merchantDoc = await Merchant.findOne({ _id: merchantId }).populate(
    'brand',
    '_id'
  );
  if (!merchantDoc || !merchantDoc.brand) return;
  const brandId = merchantDoc.brand._id;
  const query = { _id: brandId };
  const update = {
    isActive: false
  };
  return await Brand.findOneAndUpdate(query, update, {
    new: true
  });
};

// One brand per merchant: a repeated approval or signup must not add another.
const createMerchantBrand = async ({ _id, brandName, business, brand }) => {
  if (brand) return;

  const newBrand = new Brand({
    name: brandName,
    description: business,
    merchant: _id,
    isActive: false
  });

  const brandDoc = await newBrand.save();

  const update = {
    brand: brandDoc._id
  };
  await Merchant.findOneAndUpdate({ _id }, update);
};

// A fresh random signup token with a 7-day life.
const newSignupToken = () => ({
  resetPasswordToken: crypto.randomBytes(48).toString('hex'),
  resetPasswordExpires: Date.now() + SIGNUP_TOKEN_LIFE_MS
});

const sendSignupLink = (email, resetToken) =>
  mailgun.sendEmailSafely(email, 'merchant-signup', keys.app.clientURL, {
    resetToken,
    email
  });

const createMerchantUser = async (merchantDoc, existingUser) => {
  const { email, name, _id: merchant } = merchantDoc;

  if (existingUser) {
    await createMerchantBrand(merchantDoc);

    // An account that never finished signup has no password, and the link of the
    // first approval may have expired since: re-approving must give it a usable one.
    const needsSignup =
      !existingUser.password && existingUser.provider === EMAIL_PROVIDER.Email;
    const token = needsSignup ? newSignupToken() : null;

    const userDoc = await User.findOneAndUpdate(
      { _id: existingUser._id },
      { merchant, role: ROLES.Merchant, ...token },
      { new: true }
    );

    if (token) {
      await sendSignupLink(email, token.resetPasswordToken);
    } else {
      await mailgun.sendEmailSafely(email, 'merchant-welcome', null, name);
    }

    return userDoc;
  }

  const token = newSignupToken();
  const userDoc = await new User({
    email,
    firstName: name,
    lastName: '',
    merchant,
    role: ROLES.Merchant,
    ...token
  }).save();

  await sendSignupLink(email, token.resetPasswordToken);

  return userDoc;
};

module.exports = router;
