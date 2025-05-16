drop view if exists addresses;
drop table if exists addresses_root purge;
drop view if exists addresses;
drop table if exists brands_root purge;
drop table if exists brands_root_subentity_1 purge;
drop view if exists brands;
drop table if exists carts_products purge;
drop table if exists carts_root purge;
drop view if exists carts;
drop table if exists categories_root purge;
drop table if exists categories_root_subentity_1 purge;
drop view if exists categories;
drop table if exists merchants_root purge;
drop view if exists merchants;
drop table if exists orders_root purge;
drop view if exists orders;
drop table if exists products_root purge;
drop table if exists products_root_subentity_1 purge;
drop view if exists products;
drop table if exists reviews_root purge;
drop view if exists reviews;
drop table if exists users_root purge;
drop view if exists users;
drop table if exists wishlists_root purge;
drop view if exists wishlists;
drop table if exists "cartitems" purge;
drop table if exists "contacts" purge;


CREATE TABLE addresses_root(
   "__v"  number  /* UNIQUE */,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   city  varchar2(64)  /* UNIQUE */,
   ora$user  raw(2000)  /* UNIQUE */,
   state  varchar2(64)  /* UNIQUE */,
   address  varchar2(64)  /* UNIQUE */,
   country  varchar2(64)  /* UNIQUE */,
   created  timestamp with time zone,
   zip_code  varchar2(64)  /* UNIQUE */,
   is_default  boolean,
   ora$addresses_flex  JSON(Object),
   PRIMARY KEY("_id")
);


CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "addresses" AS 
addresses_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  city
  user: ora$user @cast(as: id)
  state
  address
  country
  created
  zipCode: zip_code
  isDefault: is_default
  ora$addresses_flex @flex
}; 

CREATE TABLE brands_root(
   "__v"  number,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   name  varchar2(64)  /* UNIQUE */,
   slug  varchar2(64)  /* UNIQUE */,
   created  timestamp with time zone,
   description  varchar2(256)  /* UNIQUE */,
   is_active  boolean,
   merchant  raw(2000),
   ora$brands_flex  JSON(Object),
   PRIMARY KEY("_id")
);

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "brands" AS 
brands_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  name
  slug
  created
  description
  isActive: is_active
  merchant @cast(as: id)
  ora$brands_flex @flex
}; 

CREATE TABLE carts_root(
   "__v"  number  /* UNIQUE */,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   ora$user  raw(2000)  /* UNIQUE */,
   created  timestamp with time zone,
   ora$carts_flex  JSON(Object),
   PRIMARY KEY("_id")
);

CREATE TABLE carts_products(
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   status  varchar2(64),
   product  raw(2000)  /* UNIQUE */,
   quantity  number,
   total_tax  json VALIDATE '{"oneOf" : [{ "type" :"number"}, { "extendedType" :"double"}]}',
   total_price  binary_double,
   price_with_tax  json VALIDATE '{"oneOf" : [{ "type" :"number"}, { "extendedType" :"double"}]}',
   purchase_price  binary_double,
   "_id_carts_root"  raw(2000),
   ora$carts_flex  JSON(Object),
   PRIMARY KEY("_id")
);

ALTER TABLE carts_products
ADD CONSTRAINT fk_carts_products_to_carts_root FOREIGN KEY ("_id_carts_root") REFERENCES carts_root("_id") DEFERRABLE;
CREATE INDEX IF NOT EXISTS fk_carts_products_to_carts_root_index ON carts_products("_id_carts_root");

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "carts" AS 
carts_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  user: ora$user @cast(as: id)
  created
  products: carts_products @insert @update @delete
  { 
    "_id" @cast(as: id)
    status
    product @cast(as: id)
    quantity
    totalTax: total_tax
    totalPrice: total_price
    priceWithTax: price_with_tax
    purchasePrice: purchase_price
    ora$carts_flex @flex
  } 
  ora$carts_flex @flex
};

CREATE TABLE categories_root(
   "__v"  number  /* UNIQUE */,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   name  varchar2(64),
   slug  varchar2(64)  /* UNIQUE */,
   created  timestamp with time zone,
   is_active  boolean,
   products  json VALIDATE '{"oneOf" : [{ "type" :"array"}]}',
   description  varchar2(256)  /* UNIQUE */,
   ora$categories_flex  JSON(Object),
   PRIMARY KEY("_id")
);

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "categories" AS 
categories_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  name
  slug
  created
  isActive: is_active
  products
  description
  ora$categories_flex @flex
}; 

CREATE TABLE merchants_root(
   "__v"  number  /* UNIQUE */,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   name  varchar2(64)  /* UNIQUE */,
   brand  raw(2000),
   email  varchar2(64)  /* UNIQUE */,
   status  varchar2(64)  /* UNIQUE */,
   created  timestamp with time zone,
   business  varchar2(64)  /* UNIQUE */,
   is_active  boolean,
   brand_name  varchar2(64)  /* UNIQUE */,
   phone_number  varchar2(64)  /* UNIQUE */,
   ora$merchants_flex  JSON(Object),
   PRIMARY KEY("_id")
);


CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "merchants" AS 
merchants_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  name
  brand @cast(as: id)
  email
  status
  created
  business
  isActive: is_active
  brandName: brand_name
  phoneNumber: phone_number
  ora$merchants_flex @flex
}; 

CREATE TABLE orders_root(
   "__v"  number  /* UNIQUE */,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   cart  raw(2000)  /* UNIQUE */,
   ora$user  raw(2000)  /* UNIQUE */,
   total  binary_double,
   created  timestamp with time zone,
   ora$orders_flex  JSON(Object),
   PRIMARY KEY("_id")
);


CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "orders" AS 
orders_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  cart @cast(as: id)
  user: ora$user @cast(as: id)
  total
  created
  ora$orders_flex @flex
}; 

CREATE TABLE products_root(
   "__v"  number,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   sku  varchar2(64) /* UNIQUE */,
   name  varchar2(64)  /* UNIQUE */,
   slug  varchar2(64)  /* UNIQUE */,
   brand  raw(2000),
   price  binary_double,
   created  timestamp with time zone,
   taxable  boolean,
   image_key  varchar2(64)  /* UNIQUE */,
   image_url  varchar2(64),
   is_active  boolean,
   quantity  number,
   description  varchar2(256)  /* UNIQUE */,
   ora$products_flex  JSON(Object),
   PRIMARY KEY("_id")
);

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "products" AS 
products_root @insert @update @delete
{ 
  "_id" @cast(as: id)
  sku
  name
  slug
  brand @cast(as: id)
  price
  created
  taxable
  imageKey: image_key
  imageUrl: image_url
  quantity
  description
  isActive: is_active
  ora$products_flex @flex
}; 

CREATE TABLE reviews_root(
   "__v"  number  /* UNIQUE */,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   ora$user  raw(2000)  /* UNIQUE */,
   title  varchar2(64)  /* UNIQUE */,
   rating  number  /* UNIQUE */,
   review  varchar2(64)  /* UNIQUE */,
   status  varchar2(64)  /* UNIQUE */,
   created  timestamp with time zone,
   product  raw(2000)  /* UNIQUE */,
   is_recommended  boolean,
   ora$reviews_flex  JSON(Object),
   PRIMARY KEY("_id")
);


CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "reviews" AS
reviews_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  user: ora$user @cast(as: id)
  title
  rating
  review
  status
  created
  product @cast(as: id)
  isRecommended: is_recommended
  ora$reviews_flex @flex
}; 

CREATE TABLE users_root(
   "__v"  number,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   role  varchar2(64)  /* UNIQUE */,
   email  varchar2(64)  /* UNIQUE */,
   created  timestamp with time zone,
   last_name  varchar2(64),
   merchant  raw(2000),
   password  varchar2(64),
   provider  varchar2(64),
   first_name  varchar2(64)  /* UNIQUE */,
   phone_number  varchar2(64),
   reset_password_token  varchar2(128),
   ora$users_flex  JSON(Object),
   PRIMARY KEY("_id")
);

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "users" AS 
users_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  role
  email
  created
  lastName: last_name
  merchant @cast(as: id)
  password
  provider
  firstName: first_name
  phoneNumber: phone_number
  resetPasswordToken: reset_password_token
  ora$users_flex @flex
}; 

CREATE TABLE wishlists_root(
   "__v"  number,
   "_id"  raw(2000)  DEFAULT ON NULL SYS_GUID(),
   ora$user  raw(2000),
   created  timestamp with time zone,
   is_liked  boolean,
   product  raw(2000)  /* UNIQUE */,
   updated  timestamp with time zone,
   ora$wishlists_flex  JSON(Object),
   PRIMARY KEY("_id")
);


CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "wishlists" AS 
wishlists_root @insert @update @delete
{ 
  "__v"
  "_id" @cast(as: id)
  user: ora$user @cast(as: id)
  created
  isLiked: is_liked
  product @cast(as: id)
  updated
  ora$wishlists_flex @flex
};

create json collection table "cartitems" with etag;
create json collection table "contacts" with etag;