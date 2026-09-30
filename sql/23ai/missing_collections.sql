-- if you are missing any of these collections, run this script.
-- make sure that the product IDs you reference are valid in your own JSON collections. 
-- for me, I took ecommerce.products.id[1] as the example.
-- same goes for user IDs.
-- example product id: 68252aa00200de17ccc48b12
-- example user id: 68252a9f0200de17ccc48afd

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
    'isLiked' VALUE true,
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