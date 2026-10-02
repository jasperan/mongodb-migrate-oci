const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const Contact = require('../../models/contact');
const mailgun = require('../../services/mailgun');
const { formLimiter } = require('../../middleware/rateLimit');
const { isEmail, normalizeEmail } = require('../../utils/utils');
const { asyncHandler } = require('../../utils/http');

router.post(
  '/add',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, message } = req.body;

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

    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res
        .status(400)
        .json({ error: 'You must enter description & name.' });
    }

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'You must enter a message.' });
    }

    if (message.length > 2000) {
      return res
        .status(400)
        .json({ error: 'Your message must be 2000 characters or fewer.' });
    }

    const contactEmail = normalizeEmail(email);
    const contactDoc = await new Contact({
      name,
      email: contactEmail,
      message
    }).save();

    await mailgun.sendEmailSafely(contactEmail, 'contact');

    res.status(200).json({
      success: true,
      message: `We receved your message, we will reach you on your email address ${contactEmail}!`,
      contact: contactDoc
    });
  })
);

module.exports = router;
