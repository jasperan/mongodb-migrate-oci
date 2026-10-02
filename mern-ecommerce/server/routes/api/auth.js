const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');

const auth = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');

// Bring in Models & Helpers
const User = require('../../models/user');
const mailchimp = require('../../services/mailchimp');
const mailgun = require('../../services/mailgun');
const keys = require('../../config/keys');
const { EMAIL_PROVIDER } = require('../../constants');
const { isEmail, normalizeEmail } = require('../../utils/utils');
const { asyncHandler } = require('../../utils/http');

const { secret, tokenLife } = keys.jwt;

const RESET_TOKEN_LIFE_MS = 3600000;

// Credentials arrive as JSON, so an object such as {"$ne": null} must never
// reach a query: only plain non-empty strings are accepted.
const isText = value => typeof value === 'string' && value.length > 0;

const signToken = id => jwt.sign({ id }, secret, { expiresIn: tokenLife });

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!isText(email)) {
      return res
        .status(400)
        .json({ error: 'You must enter an email address.' });
    }

    if (!isText(password)) {
      return res.status(400).json({ error: 'You must enter a password.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res
        .status(400)
        .send({ error: 'No user found for this email address.' });
    }

    if (user.provider !== EMAIL_PROVIDER.Email) {
      return res.status(400).send({
        error: `That email address is already in use using ${user.provider} provider.`
      });
    }

    // An account created through a merchant approval has no password until
    // its owner completes the signup link.
    const isMatch = user.password
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Password Incorrect'
      });
    }

    res.status(200).json({
      success: true,
      token: `Bearer ${signToken(user.id)}`,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  })
);

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, firstName, lastName, password, isSubscribed } = req.body;

    if (!isText(email)) {
      return res
        .status(400)
        .json({ error: 'You must enter an email address.' });
    }

    if (!isEmail(email)) {
      return res
        .status(400)
        .json({ error: 'You must enter a valid email address.' });
    }

    if (!isText(firstName) || !isText(lastName)) {
      return res.status(400).json({ error: 'You must enter your full name.' });
    }

    if (!isText(password)) {
      return res.status(400).json({ error: 'You must enter a password.' });
    }

    const userEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: userEmail });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'That email address is already in use.' });
    }

    // The newsletter is an extra: a provider problem must not block sign-up.
    let subscribed = false;
    if (isSubscribed && mailchimp.isConfigured()) {
      try {
        const result = await mailchimp.subscribeToNewsletter(userEmail);
        subscribed = result.status === 'subscribed' || result.status === 'exists';
      } catch (error) {
        console.warn(`newsletter subscribe failed: ${error.status || 'error'}`);
      }
    }

    const user = new User({
      email: userEmail,
      password,
      firstName,
      lastName
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    const registeredUser = await user.save();

    await mailgun.sendEmailSafely(
      registeredUser.email,
      'signup',
      null,
      registeredUser
    );

    res.status(200).json({
      success: true,
      subscribed,
      token: `Bearer ${signToken(registeredUser.id)}`,
      user: {
        id: registeredUser.id,
        firstName: registeredUser.firstName,
        lastName: registeredUser.lastName,
        email: registeredUser.email,
        role: registeredUser.role
      }
    });
  })
);

router.post(
  '/forgot',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!isText(email)) {
      return res
        .status(400)
        .json({ error: 'You must enter an email address.' });
    }

    // Without a mail provider the link could never be delivered; creating a
    // token nobody can receive would only leave a live secret in the database.
    if (!mailgun.isConfigured()) {
      return res.status(503).json({
        error: 'Password reset e-mail is not available on this server.'
      });
    }

    const existingUser = await User.findOne({ email: normalizeEmail(email) });

    if (!existingUser) {
      return res
        .status(400)
        .send({ error: 'No user found for this email address.' });
    }

    const resetToken = crypto.randomBytes(48).toString('hex');

    existingUser.resetPasswordToken = resetToken;
    existingUser.resetPasswordExpires = Date.now() + RESET_TOKEN_LIFE_MS;
    await existingUser.save();

    try {
      await mailgun.sendEmail(
        existingUser.email,
        'reset',
        keys.app.clientURL,
        resetToken
      );
    } catch (error) {
      console.warn(`mail reset failed: ${error.status || 'error'}`);
      existingUser.resetPasswordToken = undefined;
      existingUser.resetPasswordExpires = undefined;
      await existingUser.save();
      return res.status(502).json({
        error: 'We could not send the reset e-mail. Try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Please check your email for the link to reset your password.'
    });
  })
);

router.post(
  '/reset/:token',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (!isText(password)) {
      return res.status(400).json({ error: 'You must enter a password.' });
    }

    const resetUser = await User.findOne({
      resetPasswordToken: String(req.params.token),
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!resetUser) {
      return res.status(400).json({
        error:
          'Your token has expired. Please attempt to reset your password again.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    resetUser.password = await bcrypt.hash(password, salt);
    resetUser.resetPasswordToken = undefined;
    resetUser.resetPasswordExpires = undefined;

    await resetUser.save();

    await mailgun.sendEmailSafely(resetUser.email, 'reset-confirmation');

    res.status(200).json({
      success: true,
      message:
        'Password changed successfully. Please login with your new password.'
    });
  })
);

router.post(
  '/reset',
  authLimiter,
  auth,
  asyncHandler(async (req, res) => {
    const { password, confirmPassword } = req.body;
    const email = req.user.email;

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isText(password)) {
      return res.status(400).json({ error: 'You must enter a password.' });
    }

    if (!isText(confirmPassword)) {
      return res
        .status(400)
        .json({ error: 'You must confirm your new password.' });
    }

    const existingUser = await User.findOne({ email });
    if (!existingUser || !existingUser.password) {
      return res
        .status(400)
        .json({ error: 'Please enter your correct old password.' });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ error: 'Please enter your correct old password.' });
    }

    const salt = await bcrypt.genSalt(10);
    existingUser.password = await bcrypt.hash(confirmPassword, salt);
    await existingUser.save();

    await mailgun.sendEmailSafely(existingUser.email, 'reset-confirmation');

    res.status(200).json({
      success: true,
      message:
        'Password changed successfully. Please login with your new password.'
    });
  })
);

// OAuth routes exist only when the provider is configured; otherwise the
// stock passport error would answer 500 with an HTML body.
const notConfigured = provider => (req, res) =>
  res.status(501).json({ error: `${provider} sign-in is not configured.` });

const oauthSuccess = (req, res) => {
  const jwtToken = `Bearer ${signToken(req.user.id)}`;
  res.redirect(
    `${keys.app.clientURL}/auth/success?token=${encodeURIComponent(jwtToken)}`
  );
};

const mountOAuth = (provider, strategy, configured, scope, extraOptions = {}) => {
  if (!configured) {
    router.get(`/${strategy}`, notConfigured(provider));
    router.get(`/${strategy}/callback`, notConfigured(provider));
    return;
  }

  router.get(
    `/${strategy}`,
    passport.authenticate(strategy, { session: false, scope, ...extraOptions })
  );
  router.get(
    `/${strategy}/callback`,
    passport.authenticate(strategy, {
      failureRedirect: `${keys.app.clientURL}/login`,
      session: false
    }),
    oauthSuccess
  );
};

mountOAuth('Google', 'google', Boolean(keys.google.clientID && keys.google.clientSecret), ['profile', 'email'], {
  accessType: 'offline',
  approvalPrompt: 'force'
});
mountOAuth('Facebook', 'facebook', Boolean(keys.facebook.clientID && keys.facebook.clientSecret), [
  'public_profile',
  'email'
]);

module.exports = router;
