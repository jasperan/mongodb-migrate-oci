const router = require('express').Router();
const apiRoutes = require('./api');

// Mount all API routes at /api
router.use('/api', apiRoutes);

module.exports = router;