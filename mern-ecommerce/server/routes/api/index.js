const router = require('express').Router();
const { ragQuery, parseChatInput, warmUp } = require('../../services/llmChat');
const oracle = require('../../services/oracle');
const llm = require('../../services/llm');
const { aiLimiter } = require('../../middleware/rateLimit');
const { asyncHandler, httpError } = require('../../utils/http');

const authRoutes = require('./auth');
const userRoutes = require('./user');
const addressRoutes = require('./address');
const newsletterRoutes = require('./newsletter');
const productRoutes = require('./product');
const categoryRoutes = require('./category');
const brandRoutes = require('./brand');
const contactRoutes = require('./contact');
const merchantRoutes = require('./merchant');
const cartRoutes = require('./cart');
const orderRoutes = require('./order');
const reviewRoutes = require('./review');
const wishlistRoutes = require('./wishlist');
const adminDbRouter = require('./adminDb');
const aiRouter = require('./ai');

// auth routes
router.use('/auth', authRoutes);

// user routes
router.use('/user', userRoutes);

// address routes
router.use('/address', addressRoutes);

// newsletter routes
router.use('/newsletter', newsletterRoutes);

// product routes
router.use('/product', productRoutes);

// category routes
router.use('/category', categoryRoutes);

// brand routes
router.use('/brand', brandRoutes);

// contact routes
router.use('/contact', contactRoutes);

// merchant routes
router.use('/merchant', merchantRoutes);

// cart routes
router.use('/cart', cartRoutes);

// order routes
router.use('/order', orderRoutes);

// Review routes
router.use('/review', reviewRoutes);

// Wishlist routes
router.use('/wishlist', wishlistRoutes);

// Admin DB routes
router.use('/admin-db', adminDbRouter);

// AI routes (vector search, Select AI)
router.use('/ai', aiRouter);

// The first question otherwise pays for the connection pool, the catalogue
// aggregates and the embedding model's first run (several seconds).
if (oracle.isConfigured()) {
  warmUp().catch((error) => console.warn(`[chat] warm-up skipped: ${error.message}`));
}

// POST /chat - RAG over the migrated catalogue
router.post(
  '/chat',
  aiLimiter,
  asyncHandler(async (req, res) => {
    const { message, history } = parseChatInput(req.body);
    if (!llm.isConfigured()) {
      throw httpError(503, 'The AI assistant is not configured.', { hint: llm.status().hint });
    }
    if (!oracle.isConfigured()) {
      throw httpError(503, 'The AI assistant needs Oracle SQL access, which is not configured.', {
        hint: 'Set ORACLE_APP_USER, ORACLE_APP_PASSWORD and ORACLE_CONNECT_STRING in server/.env.'
      });
    }
    try {
      return res.json(await ragQuery({ message, history }));
    } catch (error) {
      // Retrieval and provider errors carry database and upstream text; the
      // browser gets one stable message and the details stay in the log.
      console.error('[chat] failed:', error);
      throw httpError(500, 'The assistant is unavailable right now.');
    }
  })
);

module.exports = router;
