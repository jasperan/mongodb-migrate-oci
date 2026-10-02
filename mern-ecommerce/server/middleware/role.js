const Merchant = require('../models/merchant');
const { ROLES } = require('../constants');

// A merchant disabled by an admin keeps the ROLE MERCHANT on the user row, so
// the merchant record decides whether the role still counts. Anything that lets
// a merchant act outside role.check (e.g. order lines) must ask this too.
const isActiveMerchant = async user => {
  if (!user || user.role !== ROLES.Merchant || !user.merchant) return false;

  const merchant = await Merchant.findById(user.merchant).select('isActive');
  return Boolean(merchant && merchant.isActive);
};

const check =
  (...roles) =>
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!roles.includes(req.user.role)) {
        return res
          .status(403)
          .json({ error: 'You are not allowed to make this request.' });
      }

      if (req.user.role === ROLES.Merchant && !(await isActiveMerchant(req.user))) {
        return res
          .status(403)
          .json({ error: 'Your merchant account is disabled.' });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

const role = { check, isActiveMerchant };
module.exports = role;
