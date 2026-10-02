const jwt = require('jsonwebtoken');

const keys = require('../config/keys');

// Optional authentication for public routes: resolves the verified token
// payload ({ id, ... }) or null. Never trusts an unsigned or expired token.
const checkAuth = async req => {
  try {
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return jwt.verify(token, keys.jwt.secret, { algorithms: ['HS256'] });
  } catch (error) {
    return null;
  }
};

module.exports = checkAuth;
