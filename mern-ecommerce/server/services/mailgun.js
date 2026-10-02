const template = require('../config/template');
const keys = require('../config/keys');

const { key, domain, sender } = keys.mailgun;

const configured = Boolean(key && domain && sender);

if (!configured) {
  console.warn('Mailgun is not configured (MAILGUN_KEY, MAILGUN_DOMAIN, MAILGUN_EMAIL_SENDER): e-mail is skipped.');
}

const isConfigured = () => configured;

const prepareTemplate = (type, host, data) => {
  switch (type) {
    case 'reset':
      return template.resetEmail(host, data);
    case 'reset-confirmation':
      return template.confirmResetPasswordEmail();
    case 'signup':
      return template.signupEmail(data);
    case 'merchant-signup':
      return template.merchantSignup(host, data);
    case 'merchant-welcome':
      return template.merchantWelcome(data);
    case 'newsletter-subscription':
      return template.newsletterSubscriptionEmail();
    case 'contact':
      return template.contactEmail();
    case 'merchant-application':
      return template.merchantApplicationEmail();
    case 'merchant-deactivate-account':
      return template.merchantDeactivateAccount();
    case 'order-confirmation':
      return template.orderConfirmationEmail(data);
    default:
      throw new Error(`Unknown e-mail type: ${type}`);
  }
};

/**
 * sendEmail(email, type, host, data)
 *  - `host` is the client base URL (e.g. http://localhost:8080) used for the
 *    links in the 'reset' and 'merchant-signup' mails; pass null otherwise.
 *  - `data` is the template payload (reset token, merchant {resetToken, email},
 *    the new user, the order, ...).
 * Resolves `{ skipped: true }` without any network call when Mailgun is not
 * configured; resolves `{ sent: true }` on success; throws an Error carrying
 * `status` when the provider fails.
 */
const sendEmail = async (email, type, host, data) => {
  const message = prepareTemplate(type, host, data);
  if (!configured) return { skipped: true };

  const body = new URLSearchParams({
    from: `MERN Store! <${sender}>`,
    to: email,
    subject: message.subject,
    text: message.text
  });

  const response = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}` },
    body,
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error(`Mailgun responded ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { sent: true };
};

/**
 * Best-effort wrapper for transactional mail: the primary operation must not
 * fail because the provider did. Logs the type and status only (no addresses).
 */
const sendEmailSafely = async (email, type, host, data) => {
  try {
    return await sendEmail(email, type, host, data);
  } catch (error) {
    console.warn(`mail ${type} failed: ${error.status || error.name || 'error'}`);
    return { failed: true };
  }
};

module.exports = { sendEmail, sendEmailSafely, isConfigured };
