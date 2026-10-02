const keys = require('../config/keys');

const { key, listKey } = keys.mailchimp;

// A Mailchimp key ends with its data centre: `<hex>-us21`.
const dataCenter = key && key.includes('-') ? key.split('-').pop() : null;
const configured = Boolean(key && listKey && dataCenter);

if (!configured) {
  console.warn('Mailchimp is not configured (MAILCHIMP_KEY, MAILCHIMP_LIST_KEY): newsletter sign-up is unavailable.');
}

const isConfigured = () => configured;

/**
 * Subscribes an address. Resolves `{ status: 'subscribed' }` or
 * `{ status: 'exists' }` (the member is already on the list); throws an Error
 * with `status` (HTTP status of the provider, 0 when unreachable) and `title`
 * (the provider's error title, e.g. "Invalid Resource") otherwise.
 */
const subscribeToNewsletter = async email => {
  if (!configured) {
    const error = new Error('Mailchimp is not configured');
    error.status = 0;
    throw error;
  }

  const response = await fetch(
    `https://${dataCenter}.api.mailchimp.com/3.0/lists/${encodeURIComponent(listKey)}/members`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email_address: email, status: 'subscribed' }),
      signal: AbortSignal.timeout(10000)
    }
  );

  if (response.ok) return { status: 'subscribed' };

  const detail = await response.json().catch(() => ({}));
  if (response.status === 400 && detail.title === 'Member Exists') return { status: 'exists' };

  const error = new Error(`Mailchimp responded ${response.status}`);
  error.status = response.status;
  error.title = detail.title;
  throw error;
};

module.exports = { subscribeToNewsletter, isConfigured };
