# Express API Contract — `mern-ecommerce/server`

> **Scope.** This is the inventory of the *migrated* server as it stood when the React 19 client was
> written: it documents the 79 handlers the client had to be built against. Endpoints added for the
> 26ai layer afterwards — `POST /api/ai/similar`, `POST /api/ai/ask`, `GET /api/ai/status` and the
> extra `/api/admin-db/*` showcase routes — are documented in
> [migration-guide.md](./migration-guide.md) §7 and listed in the root README.

Source of truth: `mern-ecommerce/server/routes/**`, `server/models/**`, `server/middleware/**`,
`server/utils/**`, `server/socket/**`, `server/index.js`, `server/config/**`.

**Endpoint count: 79 route handlers across the 16 route files in `server/routes/api/`.
78 are reachable; 1 is dead code (`server/routes/api/llmChat.js` is never mounted — see §3.16).**

Per-file distribution (verified by counting `router.<verb>(` declarations):
`auth` 9 · `user` 4 · `address` 5 · `newsletter` 1 · `product` 10 · `category` 7 · `brand` 8 ·
`contact` 1 · `merchant` 8 · `cart` 4 · `order` 7 · `review` 7 · `wishlist` 2 · `adminDb` 4 ·
`llmChat` 1 (dead) · `index` 1.

Every endpoint below is listed with the HTTP method, the full mounted path, auth/role
requirements, request fields, success response shape and the collection side effects.

---

## 1. Global conventions

### 1.1 Base path

| Layer | File | Mount |
|---|---|---|
| App | `server/index.js` | `app.use(routes)` — no path prefix |
| Root router | `server/routes/index.js` | `router.use('/api', apiRoutes)` |
| API router | `server/routes/api/index.js` | per-file mounts (see table below) |

So the full URL of any endpoint below is `/api/<mount>/<path>`.
Default port: `process.env.PORT || 3000` (`server/config/keys.js`).
Global middleware: `express.urlencoded({extended:true})`, `express.json()`,
`helmet({contentSecurityPolicy:false, frameguard:true})`, `cors()` (allow-all).

### 1.2 Mount table (`server/routes/api/index.js`)

| Mount prefix | Route file |
|---|---|
| `/api/auth` | `auth.js` |
| `/api/user` | `user.js` |
| `/api/address` | `address.js` |
| `/api/newsletter` | `newsletter.js` |
| `/api/product` | `product.js` |
| `/api/category` | `category.js` |
| `/api/brand` | `brand.js` |
| `/api/contact` | `contact.js` |
| `/api/merchant` | `merchant.js` |
| `/api/cart` | `cart.js` |
| `/api/order` | `order.js` |
| `/api/review` | `review.js` |
| `/api/wishlist` | `wishlist.js` |
| `/api/admin-db` | `adminDb.js` |
| *(no mount)* | `llmChat.js` — **dead code** |
| `/api/chat` | inline `router.post('/chat', …)` inside `index.js` |

### 1.3 Authentication

* Strategy: `passport-jwt`, configured in `server/config/passport.js`.
* Token extraction: `ExtractJwt.fromAuthHeaderAsBearerToken()` →
  header `Authorization: Bearer <jwt>`.
* `server/middleware/auth.js` is simply `passport.authenticate('jwt', {session:false})`.
* **The login/register responses already include the `Bearer ` prefix** in the `token` field.
  A client MUST send that string verbatim: `axios.defaults.headers.common['Authorization'] = token`
  (the legacy client does exactly this — `client/app/utils/token.js`).
* JWT payload: `{ id: <user._id> }`. Signed with `JWT_SECRET`, `expiresIn: '7d'`
  (`server/config/keys.js` → `jwt.tokenLife`).
* Failure mode of `auth`: passport default → **HTTP 401 with the plain-text body `Unauthorized`**
  (not JSON). There is no `/api/auth/me`; user identity is fetched with `GET /api/user/me`.

### 1.4 Role middleware

`server/middleware/role.js` → `role.check(...roles)`:

| Condition | Response |
|---|---|
| `!req.user` | `401` plain text `Unauthorized` |
| `req.user.role` not in the list | `403` plain text `You are not allowed to make this request.` |

Role literals (`server/constants/index.js` → `ROLES`):

| Name | Value |
|---|---|
| `ROLES.Admin` | `'ROLE ADMIN'` |
| `ROLES.Member` | `'ROLE MEMBER'` |
| `ROLES.Merchant` | `'ROLE MERCHANT'` |

`User.role` defaults to `ROLE MEMBER` and is constrained to those three values.

**Other enums the client must mirror** (`server/constants/index.js`):

| Group | Values |
|---|---|
| `MERCHANT_STATUS` | `Rejected`, `Approved`, `Waiting Approval` |
| `CART_ITEM_STATUS` | `Processing`, `Shipped`, `Delivered`, `Cancelled`, `Not processed` |
| `REVIEW_STATUS` | `Rejected`, `Approved`, `Waiting Approval` |
| `EMAIL_PROVIDER` | `Email`, `Google`, `Facebook` |

### 1.5 Response envelope conventions

There is **no** global envelope and **no** global error handler. Conventions actually used:

| Situation | Shape |
|---|---|
| Generic thrown error (every `try/catch`) | `400 {"error":"Your request could not be processed. Please try again."}` |
| Validation error | `400 {"error":"<field-specific message>"}` (some use `res.send`, which still serialises to JSON for objects) |
| Success with a payload | `200 {"success":true, "message":"…", "<entity>": <doc>}` OR a bare key, e.g. `200 {"products":[…], "totalPages":n, "currentPage":n, "count":n}` |
| Not found | `404 {"message":"…"}` (note: `message`, not `error`) |
| Auth failure | `401` plain text `Unauthorized` |
| Role failure | `403` plain text `You are not allowed to make this request.` |

Pagination endpoints **always** return `totalPages`, `currentPage`, `count` **alongside the entity
array** (note: the array is nested under the entity key, the pagination fields are top-level).

### 1.6 `checkAuth` (optional auth) — `server/utils/auth.js`

`GET /api/product/list` does **not** use the `auth` middleware. It calls
`checkAuth(req)`, which only base64-decodes the bearer token **without verifying the signature**
and returns `{id}` or `null`. This is how the store list returns a personalised `isLiked` flag
for logged-in users while remaining public. It is a decode, not a verification.

### 1.7 Uploads

`POST /api/product/add` uses `multer` with `multer.memoryStorage()`, `upload.single('image')`
→ **`multipart/form-data` with the file in the field named `image`**, plus the text fields below.

`server/utils/storage.js` → `s3Upload(image)` is **stubbed** (the AWS SDK code is commented out):

```js
if (image) { imageUrl = '/images/products/' + image.originalname; imageKey = image.originalname; }
return { imageUrl, imageKey };   // { imageUrl:'', imageKey:'' } when no file
```

So uploaded files are **not** persisted anywhere; the URL is a synthetic path. A React 19 client
that renders `product.imageUrl` will get `/images/products/<name>` and must not expect a real CDN.

### 1.8 Email / newsletter side effects

* `server/services/mailchimp.js` → `subscribeToNewsletter(email)` posts to
  `lists/<MAILCHIMP_LIST_KEY>/members` with `{email_address, status:'subscribed'}`.
  On success it returns the Mailchimp body (`{status:'subscribed', …}`); on failure it returns
  the **Error object** (so `result.status` is a *number* HTTP status, e.g. `400`).
  `newsletter.js` uses that to distinguish `400` from success; `auth.js` checks `result.status === 'subscribed'`.
* `server/services/mailgun.js` → `sendEmail(email, type, host, data)`; template types in use:
  `reset`, `reset-confirmation`, `signup`, `newsletter-subscription`, `contact`,
  `merchant-application`, `merchant-deactivate-account`, `merchant-signup`, `merchant-welcome`,
  `order-confirmation`. All send failures are swallowed and returned, never surfaced to the client.

### 1.9 Tax configuration

`server/config/tax.js`: `{stateCode:'CA', stateName:'California', stateTaxRate: 0.05}`.
The rate is a **percentage** that the code multiplies by 100 in the formula
`taxAmount = price * (taxRate/100) * 100` — i.e. for `stateTaxRate = 0.05` the effective rate is
**5% of price**, applied per unit (`* quantity`). `UNVERIFIED` whether that is intended.

### 1.10 Collection names

Mongoose models registered in `server/models/`: `User`, `Address`, `Brand`, `Category`,
`Product`, `Review`, `Cart` + `CartItem`, `Order`, `Merchant`, `Contact`, `Wishlist`.
Mongoose pluralises to the collections: `users`, `addresses`, `brands`, `categories`, `products`,
`reviews`, `carts`, `cartitems`, `orders`, `merchants`, `contacts`, `wishlists`.

---

## 2. Schema reference (drives every request/response shape below)

| Model | Fields (type, default) |
|---|---|
| **User** | `email` String (required unless `provider !== 'Email'`), `phoneNumber` String, `firstName` String, `lastName` String, `password` String, `merchant` ObjectId→Merchant (null), `provider` String required default `Email`, `googleId` String, `facebookId` String, `avatar` String, `role` String default `ROLE MEMBER` (enum Admin/Member/Merchant), `resetPasswordToken` String, `resetPasswordExpires` Date, `updated` Date, `created` Date = now |
| **Address** | `user` ObjectId→User, `address` String, `city` String, `state` String, `country` String, `zipCode` String, `isDefault` Boolean default `false`, `updated` Date, `created` Date |
| **Brand** | `name` String trim, `slug` String unique (auto from `name`, separator `-`, truncate 120), `image.data` Buffer, `image.contentType` String, `description` String trim, `isActive` Boolean default `true`, `merchant` ObjectId→Merchant default `null`, `updated` Date, `created` Date |
| **Category** | `_id` ObjectId auto, `name` String trim, `slug` String unique (auto), `image.data` Buffer, `image.contentType` String, `description` String trim, `isActive` Boolean default `true`, `products` [ObjectId→Product], `updated` Date, `created` Date |
| **Product** | `sku` String, `name` String trim, `slug` String unique (auto), `imageUrl` String, `imageKey` String, `description` String trim, `quantity` Number, `price` Number, `taxable` Boolean default `false`, `isActive` Boolean default `true`, `brand` ObjectId→Brand default `null`, `updated` Date, `created` Date. **`averageRating` is NOT a schema field** — it is computed by the aggregation (§6). |
| **Review** | `product` ObjectId→Product (null), `user` ObjectId→User (null), `title` String trim, `rating` Number default `0`, `review` String trim, `isRecommended` Boolean default `true`, `status` String default `Waiting Approval` (enum Waiting Approval/Rejected/Approved), `updated` Date, `created` Date |
| **Cart** | `products` [CartItem], `user` ObjectId→User, `updated` Date, `created` Date |
| **CartItem** (subdoc, gets its own `_id`) | `product` ObjectId→Product, `quantity` Number, `purchasePrice` Number default `0`, `totalPrice` Number default `0`, `priceWithTax` Number default `0`, `totalTax` Number default `0`, `status` String default `Not processed` (enum: Not processed/Processing/Shipped/Delivered/Cancelled) |
| **Order** | `cart` ObjectId→Cart, `user` ObjectId→User, `total` Number default `0`, `updated` Date, `created` Date |
| **Merchant** | `name` String trim, `email` String, `phoneNumber` String, `brandName` String, `business` String trim, `isActive` Boolean default `false`, `brand` ObjectId→Brand default `null`, `status` String default `Waiting Approval` (enum Waiting Approval/Rejected/Approved), `updated` Date, `created` Date |
| **Contact** | `name` String trim, `email` String, `message` String trim, `updated` Date, `created` Date |
| **Wishlist** | `product` ObjectId→Product (null), `user` ObjectId→User (null), `isLiked` Boolean default `false`, `updated` Date default now, `created` Date default now |

---

## 3. Endpoints

Legend for **Auth**: `—` = public · `auth` = valid JWT · `auth+Admin` etc. = JWT **and** `role.check`.

### 3.1 `routes/api/auth.js` — 9 endpoints (mount `/api/auth`)

#### `POST /api/auth/login` — public
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `password` | string | yes |

* 200 → `{ success: true, token: "Bearer <jwt>", user: { id, firstName, lastName, email, role } }`
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter a password.'}` /
  `{error:'No user found for this email address.'}` /
  `{error:'That email address is already in use using <provider> provider.'}`
  (when `user.provider !== 'Email'`) / `{success:false, error:'Password Incorrect'}`
* Collections: reads `users`. Nothing written.

#### `POST /api/auth/register` — public
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `firstName` | string | yes |
| `lastName` | string | yes |
| `password` | string | yes |
| `isSubscribed` | boolean | no (default falsy) |

* 200 → `{ success:true, subscribed: <bool>, token:"Bearer <jwt>", user:{ id, firstName, lastName, email, role } }`
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter your full name.'}` /
  `{error:'You must enter a password.'}` / `{error:'That email address is already in use.'}`
* Side effects: inserts into `users` (password bcrypt-hashed, cost 10); if `isSubscribed` → Mailchimp
  subscribe, and `subscribed` in the response is `true` only when Mailchimp returned
  `status === 'subscribed'`; sends the `signup` Mailgun email.
* **Gap:** `isSubscribed` is **not persisted** on the `User` model.

#### `POST /api/auth/forgot` — public
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |

* 200 → `{ success:true, message:'Please check your email for the link to reset your password.' }`
* 400 → `{error:'You must enter an email address.'}` / `{error:'No user found for this email address.'}`
* Side effects: updates `users`: `resetPasswordToken = <48 random bytes as hex>`,
  `resetPasswordExpires = now + 3600000 ms (1 hour)`; sends the `reset` Mailgun email with the token.

#### `POST /api/auth/reset/:token` — public
Path param `token` = the hex string from the email link.

| Field | Type | Required |
|---|---|---|
| `password` | string | yes |

* 200 → `{ success:true, message:'Password changed successfully. Please login with your new password.' }`
* 400 → `{error:'You must enter a password.'}` /
  `{error:'Your token has expired. Please attempt to reset your password again.'}`
  (also returned when no user matches the token)
* Side effects: updates `users` (`password` re-hashed, `resetPasswordToken`/`resetPasswordExpires`
  set to `undefined`); sends the `reset-confirmation` Mailgun email.
* Lookup is `{resetPasswordToken: <token>, resetPasswordExpires: {$gt: Date.now()}}`.

#### `POST /api/auth/reset` — **auth**
| Field | Type | Required |
|---|---|---|
| `password` | string | yes (the **old** password — it is verified against the bcrypt hash) |
| `confirmPassword` | string | yes (the **new** password — it is what gets stored) |

* 200 → `{ success:true, message:'Password changed successfully. Please login with your new password.' }`
* 400 → `{error:'You must enter a password.'}` / `{error:'That email address is already in use.'}`
  (returned when the user record cannot be found) / `{error:'Please enter your correct old password.'}`
* 401 plain text `Unauthenticated` when `req.user.email` is missing.
* Side effects: updates `users`; sends `reset-confirmation`.
* **Naming trap:** `password` = old, `confirmPassword` = new. Do not swap them.
* **Gap:** there is no `confirmPassword` match check in the request body — the field is only used
  as the new value.

#### `GET /api/auth/google` — public
Redirects (302) to Google OAuth. Strategy options: `scope:['profile','email']`,
`accessType:'offline'`, `approvalPrompt:'force'`, `session:false`.

#### `GET /api/auth/google/callback` — public
* On failure → `302` to `${CLIENT_URL}/login`.
* On success → `302` to `${CLIENT_URL}/auth/success?token=Bearer <jwt>`.
  The token is passed **in the query string** (see the `TODO find another way to send the token
  to frontend` comment in the route).
* Side effects (inside the strategy, `server/config/passport.js`): finds `users` by `email`;
  if absent, inserts a user with `provider:'Google'`, `googleId: profile.id`, `email`,
  `firstName`/`lastName` split from `displayName`, `avatar: profile.picture`, `password: null`,
  `role` default `ROLE MEMBER`.
* If the env keys are missing the strategy is not registered and `passport.authenticate('google')`
  throws → `500`.

#### `GET /api/auth/facebook` — public
Redirects (302) to Facebook OAuth, `scope:['public_profile','email']`,
`profileFields:['id','displayName','name','emails','picture.type(large)']`.

#### `GET /api/auth/facebook/callback` — public
Same contract as the Google callback: failure → `${CLIENT_URL}/login`,
success → `${CLIENT_URL}/auth/success?token=Bearer <jwt>`.
Candidate lookup is `{facebookId: profile.id}`; new users get `provider:'Facebook'`,
`facebookId`, `email = profile.emails?.[0]?.value ?? null`, `firstName`/`lastName` from
`profile.name`, `avatar = profile.photos[0].value`, `password: null`.

---

### 3.2 `routes/api/user.js` — 4 endpoints (mount `/api/user`)

#### `GET /api/user/search?search=<string>` — **auth+Admin**
Query: `search` (string, used as a case-insensitive regex over `firstName`, `lastName`, `email`).
* 200 → `{ users: [ … ] }` — each user has `password` and `_id` projected out,
  `merchant` populated with only `name`.
* 400 → generic error envelope.
* Collections: reads `users` (+ `merchants` for the populate).
* **Note:** `_id` is excluded, so a new client cannot key rows by `_id` from this endpoint.

#### `GET /api/user?page=<n>&limit=<n>` — **auth** (no role check → **any** logged-in user)
Query defaults: `page=1`, `limit=10`. Sorted `-created`.
* 200 → `{ users: [ … ], totalPages, currentPage, count }`; `password`, `_id`, `googleId` projected out;
  `merchant` populated with only `name`.
* 400 → generic error envelope.
* **Gap:** this is a full user list for any authenticated member; there is no role guard.

#### `GET /api/user/me` — **auth**
* 200 → `{ user: <full user doc minus password> }` with two levels of population:
  `merchant` → Merchant, and inside it `brand` → Brand.
* 400 → generic error envelope.
* Collections: reads `users`, `merchants`, `brands`.

#### `PUT /api/user` — **auth**
| Field | Type | Required |
|---|---|---|
| `profile` | object | yes — passed **verbatim** to `User.findOneAndUpdate` |

* 200 → `{ success:true, message:'Your profile is successfully updated!', user: <updated doc> }`
* 400 → generic error envelope.
* Sends no email. Does **not** strip `password` from the returned `user`.
* **Gap:** the body is not whitelisted, so any `User` path (including `role`) is writable.

---

### 3.3 `routes/api/address.js` — 5 endpoints (mount `/api/address`)

#### `POST /api/address/add` — **auth**
| Field | Type | Required |
|---|---|---|
| `address` | string | yes in practice (legacy form validates it) |
| `city` | string | yes in practice |
| `state` | string | yes in practice |
| `country` | string | yes in practice |
| `zipCode` | string | yes in practice |
| `isDefault` | boolean | no |

The **entire `req.body` is spread** into a new `Address` (`{...req.body, user: req.user._id}`),
so any other `Address` field is also accepted.
* 200 → `{ success:true, message:'Address has been added successfully!', address: <doc> }`
* 400 → generic error envelope.
* Side effects: inserts into `addresses` with `user` = JWT subject.
* No server-side validation of individual address fields; no default-address uniqueness enforcement.

#### `GET /api/address` — **auth**
* 200 → `{ addresses: [ … ] }` for the JWT user only (`{user: req.user._id}`).

#### `GET /api/address/:id` — **public (no auth)**
* 200 → `{ address: <doc> }`
* 404 → `{message:'Cannot find Address with the id: <id>.'}`
* **Bug to be aware of:** the 404 branch does not `return`, so the handler then also executes
  `res.status(200).json(...)` → a "headers already sent" throw that lands in the `catch` and
  attempts a third response. A new client sees a 404 with a valid body in the happy-miss case,
  but the server logs a double-send error.
* **Security gap:** any address can be read by id without authentication.

#### `PUT /api/address/:id` — **public (no auth)**
| Field | Type | Required |
|---|---|---|
| *(any Address field)* | — | passed verbatim as `req.body` |

* 200 → `{ success:true, message:'Address has been updated successfully!' }` (no document echoed)
* 400 → generic error envelope.
* **Security gap:** unauthenticated update of any address.

#### `DELETE /api/address/delete/:id` — **public (no auth)**
* 200 → `{ success:true, message:'Address has been deleted successfully!', address: <deleteOne result> }`
  (`address` here is `{acknowledged, deletedCount}`, **not** the deleted document).
* **Security gap:** unauthenticated delete of any address.

---

### 3.4 `routes/api/newsletter.js` — 1 endpoint (mount `/api/newsletter`)

#### `POST /api/newsletter/subscribe` — public
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |

* 200 → `{ success:true, message:'You have successfully subscribed to the newsletter' }`
* 400 → `{error:'You must enter an email address.'}` or `{error:<mailchimp title>}` when Mailchimp
  answered with HTTP 400.
* Side effects: Mailchimp list member add; `newsletter-subscription` Mailgun email.
  **No local collection is written.**

---

### 3.5 `routes/api/product.js` — 10 endpoints (mount `/api/product`)

#### `GET /api/product/item/:slug` — public
* 200 → `{ product: <doc> }` with `brand` populated as `{name, isActive, slug}`.
* 404 → `{message:'No product found.'}` when the doc is missing, inactive (`isActive:false`),
  or its brand is `null`/`isActive:false`.
* 400 → generic error envelope.
* Collections: reads `products`, `brands`.
* This is the store PDP load; `averageRating` is **not** present here (see §6).

#### `GET /api/product/list/search/:name` — public
Path param `name` → regex with options `is` (case-insensitive + dotall).
Projection: `{name:1, slug:1, imageUrl:1, price:1, _id:0}`, filtered to `isActive:true`.
* 200 → `{ products: [ {name, slug, imageUrl, price} ] }`
* The `if (productDoc.length < 0)` guard is always false — an empty result returns
  `200 {products: []}`, never 404.
* Used by the navigation search bar (client fires every 3rd keystroke — see `ui-inventory.md`).

#### `GET /api/product/list` — **public, optionally personalised**
Query parameters:

| Param | Type | Required | Meaning |
|---|---|---|---|
| `sortOrder` | JSON string | **yes** | `JSON.parse`d and passed as the `$sort` stage, e.g. `'{"created":-1}'`. A missing/invalid value throws → 400. |
| `min` | number-like string | no | lower price bound (used only when **both** `min` and `max` are truthy) |
| `max` | number-like string | no | upper price bound |
| `rating` | number-like string | no | min `averageRating` |
| `category` | string | no | category **slug** |
| `brand` | string | no | brand **slug** |
| `page` | number | no (default `1`) | |
| `limit` | number | no (default `10`) | |

* 200 →
  `{ products: [ … ], totalPages: Math.ceil(count/limit), currentPage, count }`
  where `count` is the **filtered total** (length of the aggregation without skip/limit).
  Pagination quirk: `size = count > limit ? page-1 : 0` and `currentPage = count > limit ? page : 1`,
  so a single page always reports `currentPage: 1`.
* 400 → generic error envelope (logged to the server console as `error <...>`).
* `brand` and `category` filters are appended as extra `$match` stages built from separate
  `Brand.findOne({slug, isActive:true})` / `Category.findOne({slug, isActive:true})` lookups.
  The category filter matches `_id ∈ category.products`. A non-matching slug silently yields an
  unfiltered result (the stage is only pushed when the doc is found).
* When a valid bearer token is present (`checkAuth`), the `isLiked` stage is appended so each
  product carries a wishlist flag for that user.
* Collections: reads `products`, `brands`, `reviews`, `categories`, and `wishlists` when logged in.
* Pipeline details in §6.

#### `GET /api/product/list/select` — **auth** (no role check)
* 200 → `{ products: [ {name, _id} ] }` — **all** products, active or not.
  (Note: the projection string is `'name'`, so `_id` is included.)
* Used to populate category/product multi-selects in the manager UI.

#### `POST /api/product/add` — **auth+Admin|Merchant**, `multipart/form-data`, field `image`
| Field | Type | Required |
|---|---|---|
| `sku` | string | yes |
| `name` | string | yes |
| `description` | string | yes |
| `quantity` | number | yes (a `0` value is rejected by `if (!quantity)`) |
| `price` | number | yes (a `0` value is rejected by `if (!price)`) |
| `taxable` | boolean | no |
| `isActive` | boolean | no |
| `brand` | ObjectId string | no |
| `image` | file | no (field name `image`) |

* 200 → `{ success:true, message:'Product has been added successfully!', product: <doc> }`
* 400 → `{error:'You must enter sku.'}` / `{error:'You must enter description & name.'}` /
  `{error:'You must enter a quantity.'}` / `{error:'You must enter a price.'}` /
  `{error:'This sku is already in use.'}` / generic envelope.
* Side effects: inserts into `products`; `imageUrl`/`imageKey` come from the stubbed `s3Upload`.
* **Gap:** the route does **not** push the new product id into the `Category.products` array
  (the seeder does that, the API does not). Category membership is therefore not maintained by
  product creation.

#### `GET /api/product` — **auth+Admin|Merchant**
* 200 → `{ products: [ … ] }`, each with `brand` populated (including its `merchant`).
* Merchant scoping: when `req.user.merchant` is set, the list is `.where('brand', brandId)`
  using the **first** brand returned by `Brand.find({merchant: req.user.merchant})`.
  If the merchant has no brand, `brandId` is `undefined` and the query returns nothing
  (`brands[0]?.['_id']` in the list route vs. the unguarded `brands[0]['_id']` in the detail route).

#### `GET /api/product/:id` — **auth+Admin|Merchant**
* 200 → `{ product: <doc> }` with `brand` populated as `{name}`.
* 404 → `{message:'No product found.'}`
* Same merchant scoping as above (unguarded `brands[0]['_id']` → throws a TypeError, caught →
  400 generic envelope, when a Merchant user has no brand).

#### `PUT /api/product/:id` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `product` | object | yes — passed verbatim as the update |

`sku` and `slug` inside `product` are checked for uniqueness against other documents.
* 200 → `{ success:true, message:'Product has been updated successfully!' }`
* 400 → `{error:'Sku or slug is already in use.'}` / generic envelope.
* **Note:** the update is not scoped to the merchant's own brand; any merchant can edit any product.

#### `PUT /api/product/:id/active` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `product` | object | yes — typically `{isActive: <bool>}` |

* 200 → `{ success:true, message:'Product has been updated successfully!' }`
* Unlike brand/category deactivation this does **not** cascade to anything.

#### `DELETE /api/product/delete/:id` — **auth+Admin|Merchant**
* 200 → `{ success:true, message:'Product has been deleted successfully!', product: <deleteOne result> }`
* Hard delete; does **not** pull the id out of `Category.products` and does not touch reviews.

---

### 3.6 `routes/api/category.js` — 7 endpoints (mount `/api/category`)

#### `POST /api/category/add` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `description` | string | yes |
| `products` | array of ObjectId | no |
| `isActive` | boolean | no (schema default `true`) |

* 200 → `{ success:true, message:'Category has been added successfully!', category: <doc> }`
* 400 → `{error:'You must enter description & name.'}` / generic envelope (callback-style `save`).
* `slug` is auto-generated from `name` by `mongoose-slug-generator`. No image is accepted here
  (the model has an `image` sub-document but the route never populates it).

#### `GET /api/category/list` — public
* 200 → `{ categories: [ … ] }` filtered to `isActive:true` (store nav / filters).
  Includes each category's `products` array (full ids).

#### `GET /api/category` — public
* 200 → `{ categories: [ … ] }` — **all** categories including inactive (manager UI).

#### `GET /api/category/:id` — public
* 200 → `{ category: <doc> }` with `products` populated as `{name}`.
* 404 → `{message:'No Category found.'}`

#### `PUT /api/category/:id` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `category` | object | yes — passed verbatim |

`category.slug` is checked for uniqueness against other documents.
* 200 → `{ success:true, message:'Category has been updated successfully!' }`
* 400 → `{error:'Slug is already in use.'}` / generic envelope.

#### `PUT /api/category/:id/active` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `category` | object | yes — typically `{isActive: <bool>}` |

* **Cascade side effect:** when `category.isActive` is falsy, every product referenced in
  `Category.products` is bulk-updated to `isActive:false` (`store.disableProducts` →
  `Product.bulkWrite([{updateOne:{filter:{_id}, update:{isActive:false}}}])`).
  Only products of a **currently active** category are cascaded
  (`Category.findOne({_id, isActive:true})`).
* 200 → `{ success:true, message:'Category has been updated successfully!' }`

#### `DELETE /api/category/delete/:id` — **auth+Admin**
* 200 → `{ success:true, message:'Category has been deleted successfully!', product: <deleteOne result> }`
  (the key is `product`, not `category`).
* Does not deactivate its products, does not unset `Product.category` (there is no such field on
  Product anyway — category membership is stored only on the Category).

---

### 3.7 `routes/api/brand.js` — 8 endpoints (mount `/api/brand`)

#### `POST /api/brand/add` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `description` | string | yes |
| `isActive` | boolean | no (schema default `true`) |

* 200 → `{ success:true, message:'Brand has been added successfully!', brand: <doc> }`
* 400 → `{error:'You must enter description & name.'}` / generic envelope.
* `slug` auto-generated from `name`. No image upload on this route.
* **Note:** a brand created here has `merchant: null` (never linked to a merchant).

#### `GET /api/brand/list` — public
* 200 → `{ brands: [ … ] }` filtered `isActive:true`, `merchant` populated with `name`.
  This is the storefront brand list.

#### `GET /api/brand` — **auth+Admin|Merchant**
* 200 → `{ brands: [ … ] }`; merchant users are scoped to `{merchant: req.user.merchant}`.

#### `GET /api/brand/:id` — public
* 200 → `{ brand: <doc> }` with `merchant` populated as `_id` only.
* 404 → `{message:'Cannot find brand with the id: <id>.'}`
* Route ordering is safe: `/list` and `/list/select` are declared before `/:id`, and `/:id`
  only matches single-segment paths.

#### `GET /api/brand/list/select` — **auth+Admin|Merchant**
* 200 → `{ brands: [ {name, _id} ] }`; merchant users scoped to their own merchant id.

#### `PUT /api/brand/:id` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `brand` | object | yes — passed verbatim |

`brand.slug` uniqueness checked against other docs.
* 200 → `{ success:true, message:'Brand has been updated successfully!' }`
* 400 → `{error:'Slug is already in use.'}` / generic envelope.

#### `PUT /api/brand/:id/active` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `brand` | object | yes — typically `{isActive: <bool>}` |

* **Cascade side effect:** when `brand.isActive` is falsy, **all** `Product.find({brand: brandId})`
  are bulk-updated to `isActive:false`.
* 200 → `{ success:true, message:'Brand has been updated successfully!' }`

#### `DELETE /api/brand/delete/:id` — **auth+Admin**
* **Cascade side effect:** `deactivateMerchant(brandId)` — finds the brand, and if it has a
  `merchant`, sets that Merchant to
  `{status:'Waiting Approval', isActive:false, brand:null}`.
* 200 → `{ success:true, message:'Brand has been deleted successfully!', brand: <deleteOne result> }`
* Does **not** deactivate the brand's products.

---

### 3.8 `routes/api/contact.js` — 1 endpoint (mount `/api/contact`)

#### `POST /api/contact/add` — public
| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `email` | string | yes |
| `message` | string | yes |

* 200 → `{ success:true, message:'We receved your message, we will reach you on your email address <email>!', contact: <doc> }`
  (the message text contains the original typo `receved`).
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter description & name.'}` /
  `{error:'You must enter a message.'}` /
  `{error:'A request already existed for same email address'}` / generic envelope.
* Side effects: inserts into `contacts`; sends the `contact` Mailgun email.
* Uniqueness is enforced on `email` — one contact record per address, ever.

---

### 3.9 `routes/api/merchant.js` — 8 endpoints (mount `/api/merchant`)

#### `POST /api/merchant/add` — **public** (the "sell with us" application)
| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `email` | string | yes |
| `business` | string | yes |
| `phoneNumber` | string | yes |
| `brandName` | string | no |

* 200 → `{ success:true, message:'We received your request! we will reach you on your phone number <phone>!', merchant: <doc> }`
* 400 → `{error:'You must enter your name and email.'}` /
  `{error:'You must enter a business description.'}` /
  `{error:'You must enter a phone number and an email address.'}` /
  `{error:'That email address is already in use.'}` / generic envelope.
* Side effects: inserts into `merchants` with `status:'Waiting Approval'`, `isActive:false`,
  `brand:null`; sends the `merchant-application` Mailgun email.

#### `GET /api/merchant/search?search=<string>` — **auth+Admin**
Regex search (`i`) over `phoneNumber`, `email`, `name`, `brandName`, `status`; `brand` populated fully.
* 200 → `{ merchants: [ … ] }`
* 400 → generic envelope.

#### `GET /api/merchant?page=<n>&limit=<n>` — **auth+Admin**
Defaults `page=1`, `limit=10`; sorted `-created`; `brand` populated fully.
* 200 → `{ merchants: [ … ], totalPages, currentPage, count }`

#### `PUT /api/merchant/:id/active` — **auth** (no role check)
| Field | Type | Required |
|---|---|---|
| `merchant` | object | yes — typically `{isActive: <bool>}` |

* **Cascade side effect:** when `merchant.isActive` is falsy → `deactivateBrand(merchantId)` sets
  the linked Brand to `isActive:false`, and a `merchant-deactivate-account` Mailgun email is sent.
* 200 → `{ success:true }`
* **Gap:** no role guard — any authenticated user can deactivate any merchant.

#### `PUT /api/merchant/approve/:id` — **auth** (no role check)
* Updates the merchant to `{status:'Approved', isActive:true}`.
* **Side effects (multi-collection):**
  1. `createMerchantUser(email, name, merchantId, host)`:
     * If a `users` doc already exists with that email → set `{merchant: merchantId, role:'ROLE MERCHANT'}`
       and then `createMerchantBrand(merchantDoc)`.
     * Else → insert a `users` doc with `firstName = merchant.name`, `lastName = ''`,
       `resetPasswordToken = <48 random hex bytes>`, `merchant = merchantId`,
       `role:'ROLE MERCHANT'`, `provider:'Email'`, and send the `merchant-signup` Mailgun email.
     * In the "existing user" branch a `merchant-welcome` email is sent.
  2. `createMerchantBrand({_id, brandName, business})` inserts into `brands`:
     `{name: brandName, description: business, merchant: <merchantId>, isActive:false}`
     and then sets `Merchant.brand = <new brand _id>`.
  3. Note the approve route calls `createMerchantUser` **unconditionally after** the update, and
     `createMerchantUser` itself calls `createMerchantBrand` in the existing-user branch → the
     merchant can end up with a fresh brand on every approval.
* 200 → `{ success:true }`
* **Gap:** no role guard.

#### `PUT /api/merchant/reject/:id` — **auth** (no role check)
* Updates the merchant to `{status:'Rejected'}` (leaves `isActive` untouched).
* 200 → `{ success:true }`

#### `POST /api/merchant/signup/:token` — **public**
Path param `token` must equal the `User.resetPasswordToken` created at approval time.

| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `firstName` | string | yes |
| `lastName` | string | yes |
| `password` | string | yes |

* Looks up `User.findOne({email, resetPasswordToken: token})` — **if no user matches, `userDoc` is
  `null` and `userDoc._id` throws → generic 400** (no friendly error).
* Side effects: updates `users` with the name, bcrypt-hashed password and
  `resetPasswordToken: undefined`; then `createMerchantBrand(Merchant.findOne({email}))`
  → inserts another `brands` doc (or throws if no merchant matches that email).
* 200 → `{ success:true }`
* There is no login/token returned — the merchant must then log in normally.

#### `DELETE /api/merchant/delete/:id` — **auth+Admin**
* **Cascade side effect:** `deactivateBrand(merchantId)` sets the linked Brand `isActive:false`.
* 200 → `{ success:true, message:'Merchant has been deleted successfully!', merchant: <deleteOne result> }`
* Does not delete the linked `users` doc and does not deactivate its products.

---

### 3.10 `routes/api/cart.js` — 4 endpoints (mount `/api/cart`)

#### `POST /api/cart/add` — **auth**
| Field | Type | Required |
|---|---|---|
| `products` | array of cart items | yes (an empty array creates an empty cart) |

Each item as sent by the reference client (`getCartItems` in
`client/app/containers/Cart/actions.js`):

| Field | Type | Required |
|---|---|---|
| `product` | ObjectId string (the product `_id`) | yes |
| `quantity` | number | yes |
| `price` | number (unit price) | yes |
| `taxable` | boolean | yes |

* Server-side the array goes through `store.caculateItemsSalesTax` which sets, per item:
  `purchasePrice = price`, `totalPrice = round2(price * quantity)`,
  `totalTax = taxable ? round2(price * (taxRate/100) * 100 * quantity) : 0`,
  `priceWithTax = round2(totalPrice + totalTax)`.
  Item `status` is left to the schema default `Not processed`.
* 200 → `{ success:true, cartId: <cart _id> }`
* 400 → generic envelope.
* **Side effects:**
  1. inserts into `carts` with `user = req.user._id`.
  2. `decreaseQuantity(products)` → `Product.bulkWrite` of
     `{updateOne:{filter:{_id: item.product}, update:{$inc:{quantity: -item.quantity}}}}`
     — stock is decremented **here, at cart creation**, not at order time.
* **Gap:** nothing prevents negative `product.quantity`; no stock check is performed.

#### `DELETE /api/cart/delete/:cartId` — **auth**
* 200 → `{ success:true }`
* Hard-deletes the cart. **Stock is not restored.**
* Not scoped to the owner — any authenticated user can delete any cart by id.

#### `POST /api/cart/add/:cartId` — **auth**
| Field | Type | Required |
|---|---|---|
| `product` | object (a raw cart item) | yes — pushed verbatim with `$push` |

* 200 → `{ success:true }`
* **No** tax recalculation, **no** stock decrement, **no** `_id` generation by the server beyond
  the subdocument default. Any extra keys in `product` are stored.
* Not scoped to the owner.

#### `DELETE /api/cart/delete/:cartId/:productId` — **auth**
* `$pull: {products: {product: <productId>}}` — removes **all** line items whose `product`
  equals that product id.
* 200 → `{ success:true }`
* **No** stock restoration, no ownership check.

---

### 3.11 `routes/api/order.js` — 7 endpoints (mount `/api/order`)

#### `POST /api/order/add` — **auth**
| Field | Type | Required |
|---|---|---|
| `cartId` | ObjectId string | yes |
| `total` | number | yes — the **client-computed** cart total |

* 200 → `{ success:true, message:'Your order has been placed successfully!', order: { _id: <orderId> } }`
* 400 → generic envelope.
* **Side effects / cross-collection flow:**
  1. inserts into `orders` → `{cart: cartId, user: req.user._id, total}`.
  2. `Cart.findById(orderDoc.cart._id).populate({path:'products.product', populate:{path:'brand'}})`
     is used only to build the e-mail payload; the order document itself does **not** denormalise
     the line items — they stay reachable only through the `cart` reference.
  3. sends the `order-confirmation` Mailgun email with
     `{_id, created, user, total, products}`.
  4. **The cart is NOT deleted and the order is not marked processed.** The client is responsible
     for clearing its local cart state.
* **Legacy bug:** the mail recipient is `order.user.email`, but `order.user` is an ObjectId
  (`orderDoc.user`), so the address is `undefined` and Mailgun throws internally
  (swallowed by `mailgun.sendEmail`). A rewrite should send to the authenticated user's e-mail.
* **Gap:** `total` is client-supplied and stored untrusted; the server never recomputes it here.

#### `GET /api/order/search?search=<orderId>` — **auth**
* If `search` is not a valid `ObjectId` → `200 {orders: []}` (not a 400).
* Admin → any order id; non-admin → additionally `{user: req.user._id}`.
* Orders whose `cart` populate resolves to `null` are filtered out.
* 200 → `{ orders: [ { _id, total, created, products, totalTax, totalWithTax } ] }`
  where each order has run through `store.caculateTaxAmount` and the array is sorted by
  `created` **descending**. `products` are the populated cart line items.
* 400 → generic envelope.

#### `GET /api/order?page=<n>&limit=<n>` — **auth** (no role check)
Defaults `page=1`, `limit=10`, sorted `-created`, cart→products→product→brand populated.
* 200 → `{ orders: [ … ], totalPages, currentPage, count }` via `store.formatOrders`
  → each row is `{_id, total, created, products}` plus the tax fields added by
  `store.caculateTaxAmount` (`totalTax`, `totalWithTax`, and per item
  `totalPrice`, `purchasePrice`, `priceWithTax`, `totalTax`).
* **Gap / bug:** there is **no `user` filter** — any authenticated user (Member) receives
  **every order in the system**. `count` is also `Order.countDocuments()` (global).

#### `GET /api/order/me?page=<n>&limit=<n>` — **auth**
Same shape as above but scoped `{user: req.user._id}` for both the list and `count`.
* 200 → `{ orders, totalPages, currentPage, count }`

#### `GET /api/order/:orderId` — **auth**
Admin → any order; non-admin → `{_id: orderId, user: req.user._id}`.
* 200 → `{ order: { _id, total, created, totalTax, products, cartId, totalWithTax, … } }`
  (the object is `{_id, total, created, totalTax: 0, products: cart.products, cartId: cart._id}`
  then `store.caculateTaxAmount` adds `totalTax`/`totalWithTax` and per-item tax fields).
* 404 → `{message:'Cannot find order with the id: <orderId>.'}` (also when the cart populate is null).
* **`cartId` is essential** — the status-update endpoint requires it as a body field.

#### `DELETE /api/order/cancel/:orderId` — **auth**
* Non-admin users are **not** ownership-checked here — any authenticated user can cancel any order.
* **Side effects:**
  1. `increaseQuantity(foundCart.products)` → `Product.bulkWrite` `$inc: {quantity: +item.quantity}`
     for every line item (full stock restore).
  2. deletes the `orders` doc, then deletes the `carts` doc.
* 200 → `{ success:true }`
* **Gap:** the whole order is cancelled regardless of item statuses, and there is no check that
  only the owner (or an admin) may do it.

#### `PUT /api/order/status/item/:itemId` — **auth**
| Field | Type | Required |
|---|---|---|
| `orderId` | ObjectId string | yes |
| `cartId` | ObjectId string | yes |
| `status` | string (one of `CART_ITEM_STATUS`) | no — defaults to `Cancelled` |

* Locates the cart with `Cart.findOne({'products._id': itemId})`, then updates the single line item
  with `{'products.$.status': status}`.
* **Cascade when `status === 'Cancelled'`:** `$inc` the product's `quantity` back by
  `foundCartProduct.quantity`.
* **Order auto-cancel:** when *every* line item in the cart has `status === 'Cancelled'`,
  the `orders` doc and the `carts` doc are deleted.
* 200 →
  `{ success:true, orderCancelled:true, message:'Order has been cancelled successfully' }`
  (the message is `Your order has been cancelled successfully` for non-admins)
  **or** `{ success:true, message:'Item has been cancelled successfully!' }` (item cancelled, order alive)
  **or** `{ success:true, message:'Item status has been updated successfully!' }` (any other status).
* The client can distinguish the auto-cancel by the presence of `orderCancelled: true`.
* 400 → generic envelope.
* Note: `itemId` is the **CartItem subdocument `_id`**, not the product id.

---

### 3.12 `routes/api/review.js` — 7 endpoints (mount `/api/review`)

#### `POST /api/review/add` — **auth**
`new Review({...req.body, user: req.user._id})` — the whole body is spread.

| Field | Type | Required |
|---|---|---|
| `product` | ObjectId string | yes in practice |
| `title` | string | yes in practice |
| `rating` | number | yes in practice |
| `review` | string | yes in practice |
| `isRecommended` | boolean | no (default `true`) |
| `status` | string | no in practice — should be left for the server (default `Waiting Approval`) |

* 200 → `{ success:true, message:'Your review has been added successfully and will appear when approved!', review: <doc> }`
* 400 → generic envelope.
* Side effects: inserts into `reviews`; **does not update `Product.averageRating`** (there is no such
  field — see §6).
* **Gap:** because the body is spread, a client can set `status`/`user` independently of the server default.

#### `GET /api/review?page=<n>&limit=<n>` — public
Defaults `page=1`, `limit=10`; sorted `-created`;
`user` populated as `{firstName}` (only), `product` populated as `{name, slug, imageUrl}`.
* 200 → `{ reviews: [ … ], totalPages, currentPage, count }`
* This is the admin/manager review queue and returns reviews of **all** statuses.

#### `GET /api/review/:slug` — public
Path param is the **product slug**.
* Looks up `Product.findOne({slug})`; 404 `{message:'No product found.'}` when the product is
  missing or its brand is inactive/null (note: here the brand is **not** populated, so
  `productDoc.brand` is an ObjectId and the `hasNoBrand` check can never fire → `UNVERIFIED`
  as dead code).
* 200 → `{ reviews: [ … ] }` — only `status:'Approved'`, sorted `-created`,
  `user` populated as `{firstName}`.
* **Note:** the `.populate('user','firstName')` means the client receives only a first name,
  no avatar/id. There is no rating summary payload — the client computes averages/distribution.

#### `PUT /api/review/:id` — **public (no auth)**
| Field | Type | Required |
|---|---|---|
| *(any Review field)* | — | body passed verbatim |

* 200 → `{ success:true, message:'review has been updated successfully!' }`
* **Security gap:** anyone can edit any review (including setting `status:'Approved'`).

#### `PUT /api/review/approve/:reviewId` — **auth** (no role check)
* Sets `{status:'Approved', isActive:true}`.
* 200 → `{ success:true }`
* **Gap:** any authenticated user can approve reviews. `isActive` is not a field on the Review
  schema, so it is silently dropped by Mongoose (strict mode).

#### `PUT /api/review/reject/:reviewId` — **auth** (no role check)
* Sets `{status:'Rejected'}`.
* 200 → `{ success:true }`

#### `DELETE /api/review/delete/:id` — **public (no auth)**
* 200 → `{ success:true, message:'review has been deleted successfully!', review: <deleteOne result> }`
* **Security gap:** unauthenticated delete.

---

### 3.13 `routes/api/wishlist.js` — 2 endpoints (mount `/api/wishlist`)

#### `POST /api/wishlist` — **auth**
| Field | Type | Required |
|---|---|---|
| `product` | ObjectId string | yes |
| `isLiked` | boolean | yes (this is the toggle value) |

* Upsert-by-find-then-create: `Wishlist.findOneAndUpdate({product, user: req.user._id}, {product, isLiked, updated: Date.now()}, {new:true})`.
  Note `findOneAndUpdate` without `upsert` — the insert happens in the `else` branch.
* 200 → `{ success:true, message:'Your Wishlist has been updated successfully!', wishlist: <doc> }`
  (existing row) **or**
  `{ success:true, message:'Added to your Wishlist successfully!', wishlist: <doc> }` (new row).
* 400 → generic envelope.
* Side effects: writes `wishlists` (`isLiked:false` rows are kept, not deleted).

#### `GET /api/wishlist` — **auth**
* `Wishlist.find({user, isLiked: true})`, `product` populated as `{name, slug, price, imageUrl}`,
  sorted `-updated`.
* 200 → `{ wishlist: [ { _id, product: {name, slug, price, imageUrl}, user, isLiked, updated, created } ] }`
* 400 → generic envelope.
* **Note:** the product `_id` is **not** projected out, so the item key is `product._id`.
  There is no `product` slug removal.

---

### 3.14 `routes/api/adminDb.js` — 4 endpoints (mount `/api/admin-db`)

All four are **public (no auth, no role check)** and return **arrays / bare objects** — there is no
`{success}` envelope. Errors → `500 {error: <message>}`.

| Endpoint | Data source | Success body |
|---|---|---|
| `GET /api/admin-db/collections/mongo` | **mongoose** — `mongoose.connection.db.listCollections().toArray()` | `["users","products", …]` (bare string array) |
| `GET /api/admin-db/collections/mongo/:name/count` | **mongoose** — `mongoose.connection.db.collection(name).countDocuments()` | `{ collection: "<name>", count: <n> }` |
| `GET /api/admin-db/collections/oracle` | **node-oracledb / SODA** — new connection from `ORACLE_USER` / `ORACLE_PASSWORD` / `ORACLE_CONNECT_STRING`, `conn.getSodaDatabase().getCollectionNames()` | `["products","reviews", …]` (bare string array) |
| `GET /api/admin-db/collections/oracle/:name/count` | **node-oracledb / SODA** — `soda.openCollection(name).find().count()` | `{ collection: "<name>", count: <n> }` |

Notes for a rewrite:
* The MongoDB branch uses the **existing mongoose connection** (no separate connection pool).
* The Oracle branch opens and closes a **fresh connection per request**.
* The returned collection names are raw: MongoDB names are the pluralised mongoose collections,
  Oracle names are the SODA collection names (`products`, `reviews`, `brands`, `wishlists`, …).
* No pagination, no document preview — counts only.
* Data-source functions used elsewhere: `server/services/llmChat.js` also talks to Oracle via SODA
  (`openCollection('products'|'reviews')` with an `embedding` filter) but is reachable only from
  the RAG service, not from an HTTP route (see §3.15/§3.16).

### 3.15 `POST /api/chat` — public (inline in `routes/api/index.js`)

| Field | Type | Required |
|---|---|---|
| `message` | string | yes |

* Proxies to `services/llmChat.js` → `ragQuery(message)`, which POSTs `{question: message}` to
  `${RAG_API_URL || 'http://localhost:8000/rag'}` and returns `res.data.answer`.
* 200 → `{ response: <answer string> }`
* 500 → `{ error: 'RAG chat failed', details: <err.message> }`
* Collections: none.
* **Note the payload key is `message` in, `response` out** — asymmetric with the RAG service's
  `question`/`answer`.

### 3.16 `routes/api/llmChat.js` — **NOT MOUNTED (dead code)**

Defines `POST /api/llm-chat/message` with body `{message}` → `200 {response}` / `500 {error:'LLM chat failed', details}`.
`routes/api/index.js` only requires `../../services/llmChat` for the inline `/chat` route and never
`require('./llmChat')`. **The path `/api/llm-chat/message` therefore 404s.** A rewrite should
expose exactly one of the two (recommended: keep `POST /api/chat`).

---

## 4. Cross-collection denormalisation & side-effect map

This is the complete list of every place a route writes to more than one collection.

| # | Trigger endpoint | Writes | Detail |
|---|---|---|---|
| 1 | `POST /api/cart/add` | `carts` + `products` | insert cart; `$inc: {quantity: -item.quantity}` per line item (`decreaseQuantity`) |
| 2 | `POST /api/order/add` | `orders` | insert order `{cart, user, total}`; **cart untouched**; e-mail built from the populated cart |
| 3 | `DELETE /api/order/cancel/:orderId` | `products` + `orders` + `carts` | `$inc: {quantity: +item.quantity}` for all items, then delete order, then delete cart |
| 4 | `PUT /api/order/status/item/:itemId` | `carts` + `products` (+ `orders`) | set `products.$.status`; if `Cancelled` → `$inc` product quantity back; if **all** items are `Cancelled` → delete order + cart |
| 5 | `PUT /api/category/:id/active` | `categories` + `products` | when deactivating: `Category.products` → each product `isActive:false` |
| 6 | `PUT /api/brand/:id/active` | `brands` + `products` | when deactivating: every `Product.find({brand})` → `isActive:false` |
| 7 | `DELETE /api/brand/delete/:id` | `brands` + `merchants` | `deactivateMerchant` → merchant `{status:'Waiting Approval', isActive:false, brand:null}` |
| 8 | `DELETE /api/merchant/delete/:id` | `merchants` + `brands` | `deactivateBrand` → brand `isActive:false` |
| 9 | `PUT /api/merchant/:id/active` | `merchants` + `brands` | when deactivating: `deactivateBrand` + deactivation e-mail |
| 10 | `PUT /api/merchant/approve/:id` | `merchants` + `users` + `brands` | status/active flip; upsert merchant user (`role:'ROLE MERCHANT'`, `merchant` link); insert brand `{name: brandName, description: business, merchant, isActive:false}` and set `Merchant.brand` |
| 11 | `POST /api/merchant/signup/:token` | `users` + `brands` | set user name/password and clear `resetPasswordToken`; then `createMerchantBrand` inserts another brand for that merchant |
| 12 | `POST /api/product/add` | `products` only | **does not** update `Category.products` |
| 13 | `DELETE /api/product/delete/:id` | `products` only | **does not** clean `Category.products` or `reviews` |
| 14 | `POST /api/review/add` | `reviews` only | **no** rating denormalisation |
| 15 | `PUT /api/review/approve/:reviewId` | `reviews` only | **no** rating denormalisation |
| 16 | `POST /api/auth/register` | `users` (+ Mailchimp) | |
| 17 | `POST /api/auth/forgot` / `/reset/:token` / `/reset` | `users` | reset token lifecycle |
| 18 | `GET /api/auth/*/callback` | `users` (insert on first social login) | |

### 4.1 There is NO persisted rating denormalisation

`Product.averageRating` **does not exist in the schema and is never written.** It is computed
on the fly by the `GET /api/product/list` aggregation (`totalRatings`, `totalReviews`,
`averageRating` — see §6). It is therefore **absent** from:

* `GET /api/product/item/:slug` (the PDP) — the PDP response has no rating at all;
* `GET /api/product`, `GET /api/product/:id`, `GET /api/product/list/select`.

The storefront therefore has to fetch reviews separately to show a rating on the PDP, or use the
`/api/product/list` aggregation for listing pages only.

### 4.2 There is NO stored cart/order total denormalisation

Totals are derived, never persisted atomically:

| Value | Where it comes from |
|---|---|
| cart `totalPrice` / `totalTax` / `priceWithTax` per item | computed once when the cart is created (`POST /api/cart/add` via `store.caculateItemsSalesTax`) and stored on the CartItem |
| cart total shown in the header | **client-side** (`calculateCartTotal` in `containers/Cart/actions.js` sums `price * quantity` into `localStorage['cart_total']`) |
| `Order.total` | **client-supplied** at `POST /api/order/add` |
| order `totalTax` / `totalWithTax` / item `totalPrice` etc. | computed on **read** by `store.caculateTaxAmount` in `GET /api/order`, `/me`, `/:orderId`, `/search` — never stored |

Consequence for a rewrite: `GET /api/order*` responses always carry freshly computed tax fields;
the stored `Order.total` can disagree with the recomputed sum.

---

## 5. Socket layer (`server/socket/`)

Transport: `socket.io`, created in `server/socket/index.js`, attached to the same HTTP server and
port as Express (`socket(server)` in `server/index.js`). CORS: `origin:'*'`, methods `GET`/`POST`.
The namespace is the default `/`.

### 5.1 Connection authentication (handshake middleware, `io.use(authHandler)`)

* Reads `socket.handshake.auth.token` (i.e. the client must connect with
  `io(SOCKET_URL, {auth: {token}})`).
* The token **must** be the full `Bearer <jwt>` string: it is split on whitespace and
  `authType` must equal `'Bearer'`.
* `jwt.verify(tokenValue, JWT_SECRET)` → payload `{id}` → `User.findById(id)`.
* Failure paths call `next(new Error('no token'))` / `next(new Error('no user found'))`
  → the client receives a `connect_error` event.
* On success an in-memory record is created/reused:

```js
{ id, role, isAdmin: role === 'ROLE ADMIN', name: `${firstName} ${lastName}`,
  socketId, messages: [], online?: bool }
```

* **State is process-local**: `users` and `messages` are plain module-level arrays
  (`server/socket/support.js`). Nothing is persisted to MongoDB, and nothing survives a restart.
  There is no multi-instance support (no Redis adapter).

### 5.2 Events

Direction legend: **C→S** client emits · **S→C** server emits.

| Event | Dir | Payload | Behaviour |
|---|---|---|---|
| `connectUser` | C→S | *(no payload)* | Marks the caller online. If the caller **is an admin** → broadcast `connectUser` with the user record to everyone else. Otherwise → emit `connectUser` with the user record **only to the online admins** (`socket.to(admin.socketId)`). |
| `connectUser` | S→C | `{id, role, isAdmin, name, socketId, messages, online:true}` | Fired by the above. |
| `getUsers` | C→S | *(no payload)* | Presence list request. |
| `getUsers` | S→C | `user[]` | **Admin callers** receive every other connected user (`users.filter(x => x.socketId !== socket.id)`); **non-admin callers** receive only the connected **admins** (`users.filter(x => x.isAdmin === true)` — note: not filtered by `online`). Always emitted `io.to(socket.id)`. If the socket is unknown the payload is the admin list. |
| `getMessages` | C→S | *(no payload)* | |
| `getMessages` | S→C | `message[]` | `messages.filter(m => m.from === me).concat(messages.filter(m => m.to === me))` — i.e. sent **and** received, unsorted, from the in-memory log. |
| `message` | C→S | `{ text: string, to: <user id> }` | Builds `{id: uuidv4(), value: text, time: Date.now(), user: <sender record>, from: sender.id, to: recipient.id}`, pushes to the in-memory `messages` array, then emits to **both** sockets: `io.to(userTo.socketId).to(user.socketId).emit('message', message)`. If `to` is not a connected user id, `userTo` is `undefined` and the emit throws (unhandled). |
| `message` | S→C | `{id, value, time, user, from, to}` | Note the text field is `value`, **not** `text`. |
| `disconnect` | C→S | *(socket.io lifecycle)* | Marks the user `online = false` and broadcasts `disconnectUser`. |
| `disconnectUser` | S→C | the user record | Broadcast to all. |
| `connect_error` | C→S | `Error` | The server **listens** for this on the socket (a client-side event) purely to log `connect_error due to <message>`. |

### 5.3 Client wiring (for parity)

`client/app/contexts/Socket/` provides `SocketProvider` / `SocketContext` / `useSocket`.
`SOCKET_URL` = `http://127.0.0.1:3000` on localhost, otherwise `window.location.host`
(`client/app/constants/index.js`). The socket is **not** used for cart/order/notification — only for
the support chat (`containers/Support`, `components/Manager/Support/*`).

### 5.4 Gaps to design around

* No persistence, no read receipts, no typing indicator, no conversation grouping by peer.
* Messages arrive for the sender *and* the recipient with identical payloads (the client has to
  deduplicate / align by `from`).
* Any user can message any user id; there is no admin-only guard on the server.
* `getUsers` for a non-admin exposes only admins; there is no way for a member to discover another
  member.

---

## 6. `utils/queries.js` — aggregation pipelines

Two exported factories. Both are used **only** by `GET /api/product/list`
(`server/routes/api/product.js`).

### 6.1 `getStoreProductsQuery(min, max, rating)`

Preamble (plain JS, runs in both branches):

```js
rating = Number(rating); max = Number(max); min = Number(min);
const priceFilter  = min && max ? { price: { $gte: min, $lte: max } } : {};
const ratingFilter = rating ? { rating: { $gte: rating } } : { rating: { $gte: rating } };  // both branches identical
const matchQuery = { isActive: true, price: priceFilter.price, averageRating: ratingFilter.rating };
```

Points to note:

* The price filter only applies when **both** `min` and `max` are truthy.
* `ratingFilter`'s ternary has identical branches. With the default (no `rating` query param)
  `Number(undefined)` is `NaN`, so `matchQuery.averageRating` becomes `{ $gte: NaN }`.
  The exact MongoDB match semantics of `$gte: NaN` are **UNVERIFIED**; the constructed value is not.
* When no price filter is supplied, `matchQuery.price` is `undefined` (the key exists with an
  undefined value), which the driver may serialise as `null` — behaviour **UNVERIFIED**.

#### Branch A — Oracle / load-balanced (`process.env.MONGO_URI.includes('loadBalanced')`)

The stages are transparently rewritten into Oracle SQL/JSON by the Oracle Mongo-compatible
extension: MongoDB `$lookup` is replaced by `$sql` stages that the server translates to
`json_mergepatch` + `left outer join`, and intermediate stage aliases (`"Q6"` etc.) become
query names.

| # | Stage | Notes |
|---|---|---|
| 1 | `$sql` `select json_mergepatch(i.data, json_object('brands' : json_array(b.data returning json) returning json)) from input i left outer join brands b on i.data.brand.idOnly() = b.data."_id".idOnly()` | the `$lookup` from `products.brand` → `brands._id` |
| 2 | `$unwind { path:'$brands', preserveNullAndEmptyArrays:true }` | |
| 3 | `$addFields` `'brand.name'`, `'brand._id'`, `'brand.isActive'` from `$brands.*` | replaces the mongoose `brand` ObjectId reference with an embedded sub-document |
| 4 | `$match { 'brand.isActive': true }` | products of inactive brands are excluded |
| 5 | `$sql` `select json_mergepatch(i.data, json_object('reviews': json_array(r.data returning json) returning json)) from "Q6" i left outer join reviews r on i.data."_id".idOnly() = r.data.product.idOnly()` | the `$lookup` from `products._id` → `reviews.product`; reads the previous stage under the alias `Q6` |
| 6 | `$addFields { totalRatings: {$sum:'$reviews.rating'}, totalReviews: {$size:'$reviews'} }` | |
| 7 | `$addFields { averageRating: {$cond:[{$eq:['$totalReviews',0]}, 0, {$divide:['$totalRatings','$totalReviews']}]} }` | 0 when there are no reviews |
| 8 | `$match matchQuery` | `{isActive:true, price:…, averageRating:…}` |
| 9 | `$project { brands: 0, reviews: 0 }` | strips the join artifacts |

#### Branch B — vanilla MongoDB

Identical stage list using real `$lookup`:

1. `$lookup` `brands` on `brand` → `_id` as `brands`
2. `$unwind '$brands'` (`preserveNullAndEmptyArrays:true`)
3. `$addFields` `'brand.name'`, `'brand._id'`, `'brand.isActive'`
4. `$match { 'brand.isActive': true }`
5. `$lookup` `reviews` on `_id` → `product` as `reviews`
6. `$addFields` `totalRatings`, `totalReviews`
7. `$addFields` `averageRating` (same `$cond`)
8. `$match matchQuery`
9. `$project { brands: 0, reviews: 0 }`

**Endpoints consuming this:** `GET /api/product/list` only. `routes/api/product.js` then
optionally appends `$match` stages for the resolved category and brand, appends the wishlist
stage when the caller is authenticated, and finally appends
`[{$sort: sortOrder}, {$skip: size*limit}, {$limit: limit}]`.

### 6.2 `getStoreProductsWishListQuery(userId, brandDoc, categoryDoc)`

Determines an Oracle query alias purely for logging/telemetry purposes:

```js
let alias = 'Q12';                                     // no brand, no category
if (brandDoc && categoryDoc) alias = 'Q14';            // both
else if (brandDoc || categoryDoc) alias = 'Q13';       // exactly one
```

**Branch A — Oracle** (single `$sql` stage):

```sql
select json_mergepatch(i.data, json_object('isLiked': w.is_liked returning json))
from "<alias>" i
left outer join wishlists_root w
  on i.data."_id" = w.product
 and w.ora$user = hextoraw('<userId as a 24-char ObjectId hex>')
```

* The `$addFields { isLiked: { $arrayElemAt: ['$isLiked.isLiked', 0] } }` stage is
  **commented out** in this branch — the `json_mergepatch` already yields the scalar.
* `wishlists_root` is the SODA root table for the `wishlists` collection and `ora$user` is the
  Oracle-managed per-document user column.
* The alias must be one of `Q12`/`Q13`/`Q14`, i.e. it names the **preceding** concatenated
  pipeline built by the caller — the alias is coupled to how many `$match` stages
  `GET /api/product/list` pushed before it.

Oracle-stage equivalence is **UNVERIFIED** against a live Oracle 26ai instance in this review;
the SQL text above is quoted verbatim from the source.

**Branch B — vanilla MongoDB:**

1. `$lookup` `wishlists` with `let: {product: '$_id'}` and a pipeline
   `$match { $and: [ {$expr: {$eq: ['$$product','$product']}}, {user: new ObjectId(userId)} ] }`
   → `as: 'isLiked'`
2. `$addFields { isLiked: { $arrayElemAt: ['$isLiked.isLiked', 0] } }`
   → a boolean, or **missing/undefined** when the user has no wishlist row for that product

Important behavioural difference to preserve: in Branch B, `isLiked` is `undefined` (the key is
absent) when there is no wishlist row; in Branch A the `json_mergepatch` also omits/keeps `null`
depending on the join — **UNVERIFIED**. A React 19 client MUST treat a falsy `isLiked` as
"not liked" rather than relying on the key existing.

### 6.3 `MONGO_URI.includes('loadBalanced')` — what it means

* The check is a runtime string test on the connection string, not a build-time flag.
  The Oracle deployment uses a MongoDB-compatible load-balanced endpoint whose connection string
  contains the literal `loadBalanced` (e.g.
  `mongodb://…/?loadBalanced=true`), which is the standard flag for `mongos`-fronted
  Atlas/OCI load-balanced clusters.
* Consequently **both pipelines must be kept in the source tree**; the branch is selected per
  process at import-call time (evaluated inside the factory on every request).
* Behavioural surface that a rewrite must not assume away: the aggregation returns products whose
  `brand` has been **replaced** by an embedded `{name, _id, isActive}` sub-document (the original
  `brand` ObjectId is overwritten by `$addFields`), items are filtered by the brand's own
  `isActive`, and `averageRating`/`totalRatings`/`totalReviews` are present on every returned row
  with `brands`/`reviews` projected away.

---

## 7. `POST /api/product/list` request/response worked example

Request:

```
GET /api/product/list?sortOrder=%7B%22created%22%3A-1%7D&min=10&max=100&rating=3&category=shirts&brand=acme&page=2&limit=10
Authorization: Bearer <jwt>          (optional)
```

Response (`200`), shape only:

```json
{
  "products": [
    {
      "_id": "…",
      "sku": "…",
      "name": "…",
      "slug": "…",
      "imageUrl": "/images/products/….png",
      "imageKey": "….png",
      "description": "…",
      "quantity": 42,
      "price": 19.99,
      "taxable": true,
      "isActive": true,
      "brand": { "_id": "…", "name": "Acme", "isActive": true },
      "created": "2026-01-01T00:00:00.000Z",
      "totalRatings": 12,
      "totalReviews": 4,
      "averageRating": 3,
      "isLiked": true
    }
  ],
  "totalPages": 3,
  "currentPage": 2,
  "count": 27
}
```

`isLiked` is present only when a valid (unsigned-verified, base64-decoded) bearer token was sent.

---

## 8. Summary of contract gaps a new client must be designed around

| # | Gap | Where |
|---|---|---|
| 1 | `POST /api/llm-chat/message` is never mounted; use `POST /api/chat` | `routes/api/llmChat.js` |
| 2 | No persisted `averageRating` on Product; PDP has no rating | `models/product.js`, `routes/api/product.js` |
| 3 | Uploads are stubbed (no S3/SODA write); URLs are synthetic | `utils/storage.js` |
| 4 | `GET /api/order` and `GET /api/user` have no role/ownership guard | `routes/api/order.js`, `user.js` |
| 5 | `PUT /api/review/:id`, `DELETE /api/review/delete/:id`, all of address `/:id` are unauthenticated | `routes/api/review.js`, `address.js` |
| 6 | Merchant approve/reject, review approve/reject require only `auth`, no role check | `merchant.js`, `review.js` |
| 7 | `Order.total` is client-supplied and never recomputed server-side | `order.js` |
| 8 | `POST /api/auth/reset` uses `password` = old, `confirmPassword` = new | `auth.js` |
| 9 | `POST /api/merchant/signup/:token` 400s via a TypeError when the token is wrong | `merchant.js` |
| 10 | `order-confirmation` e-mail is addressed to `undefined` | `order.js` |
| 11 | `POST /api/product/add` never registers the product in its category | `product.js` |
| 12 | Cart creation decrements stock; cancelling restores it; nothing else does | `cart.js`, `order.js` |
| 13 | `GET /api/product/item/:slug` returns no `averageRating`, but `/api/product/list` does | `product.js` |
| 14 | No CORS/CSRF concerns are handled (cors is wide open, no cookie auth) | `index.js` |
