const express = require('express');
const router = express.Router();

// Bring in Models & Utils
const Cart = require('../../models/cart');
const Order = require('../../models/order');
const auth = require('../../middleware/auth');
const store = require('../../utils/store');
const { asyncHandler, httpError, isObjectId } = require('../../utils/http');
const { CART_ITEM_STATUS } = require('../../constants');

// A cart is a private shopping list until an order references it; from then on
// it is the order's line items and must not change underneath it.
const loadOwnCart = async (req, { allowOrdered = false } = {}) => {
  const { cartId } = req.params;
  const cart = isObjectId(cartId)
    ? await Cart.findOne({ _id: cartId, user: req.user._id })
    : null;
  if (!cart) throw httpError(404, 'Cart not found.');

  if (!allowOrdered && (await Order.exists({ cart: cart._id }))) {
    throw httpError(409, 'This cart already belongs to an order.', {
      code: 'CART_ORDERED'
    });
  }

  return cart;
};

router.post(
  '/add',
  auth,
  asyncHandler(async (req, res) => {
    const lines = await store.priceItems(req.body.products);

    await store.reserveStock(lines);

    try {
      const cartDoc = await new Cart({ user: req.user._id, products: lines }).save();

      res.status(200).json({
        success: true,
        cartId: cartDoc.id
      });
    } catch (error) {
      await store.releaseStock(lines);
      throw error;
    }
  })
);

router.delete(
  '/delete/:cartId',
  auth,
  asyncHandler(async (req, res) => {
    const cart = await loadOwnCart(req);

    const result = await Cart.deleteOne({ _id: cart._id, user: req.user._id });
    if (result.deletedCount === 1) {
      await store.releaseStock(
        cart.products.filter(line => line.status !== CART_ITEM_STATUS.Cancelled)
      );
    }

    res.status(200).json({
      success: true
    });
  })
);

router.post(
  '/add/:cartId',
  auth,
  asyncHandler(async (req, res) => {
    const cart = await loadOwnCart(req);
    const [line] = await store.priceItems([req.body.product]);

    await store.reserveStock([line]);

    try {
      await Cart.updateOne({ _id: cart._id }, { $push: { products: line } });
    } catch (error) {
      await store.releaseStock([line]);
      throw error;
    }

    res.status(200).json({
      success: true
    });
  })
);

router.delete(
  '/delete/:cartId/:productId',
  auth,
  asyncHandler(async (req, res) => {
    const cart = await loadOwnCart(req);
    const { productId } = req.params;

    const removed = isObjectId(productId)
      ? cart.products.filter(line => String(line.product) === productId.toLowerCase())
      : [];

    if (removed.length > 0) {
      // Only the request whose pull actually changed the cart gives the stock back.
      const result = await Cart.updateOne(
        { _id: cart._id },
        { $pull: { products: { product: productId } } }
      );
      if (result.modifiedCount === 1) await store.releaseStock(removed);
    }

    res.status(200).json({
      success: true
    });
  })
);

module.exports = router;
