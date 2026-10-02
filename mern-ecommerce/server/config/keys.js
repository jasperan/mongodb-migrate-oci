const jwtSecret = process.env.JWT_SECRET;

// A missing or published-placeholder secret lets anyone mint valid tokens, so
// the process refuses to start instead of running with it.
if (!jwtSecret || jwtSecret === 'update_your_JWT_secret') {
  console.error('JWT_SECRET is missing or still the placeholder. Set a random value of at least 32 characters.');
  process.exit(1);
}
if (jwtSecret.length < 32) {
  console.warn('JWT_SECRET is shorter than 32 characters; use a longer random value.');
}

module.exports = {
  app: {
    name: 'Mern Ecommerce',
    apiURL: `${process.env.BASE_API_URL}`,
    clientURL: process.env.CLIENT_URL
  },
  // Browser origins allowed to call the API and open the support socket.
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:8080')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  port: process.env.PORT || 3000,
  database: {
    url: process.env.MONGO_URI
  },
  jwt: {
    secret: jwtSecret,
    tokenLife: '7d'
  },
  mailchimp: {
    key: process.env.MAILCHIMP_KEY,
    listKey: process.env.MAILCHIMP_LIST_KEY
  },
  mailgun: {
    key: process.env.MAILGUN_KEY,
    domain: process.env.MAILGUN_DOMAIN,
    sender: process.env.MAILGUN_EMAIL_SENDER
  },
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  facebook: {
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL
  }
};
