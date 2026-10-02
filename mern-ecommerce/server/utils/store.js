const Brand = require('../models/brand');
const Product = require('../models/product');
const Cart = require('../models/cart');
const taxConfig = require('../config/tax');
const { CART_ITEM_STATUS } = require('../constants');
const { httpError, isObjectId } = require('./http');

const MAX_CART_LINES = 50;
const MAX_LINE_QUANTITY = 99;

const round2 = value => parseFloat(Number(value).toFixed(2));

// Sales tax of `quantity` units at `price` (taxable products only).
const lineTax = (price, quantity) => {
  const taxAmount = price * (taxConfig.stateTaxRate / 100) * 100;
  return round2(taxAmount * quantity);
};
exports.lineTax = lineTax;

const invalidCart = message => httpError(400, message, { code: 'INVALID_CART' });

const unavailable = product =>
  httpError(409, 'A product in your cart is no longer available.', {
    code: 'PRODUCT_UNAVAILABLE',
    product: String(product)
  });

// Products of an inactive brand are deactivated one by one, so the stock of each
// is written in a single awaited bulk operation.
exports.disableProducts = async products => {
  if (!products || products.length === 0) return;

  await Product.bulkWrite(
    products.map(item => ({
      updateOne: {
        filter: { _id: item._id },
        update: { isActive: false }
      }
    }))
  );
};

// calculate order tax amount
exports.caculateTaxAmount = order => {
  try {
    order.totalTax = 0;
    if (order.products && order.products.length > 0) {
      order.products.map(item => {
        const price = item.purchasePrice || (item?.product?.price ?? 0);
        const quantity = item.quantity;
        item.totalPrice = price * quantity;
        item.purchasePrice = price;

        if (item.status !== CART_ITEM_STATUS.Cancelled) {
          if (item.product?.taxable && item.priceWithTax === 0) {
            item.totalTax = lineTax(price, quantity);

            order.totalTax += item.totalTax;
          } else {
            order.totalTax += item.totalTax;
          }
        }

        item.priceWithTax = round2(item.totalPrice + item.totalTax);
      });
    }

    const hasCancelledItems = order.products.filter(
      item => item.status === CART_ITEM_STATUS.Cancelled
    );

    if (hasCancelledItems.length > 0) {
      order.total = this.caculateOrderTotal(order);
    }

    const currentTotal = this.caculateOrderTotal(order);

    if (currentTotal !== order.total) {
      order.total = this.caculateOrderTotal(order);
    }

    order.totalWithTax = order.total + order.totalTax;
    order.total = round2(order.total);
    order.totalTax = parseFloat(
      Number(order.totalTax && order.totalTax.toFixed(2))
    );
    order.totalWithTax = round2(order.totalWithTax);
    return order;
  } catch (error) {
    return order;
  }
};

exports.caculateOrderTotal = order => {
  const total = order.products
    .filter(item => item.status !== CART_ITEM_STATUS.Cancelled)
    .reduce((sum, current) => sum + current.totalPrice, 0);

  return total;
};

/**
 * Validates the `[{ product, quantity }]` a client sends for a cart or checkout
 * and merges duplicate products. Anything besides the product id and quantity
 * (price, tax flag, ...) is ignored: those come from the database.
 */
exports.normalizeItems = items => {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CART_LINES) {
    throw invalidCart(`A cart needs between 1 and ${MAX_CART_LINES} items.`);
  }

  const merged = new Map();
  for (const item of items) {
    const id = typeof item?.product === 'string' ? item.product.toLowerCase() : null;
    if (!isObjectId(id)) throw invalidCart('Every item needs a valid product id.');

    const quantity = item.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw invalidCart(`Quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}.`);
    }

    const total = (merged.get(id) || 0) + quantity;
    if (total > MAX_LINE_QUANTITY) {
      throw invalidCart(`You can order at most ${MAX_LINE_QUANTITY} units of one product.`);
    }
    merged.set(id, total);
  }

  return [...merged].map(([product, quantity]) => ({ product, quantity }));
};

/**
 * Cart lines priced from the Product documents: price and tax flag come from the
 * database, never from the request. Throws PRODUCT_UNAVAILABLE for a product that
 * does not exist or is not for sale. Stock is checked when it is reserved.
 */
exports.priceItems = async items => {
  const wanted = exports.normalizeItems(items);
  const products = await Product.find({
    _id: { $in: wanted.map(item => item.product) }
  }).select('name price taxable isActive brand');
  const byId = new Map(products.map(product => [String(product._id), product]));

  // For sale means the product and its brand are active, as in the storefront
  // queries; disabling a merchant only deactivates the brand.
  const brandIds = [...new Set(products.map(product => product.brand).filter(Boolean).map(String))];
  const activeBrands = new Set(
    (await Brand.find({ _id: { $in: brandIds }, isActive: true }).select('_id')).map(brand =>
      String(brand._id)
    )
  );

  return wanted.map(({ product: id, quantity }) => {
    const product = byId.get(id);
    if (!product || !product.isActive || !activeBrands.has(String(product.brand))) {
      throw unavailable(id);
    }

    const totalPrice = round2(product.price * quantity);
    const totalTax = product.taxable ? lineTax(product.price, quantity) : 0;

    return {
      product: id,
      quantity,
      purchasePrice: product.price,
      totalPrice,
      totalTax,
      priceWithTax: product.taxable ? round2(totalPrice + totalTax) : 0
    };
  });
};

// Pre-tax order total, the same semantic as every order already stored.
exports.linesTotal = lines =>
  round2(lines.reduce((sum, line) => sum + line.purchasePrice * line.quantity, 0));

const restock = (product, quantity) =>
  Product.updateOne({ _id: product }, { $inc: { quantity } });

const brandIsActive = async productId => {
  const product = await Product.findById(productId).select('brand');
  return Boolean(product && product.brand && (await Brand.exists({ _id: product.brand, isActive: true })));
};

/**
 * Takes stock for every line with a conditional update per product (it matches
 * only while enough is left), so two buyers can never both get the last unit.
 * Multi-document transactions are not assumed to exist on the target database;
 * instead, a failing line gives back what the earlier lines took.
 */
exports.reserveStock = async lines => {
  const reserved = [];

  try {
    for (const line of lines) {
      const result = await Product.updateOne(
        { _id: line.product, isActive: true, quantity: { $gte: line.quantity } },
        { $inc: { quantity: -line.quantity } }
      );

      if (result.modifiedCount !== 1) {
        const product = await Product.findById(line.product).select('name quantity isActive');
        if (!product || !product.isActive) {
          throw unavailable(line.product);
        }

        const available = Math.max(0, product.quantity || 0);
        throw httpError(409, `Only ${available} left of ${product.name}.`, {
          code: 'INSUFFICIENT_STOCK',
          product: String(line.product),
          available
        });
      }

      // The brand cannot be part of the conditional update, so it is checked once
      // the unit is taken; a brand disabled since pricing hands the unit back.
      if (!(await brandIsActive(line.product))) {
        await restock(line.product, line.quantity);
        throw unavailable(line.product);
      }

      reserved.push(line);
    }
  } catch (error) {
    await exports.releaseStock(reserved);
    throw error;
  }
};

exports.releaseStock = async lines => {
  for (const line of lines) {
    await restock(line.product, line.quantity);
  }
};

/**
 * Moves one cart line to `status` unless it is already Cancelled, as a single
 * conditional update on that line. The line is addressed by its array index:
 * `$elemMatch` in an update filter is rejected by the Oracle Database API for
 * MongoDB, while indexed paths behave the same on both backends, and the `_id`
 * in the filter keeps a stale index from touching another line.
 * Resolves true when this call performed the change.
 */
exports.setLineStatus = async (cart, line, status) => {
  const index = cart.products.findIndex(item => String(item._id) === String(line._id));
  if (index === -1) return false;

  const path = `products.${index}`;
  const result = await Cart.updateOne(
    {
      _id: cart._id,
      [`${path}._id`]: line._id,
      [`${path}.status`]: { $ne: CART_ITEM_STATUS.Cancelled }
    },
    { $set: { [`${path}.status`]: status } }
  );

  return result.modifiedCount === 1;
};

/**
 * Cancels one cart line and gives its stock back, once: concurrent cancels (or a
 * cancel racing the order-level cancel) restock exactly one time.
 * Resolves true when this call performed the cancellation.
 */
exports.cancelLine = async (cart, line) => {
  if (!(await exports.setLineStatus(cart, line, CART_ITEM_STATUS.Cancelled))) return false;

  await restock(line.product, line.quantity);
  return true;
};

exports.formatOrders = orders => {
  const newOrders = orders.map(order => {
    return {
      _id: order._id,
      total: round2(order.total),
      created: order.created,
      products: order?.cart?.products
    };
  });

  return newOrders.map(order => {
    return order?.products ? this.caculateTaxAmount(order) : order;
  });
};
