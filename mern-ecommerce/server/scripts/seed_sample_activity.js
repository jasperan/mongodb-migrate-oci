/*
 * Workshop helper: adds a little shopper activity to the freshly seeded storefront database,
 * so that every one of the 12 collections holds at least one document.
 *
 * `npm run seed:db` creates the admin user, categories, brands and products only. The
 * JSON-to-duality converter used in the migration labs (sql/26ai/05_generate_duality_ddl.sql)
 * infers its schema from existing documents and fails on an empty collection, so the source needs
 * addresses, merchants, carts, cartitems, orders, reviews, wishlists and contacts too.
 *
 * Usage (from the repository root):
 *   mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --file mern-ecommerce/server/scripts/seed_sample_activity.js
 *
 * Idempotent: a collection that already has documents is left alone. Documents use the same
 * field names and types as the Mongoose models in server/models.
 */
(function () {
  const adminUser = db.users.findOne({ role: 'ROLE ADMIN' }) || db.users.findOne({});
  const products = db.products.find({}).limit(3).toArray();
  const brand = db.brands.findOne({});
  if (!adminUser || products.length < 2) {
    print('ERROR: run `npm run seed:db <email> <password>` first (needs the admin user and products).');
    quit(1);
  }
  const now = new Date();

  const line = (product, quantity, status) => {
    const price = Number(product.price);
    const tax = Math.round(price * quantity * 0.1 * 100) / 100;
    return {
      _id: new ObjectId(),
      product: product._id,
      quantity: quantity,
      purchasePrice: price,
      totalPrice: price * quantity,
      priceWithTax: price * quantity + tax,
      totalTax: tax,
      status: status
    };
  };

  const into = (name, docs) => {
    if (db.getCollection(name).countDocuments({}) > 0) {
      print(name.padEnd(12) + ' already has documents, skipped');
      return;
    }
    db.getCollection(name).insertMany(docs);
    print(name.padEnd(12) + ' ' + docs.length + ' inserted');
  };

  const lines = [line(products[0], 2, 'Not processed'), line(products[1], 1, 'Not processed')];
  const cartId = new ObjectId();
  const orderLines = [line(products[0], 1, 'Delivered'), line(products[1], 3, 'Delivered')];

  into('addresses', [
    { user: adminUser._id, address: '500 Oracle Parkway', city: 'Austin', state: 'TX', country: 'United States',
      zipCode: '78741', isDefault: true, created: now, __v: 0 }
  ]);
  into('merchants', [
    { name: 'Alex Morgan', email: 'merchant@example.com', phoneNumber: '+1 512 555 0100',
      brandName: brand ? brand.name : 'Demo Brand', business: 'Demo merchant used by the migration workshop',
      isActive: false, brand: brand ? brand._id : null, status: 'Waiting Approval', created: now, __v: 0 }
  ]);
  into('carts', [{ _id: cartId, products: lines, user: adminUser._id, created: now, __v: 0 }]);
  into('cartitems', lines.concat(orderLines).map((l) => Object.assign({ __v: 0 }, l)));
  into('orders', [
    { cart: new ObjectId(), user: adminUser._id, total: orderLines.reduce((t, l) => t + l.totalPrice, 0), created: now, __v: 0 }
  ]);
  into('reviews', [
    { product: products[0]._id, user: adminUser._id, title: 'Great value', rating: 5,
      review: 'Exactly as described and it arrived quickly.', isRecommended: true, status: 'Approved', created: now, __v: 0 },
    { product: products[1]._id, user: adminUser._id, title: 'Good, not perfect', rating: 4,
      review: 'Solid quality for the price.', isRecommended: true, status: 'Approved', created: now, __v: 0 }
  ]);
  into('wishlists', [
    { product: products[products.length - 1]._id, user: adminUser._id, isLiked: true, updated: now, created: now, __v: 0 }
  ]);
  into('contacts', [
    { name: 'Sam Taylor', email: 'sam@example.com', message: 'Do you ship to Canada?', created: now, __v: 0 }
  ]);

  print('');
  print('collections with documents: ' +
    db.getCollectionNames().filter((n) => !n.startsWith('system.') && db.getCollection(n).countDocuments({}) > 0).length);
})();
