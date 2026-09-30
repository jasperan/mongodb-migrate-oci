-- Insert into addresses
INSERT INTO ecommerce."addresses"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '6827ca912c58f326e6d97595',
    'user' VALUE '68252a9f0200de17ccc48afd',
    'address' VALUE 'Calle Atocha',
    'city' VALUE 'Madrid',
    'state' VALUE 'Madrid',
    'country' VALUE 'Spain',
    'zipCode' VALUE '28045',
    'isDefault' VALUE true,
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-16T23:30:25.221000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    '__v' VALUE 0
  )
);

-- Insert into brands
INSERT INTO ecommerce."brands"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '68252aa00200de17ccc48b08',
    'isActive' VALUE true,
    'merchant' VALUE null,
    'name' VALUE 'Jenkins - Heller',
    'description' VALUE 'Verumtamen cedo cicuta minus maxime atavus.',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-14T23:43:28.015000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    'slug' VALUE 'jenkins-heller',
    '__v' VALUE 0
  )
);

-- Insert into carts
INSERT INTO ecommerce."carts"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '68252fe498ebb361c47fd3be',
    'user' VALUE '68252a9f0200de17ccc48afd',
    'products' VALUE JSON_ARRAY(
      JSON_OBJECT(
        'purchasePrice' VALUE 527,
        'totalPrice' VALUE 527,
        'priceWithTax' VALUE 553.35,
        'totalTax' VALUE 26.35,
        'status' VALUE 'Not processed',
        '_id' VALUE '68252fe498ebb361c47fd3bf',
        'quantity' VALUE 1,
        'product' VALUE '68252aa00200de17ccc48b75'
      )
    ),
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-15T00:05:56.960000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    '__v' VALUE 0
  )
);

-- Insert into categories
INSERT INTO ecommerce."categories"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '68252a9f0200de17ccc48afe',
    'isActive' VALUE true,
    'products' VALUE JSON_ARRAY(
      '68252aa00200de17ccc48b12',
      '68252aa00200de17ccc48b25',
      '68252aa00200de17ccc48b28',
      '68252aa00200de17ccc48b34',
      '68252aa00200de17ccc48b35',
      '68252aa00200de17ccc48b38',
      '68252aa00200de17ccc48b47',
      '68252aa00200de17ccc48b4f',
      '68252aa00200de17ccc48b50',
      '68252aa00200de17ccc48b53',
      '68252aa00200de17ccc48b5b'
    ),
    'name' VALUE 'Home',
    'description' VALUE 'Adicio contego sit aro peccatus sordeo.',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-14T23:43:27.974000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    'slug' VALUE 'home',
    '__v' VALUE 0
  )
);

-- Insert into merchants
INSERT INTO ecommerce."merchants"
VALUES (
  JSON_OBJECT(
    'brandName' VALUE 'Granite Merchant',
    'business' VALUE 'I¡m a wholesale granite merchant',
    'isActive' VALUE true,
    'phoneNumber' VALUE '(555) 123-4567',
    '_id' VALUE '6827cbe32c58f326e6d975cb',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-16T23:36:03.947000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    'email' VALUE 'nacho@nacho.com',
    '__v' VALUE 0,
    'name' VALUE 'Nacho',
    'status' VALUE 'Approved',
    'brand' VALUE null
  )
);

-- Insert into orders
INSERT INTO ecommerce."orders"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '68252fe498ebb361c47fd3c0',
    'total' VALUE 527,
    'cart' VALUE '68252fe498ebb361c47fd3be',
    'user' VALUE '68252a9f0200de17ccc48afd',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-15T00:05:56.988000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    '__v' VALUE 0
  )
);

-- Insert into products
INSERT INTO ecommerce."products"
VALUES (
  JSON_OBJECT(
    'sku' VALUE 'qRqBc7jc0J',
    'price' VALUE 135,
    'isActive' VALUE true,
    'description' VALUE 'Abeo vestrum valde alo.',
    'taxable' VALUE true,
    '_id' VALUE '68252aa00200de17ccc48b12',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-14T23:43:28.034000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    '__v' VALUE 0,
    'quantity' VALUE 21,
    'slug' VALUE 'small-plastic-soap',
    'name' VALUE 'Small Plastic Soap',
    'brand' VALUE '68252aa00200de17ccc48b08'
  )
);

-- Insert into reviews
INSERT INTO ecommerce."reviews"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '6825302498ebb361c47fd3c1',
    'product' VALUE '68252aa00200de17ccc48b75',
    'user' VALUE '68252a9f0200de17ccc48afd',
    'rating' VALUE 4,
    'isRecommended' VALUE true,
    'status' VALUE 'Approved',
    'review' VALUE 'Good granite, smooth granite.',
    'title' VALUE 'Not bad',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-15T00:07:00.887000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    '__v' VALUE 0
  )
);

-- Insert into users
INSERT INTO ecommerce."users"
VALUES (
  JSON_OBJECT(
    '_id' VALUE '68252a9f0200de17ccc48afd',
    'merchant' VALUE null,
    'provider' VALUE 'Email',
    'role' VALUE 'ROLE ADMIN',
    'email' VALUE 'admin@example.com',
    'password' VALUE '$2a$10$DZEIail.KTKBywJrTX9MbOv34KhgTNf7bv2vFwWwYsmQtRAUsZ6yy',
    'firstName' VALUE 'admin',
    'lastName' VALUE 'admin',
    'created' VALUE TO_TIMESTAMP_TZ('2025-05-14T23:43:27.886000Z', 'YYYY-MM-DD\"T\"HH24:MI:SS.FF3TZR'),
    '__v' VALUE 0
  )
);

INSERT INTO ecommerce."cartitems"
VALUES (
  JSON_OBJECT(
    'product' VALUE '68252aa00200de17ccc48b12',
    'quantity' VALUE 1,
    'purchasePrice' VALUE 0,
    'totalPrice' VALUE 0,
    'priceWithTax' VALUE 0,
    'totalTax' VALUE 0,
    'status' VALUE 'Not processed'
  )
);

INSERT INTO ecommerce."wishlists"
VALUES (
  JSON_OBJECT(
    'product' VALUE '68252aa00200de17ccc48b12',
    'user' VALUE '68252a9f0200de17ccc48afd',
    'isLiked' VALUE false,
    'created' VALUE TO_TIMESTAMP_TZ('2024-01-01T00:00:00.000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR'),
    'updated' VALUE TO_TIMESTAMP_TZ('2024-01-01T00:00:00.000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR')
  )
);

INSERT INTO ecommerce."contacts"
VALUES (
  JSON_OBJECT(
    'name' VALUE 'Test Contact',
    'email' VALUE 'mycontact@example.com',
    'message' VALUE 'This is a test contact.',
    'created' VALUE TO_TIMESTAMP_TZ('2024-01-01T00:00:00.000Z', 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZR')
  )
);