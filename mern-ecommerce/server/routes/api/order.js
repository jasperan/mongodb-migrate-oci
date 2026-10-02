const express = require('express');
const router = express.Router();

// Bring in Models & Utils
const Order = require('../../models/order');
const Cart = require('../../models/cart');
const Product = require('../../models/product');
const Brand = require('../../models/brand');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const mailgun = require('../../services/mailgun');
const store = require('../../utils/store');
const {
  asyncHandler,
  httpError,
  isObjectId,
  parsePagination
} = require('../../utils/http');
const { ROLES, CART_ITEM_STATUS } = require('../../constants');

const withLines = query =>
  query.populate({
    path: 'cart',
    populate: {
      path: 'products.product',
      populate: {
        path: 'brand'
      }
    }
  });

const isOwner = (order, user) => String(order.user) === String(user._id);

// Confirmation mail is best-effort: sendEmailSafely never throws, and the
// response does not wait for the provider.
const notifyOrderPlaced = (user, order, lines) => {
  mailgun.sendEmailSafely(user.email, 'order-confirmation', null, {
    order: {
      _id: order._id,
      created: order.created,
      total: order.total,
      products: lines
    },
    user
  });
};

// Everything checkout created or took is undone, so a failure leaves neither a
// reserved unit nor an orphan cart behind.
const rollbackCheckout = async (cart, lines) => {
  if (cart) await Cart.deleteOne({ _id: cart._id });
  await store.releaseStock(lines);
};

router.post(
  '/checkout',
  auth,
  asyncHandler(async (req, res) => {
    const lines = await store.priceItems(req.body.products);

    await store.reserveStock(lines);

    let cartDoc = null;
    let orderDoc = null;
    try {
      cartDoc = await new Cart({ user: req.user._id, products: lines }).save();
      orderDoc = await new Order({
        cart: cartDoc._id,
        user: req.user._id,
        total: store.linesTotal(lines)
      }).save();
    } catch (error) {
      await rollbackCheckout(cartDoc, lines);
      throw error;
    }

    notifyOrderPlaced(req.user, orderDoc, lines);

    res.status(200).json({
      success: true,
      message: `Your order has been placed successfully!`,
      order: { _id: orderDoc._id, total: orderDoc.total, created: orderDoc.created }
    });
  })
);

router.post(
  '/add',
  auth,
  asyncHandler(async (req, res) => {
    const { cartId } = req.body;
    if (!isObjectId(cartId)) throw httpError(400, 'A valid cartId is required.');

    const cart = await Cart.findOne({ _id: cartId, user: req.user._id });
    if (!cart || cart.products.length === 0) {
      throw httpError(400, 'Cart not found.');
    }
    if (await Order.exists({ cart: cart._id })) {
      throw httpError(400, 'This cart has already been ordered.');
    }

    // The total never comes from the request.
    const orderDoc = await new Order({
      cart: cart._id,
      user: req.user._id,
      total: store.linesTotal(cart.products)
    }).save();

    // Nothing enforces one order per cart in the database, so of two orders that
    // raced for the same cart the one created first stays.
    const [winner] = await Order.find({ cart: cart._id }).sort({ _id: 1 }).limit(1);
    if (String(winner._id) !== String(orderDoc._id)) {
      await Order.deleteOne({ _id: orderDoc._id });
      throw httpError(400, 'This cart has already been ordered.');
    }

    // DELETE /cart/delete checks for an order and then deletes the cart, so the two
    // can interleave: the stock of a vanished cart is already released, which means
    // an order that outlives its cart would sell units that are back on the shelf.
    if (!(await Cart.exists({ _id: cart._id }))) {
      await Order.deleteOne({ _id: orderDoc._id });
      throw httpError(409, 'This cart was deleted while the order was placed.');
    }

    notifyOrderPlaced(req.user, orderDoc, cart.products);

    res.status(200).json({
      success: true,
      message: `Your order has been placed successfully!`,
      order: { _id: orderDoc._id, total: orderDoc.total, created: orderDoc.created }
    });
  })
);

// search orders api
router.get(
  '/search',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const { search } = req.query;

    if (!isObjectId(search)) {
      return res.status(200).json({
        orders: []
      });
    }

    const ordersDoc = (await withLines(Order.find({ _id: search }))).filter(
      order => order.cart
    );

    const orders = ordersDoc
      .map(o =>
        store.caculateTaxAmount({
          _id: o._id,
          total: parseFloat(Number(o.total.toFixed(2))),
          created: o.created,
          products: o.cart?.products
        })
      )
      .sort((a, b) => b.created - a.created);

    res.status(200).json({
      orders
    });
  })
);

const listOrders = async (req, res, query) => {
  const { page, limit, skip } = parsePagination(req.query);

  const ordersDoc = await withLines(Order.find(query).sort('-created'))
    .limit(limit)
    .skip(skip)
    .exec();

  const count = await Order.countDocuments(query);

  res.status(200).json({
    orders: store.formatOrders(ordersDoc),
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    count
  });
};

// fetch orders api
router.get(
  '/',
  auth,
  role.check(ROLES.Admin),
  asyncHandler((req, res) => listOrders(req, res, {}))
);

// fetch my orders api
router.get(
  '/me',
  auth,
  asyncHandler((req, res) => listOrders(req, res, { user: req.user._id }))
);

// fetch order api
router.get(
  '/:orderId',
  auth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const query = isObjectId(orderId) ? { _id: orderId } : null;
    if (query && req.user.role !== ROLES.Admin) query.user = req.user._id;

    const orderDoc = query ? await withLines(Order.findOne(query)) : null;

    if (!orderDoc || !orderDoc.cart) {
      throw httpError(404, 'Order not found.');
    }

    const order = store.caculateTaxAmount({
      _id: orderDoc._id,
      total: orderDoc.total,
      created: orderDoc.created,
      totalTax: 0,
      products: orderDoc.cart.products,
      cartId: orderDoc.cart._id
    });

    res.status(200).json({
      order
    });
  })
);

router.delete(
  '/cancel/:orderId',
  auth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const query = isObjectId(orderId) ? { _id: orderId } : null;
    if (query && req.user.role !== ROLES.Admin) query.user = req.user._id;

    const order = query ? await Order.findOne(query) : null;
    if (!order) throw httpError(404, 'Order not found.');

    const cart = await Cart.findById(order.cart);

    if (cart) {
      const dispatched = cart.products.some(
        line =>
          line.status === CART_ITEM_STATUS.Shipped ||
          line.status === CART_ITEM_STATUS.Delivered
      );
      if (dispatched) {
        throw httpError(
          409,
          'An order with shipped or delivered items cannot be cancelled.',
          { code: 'ORDER_DISPATCHED' }
        );
      }

      // Lines already cancelled one by one were restocked then; cancelLine
      // restocks each remaining line exactly once.
      for (const line of cart.products) {
        await store.cancelLine(cart, line);
      }
    }

    await Order.deleteOne({ _id: order._id });
    if (cart) await Cart.deleteOne({ _id: cart._id });

    res.status(200).json({
      success: true
    });
  })
);

// A merchant fulfils the lines of products that belong to their own brand, and
// only while their merchant account is active (a disabled or deleted merchant
// keeps ROLE MERCHANT on the user row but loses every merchant privilege).
const merchantOwnsLine = async (user, line) => {
  if (!(await role.isActiveMerchant(user))) return false;

  const product = await Product.findById(line.product).select('brand');
  if (!product || !product.brand) return false;

  return Boolean(await Brand.exists({ _id: product.brand, merchant: user.merchant }));
};

// A customer may cancel a line until it ships; cancelling an already cancelled
// line is a harmless repeat (it restocks nothing).
const CUSTOMER_CANCELLABLE = [
  CART_ITEM_STATUS.Not_processed,
  CART_ITEM_STATUS.Processing,
  CART_ITEM_STATUS.Cancelled
];

router.put(
  '/status/item/:itemId',
  auth,
  asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const status = req.body.status || CART_ITEM_STATUS.Cancelled;

    if (!Object.values(CART_ITEM_STATUS).includes(status)) {
      throw httpError(400, 'Unknown item status.');
    }

    // The order and cart are derived from the item; ids in the body are ignored.
    const cart = isObjectId(itemId) ? await Cart.findOne({ 'products._id': itemId }) : null;
    const order = cart ? await Order.findOne({ cart: cart._id }) : null;
    if (!order) throw httpError(404, 'Order item not found.');

    const isAdmin = req.user.role === ROLES.Admin;
    const owner = isOwner(order, req.user);
    const line = cart.products.id(itemId);
    const manager = isAdmin || (await merchantOwnsLine(req.user, line));

    if (!manager && !owner) {
      // Same answer role.check gives a disabled merchant on every other route.
      if (req.user.role === ROLES.Merchant && !(await role.isActiveMerchant(req.user))) {
        throw httpError(403, 'Your merchant account is disabled.');
      }
      throw httpError(404, 'Order item not found.');
    }

    if (!manager) {
      const allowed =
        status === CART_ITEM_STATUS.Cancelled && CUSTOMER_CANCELLABLE.includes(line.status);
      if (!allowed) {
        throw httpError(403, 'You are not allowed to make this request.');
      }
    }

    if (line.status === CART_ITEM_STATUS.Cancelled && status !== CART_ITEM_STATUS.Cancelled) {
      throw httpError(400, 'A cancelled item cannot be changed.');
    }

    if (status !== CART_ITEM_STATUS.Cancelled) {
      // Repeating the current status is a harmless no-op (the update would match
      // but modify nothing), so only a vanished or cancelled line is an error.
      if (line.status !== status && !(await store.setLineStatus(cart, line, status))) {
        throw httpError(409, 'A cancelled item cannot be changed.');
      }

      return res.status(200).json({
        success: true,
        message: 'Item status has been updated successfully!'
      });
    }

    await store.cancelLine(cart, line);

    const current = await Cart.findById(cart._id);
    const allCancelled =
      !current || current.products.every(item => item.status === CART_ITEM_STATUS.Cancelled);

    // All items are cancelled => Cancel order
    if (allCancelled) {
      await Order.deleteOne({ _id: order._id });
      await Cart.deleteOne({ _id: cart._id });

      return res.status(200).json({
        success: true,
        orderCancelled: true,
        message: `${isAdmin ? 'Order' : 'Your order'} has been cancelled successfully`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item has been cancelled successfully!'
    });
  })
);

module.exports = router;
