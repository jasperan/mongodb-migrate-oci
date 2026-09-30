const router = require('express').Router();
const { ragQuery } = require('../../services/llmChat');

console.log('Registering /chat route');

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

// POST /chat — RAG over the migrated catalogue
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  try {
    const result = await ragQuery(message);
    if (!result.configured) {
      return res.status(503).json({ response: null, error: result.error, retrieval: result.retrieval });
    }
    return res.json({
      response: result.answer,
      model: result.model,
      retrieval: result.retrieval
    });
  } catch (err) {
    return res.status(500).json({ error: 'RAG chat failed', details: err.message });
  }
});

module.exports = router;
