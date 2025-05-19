-- then, after running mongorestore (collections need to have been created):
-- run as admin
grant select on ecommerce.addresses to ecommercedv;
grant select on ecommerce.brands to ecommercedv;
grant select on ecommerce.cartitems to ecommercedv;
grant select on ecommerce.carts to ecommercedv;
grant select on ecommerce.categories to ecommercedv;
grant select on ecommerce.contacts to ecommercedv;
grant select on ecommerce.merchants to ecommercedv;
grant select on ecommerce.orders to ecommercedv;
grant select on ecommerce.products to ecommercedv;
grant select on ecommerce.reviews to ecommercedv;
grant select on ecommerce.users to ecommercedv;
grant select on ecommerce.wishlists to ecommercedv;
