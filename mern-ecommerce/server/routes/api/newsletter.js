const express = require('express');
const router = express.Router();

const mailchimp = require('../../services/mailchimp');
const mailgun = require('../../services/mailgun');
const { formLimiter } = require('../../middleware/rateLimit');
const { isEmail, normalizeEmail } = require('../../utils/utils');
const { asyncHandler } = require('../../utils/http');

router.post(
  '/subscribe',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res
        .status(400)
        .json({ error: 'You must enter an email address.' });
    }

    if (!isEmail(email.trim())) {
      return res
        .status(400)
        .json({ error: 'You must enter a valid email address.' });
    }

    if (!mailchimp.isConfigured()) {
      return res
        .status(503)
        .json({ error: 'Newsletter sign-up is not available right now.' });
    }

    const subscriberEmail = normalizeEmail(email);

    let result;
    try {
      result = await mailchimp.subscribeToNewsletter(subscriberEmail);
    } catch (error) {
      console.warn(`newsletter subscribe failed: ${error.status || 'error'}`);
      if (error.status === 400) {
        return res.status(400).json({
          error: 'We could not subscribe that email address. Please check it and try again.'
        });
      }
      return res
        .status(502)
        .json({ error: 'The newsletter service is unavailable. Try again later.' });
    }

    if (result.status === 'exists') {
      return res
        .status(200)
        .json({ success: true, message: "You're already subscribed." });
    }

    await mailgun.sendEmailSafely(subscriberEmail, 'newsletter-subscription');

    res.status(200).json({
      success: true,
      message: 'You have successfully subscribed to the newsletter'
    });
  })
);

module.exports = router;
