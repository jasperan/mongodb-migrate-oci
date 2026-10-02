const passport = require('passport');

// A custom callback keeps every 401 in the API's JSON error shape; the stock
// passport handler answers with a plain-text body.
const auth = (req, res, next) =>
  passport.authenticate('jwt', { session: false }, (error, user) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    return next();
  })(req, res, next);

module.exports = auth;
