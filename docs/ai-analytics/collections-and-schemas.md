# MongoDB Collections & Schemas (MERN Ecommerce)

This document summarizes the main collections and document structures used in the MERN Ecommerce application, as referenced by the AI-Analytics solution.

## Collections Overview

- **users**: User accounts (admin, buyer, seller)
- **products**: Product catalog
- **orders**: Customer orders
- **categories**: Product categories
- **brands**: Product brands
- **reviews**: Product reviews
- **carts**: Shopping carts
- **wishlists**: User wishlists

## Document Structures

### User
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "password": "string (hashed)",
  "role": "string (admin|buyer|seller)",
  "cart": [ ... ],
  "wishlist": [ ... ],
  "orders": [ ... ]
}
```

### Product
```json
{
  "_id": "ObjectId",
  "name": "string",
  "description": "string",
  "price": "number",
  "category": "ObjectId",
  "brand": "ObjectId",
  "stock": "number",
  "images": [ "string" ],
  "reviews": [ ... ]
}
```

### Order
```json
{
  "_id": "ObjectId",
  "user": "ObjectId",
  "orderItems": [ ... ],
  "totalPrice": "number",
  "orderDate": "date",
  "status": "string"
}
```

### Category/Brand
```json
{
  "_id": "ObjectId",
  "name": "string"
}
```

### Review
```json
{
  "_id": "ObjectId",
  "user": "ObjectId",
  "product": "ObjectId",
  "rating": "number",
  "reviewText": "string",
  "createdAt": "date"
}
```

## Notes
- This structure is based on the referenced MERN Ecommerce app and may be extended for AI/analytics features.
- For vector search and RAG, focus will be on `products`, `reviews`, and possibly `orders` collections. 