const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const Wishlist = require('../../models/wishlist');
const Product = require('../../models/product');
const auth = require('../../middleware/auth');
const { asyncHandler, httpError, isObjectId } = require('../../utils/http');

router.post(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { product, isLiked } = req.body;

    if (!isObjectId(product) || typeof isLiked !== 'boolean') {
      throw httpError(400, 'A product and isLiked (true/false) are required.');
    }
    if (!(await Product.exists({ _id: product }))) {
      throw httpError(404, 'Product not found.');
    }

    const query = { product, user: req.user._id };
    const update = {
      product,
      isLiked,
      updated: Date.now()
    };

    const updatedWishlist = await Wishlist.findOneAndUpdate(query, update, {
      new: true
    });

    if (updatedWishlist !== null) {
      res.status(200).json({
        success: true,
        message: 'Your Wishlist has been updated successfully!',
        wishlist: updatedWishlist
      });
    } else {
      const wishlist = new Wishlist({
        product,
        isLiked,
        user: req.user._id
      });

      const wishlistDoc = await wishlist.save();

      res.status(200).json({
        success: true,
        message: `Added to your Wishlist successfully!`,
        wishlist: wishlistDoc
      });
    }
  })
);

// fetch wishlist api
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const entries = await Wishlist.find({ user: req.user._id, isLiked: true })
      .populate({
        path: 'product',
        select: 'name slug price imageUrl'
      })
      .sort('-updated');

    // A deleted product leaves a dangling reference; showing it would render an
    // empty card, so it is dropped here.
    const wishlist = entries.filter(entry => entry.product);

    res.status(200).json({
      wishlist
    });
  })
);

// remove an entry by its own id
router.delete(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) throw httpError(404, 'Wishlist entry not found.');

    const result = await Wishlist.deleteOne({
      _id: req.params.id,
      user: req.user._id
    });
    if (result.deletedCount === 0) throw httpError(404, 'Wishlist entry not found.');

    res.status(200).json({
      success: true,
      message: 'Removed from your Wishlist successfully!'
    });
  })
);

module.exports = router;
