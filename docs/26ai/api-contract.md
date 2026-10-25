# Express API Contract — `mern-ecommerce/server`

> **Scope.** This is the inventory of the *migrated* server the React 19 client (`mern-ecommerce/web`)
> is built against, plus the 26ai layer added on top of it: the migration showcase routes
> (`/api/admin-db/*`, §3.14), the RAG chat route (`POST /api/chat`, §3.15) and the AI endpoints
> (`/api/ai/*`, §3.16). The server is hardened: every mutating route is authenticated, role-checked
> and ownership-scoped, request bodies are whitelisted, prices and totals come from the database, and
> every error is JSON (§1.5). The same code serves both backends — local MongoDB (migration source)
> and Oracle AI Database 26ai through the Oracle Database API for MongoDB (target) — and the
> storefront behaves identically on both.

Source of truth: `mern-ecommerce/server/routes/**`, `server/models/**`, `server/middleware/**`,
`server/utils/**`, `server/socket/**`, `server/index.js`, `server/config/**`, `server/services/**`.

**Endpoint count: 88 route handlers across the 16 files in `server/routes/api/` (the `POST /chat`
handler lives inline in `routes/api/index.js`), plus `GET /api/health` declared in `server/index.js`
— 89 in total. The unmounted `routes/api/llmChat.js` handler was removed (dead code — §3.15 documents
what replaced it).**

Per-file distribution (verified by counting `router.<verb>(` declarations):
`auth` 9 · `user` 4 · `address` 5 · `newsletter` 1 · `product` 10 · `category` 7 · `brand` 8 ·
`contact` 1 · `merchant` 8 · `cart` 4 · `order` 8 · `review` 7 · `wishlist` 3 · `adminDb` 9 ·
`ai` 3 · `index` 1 (`/chat`).

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

Global middleware, in order (`server/index.js`):

1. `app.set('trust proxy', …)` from `TRUST_PROXY` (`1` = one hop, `true`, or an address/subnet list;
   unset = no proxy). The rate limiters count the address derived from it, so set it to `1` behind
   `web/nginx.conf`.
2. `app.set('query parser', 'simple')` — query strings are parsed as plain `key=value`;
   `category[$ne]=x` stays a string key instead of becoming an operator object.
3. `express.urlencoded({extended:false})`, `express.json()`.
4. `helmet({contentSecurityPolicy:false, frameguard:true})`.
5. `cors({origin: keys.corsOrigins})` — an **allow-list**, not allow-all. `CORS_ORIGINS` is a
   comma-separated list (default `CLIENT_URL`, then `http://localhost:8080`); the same list guards
   the support socket (§5).
6. `GET /api/health` (§3.17), then passport, then the routers, then the JSON 404 and error handlers (§1.5).

**Startup is fail-fast.** `server/config/keys.js` calls `process.exit(1)` when `JWT_SECRET` is
missing or still the published placeholder `update_your_JWT_secret` (and warns below 32 characters).
`server/utils/db.js` connects with `serverSelectionTimeoutMS: 15000`, and on failure logs
`x MongoDB connection failed: mongodb://***:***@host/… - <driver message>` (credentials masked) and
`process.exit(1)`. `server/index.js` calls `app.listen` only inside that promise's `then`, so a wrong
or unreachable `MONGO_URI` stops the process instead of leaving a half-serving API on the port.
`SIGINT`/`SIGTERM` drain the socket and HTTP server, disconnect Mongo and close the Oracle pool
(`oracle.close()`).

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
| `/api/ai` | `ai.js` |
| `/api/chat` | inline `router.post('/chat', …)` inside `routes/api/index.js` |
| `/api/health` | inline `app.get('/api/health', …)` inside `server/index.js` |

### 1.3 Authentication

* Strategy: `passport-jwt`, configured in `server/config/passport.js`.
* Token extraction: `ExtractJwt.fromAuthHeaderAsBearerToken()` →
  header `Authorization: Bearer <jwt>`.
* `server/middleware/auth.js` wraps `passport.authenticate('jwt', {session:false}, cb)` with a custom
  callback so a failure is JSON (see below). `req.user` is the user document **without** `password`,
  `resetPasswordToken` and `resetPasswordExpires` (excluded in `passport.js`).
* **The login/register responses already include the `Bearer ` prefix** in the `token` field.
  A client MUST send that string verbatim as the `Authorization` header (the web client stores it in
  `authSlice` and sets `headers.set('authorization', token)` in `web/src/app/api.js`).
* JWT payload: `{ id: <user._id> }`. Signed HS256 with `JWT_SECRET`, `expiresIn: '7d'`
  (`server/config/keys.js` → `jwt.tokenLife`).
* Failure mode of `auth`: **HTTP 401 `{"error":"Unauthorized"}`** (JSON). There is no
  `/api/auth/me`; user identity is fetched with `GET /api/user/me`.

### 1.4 Role middleware

`server/middleware/role.js` → `role.check(...roles)`:

| Condition | Response |
|---|---|
| `!req.user` | `401 {"error":"Unauthorized"}` |
| `req.user.role` not in the list | `403 {"error":"You are not allowed to make this request."}` |
| `ROLE MERCHANT` whose `Merchant` document is missing or `isActive:false` | `403 {"error":"Your merchant account is disabled."}` |

The merchant check loads the `Merchant` document on every merchant request, so an admin disabling a
merchant (`PUT /api/merchant/:id/active`) takes effect immediately even though the user row keeps
`ROLE MERCHANT`.

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

### 1.5 Response envelope and error conventions

There is no success envelope, but **every error is JSON `{ "error": "<message>", …extra }`** (C1).
`server/index.js` ends the middleware chain with:

* `app.use('/api', …)` → any unknown `/api/**` path answers `404 {"error":"Not found"}`;
* an error handler that maps `entity.parse.failed` (malformed JSON body) to
  `400 {"error":"Malformed JSON body."}`, honours `err.status` (4xx) with `{error: err.message, ...err.extra}`,
  and answers every other thrown error with `500 {"error":"Internal server error"}` (the real
  error is logged, never sent). Async handlers are wrapped in `asyncHandler` (`server/utils/http.js`)
  so a rejected promise reaches this handler instead of hanging the request.

| Situation | Shape |
|---|---|
| Validation error | `400 {"error":"<field-specific message>"}` (e.g. `Your address is not valid.`) |
| Unauthenticated | `401 {"error":"Unauthorized"}` |
| Role failure | `403 {"error":"You are not allowed to make this request."}` |
| Not found / not yours | `404 {"error":"<message>"}` — a resource that belongs to another user is reported as not found, never as forbidden |
| Business conflict | `409 {"error":"<message>", "code":"<CODE>", …}` — cart/order codes in §3.10–3.11 |
| Rate limited | `429 {"error":"Too many …"}` (§1.10) |
| Mail/Mailchimp not configured | `503 {"error":"…"}` (`/auth/forgot`, `/newsletter/subscribe`) |
| Success with a payload | `200 {"success":true, "message":"…", "<entity>": <doc>}` OR a bare key, e.g. `200 {"products":[…], "totalPages":n, "currentPage":n, "count":n}` |

Every 404 uses `error` (`GET /api/review/:slug` included).

Pagination endpoints **always** return `totalPages`, `currentPage`, `count` **alongside the entity
array** (the array is nested under the entity key, the pagination fields are top-level).
`parsePagination` (`server/utils/http.js`) clamps `limit` to `1..50` (default `10`) and `page` to
`1..floor((2^31-1)/limit)+1`, the last page whose `skip` still fits int32: the Oracle Database API for
MongoDB answers `500` for a larger skip, so `?page=99999999999` is a plain `200` on both backends.

No response — on any route — carries `password`, `resetPasswordToken`, `resetPasswordExpires`
(`googleId`/`facebookId` are also hidden from `/api/user*`).

### 1.6 `checkAuth` (optional auth) — `server/utils/auth.js`

`GET /api/product/list` and `GET /api/review` do **not** use the `auth` middleware. They call
`checkAuth(req)`, which **verifies** the bearer token (`jwt.verify(token, JWT_SECRET, {algorithms:['HS256']})`)
and returns the payload `{id, …}` or `null` — an unsigned, forged or expired token is simply
anonymous. This is how the store list returns a personalised `isLiked` flag for logged-in users and
how `GET /api/review` recognises an admin while remaining public.

### 1.7 Uploads

`POST /api/product/add` uses `multer` with `multer.memoryStorage()`, `upload.single('image')`
→ **`multipart/form-data` with the file in the field named `image`**, plus the text fields below.
Limits: one file, **2 MB**, `image/*` MIME only; a larger or non-image upload answers `400`.

`server/utils/storage.js` → `s3Upload(image)` is a **stub** (no cloud storage): it reduces the client
file name to a safe basename and returns

```js
{ imageUrl: '/images/products/' + safeName, imageKey: safeName }   // { imageUrl:'', imageKey:'' } when no file
```

So uploaded files are **not** persisted anywhere; the URL is a synthetic path. The web client renders
generated/local product art (`web/src/lib/productImages.js`, WebP thumbnails under
`web/public/products/thumbs/`) and does not depend on a real CDN.

### 1.8 Email / newsletter side effects

* `server/services/mailchimp.js` → `subscribeToNewsletter(email)` (plain `fetch`, 10 s timeout) posts
  to `lists/<MAILCHIMP_LIST_KEY>/members`. It resolves `{status:'subscribed'}` or `{status:'exists'}`
  and **throws** an Error with `.status` (provider HTTP status, `0` when unreachable) and `.title`
  otherwise. `isConfigured()` is `MAILCHIMP_KEY` + `MAILCHIMP_LIST_KEY`.
* `server/services/mailgun.js` → `sendEmail(email, type, host, data)` (plain `fetch`); template types in
  use: `reset`, `reset-confirmation`, `signup`, `newsletter-subscription`, `contact`,
  `merchant-application`, `merchant-deactivate-account`, `merchant-signup`, `merchant-welcome`,
  `order-confirmation`. Unconfigured (`MAILGUN_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_EMAIL_SENDER`) it
  resolves `{skipped:true}` without a network call; configured and failing it throws.
  `sendEmailSafely` has the same signature but never throws (logs `mail <type> failed: <status>`);
  **transactional mail (signup, contact, order confirmation, merchant mails, reset confirmation) is
  best-effort via `sendEmailSafely`** and never changes an API response. Only the two routes whose
  whole point is the mail — `POST /api/auth/forgot` and `POST /api/newsletter/subscribe` — report
  provider state (503 when unconfigured, 502 when the provider fails).
* `host` (the storefront base URL used in reset and merchant-signup links) is always
  `keys.app.clientURL` (`CLIENT_URL`), never the request's `Host` header.

### 1.9 Tax configuration

`server/config/tax.js`: `{stateCode:'CA', stateName:'California', stateTaxRate: 0.05}`.
The rate is a **percentage** that `store.lineTax` multiplies by 100:
`taxAmount = price * (taxRate/100) * 100` — i.e. for `stateTaxRate = 0.05` the effective rate is
**5% of price**, applied per unit (`* quantity`, rounded to 2 decimals). `UNVERIFIED` whether that is
intended.

### 1.10 Rate limits and operational environment variables

`server/middleware/rateLimit.js` (`express-rate-limit`, per client IP, `standardHeaders: 'draft-7'`,
429 body `{"error": …}`):

| Limiter | Env var (default; `0` disables) | Window | Routes |
|---|---|---|---|
| `authLimiter` | `RATE_LIMIT_AUTH` (50) | 15 min | `POST /auth/login`, `/auth/register`, `/auth/forgot`, `/auth/reset/:token`, `/auth/reset`, `POST /merchant/signup/:token` |
| `formLimiter` | `RATE_LIMIT_FORMS` (30) | 15 min | `POST /contact/add`, `/newsletter/subscribe`, `/merchant/add` |
| `aiLimiter` | `RATE_LIMIT_AI` (30) | 1 min | `POST /chat` and **every** `/api/ai/*` route |

Other env vars that change API behaviour: `JWT_SECRET` (required), `CLIENT_URL`, `CORS_ORIGINS`,
`TRUST_PROXY`, `MONGO_URI`; the Oracle SQL pool uses `ORACLE_CONNECT_STRING`, `ORACLE_APP_USER`,
`ORACLE_APP_PASSWORD` (**no fallback** to `ORACLE_USER`/`ORACLE_PASSWORD` any more — those belong to
the setup scripts), `ORACLE_DV_USER`, `ORACLE_POOL_MAX` (default 6) and `ORACLE_CALL_TIMEOUT_MS`
(default 15000); AI settings are in §3.15–3.16. `server/.env.example` lists them all. An e2e harness
that replays many sign-ins or chat calls from one address needs `RATE_LIMIT_AUTH=0` / `RATE_LIMIT_AI=0`.

### 1.11 Collection names

Mongoose models registered in `server/models/`: `User`, `Address`, `Brand`, `Category`,
`Product`, `Review`, `Cart` + `CartItem`, `Order`, `Merchant`, `Contact`, `Wishlist`.
Mongoose pluralises to the collections: `users`, `addresses`, `brands`, `categories`, `products`,
`reviews`, `carts`, `cartitems`, `orders`, `merchants`, `contacts`, `wishlists`.
Slug plugins are registered per schema (`BrandSchema.plugin(slug)` …), not globally.

---

## 2. Schema reference (drives every request/response shape below)

| Model | Fields (type, default) |
|---|---|
| **User** | `email` String trim lowercase (required unless `provider !== 'Email'`), `phoneNumber` String, `firstName` String, `lastName` String, `password` String, `merchant` ObjectId→Merchant (null), `provider` String required default `Email`, `googleId` String, `facebookId` String, `avatar` String, `role` String default `ROLE MEMBER` (enum Admin/Member/Merchant), `resetPasswordToken` String, `resetPasswordExpires` Date, `updated` Date, `created` Date = now |
| **Address** | `user` ObjectId→User, `address` String, `city` String, `state` String, `country` String, `zipCode` String (all trim, maxlength 200), `isDefault` Boolean default `false`, `updated` Date, `created` Date |
| **Brand** | `name` String trim, `slug` String unique (auto from `name`, separator `-`, truncate 120), `image.data` Buffer, `image.contentType` String, `description` String trim, `isActive` Boolean default `true`, `merchant` ObjectId→Merchant default `null`, `updated` Date, `created` Date |
| **Category** | `_id` ObjectId auto, `name` String trim, `slug` String unique (auto), `image.data` Buffer, `image.contentType` String, `description` String trim, `isActive` Boolean default `true`, `products` [ObjectId→Product], `updated` Date, `created` Date |
| **Product** | `sku` String, `name` String trim, `slug` String unique (auto), `imageUrl` String, `imageKey` String, `description` String trim, `quantity` Number (min 0), `price` Number (min 0), `taxable` Boolean default `false`, `isActive` Boolean default `true`, `brand` ObjectId→Brand default `null`, `updated` Date, `created` Date. **`averageRating` is NOT a schema field** — it is computed by the aggregation (§6). |
| **Review** | `product` ObjectId→Product (null), `user` ObjectId→User (null), `title` String trim, `rating` Number **required, 1..5**, `review` String trim, `isRecommended` Boolean default `true`, `status` String default `Waiting Approval` (enum Waiting Approval/Rejected/Approved), `updated` Date, `created` Date |
| **Cart** | `products` [CartItem], `user` ObjectId→User, `updated` Date, `created` Date |
| **CartItem** (subdoc, gets its own `_id`) | `product` ObjectId→Product, `quantity` Number (integer, min 1), `purchasePrice` Number default `0`, `totalPrice` Number default `0`, `priceWithTax` Number default `0`, `totalTax` Number default `0`, `status` String default `Not processed` (enum: Not processed/Processing/Shipped/Delivered/Cancelled) |
| **Order** | `cart` ObjectId→Cart, `user` ObjectId→User, `total` Number default `0` (min 0), `updated` Date, `created` Date |
| **Merchant** | `name` String trim, `email` String (trim, lowercase, max 254), `phoneNumber` String (max 40), `brandName` String (max 100), `business` String trim, `isActive` Boolean default `false`, `brand` ObjectId→Brand default `null`, `status` String default `Waiting Approval` (enum Waiting Approval/Rejected/Approved), `updated` Date, `created` Date |
| **Contact** | `name` String trim (max 100), `email` String (trim, lowercase, max 254), `message` String trim (max 2000), `updated` Date, `created` Date |
| **Wishlist** | `product` ObjectId→Product (null), `user` ObjectId→User (null), `isLiked` Boolean default `false`, `updated` Date default now, `created` Date default now |

---

## 3. Endpoints

Legend for **Auth**: `—` = public · `auth` = valid JWT · `auth+Admin` etc. = JWT **and** `role.check`.
`pick(body, keys)` (`server/utils/http.js`) copies whitelisted keys only — no route spreads a request
body into a document.

### 3.1 `routes/api/auth.js` — 9 endpoints (mount `/api/auth`)

Credentials must be plain non-empty strings (`isText`): an object such as `{"$ne":null}` is rejected
with `400` before it can reach a query. E-mail addresses are stored trimmed and lowercased
(`normalizeEmail`) and looked up the same way.

#### `POST /api/auth/login` — public, `authLimiter`
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `password` | string | yes |

* 200 → `{ success: true, token: "Bearer <jwt>", user: { id, firstName, lastName, email, role } }`
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter a password.'}` /
  `{error:'No user found for this email address.'}` /
  `{error:'That email address is already in use using <provider> provider.'}`
  (when `user.provider !== 'Email'`) / `{success:false, error:'Password Incorrect'}`
  (also for an account that has no password yet, e.g. an unfinished merchant signup)
* Collections: reads `users`. Nothing written.

#### `POST /api/auth/register` — public, `authLimiter`
| Field | Type | Required |
|---|---|---|
| `email` | string | yes (must look like an e-mail) |
| `firstName` | string | yes |
| `lastName` | string | yes |
| `password` | string | yes |
| `isSubscribed` | boolean | no (default falsy) |

* 200 → `{ success:true, subscribed: <bool>, token:"Bearer <jwt>", user:{ id, firstName, lastName, email, role } }`
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter a valid email address.'}` /
  `{error:'You must enter your full name.'}` / `{error:'You must enter a password.'}` /
  `{error:'That email address is already in use.'}`
* Side effects: inserts into `users` (password bcrypt-hashed, cost 10, role always `ROLE MEMBER`);
  if `isSubscribed` **and** Mailchimp is configured → subscribe (a provider failure is logged and
  does **not** block sign-up; `subscribed` is `true` for `subscribed`/`exists`); best-effort `signup`
  Mailgun email.
* **Gap:** `isSubscribed` is **not persisted** on the `User` model.

#### `POST /api/auth/forgot` — public, `authLimiter`
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |

* 200 → `{ success:true, message:'Please check your email for the link to reset your password.' }`
* 400 → `{error:'You must enter an email address.'}` / `{error:'No user found for this email address.'}`
* **503** → `{error:'Password reset e-mail is not available on this server.'}` when Mailgun is not
  configured (checked first, so no token is created that nobody could receive).
* 502 → `{error:'We could not send the reset e-mail. Try again later.'}` when the provider fails; the
  freshly written token is removed again.
* Side effects: updates `users`: `resetPasswordToken = <48 random bytes as hex>`,
  `resetPasswordExpires = now + 3600000 ms (1 hour)`; sends the `reset` Mailgun email with the token.

#### `POST /api/auth/reset/:token` — public, `authLimiter`
Path param `token` = the hex string from the email link.

| Field | Type | Required |
|---|---|---|
| `password` | string | yes |

* 200 → `{ success:true, message:'Password changed successfully. Please login with your new password.' }`
* 400 → `{error:'You must enter a password.'}` /
  `{error:'Your token has expired. Please attempt to reset your password again.'}`
  (also returned when no user matches the token)
* Side effects: updates `users` (`password` re-hashed, `resetPasswordToken`/`resetPasswordExpires`
  cleared); best-effort `reset-confirmation` Mailgun email.
* Lookup is `{resetPasswordToken: String(token), resetPasswordExpires: {$gt: Date.now()}}`.

#### `POST /api/auth/reset` — **auth**, `authLimiter`
| Field | Type | Required |
|---|---|---|
| `password` | string | yes (the **old** password — it is verified against the bcrypt hash) |
| `confirmPassword` | string | yes (the **new** password — it is what gets stored) |

* 200 → `{ success:true, message:'Password changed successfully. Please login with your new password.' }`
* 400 → `{error:'You must enter a password.'}` / `{error:'You must confirm your new password.'}` /
  `{error:'Please enter your correct old password.'}` (also for an account without a password)
* 401 `{error:'Unauthorized'}` when `req.user.email` is missing.
* Side effects: updates `users`; best-effort `reset-confirmation`.
* **Naming trap:** `password` = old, `confirmPassword` = new. Do not swap them.
* **Gap:** there is no `confirmPassword` match check in the request body — the field is only used
  as the new value.

#### `GET /api/auth/google` — public
Redirects (302) to Google OAuth. Strategy options: `scope:['profile','email']`,
`accessType:'offline'`, `approvalPrompt:'force'`, `session:false`. When `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` are not set the route is still mounted but answers
`501 {error:'Google sign-in is not configured.'}`.

#### `GET /api/auth/google/callback` — public
* On failure → `302` to `${CLIENT_URL}/login`.
* On success → `302` to `${CLIENT_URL}/auth/success?token=<url-encoded "Bearer <jwt>">`.
  The token is passed **in the query string** (the web `AuthSuccess` page picks it up and clears the URL).
* Side effects (inside the strategy, `server/config/passport.js`): finds `users` by `email`;
  if absent, inserts a user with `provider:'Google'`, `googleId: profile.id`, `email`,
  `firstName`/`lastName` split from `displayName`, `avatar: profile.picture`, `password: null`,
  `role` default `ROLE MEMBER`. A Google login does **not** sign into an existing `provider:'Email'`
  account with the same address.
* Unconfigured → `501 {error:'Google sign-in is not configured.'}`.

#### `GET /api/auth/facebook` — public
Redirects (302) to Facebook OAuth, `scope:['public_profile','email']`,
`profileFields:['id','displayName','name','emails','picture.type(large)']`. Unconfigured →
`501 {error:'Facebook sign-in is not configured.'}`.

#### `GET /api/auth/facebook/callback` — public
Same contract as the Google callback: failure → `${CLIENT_URL}/login`,
success → `${CLIENT_URL}/auth/success?token=<url-encoded "Bearer <jwt>">`.
Candidate lookup is `{facebookId: profile.id}`; new users get `provider:'Facebook'`,
`facebookId`, `email = profile.emails?.[0]?.value ?? null`, `firstName`/`lastName` from
`profile.name`, `avatar = profile.photos[0].value`, `password: null`.

---

### 3.2 `routes/api/user.js` — 4 endpoints (mount `/api/user`)

Hidden on every response: `password`, `resetPasswordToken`, `resetPasswordExpires`, `googleId`,
`facebookId`.

#### `GET /api/user/search?search=<string>` — **auth+Admin**
Query: `search` (string, required, escaped and used as a case-insensitive regex over `firstName`,
`lastName`, `email`).
* 200 → `{ users: [ … ] }` — at most **50** rows, `_id` projected out, `merchant` populated with only `name`.
* 400 → `{error:'You must enter a search term.'}`
* Collections: reads `users` (+ `merchants` for the populate).
* **Note:** `_id` is excluded, so a client cannot key rows by `_id` from this endpoint.

#### `GET /api/user?page=<n>&limit=<n>` — **auth+Admin**
Query defaults: `page=1`, `limit=10` (clamped to `1..50`). Sorted `-created`.
* 200 → `{ users: [ … ], totalPages, currentPage, count }`; `_id` projected out;
  `merchant` populated with only `name`.
* A member or merchant gets `403`.

#### `GET /api/user/me` — **auth**
* 200 → `{ user: <full user doc minus the hidden fields> }` with two levels of population:
  `merchant` → Merchant, and inside it `brand` → Brand.
* Collections: reads `users`, `merchants`, `brands`.

#### `PUT /api/user` — **auth**
| Field | Type | Required |
|---|---|---|
| `profile` | object | yes — only `firstName`, `lastName`, `phoneNumber`, `avatar` are read (strings) |

* 200 → `{ success:true, message:'Your profile is successfully updated!', user: <updated doc, hidden fields removed> }`
* 400 → `{error:'Your profile is not valid.'}` (non-string value or failed validation).
* Sends no email. `role`, `email`, `password`, `merchant` … inside `profile` are ignored, so a
  member cannot promote themselves.

---

### 3.3 `routes/api/address.js` — 5 endpoints (mount `/api/address`)

All five are **auth** and owner-scoped: every lookup is `{_id, user: req.user._id}`, so a foreign,
malformed or unknown id answers `404 {error:'Address not found.'}` (admins are not exempt).

#### `POST /api/address/add` — **auth**
| Field | Type | Required |
|---|---|---|
| `address` | string | no (whitelisted; the web form requires it) |
| `city` | string | no (whitelisted; the web form requires it) |
| `state` | string | no (whitelisted; the web form requires it) |
| `country` | string | no (whitelisted; the web form requires it) |
| `zipCode` | string | no (whitelisted; the web form requires it) |
| `isDefault` | boolean | no |

Only those six keys are read (`ADDRESS_FIELDS`); `user` is always the JWT subject.
* 200 → `{ success:true, message:'Address has been added successfully!', address: <doc> }`
* 400 → `{error:'Your address is not valid.'}` (schema validation, e.g. a field over 200 characters).
* Side effects: inserts into `addresses`. No default-address uniqueness enforcement.

#### `GET /api/address` — **auth**
* 200 → `{ addresses: [ … ] }` for the JWT user only (`{user: req.user._id}`).

#### `GET /api/address/:id` — **auth**, owner
* 200 → `{ address: <doc> }`
* 404 → `{error:'Address not found.'}`

#### `PUT /api/address/:id` — **auth**, owner
| Field | Type | Required |
|---|---|---|
| *(any of the six address fields)* | — | whitelisted, validated |

* 200 → `{ success:true, message:'Address has been updated successfully!' }` (no document echoed)
* 400 → `{error:'Your address is not valid.'}`; 404 → `{error:'Address not found.'}`

#### `DELETE /api/address/delete/:id` — **auth**, owner
* 200 → `{ success:true, message:'Address has been deleted successfully!', address: <deleteOne result> }`
  (`address` here is `{acknowledged, deletedCount}`, **not** the deleted document).
* 404 → `{error:'Address not found.'}` when nothing was deleted.

---

### 3.4 `routes/api/newsletter.js` — 1 endpoint (mount `/api/newsletter`)

#### `POST /api/newsletter/subscribe` — public, `formLimiter`
| Field | Type | Required |
|---|---|---|
| `email` | string | yes (must look like an e-mail) |

* 200 → `{ success:true, message:'You have successfully subscribed to the newsletter' }`, or
  `{ success:true, message:"You're already subscribed." }` when Mailchimp already has the member.
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter a valid email address.'}` /
  `{error:'We could not subscribe that email address. Please check it and try again.'}` (Mailchimp answered 400).
* **503** → `{error:'Newsletter sign-up is not available right now.'}` when `MAILCHIMP_KEY` /
  `MAILCHIMP_LIST_KEY` are not configured (they are not in the demo; the web footer shows the message).
* 502 → `{error:'The newsletter service is unavailable. Try again later.'}` on any other provider failure.
* Side effects: Mailchimp list member add; best-effort `newsletter-subscription` Mailgun email.
  **No local collection is written.**

---

### 3.5 `routes/api/product.js` — 10 endpoints (mount `/api/product`)

Merchant scoping (used below): a `ROLE MERCHANT` user is restricted to products whose `brand` is one
of `Brand.find({merchant: req.user.merchant})`; a merchant without a merchant link or brand owns
nothing (an empty `$in`, never an unscoped query). Admins are unscoped.

#### `GET /api/product/item/:slug` — public
* 200 → `{ product: <doc> }` with `brand` populated as `{name, isActive, slug}`.
* 404 → `{error:'No product found.'}` when the doc is missing, inactive (`isActive:false`),
  or its brand is `null`/`isActive:false`.
* Collections: reads `products`, `brands`.
* This is the store PDP load; `averageRating` is **not** present here (see §6) — the PDP gets its
  rating from `GET /api/review/:slug`.

#### `GET /api/product/list/search/:name` — public
Path param `name` → `{ name: { $regex: new RegExp(escapeRegex(name), 'i') }, isActive: true }`
(see the `GET /list/search/:name` handler in `server/routes/api/product.js`; `escapeRegex` is in
`server/utils/utils.js`). Projection `{name:1, slug:1, imageUrl:1, price:1, _id:0}`, sorted
`{name:1, _id:1}`, **capped at 20**.
* 200 → `{ products: [ {name, slug, imageUrl, price} ] }` — an empty result is `200 {products: []}`, never 404.
* **Cross-backend note (fixed):** the regex flags MUST sit on the `RegExp` (`'i'`), not in a
  `$options` field — the Oracle Database API for MongoDB ignores `$options` on a find filter, so
  a `{ $regex: new RegExp(name), $options: 'is' }` filter was case-insensitive on MongoDB and
  case-sensitive on Oracle (`mug` → 3 hits locally, 0 on Oracle). Measured after the fix, on both
  `:3001` and `:3000`: `mug`/`MUG`/`enamel`/`camp` → 3/3/3/3, and a term with regex metacharacters
  (`(`) → 200 with 0 hits instead of an error (the term is escaped).
  The same `new RegExp(escapeRegex(term), 'i')` pattern is used by `GET /api/user/search` and
  `GET /api/merchant/search`.
* Used by the navigation search bar (the client debounces keystrokes — see `ui-inventory.md`).

#### `GET /api/product/list` — **public, optionally personalised**
Query parameters (all optional; every value must be a single plain string — a repeated key such as `?category=a&category=b` is `400 {error:'Invalid category filter.'}`, and with the simple query parser an operator form like `category[$ne]=x` is just an unknown, ignored key):

| Param | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | — | case-insensitive **substring** of the product name (escaped, NUL bytes dropped, first 100 characters) |
| `category` | string | — | category **slug** (active categories only) |
| `brand` | string | — | brand **slug** (active brands only) |
| `min` | number-like string | — | inclusive lower price bound; applied on its own; clamped to `0..1e9` (the Oracle API answers 500 for a NUMBER beyond ~1e126, so out-of-range values are clamped on both backends, `Infinity` included) |
| `max` | number-like string | — | inclusive upper price bound; applied on its own; clamped to `0..1e9` |
| `rating` | number-like string | `0` | minimum `averageRating` (Approved reviews only); clamped to `0..5` |
| `sortOrder` | JSON string | `{"created":-1}` | whitelist: `created`, `price`, `name`, `averageRating`, each `1` or `-1`; `_id` is appended as a tiebreak so paging is stable. A missing, invalid or unlisted value falls back to `{created:-1}` — **never a 400** |
| `page` | number | `1` | clamped to the last page (and, before that, to the last page whose `skip` fits int32 — see §1.5) |
| `limit` | number | `10` | clamped to `1..50` |

* 200 →
  `{ products: [ … ], totalPages: Math.ceil(count/limit), currentPage, count }`
  where `count` is the **filtered total**; `currentPage = min(page, totalPages)`.
* A `category` or `brand` slug that matches nothing (or an inactive one), and any filter that yields
  no rows, answers `200 {products:[], totalPages:0, currentPage:1, count:0}` — an unknown slug is
  "nothing", not "ignore the filter".
* The filters run inside the aggregation of §6.1 (`getStoreProductsQuery`); the category filter is
  `_id ∈ category.products`, the brand filter is the brand `_id`.
* **`isLiked`:** when a *verified* bearer token is present (`checkAuth`) every product carries
  `isLiked` — `true`/`false`, present on **both** backends; anonymous callers get no `isLiked` key.
* Review aggregates (`totalRatings`, `totalReviews`, `averageRating`) count **Approved reviews only**.
* Collections: reads `products`, `brands`, `reviews`, `categories`, and `wishlists` when logged in.
* Pipeline details in §6. Worked example in §7.

#### `GET /api/product/list/select` — **auth+Admin|Merchant**
* 200 → `{ products: [ {name, _id} ] }` — all products (active or not), merchant-scoped.
* Used to populate the category/product multi-selects in the manager UI.

#### `POST /api/product/add` — **auth+Admin|Merchant**, `multipart/form-data`, field `image`
| Field | Type | Required |
|---|---|---|
| `sku` | string | yes |
| `name` | string | yes |
| `description` | string | yes |
| `quantity` | whole number ≥ 0 | yes (`0` is allowed) |
| `price` | number > 0 | yes |
| `taxable` | boolean | no (default `false`; `"true"`/`"false"` strings from multipart are accepted) |
| `isActive` | boolean | no (default `true`) |
| `brand` | ObjectId string | no for admins (must exist); **ignored for merchants** — their own brand is used |
| `image` | file | no (≤ 2 MB, `image/*`) |

* 200 → `{ success:true, message:'Product has been added successfully!', product: <doc> }`
* 400 → `{error:'You must enter sku.'}` / `{error:'You must enter description & name.'}` /
  `{error:'Quantity must be a whole number, 0 or more.'}` / `{error:'You must enter a price above 0.'}` /
  `{error:'Taxable and active must be true or false.'}` / `{error:'Unknown brand.'}` /
  `{error:'This sku is already in use.'}` / an upload error (size, type).
* 403 → `{error:'Your account has no brand to list products under.'}` for a merchant without a brand.
* Side effects: inserts into `products`; `imageUrl`/`imageKey` come from the stubbed `s3Upload`.
* **Gap:** the route does **not** push the new product id into the `Category.products` array
  (the seeder does that, the API does not). Category membership is therefore not maintained by
  product creation.

#### `GET /api/product` — **auth+Admin|Merchant**
* 200 → `{ products: [ … ] }`, each with `brand` populated (including its `merchant`); merchant-scoped.

#### `GET /api/product/:id` — **auth+Admin|Merchant**
* 200 → `{ product: <doc> }` with `brand` populated as `{name}`; merchant-scoped.
* 404 → `{error:'No product found.'}` (malformed id, unknown id, or another merchant's product).

#### `PUT /api/product/:id` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `product` | object | yes — **partial**: only the keys present are validated and written (`sku`, `name`, `slug`, `description`, `quantity`, `price`, `taxable`, `isActive`; `brand` for admins only) |

`sku` and `slug` inside `product` are checked for uniqueness against other documents.
* 200 → `{ success:true, message:'Product has been updated successfully!' }`
* 400 → `{error:'Sku or slug is already in use.'}` / `{error:'Invalid <field>.'}` /
  `{error:'There is nothing to update.'}`
* 404 → `{error:'No product found.'}` — including a product that belongs to another merchant's brand.

#### `PUT /api/product/:id/active` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `product` | object | yes — `{isActive: <bool>}` (booleans or `"true"`/`"false"`) |

* 200 → `{ success:true, message:'Product has been updated successfully!' }`
* 400 → `{error:'isActive must be true or false.'}`; 404 → `{error:'No product found.'}` (also out of scope).
* Unlike brand/category deactivation this does **not** cascade to anything.

#### `DELETE /api/product/delete/:id` — **auth+Admin|Merchant**
* 200 → `{ success:true, message:'Product has been deleted successfully!', product: <deleteOne result> }`
* 404 → `{error:'No product found.'}` when nothing matched (out of scope for a merchant).
* Hard delete; does **not** pull the id out of `Category.products`, does not touch reviews, and
  `GET /api/wishlist` drops the dangling entry (§3.13).

---

### 3.6 `routes/api/category.js` — 7 endpoints (mount `/api/category`)

#### `POST /api/category/add` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `description` | string | yes |
| `products` | array of ObjectId | no |
| `isActive` | boolean | no (default `true`) |

* 200 → `{ success:true, message:'Category has been added successfully!', category: <doc> }`
* 400 → `{error:'You must enter description & name.'}` / `{error:'Invalid products.'}` /
  `{error:'isActive must be true or false.'}`
* `slug` is auto-generated from `name` by `mongoose-slug-generator`. No image is accepted here
  (the model has an `image` sub-document but the route never populates it).

#### `GET /api/category/list` — public
* 200 → `{ categories: [ … ] }` filtered to `isActive:true` (store nav / filters).
  Includes each category's `products` array (full ids).

#### `GET /api/category` — **auth+Admin**
* 200 → `{ categories: [ … ] }` — **all** categories including inactive (manager UI). A member gets `403`.

#### `GET /api/category/:id` — public, active only
* 200 → `{ category: <doc> }` with `products` populated as `{name}`.
* 404 → `{error:'No Category found.'}` (unknown id, malformed id, or an inactive category).

#### `PUT /api/category/:id` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `category` | object | yes — only `name`, `slug`, `description`, `products` are read |

`category.slug` is checked for uniqueness against other documents.
* 200 → `{ success:true, message:'Category has been updated successfully!' }`
* 400 → `{error:'Slug is already in use.'}` / `{error:'Invalid <field>.'}` / `{error:'Invalid products.'}` /
  `{error:'There is nothing to update.'}`; 404 → `{error:'No Category found.'}`.
* Activation is **not** writable here — use `/:id/active`.

#### `PUT /api/category/:id/active` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `category` | object | yes — `{isActive: <boolean>}` (a non-boolean is `400 {error:'isActive must be true or false.'}`) |

* **Cascade side effect:** when `category.isActive` is `false`, every product referenced in
  `Category.products` is bulk-updated to `isActive:false` (`store.disableProducts` →
  `Product.bulkWrite([{updateOne:{filter:{_id}, update:{isActive:false}}}])`).
  Only products of a **currently active** category are cascaded
  (`Category.findOne({_id, isActive:true})`).
* 200 → `{ success:true, message:'Category has been updated successfully!' }`; 404 → `{error:'No Category found.'}`

#### `DELETE /api/category/delete/:id` — **auth+Admin**
* 200 → `{ success:true, message:'Category has been deleted successfully!', product: <deleteOne result> }`
  (the key is `product`, not `category`).
* 404 → `{error:'No Category found.'}`.
* Does not deactivate its products, does not unset `Product.category` (there is no such field on
  Product anyway — category membership is stored only on the Category).

---

### 3.7 `routes/api/brand.js` — 8 endpoints (mount `/api/brand`)

A merchant's "managed brands" are `{merchant: req.user.merchant}`; admins manage all.

#### `POST /api/brand/add` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `description` | string | yes |
| `isActive` | boolean | no (default `true`) |

* 200 → `{ success:true, message:'Brand has been added successfully!', brand: <doc> }`
* 400 → `{error:'You must enter description & name.'}` / `{error:'isActive must be true or false.'}`
* `slug` auto-generated from `name`. No image upload on this route.
* **Note:** a brand created here has `merchant: null` (never linked to a merchant).

#### `GET /api/brand/list` — public
* 200 → `{ brands: [ … ] }` filtered `isActive:true`, `merchant` populated with `name`, **each brand
  carrying `productCount`** (number of *active* products of that brand, from one `Product.aggregate`
  `$match`/`$group`; `0` when none). This is the storefront brand list.

#### `GET /api/brand` — **auth+Admin|Merchant**
* 200 → `{ brands: [ … ] }`; merchant users are scoped to `{merchant: req.user.merchant}`.

#### `GET /api/brand/:id` — public, active only
* 200 → `{ brand: <doc> }` (the owning merchant is **not** populated or disclosed).
* 404 → `{error:'Cannot find brand with the id: <id>.'}` (unknown, malformed or inactive).
* Route ordering is safe: `/list` is declared first, and `/:id` only matches single-segment paths
  (`/list/select` is two segments).

#### `GET /api/brand/list/select` — **auth+Admin|Merchant**
* 200 → `{ brands: [ {name, _id} ] }`; merchant users scoped to their own merchant id.

#### `PUT /api/brand/:id` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `brand` | object | yes — only `name`, `slug`, `description` are read (non-empty strings) |

`brand.slug` uniqueness checked against other docs. The merchant link and `isActive` are never
client-writable here.
* 200 → `{ success:true, message:'Brand has been updated successfully!' }`
* 400 → `{error:'Slug is already in use.'}` / `{error:'Invalid <field>.'}` / `{error:'There is nothing to update.'}`
* 404 → `{error:'Cannot find brand with the id: <id>.'}` (also another merchant's brand).

#### `PUT /api/brand/:id/active` — **auth+Admin|Merchant**
| Field | Type | Required |
|---|---|---|
| `brand` | object | yes — `{isActive: <boolean>}` (non-boolean → `400 {error:'isActive must be true or false.'}`) |

* **Cascade side effect:** when `brand.isActive` is `false`, **all** `Product.find({brand: brandId})`
  are bulk-updated to `isActive:false`.
* 200 → `{ success:true, message:'Brand has been updated successfully!' }`; 404 for an out-of-scope brand.

#### `DELETE /api/brand/delete/:id` — **auth+Admin**
* **Cascade side effect:** `deactivateMerchant(brandId)` — finds the brand, and if it has a
  `merchant`, sets that Merchant to
  `{status:'Waiting Approval', isActive:false, brand:null}`.
* 200 → `{ success:true, message:'Brand has been deleted successfully!', brand: <deleteOne result> }`
* Does **not** deactivate the brand's products.

---

### 3.8 `routes/api/contact.js` — 1 endpoint (mount `/api/contact`)

#### `POST /api/contact/add` — public, `formLimiter`
| Field | Type | Required |
|---|---|---|
| `name` | string | yes (≤ 100 characters) |
| `email` | string | yes (must look like an e-mail) |
| `message` | string | yes (≤ 2000 characters) |

* 200 → `{ success:true, message:'We receved your message, we will reach you on your email address <email>!', contact: <doc> }`
  (the message text contains the original typo `receved`; `<email>` is the normalised address).
* 400 → `{error:'You must enter an email address.'}` / `{error:'You must enter a valid email address.'}` /
  `{error:'You must enter description & name.'}` / `{error:'You must enter a message.'}` /
  `{error:'Your message must be 2000 characters or fewer.'}`
* Side effects: inserts into `contacts`; best-effort `contact` Mailgun email. The same address may
  send any number of messages (there is no uniqueness rule any more).

---

### 3.9 `routes/api/merchant.js` — 8 endpoints (mount `/api/merchant`)

#### `POST /api/merchant/add` — **public** (the "sell with us" application), `formLimiter`
| Field | Type | Required |
|---|---|---|
| `name` | string | yes (≤ 100) |
| `email` | string | yes (valid e-mail) |
| `business` | string | yes (≤ 2000) |
| `phoneNumber` | string | yes (≤ 40) |
| `brandName` | string | no (≤ 100) |

* 200 → `{ success:true, message:'We received your request! we will reach you on your phone number <phone>!', merchant: <doc> }`
* 400 → `{error:'You must enter your name and a valid email.'}` /
  `{error:'You must enter a business description.'}` /
  `{error:'You must enter a phone number and an email address.'}` /
  `{error:'Your brand name is not valid.'}` /
  `{error:'That email address is already in use.'}`
* Side effects: inserts into `merchants` with `status:'Waiting Approval'`, `isActive:false`,
  `brand:null`; best-effort `merchant-application` Mailgun email.

#### `GET /api/merchant/search?search=<string>` — **auth+Admin**
Escaped regex search (`i`) over `phoneNumber`, `email`, `name`, `brandName`, `status`; `brand`
populated with `name`; at most 50 rows.
* 200 → `{ merchants: [ … ] }`
* 400 → `{error:'You must enter a search term.'}`

#### `GET /api/merchant?page=<n>&limit=<n>` — **auth+Admin**
Defaults `page=1`, `limit=10`; sorted `-created`; `brand` populated fully.
* 200 → `{ merchants: [ … ], totalPages, currentPage, count }`

#### `PUT /api/merchant/:id/active` — **auth+Admin**
| Field | Type | Required |
|---|---|---|
| `merchant` | object | yes — `{isActive: <boolean>}` (anything else → `400 {error:'isActive must be true or false.'}`) |

* **Cascade side effect:** when `merchant.isActive` is `false` → `deactivateBrand(merchantId)` sets
  the linked Brand to `isActive:false`, and a best-effort `merchant-deactivate-account` Mailgun email
  is sent. The merchant user immediately loses merchant access (`role.check`, §1.4).
* 200 → `{ success:true }`; 404 → `{error:'Merchant not found.'}`

#### `PUT /api/merchant/approve/:id` — **auth+Admin**
* **409** `{error:'That email belongs to an administrator account.'}` when a user with the merchant's
  e-mail has `ROLE ADMIN` — checked before anything is written; the merchant stays unchanged and the
  admin is never demoted.
* Otherwise updates the merchant to `{status:'Approved', isActive:true}`.
* **Side effects (multi-collection)** — `createMerchantUser(merchantDoc, existingUser)`:
  * If a `users` doc already exists with that email → `createMerchantBrand` (once, see below), and the
    user is set to `{merchant: merchantId, role:'ROLE MERCHANT'}`. A user of provider `Email` **without a
    password** (signup never finished) also gets a fresh `resetPasswordToken` + `resetPasswordExpires =
    now + 7 days` in the same update and the `merchant-signup` email, so re-approving revives an expired
    link (the previous token stops working); any other user gets the best-effort `merchant-welcome` email.
  * Else → insert a `users` doc with `firstName = merchant.name`, `lastName = ''`,
    `resetPasswordToken = <48 random hex bytes>`, **`resetPasswordExpires = now + 7 days`**,
    `merchant = merchantId`, `role:'ROLE MERCHANT'`, `provider:'Email'`, and send the
    `merchant-signup` email (link built from `CLIENT_URL`). The brand is created later, by the signup step.
  * `createMerchantBrand({_id, brandName, business, brand})` is a no-op when the merchant already has a
    `brand`, so a repeated approval no longer creates another brand. Otherwise it inserts into `brands`
    `{name: brandName, description: business, merchant: <merchantId>, isActive:false}` and sets
    `Merchant.brand = <new brand _id>`.
* 200 → `{ success:true }`; 404 → `{error:'Merchant not found.'}`

#### `PUT /api/merchant/reject/:id` — **auth+Admin**
* Updates the merchant to `{status:'Rejected'}` (leaves `isActive` untouched).
* 200 → `{ success:true }`; 404 → `{error:'Merchant not found.'}`

#### `POST /api/merchant/signup/:token` — **public**, `authLimiter`
Path param `token` must equal the `User.resetPasswordToken` created at approval time and must not
have expired (7 days).

| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `firstName` | string | yes |
| `lastName` | string | yes |
| `password` | string | yes |

* Looks up `User.findOne({email, resetPasswordToken: token, resetPasswordExpires: {$gt: now}})`.
  No match — wrong, expired or already used token — is
  `400 {error:'Your signup link is invalid or has expired.'}` (no more TypeError).
* **The token is single-use:** it is consumed with an atomic conditional update
  (`$set` name/hash, `$unset` token and expiry), so a replay or a concurrent second request finds
  nothing to update and also gets the 400.
* Side effects: updates `users` with the name and bcrypt-hashed password; then
  `createMerchantBrand(Merchant.findOne({email}))` — a no-op when the merchant already has a brand.
* 200 → `{ success:true }`; 400 for the field validation messages (`'You must enter an email address.'`,
  `'You must enter your full name.'`, `'You must enter a password.'`).
* There is no login/token returned — the merchant must then log in normally.

#### `DELETE /api/merchant/delete/:id` — **auth+Admin**
* **Cascade side effect:** `deactivateBrand(merchantId)` sets the linked Brand `isActive:false`.
* 200 → `{ success:true, message:'Merchant has been deleted successfully!', merchant: <deleteOne result> }`
* Does not delete the linked `users` doc and does not deactivate its products.

---

### 3.10 `routes/api/cart.js` — 4 endpoints (mount `/api/cart`)

The storefront no longer builds a cart before checkout — it calls `POST /api/order/checkout`
(§3.11), which creates the cart, takes the stock and creates the order in one request. The four cart
endpoints remain for API clients; they follow the same pricing and stock rules.

**Rules shared by every cart route** (`server/routes/api/cart.js`, `server/utils/store.js`):

* **Prices and totals come from the database.** Only `product` (id) and `quantity` are read from the
  request; a `price`, `taxable`, `totalPrice` … in the body is ignored. `store.priceItems` loads the
  `Product` docs and sets, per line, `purchasePrice = product.price`,
  `totalPrice = round2(price * quantity)`, `totalTax = taxable ? round2(price * (taxRate/100) * 100 * quantity) : 0`,
  `priceWithTax = taxable ? round2(totalPrice + totalTax) : 0`. Item `status` is the schema default `Not processed`.
* **Validation** (`store.normalizeItems`): 1..50 lines, each `product` a 24-hex id, `quantity` an integer
  `1..99`; duplicate products in one request are merged (merged total ≤ 99). A violation is
  `400 {error, code:'INVALID_CART'}`.
* A missing or inactive product, **or one whose brand is missing or inactive**, is
  `409 {error, code:'PRODUCT_UNAVAILABLE', product:<id>}`. Disabling a merchant only deactivates its
  brand, so the brand is checked next to `product.isActive` (with a plain `Brand` query, identical on both
  backends) at pricing time and again right after each unit is reserved; a unit taken from a product whose
  brand was disabled in between is given back.
* **Stock is reserved per line with a conditional update** (`Product.updateOne({_id, isActive:true,
  quantity:{$gte:n}}, {$inc:{quantity:-n}})`) so two buyers cannot both get the last unit; if a
  later line fails, the earlier lines are given back. An unmet line is
  `409 {error:'Only N left of <name>.', code:'INSUFFICIENT_STOCK', product:<id>, available:N}`.
  No multi-document transaction is assumed (the target database is not required to provide them).
* **Ownership:** every `:cartId` route is scoped to `{_id, user: req.user._id}` — a foreign, unknown or
  malformed id is `404 {error:'Cart not found.'}`. A cart referenced by an `Order` is read-only:
  `409 {error:'This cart already belongs to an order.', code:'CART_ORDERED'}`.

#### `POST /api/cart/add` — **auth**
| Field | Type | Required |
|---|---|---|
| `products` | array of `{product, quantity}` | yes (1..50 lines) |

* 200 → `{ success:true, cartId: <cart _id> }`
* 400 `INVALID_CART`; 409 `PRODUCT_UNAVAILABLE` / `INSUFFICIENT_STOCK` (see above).
* **Side effects:** reserves stock for every line (`$inc: {quantity: -n}`), then inserts into `carts` with
  `user = req.user._id`; if the insert fails the stock is released again.

#### `DELETE /api/cart/delete/:cartId` — **auth**, owner, unordered cart
* 200 → `{ success:true }`
* Deletes the cart **and restocks** every line that is not `Cancelled`.
* 404 `Cart not found.`; 409 `CART_ORDERED`.

#### `POST /api/cart/add/:cartId` — **auth**, owner, unordered cart
| Field | Type | Required |
|---|---|---|
| `product` | object `{product, quantity}` | yes — priced from the DB like `/add` |

* 200 → `{ success:true }`; the line is `$push`ed after its stock is reserved (released again if the push fails).
* The same product may be added as several separate lines (no merging with existing lines).
* 400 `INVALID_CART`; 404; 409 `PRODUCT_UNAVAILABLE` / `INSUFFICIENT_STOCK` / `CART_ORDERED`.

#### `DELETE /api/cart/delete/:cartId/:productId` — **auth**, owner, unordered cart
* `$pull: {products: {product: <productId>}}` — removes **all** line items whose `product`
  equals that product id, and **restocks** them only when this request's pull actually changed the cart.
* 200 → `{ success:true }` (also when the product was not in the cart — nothing to restock)
* 404; 409 `CART_ORDERED`.

---

### 3.11 `routes/api/order.js` — 8 endpoints (mount `/api/order`)

An order is `{cart, user, total}`; the line items live in the referenced cart. Reads are
**owner-scoped** (a non-admin only ever sees `{user: req.user._id}` orders; someone else's id is
`404 {error:'Order not found.'}`).

#### `POST /api/order/checkout` — **auth** *(new; what the storefront calls)*
| Field | Type | Required |
|---|---|---|
| `products` | array of `{product, quantity}` | yes — 1..50 lines, `quantity` integer 1..99 (rules of §3.10) |

* 200 → `{ success:true, message:'Your order has been placed successfully!', order: { _id, total, created } }`
  where `total` is the **pre-tax sum of `purchasePrice × quantity` computed on the server** from DB
  prices (`store.linesTotal`).
* 400 → `{error, code:'INVALID_CART'}`
* 409 → `{error, code:'INSUFFICIENT_STOCK', product, available}` /
  `{error, code:'PRODUCT_UNAVAILABLE', product}`
* **Side effects / cross-collection flow:**
  1. `store.priceItems` prices the lines from `products`.
  2. `store.reserveStock` takes stock line by line with a conditional `$inc` (rolled back on a failing line).
  3. inserts into `carts` (`user = req.user._id`, priced lines), then into `orders`
     `{cart, user, total}`. If either insert fails, the cart is deleted and the stock is released
     (`rollbackCheckout`), so a failure leaves no orphan cart and no reserved unit.
  4. best-effort `order-confirmation` Mailgun email to the authenticated user (`{order, user}` template
     data); the response does not wait for the provider.
* Two concurrent checkouts for the last unit: exactly one succeeds, the other gets `INSUFFICIENT_STOCK`.

#### `POST /api/order/add` — **auth** *(legacy two-step flow, still supported)*
| Field | Type | Required |
|---|---|---|
| `cartId` | ObjectId string | yes — must be the caller's own cart |

* 200 → `{ success:true, message:'Your order has been placed successfully!', order: { _id, total, created } }`
* 400 → `{error:'A valid cartId is required.'}` / `{error:'Cart not found.'}` (not yours, unknown or empty) /
  `{error:'This cart has already been ordered.'}`.
* 409 → `{error:'This cart was deleted while the order was placed.'}`: `DELETE /cart/delete` checks for an
  order and then deletes the cart (releasing its stock), so the order is saved first and the cart is
  re-checked afterwards; a vanished cart removes the new order again. No order outlives its cart on the
  interleavings that this check can see (a cart deleted after the re-check is not detectable without a transaction).
* `total` is **no longer accepted from the request**: it is recomputed from the cart's stored lines. The
  stock was already reserved when the cart was created (§3.10), so `/order/add` takes none.
* One order per cart: nothing in the database enforces it (no unique index), so of two orders that raced
  for the same cart the one created first stays and the loser is deleted with the same 400.
* The cart is **not** deleted. A best-effort confirmation mail goes to the authenticated user.

#### `GET /api/order/search?search=<orderId>` — **auth+Admin**
* If `search` is not a valid `ObjectId` → `200 {orders: []}` (not a 400).
* Orders whose `cart` populate resolves to `null` are filtered out.
* 200 → `{ orders: [ { _id, total, created, products, totalTax, totalWithTax } ] }`
  where each order has run through `store.caculateTaxAmount` and the array is sorted by
  `created` **descending**. `products` are the populated cart line items.
* A non-admin gets `403`.

#### `GET /api/order?page=<n>&limit=<n>` — **auth+Admin**
Defaults `page=1`, `limit=10` (≤ 50), sorted `-created`, cart→products→product→brand populated.
* 200 → `{ orders: [ … ], totalPages, currentPage, count }` via `store.formatOrders`
  → each row is `{_id, total, created, products}` plus the tax fields added by
  `store.caculateTaxAmount` (`totalTax`, `totalWithTax`, and per item
  `totalPrice`, `purchasePrice`, `priceWithTax`, `totalTax`).
* Every order in the system (`count` is the global `Order.countDocuments()`); a member gets `403`.
  Members read their own orders through `/me`.

#### `GET /api/order/me?page=<n>&limit=<n>` — **auth**
Same shape as above but scoped `{user: req.user._id}` for both the list and `count`.
* 200 → `{ orders, totalPages, currentPage, count }`

#### `GET /api/order/:orderId` — **auth**, owner or admin
Admin → any order; everyone else → `{_id: orderId, user: req.user._id}`.
* 200 → `{ order: { _id, total, created, totalTax, products, cartId, totalWithTax, … } }`
  (the object is `{_id, total, created, totalTax: 0, products: cart.products, cartId: cart._id}`
  then `store.caculateTaxAmount` adds `totalTax`/`totalWithTax` and per-item tax fields).
* 404 → `{error:'Order not found.'}` (unknown, malformed, someone else's, or the cart populate is null).

#### `DELETE /api/order/cancel/:orderId` — **auth**, owner or admin
* 404 `{error:'Order not found.'}` for another user's order.
* **409** `{error:'An order with shipped or delivered items cannot be cancelled.', code:'ORDER_DISPATCHED'}`
  when any line is `Shipped` or `Delivered`.
* **Side effects:**
  1. each remaining line goes through `store.cancelLine` — a conditional update of the line's status
     that restocks the product **exactly once** (lines already cancelled one by one were restocked
     then; concurrent cancels cannot double-restock);
  2. deletes the `orders` doc, then the `carts` doc.
* 200 → `{ success:true }`

#### `PUT /api/order/status/item/:itemId` — **auth**
| Field | Type | Required |
|---|---|---|
| `status` | string (one of `CART_ITEM_STATUS`) | no — defaults to `Cancelled`; any other value is `400 {error:'Unknown item status.'}` |

The `orderId`/`cartId` body fields of the old contract are **ignored**: the cart is found with
`Cart.findOne({'products._id': itemId})` and the order with `Order.findOne({cart})` — an unknown or
malformed `itemId` is `404 {error:'Order item not found.'}`.

* **Who may do what:** an admin may move a line to any status; a merchant only lines of products of
  their own brand **and only while their `Merchant` document exists and is `isActive`** (the rule of
  `role.check`, shared through `role.isActiveMerchant`): a disabled or deleted merchant gets
  `403 {error:'Your merchant account is disabled.'}`. The order's owner may only **cancel** a line whose
  status is `Not processed` or `Processing` (anything else → `403 {error:'You are not allowed to make this request.'}`). Anyone else
  gets `404`. A `Cancelled` line cannot be moved to another status (`400 {error:'A cancelled item cannot be changed.'}`);
  if a concurrent cancel wins the race after that check the answer is `409` with the same text.
  Repeating the line's current status is a harmless `200` no-op.
* **Cascade when `status === 'Cancelled'`:** `store.cancelLine` marks the line and `$inc`s the product's
  `quantity` back by the line quantity — once; repeating the cancel is a harmless 200 with no second restock.
* **Order auto-cancel:** when *every* line item in the cart has `status === 'Cancelled'`,
  the `orders` doc and the `carts` doc are deleted.
* 200 →
  `{ success:true, orderCancelled:true, message:'Order has been cancelled successfully' }`
  (the message is `Your order has been cancelled successfully` for non-admins)
  **or** `{ success:true, message:'Item has been cancelled successfully!' }` (item cancelled, order alive)
  **or** `{ success:true, message:'Item status has been updated successfully!' }` (any other status).
* The client can distinguish the auto-cancel by the presence of `orderCancelled: true`.
* Note: `itemId` is the **CartItem subdocument `_id`**, not the product id.

---

### 3.12 `routes/api/review.js` — 7 endpoints (mount `/api/review`)

#### `POST /api/review/add` — **auth**
Only `title`, `review`, `rating`, `isRecommended` are read from the body (plus `product`); `user` is the
JWT subject and **`status` is always forced to `Waiting Approval`** — a client cannot publish its own review.

| Field | Type | Required |
|---|---|---|
| `product` | ObjectId string | yes — must be an existing product |
| `rating` | integer 1..5 | yes |
| `title` | string ≤ 2000 | no |
| `review` | string ≤ 2000 | no |
| `isRecommended` | boolean | no (default `true`) |

* 200 → `{ success:true, message:'Your review has been added successfully and will appear when approved!', review: <doc> }`
* 400 → `{error:'Rating must be a whole number between 1 and 5.'}` / `{error:'Your title is not valid.'}` /
  `{error:'Your review is not valid.'}` / `{error:'isRecommended must be true or false.'}` /
  `{error:'That product does not exist.'}`
* Side effects: inserts into `reviews`; **does not update `Product.averageRating`** (there is no such
  field — see §6). The product's aggregate changes only once an admin approves the review.

#### `GET /api/review?page=<n>&limit=<n>&status=<status>` — public, role-aware
Defaults `page=1`, `limit=10`; sorted `-created`;
`user` populated as `{firstName}` (only), `product` populated as `{name, slug, imageUrl}`.
* **Anonymous or non-admin callers → `Approved` reviews only** (`status` is ignored).
* **Admin (verified bearer token, `role === 'ROLE ADMIN'`) → every status**, optionally narrowed with
  `?status=Approved|Rejected|Waiting Approval`; an unknown value is `400 {error:'Unknown review status.'}`.
  This is the manager review queue (the dashboard's "Pending" tab sends `?status=Waiting Approval`).
* 200 → `{ reviews: [ … ], totalPages, currentPage, count }` (`count` follows the filter).

#### `GET /api/review/:slug` — public
Path param is the **product slug**.
* Looks up `Product.findOne({slug})` with `brand` populated (`isActive`); 404 `{error:'No product found.'}`
  when the product is missing or its brand is `null`/`isActive:false`.
* 200 → `{ reviews: [ … ] }` — only `status:'Approved'`, sorted `-created`,
  `user` populated as `{firstName}`.
* **Note:** the `.populate('user','firstName')` means the client receives only a first name,
  no avatar/id. There is no rating summary payload — the client computes averages/distribution.

#### `PUT /api/review/:id` — **auth**, owner or admin
| Field | Type | Required |
|---|---|---|
| `title`, `review`, `rating`, `isRecommended` | as in `/add` | partial — only the keys present are validated/written |

* 200 → `{ success:true, message:'review has been updated successfully!' }`
* 404 → `{error:'Review not found.'}` for a malformed/unknown id or someone else's review.
* **Any edit — an admin's included — resets the review to `Waiting Approval`**; `status` and `user` in
  the body are ignored.

#### `PUT /api/review/approve/:reviewId` — **auth+Admin**
* Sets `{status:'Approved'}`.
* 200 → `{ success:true }`; 404 → `{error:'Review not found.'}`

#### `PUT /api/review/reject/:reviewId` — **auth+Admin**
* Sets `{status:'Rejected'}`.
* 200 → `{ success:true }`; 404 → `{error:'Review not found.'}`

#### `DELETE /api/review/delete/:id` — **auth**, owner or admin
* 200 → `{ success:true, message:'review has been deleted successfully!', review: <deleteOne result> }`
* 404 → `{error:'Review not found.'}` for someone else's review.

---

### 3.13 `routes/api/wishlist.js` — 3 endpoints (mount `/api/wishlist`)

#### `POST /api/wishlist` — **auth**
| Field | Type | Required |
|---|---|---|
| `product` | ObjectId string | yes — must be a valid id of an existing product |
| `isLiked` | boolean | yes (this is the toggle value; a non-boolean is rejected) |

* Upsert-by-find-then-create: `Wishlist.findOneAndUpdate({product, user: req.user._id}, {product, isLiked, updated: Date.now()}, {new:true})`.
  Note `findOneAndUpdate` without `upsert` — the insert happens in the `else` branch.
* 200 → `{ success:true, message:'Your Wishlist has been updated successfully!', wishlist: <doc> }`
  (existing row) **or**
  `{ success:true, message:'Added to your Wishlist successfully!', wishlist: <doc> }` (new row).
* 400 → `{error:'A product and isLiked (true/false) are required.'}`; 404 → `{error:'Product not found.'}`
* Side effects: writes `wishlists` (`isLiked:false` rows are kept, not deleted).

#### `GET /api/wishlist` — **auth**
* `Wishlist.find({user, isLiked: true})`, `product` populated as `{name, slug, price, imageUrl}`,
  sorted `-updated`; **entries whose product no longer exists are dropped** from the response.
* 200 → `{ wishlist: [ { _id, product: {name, slug, price, imageUrl}, user, isLiked, updated, created } ] }`
* **Note:** the product `_id` is **not** projected out, so the item key is `product._id`; `_id` is the
  wishlist entry id used by `DELETE /api/wishlist/:id`.

#### `DELETE /api/wishlist/:id` — **auth**, owner *(new)*
`:id` is the **wishlist entry** `_id` (not the product id).
* 200 → `{ success:true, message:'Removed from your Wishlist successfully!' }`
* 404 → `{error:'Wishlist entry not found.'}` (malformed, unknown, someone else's, or already removed).

---

### 3.14 `routes/api/adminDb.js` — 9 endpoints (mount `/api/admin-db`)

All nine are **public (no auth, no role check)** — the migration showcase page is public and the
routes are therefore cheap and closed — and return **objects**; there is no `{success}` envelope.
Errors use the common `{error}` shape (§1.5): an unknown collection is `404 {"error":"Unknown collection"}`;
anything else is `500 {"error":"Internal server error"}` (driver text is logged, never sent).

**Caching.** Every payload is cached in-process for **15 s**; callers that arrive during a load share
it. `?fresh=1` bypasses the cached value (at most once per second, so a refresh loop cannot turn into
load). Because counts come from the cache, a document written through the MongoDB API shows up in
these counts within 15 s (or immediately with `?fresh=1`).

| Endpoint | Data source | Success body |
|---|---|---|
| `GET /api/admin-db/collections` | **mongoose** `listCollections` + `countDocuments` for each, and **node-oracledb SQL** `user_json_collections` with a per-collection row count — both in one request | `{ mongo: [{ name, count }], oracle: [{ name, type, count }], oracleStatus }` — `type` is `TABLE` or `VIEW`; `oracleStatus` is `'ok'`, `'not-configured'` or `'unavailable'` (then `oracle` is `[]`; the Mongo side is still served with 200) |
| `GET /api/admin-db/collections/mongo` | the same cached Mongo list | `["users","products", …]` (bare string array) |
| `GET /api/admin-db/collections/mongo/:name/count` | the cached Mongo list | `{ collection: "<name>", count: <n> }` |
| `GET /api/admin-db/collections/oracle` | the cached Oracle list | `[{ name, type }]` |
| `GET /api/admin-db/collections/oracle/:name/count` | the cached Oracle list | `{ collection: "<name>", count: <n> }` |
| `GET /api/admin-db/views` | `user_views` (duality views and Oracle model internals excluded) with a row count per view | `{ views: [{ name, kind, columns, documents }], schema }` |
| `GET /api/admin-db/duality-views` | `MERN26DV.duality_view_manifest` + one in-database comparison (counts and a key-level `minus`) per view | `{ views: [{ name, source, documents, collectionDocuments, pending, stale, inSync, insert, update, delete }], schema, source }` |
| `GET /api/admin-db/validity` | `DOCUMENT_VALIDITY` + the `*_VALIDITY` views + `JSON_SCHEMAS` | `{ collections: [{ name, documents, valid, invalid }], inferredSchemas: [{ collection, characters }], invalidDocuments: [{ view, doc_id, report }], source }` |
| `GET /api/admin-db/migration-status` | the JSON report from `scripts/verify_migration.py` + the cached Oracle collection counts | `{ generatedAt, reportFile, sourceLabel, targetLabel, sourceDocuments, targetDocuments, verified, comparisons: [{ collection, source, target, match }], targetViews, embeddingDimension, embeddingModel }` |

`reportFile` is the report's **basename** (`migration-report.json`); the server-side path is never sent
(the previous `reportPath` field is gone). The report is read from `MIGRATION_REPORT` when set,
otherwise `docs/26ai/migration-report.json`.

Live values on the Oracle deployment (`schema.app = MERN26`, `schema.dv = MERN26DV`):

* `/collections` returns **13** Mongo-side names and **13** Oracle objects, not 12: the Oracle branch of
  mongoose also sees the JSON collection view `PRODUCTS_ENRICHED` created by `sql/26ai/04_relational_views.sql`
  (typed `VIEW` on the Oracle side, 112 documents).
* `/views` currently returns **17** rows: the six per-collection views `BRANDS_V`, `CATEGORIES_V`,
  `PRODUCTS_V`, `USERS_V`, `ORDERS_V`, `REVIEWS_V`, `PRODUCT_CATALOG`, `ACTIVE_PRODUCTS_OVER_50`,
  `ACTIVE_NONTAXABLE_PRODUCTS`, `PRODUCT_REVIEW_STATS`, `ORDER_SUMMARY` (all `kind: "relational"`),
  `PRODUCTS_ENRICHED` (`kind: "json-collection-view"`) and the five validity views
  (`DOCUMENT_VALIDITY`, `PRODUCTS_VALIDITY`, `USERS_VALIDITY`, `ORDERS_VALIDITY`, `CARTS_VALIDITY`,
  `kind: "validity"`). The three Oracle Data Mining internals that belong to the ONNX embedding
  model — `DM$VJALL_MINILM_L12_V2`, `DM$VMALL_MINILM_L12_V2`, `DM$VPALL_MINILM_L12_V2` — are
  filtered out (`view_name not like 'DM$%'`); they are not views over the JSON store. A view the schema
  cannot count reports `documents: null` instead of failing the response.
* `/duality-views` returns **12** views and reports `pending`/`stale` per view. The duality views are
  **populated by `DBMS_JSON_DUALITY.IMPORT_ALL`**, so they are a point-in-time copy of the collections:
  documents the application writes through the MongoDB API afterwards show up as `pending` until
  `sql/26ai/06_import_duality_views.sql` is re-run. (`pending` = in the collection but not in the
  view, `stale` = in the view but no longer in the collection; the comparison folds ObjectId hex
  case, because the duality view renders `_id` upper-case and the collection lower-case.)
* `/migration-status` mixes a **static** report with **cached live** counts: `sourceDocuments` comes from
  the report, `targetDocuments` from Oracle (at most 15 s old), so any test data written after the report
  was generated shows as `match: false` until the source is re-verified.

Notes for a rewrite:
* Every `:name` path parameter is looked up in the **real collection list** and the SQL for that count
  was already run; a name that is not a collection never reaches SQL —
  `GET /collections/oracle/DROP TABLE x/count` → `404 {"error":"Unknown collection"}`. (The statements
  that do run use `dbms_assert.enquote_name`.)
* The MongoDB branch uses the **existing mongoose connection**; the Oracle branch uses the shared
  node-oracledb pool from `server/services/oracle.js` (`ORACLE_APP_USER` / `ORACLE_APP_PASSWORD` /
  `ORACLE_CONNECT_STRING`; **no fallback** to `ORACLE_USER` / `ORACLE_PASSWORD`; pool size
  `ORACLE_POOL_MAX`, default 6; per-statement `ORACLE_CALL_TIMEOUT_MS`, default 15000). With those
  variables unset every Oracle panel is `503`-style unavailable and `/collections` still answers 200
  with `oracleStatus: 'not-configured'`. There is no SODA database handle anywhere in these routes.
* `/views` and `/duality-views` count inside the database in one statement each (a statement-local
  `row_count` / `sync_state` function), so they no longer issue one round trip per object; with the pool
  kept warm the five panel endpoints together take about 1 s against the ADB (cold server cache).
* No pagination and no document preview anywhere — counts, catalogues and one validation sample
  per collection (`fetch first 5 rows only`).

### 3.15 `POST /api/chat` — public, `aiLimiter` (inline in `routes/api/index.js`)

| Field | Type | Required |
|---|---|---|
| `message` | string, 1..500 characters (trimmed) | yes |
| `history` | array of up to **6** earlier turns `{ role: 'user' \| 'assistant', content: string ≤ 2000 }` (only the last 6 are kept) | no |

RAG over the migrated catalogue. `services/llmChat.js` → `ragQuery({message, history})` runs
**retrieval inside Oracle** (live catalogue facts, a price filter when the message has one, the products
the previous answer named for a follow-up such as "which of those is cheapest?", and a semantic
`VECTOR_DISTANCE` ranking over `PRODUCT_EMBEDDINGS`) and sends that context plus the question and the
history to the OpenAI-compatible chat model configured through `LLM_*` / `OCI_GENAI_*`. There is no
`RAG_API_URL` proxy any more.

* 200 → `{ response: <answer>, model: <provider model id>, retrieval: { source, documents: [{ id, name, slug, price, brand, category, inStock }] } }`
  — live: `model: "xai.grok-4.3"`, `retrieval.source: "in-database:ALL_MINILM_L12_V2"`.
  `retrieval.documents` are the **products the answer names**, looked up in the catalogue (the web UI
  turns them into source chips linking to `/product/:slug`) — not the raw top-k hits.
  `retrieval.source` is `in-database:<MODEL>`, `remote:<model>` or `keyword-fallback`.
* 400 → `{ error }` for a missing/empty `message`, `message` over 500 characters, a non-array `history`,
  or a history turn with a bad role or empty/over-long content.
* 429 → `{ error: 'Too many AI requests. Please wait a minute and try again.' }` (`RATE_LIMIT_AI`).
* 503 → `{ error: 'The AI assistant is not configured.', hint: <configuration hint> }` when no LLM key is
  configured, or `{ error: 'The AI assistant needs Oracle SQL access, which is not configured.', hint }`
  when `ORACLE_APP_*` are missing.
* 500 → `{ error: 'The assistant is unavailable right now.' }` for any retrieval or provider failure; the
  details are logged server-side only (the old `details: err.message` field is gone).
* Collections: none (reads `PRODUCT_EMBEDDINGS` and the catalogue tables via SQL). Retrieval degrades to a
  keyword `LIKE` search over the same collections in exactly one case — no embedding store to search —
  and reports it as `retrieval.source: "keyword-fallback"`. Any other retrieval failure is rethrown, so the
  caller gets the 500 instead of a plausible-looking keyword answer.
* On start-up the API warms the connection pool, catalogue facts and the embedding model
  (`warmUp()`), so the first question does not pay several seconds.
* **Note the payload key is `message` in, `response` out.**

### 3.16 `routes/api/ai.js` — 3 endpoints (mount `/api/ai`)

`router.use(aiLimiter)` — all three share `RATE_LIMIT_AI` (429 body as above).

| Endpoint | Auth | Request | Success body |
|---|---|---|---|
| `GET /api/ai/status` | public | — | `{ llm: { configured, provider, model, embeddingModel, hint }, embeddings: { inDatabaseModel, dimension, table, remoteModel }, selectAi: { profile, configured } }` — **no `llm.baseUrl`** (the endpoint is served to anonymous callers) |
| `POST /api/ai/similar` | public | `{ text, topK? }` | `{ query, source, results: [{ id, name, score }], dimension, model }` |
| `POST /api/ai/ask` | **auth + Admin** | `{ question }` | `{ question, provider, profile, sql, rows, truncated, skipped?, error? }` |

* `POST /api/ai/similar` runs `VECTOR_DISTANCE` over `MERN26.PRODUCT_EMBEDDINGS` with the
  in-database ONNX model (`vector_embedding(ALL_MINILM_L12_V2 using :text as data)`), so it needs no
  provider key; `source` is `in-database:<MODEL>` (or `remote:<model>` when
  `LLM_EMBEDDING_MODEL` is set instead). Live: 200 for `{"text":"warm camping blanket"}` →
  `source: "in-database:ALL_MINILM_L12_V2"`, `dimension: 384`, top hit `Wool Blanket`.
  **400** `{error}` when `text` is not a string, is empty, or is over **500** characters, and when `topK`
  is present but not a finite number; `topK` is clamped to `1..20`. **503** `{error, hint}` when no
  embedding store/model is configured or the embedding table is empty.
* `POST /api/ai/ask` calls `DBMS_CLOUD_AI.GENERATE(..., action => 'showsql')` (30 s call timeout), then
  runs the generated SQL **only if it is a single read-only `SELECT`/`WITH`** (`utils/sqlGuard.js`). The
  statement is first tokenised left to right so string literals, Oracle `q'<delim>…<delim>'` literals
  (any delimiter, `[]{}()<>` pairs included) and `"quoted identifiers"` are blanked before scanning; an
  unterminated literal/identifier or a comment makes it unverifiable and it is skipped. It is also skipped
  for `;` (more than one statement), `@` (database link), `with function|procedure`, DML/DDL, PL/SQL
  (`begin`, `declare`, `execute`, `pragma`), `into`, any `dbms_`/`utl_`/`owa_`/`apex_` name, and dictionary or
  fixed objects (`sys.`, `dba_*`, `cdb_*`, `v$`, `gv$`, `x$`, including inside quoted identifiers), with a 10 s timeout and
  at most **50** rows. `rows` is `null` when nothing ran; `truncated` is `true` when more than 50 rows came
  back; `skipped` carries the reason when the statement was not run; `error` carries only the ORA code
  (`The generated SQL could not be run (ORA-00942).`), never raw driver text. Live:
  `{ question, provider: "Oracle Select AI", profile: "MERN_LLM", sql: "SELECT COUNT(*) …", rows: [{ "product_count": 88 }], truncated: false }`.
  `401 {error:'Unauthorized'}` without a token, `403 {error:'You are not allowed to make this request.'}` for a
  member — the generated SQL is executed against the schema, so this one stays behind an administrator
  session. `400` for a missing/over-500-character `question`; `503 {error, hint}` when `SELECT_AI_PROFILE`
  is not set; `502 {error, provider}` when generation itself fails.
* `GET /api/ai/status` is what the dashboard reads to label the panels; `llm.hint` is the
  configuration message to show when no key is present.
* No `{success}` envelope and no collection writes: SQL reads only (§4 does not apply).

### 3.17 `GET /api/health` — public (inline in `server/index.js`)

* 200 → `{ status: 'ok' | 'degraded', mongo: 'up' | 'down', oracle: 'up' | 'down' | 'not-configured' }`.
  `status` is `ok` when Mongo is up and Oracle is not `down`.
* 503 with the same body when Mongo is down.
* The Oracle state is a `select 1 from dual` ping with a 3 s timeout whose result is **cached for 10 s**
  (container healthchecks poll this route; each probe would otherwise take a pooled connection).
  `not-configured` when the `ORACLE_APP_*` variables are unset. No authentication, no rate limit.
* `server/Dockerfile` uses it as the API container's `HEALTHCHECK` (a 503 makes the check fail), and `docker-compose.yml` starts `web` only once the API is healthy.

---

## 4. Cross-collection denormalisation & side-effect map

This is the complete list of every place a route writes to more than one collection.

| # | Trigger endpoint | Writes | Detail |
|---|---|---|---|
| 1 | `POST /api/order/checkout` | `products` + `carts` + `orders` | per line: conditional `$inc: {quantity: -n}` (only while `quantity ≥ n` and `isActive`); then insert cart (DB prices), then insert order `{cart, user, total}`; a failing step releases the stock and deletes the cart |
| 2 | `POST /api/cart/add` | `products` + `carts` | same stock reservation, then insert cart; released again if the insert fails |
| 3 | `POST /api/cart/add/:cartId` | `products` + `carts` | reserve stock for the new line, `$push` the priced line |
| 4 | `DELETE /api/cart/delete/:cartId` · `…/:productId` | `carts` + `products` | delete the (unordered) cart / pull the line; `$inc` the stock back, once |
| 5 | `POST /api/order/add` | `orders` | insert order `{cart, user, total}` with the total recomputed from the cart; **cart untouched**, stock already taken at cart creation |
| 6 | `DELETE /api/order/cancel/:orderId` | `carts` + `products` + `orders` | `cancelLine` per remaining line (status → Cancelled + one `$inc` restock), then delete order, then delete cart; `409 ORDER_DISPATCHED` when a line is Shipped/Delivered |
| 7 | `PUT /api/order/status/item/:itemId` | `carts` + `products` (+ `orders`) | set `products.$.status`; if `Cancelled` → `cancelLine` restocks once; if **all** items are `Cancelled` → delete order + cart |
| 8 | `PUT /api/category/:id/active` | `categories` + `products` | when deactivating: `Category.products` → each product `isActive:false` |
| 9 | `PUT /api/brand/:id/active` | `brands` + `products` | when deactivating: every `Product.find({brand})` → `isActive:false` |
| 10 | `DELETE /api/brand/delete/:id` | `brands` + `merchants` | `deactivateMerchant` → merchant `{status:'Waiting Approval', isActive:false, brand:null}` |
| 11 | `DELETE /api/merchant/delete/:id` | `merchants` + `brands` | `deactivateBrand` → brand `isActive:false` |
| 12 | `PUT /api/merchant/:id/active` | `merchants` + `brands` | when deactivating: `deactivateBrand` + deactivation e-mail |
| 13 | `PUT /api/merchant/approve/:id` | `merchants` + `users` + `brands` | status/active flip; upsert merchant user (`role:'ROLE MERCHANT'`, `merchant` link, 7-day signup token for a new user); existing-user branch also creates the brand `{name: brandName, description: business, merchant, isActive:false}` (once) and sets `Merchant.brand`; `409` for an admin's e-mail |
| 14 | `POST /api/merchant/signup/:token` | `users` + `brands` | set user name/password and `$unset` the token (single use); then `createMerchantBrand` (no-op when the merchant already has a brand) |
| 15 | `POST /api/product/add` | `products` only | **does not** update `Category.products` |
| 16 | `DELETE /api/product/delete/:id` | `products` only | **does not** clean `Category.products`, `reviews` or `wishlists` (the wishlist read drops dangling entries) |
| 17 | `POST /api/review/add` | `reviews` only | **no** rating denormalisation |
| 18 | `PUT /api/review/approve/:reviewId` | `reviews` only | **no** rating denormalisation; the product aggregate changes because §6 counts Approved reviews |
| 19 | `POST /api/auth/register` | `users` (+ Mailchimp) | |
| 20 | `POST /api/auth/forgot` / `/reset/:token` / `/reset` | `users` | reset token lifecycle |
| 21 | `GET /api/auth/*/callback` | `users` (insert on first social login) | |

### 4.1 There is NO persisted rating denormalisation

`Product.averageRating` **does not exist in the schema and is never written.** It is computed
on the fly by the `GET /api/product/list` aggregation (`totalRatings`, `totalReviews`,
`averageRating` over **Approved** reviews — see §6). It is therefore **absent** from:

* `GET /api/product/item/:slug` (the PDP) — the PDP response has no rating at all;
* `GET /api/product`, `GET /api/product/:id`, `GET /api/product/list/select`.

The storefront therefore fetches reviews separately (`GET /api/review/:slug`) to show a rating on
the PDP, and uses the `/api/product/list` aggregation for listing pages only.

### 4.2 Cart/order totals: computed from the database, read-time tax

| Value | Where it comes from |
|---|---|
| cart item `purchasePrice` / `totalPrice` / `totalTax` / `priceWithTax` | computed **on the server** from the `Product` document when the cart/checkout request is handled (`store.priceItems`) and stored on the CartItem — the client price is ignored |
| cart total shown in the web header/bag | **client-side** (`web/src/features/cart/cartSlice.js` sums `price * quantity`; display only — checkout re-prices on the server) |
| `Order.total` | **server-computed** pre-tax sum of `purchasePrice × quantity` at `POST /api/order/checkout` and `/order/add` |
| order `totalTax` / `totalWithTax` / item `totalPrice` etc. | computed on **read** by `store.caculateTaxAmount` in `GET /api/order*` — never stored |

`GET /api/order*` responses always carry freshly computed tax fields; cancelled lines are excluded
from `total`/`totalTax`, so the recomputed `total` can differ from the stored `Order.total` after a
line cancellation.

---

## 5. Socket layer (`server/socket/`)

Transport: `socket.io`, created in `server/socket/index.js`, attached to the same HTTP server and
port as Express (`socket(server)` in `server/index.js`). CORS: `origin: keys.corsOrigins` (the same
allow-list as the REST API), methods `GET`/`POST`. The namespace is the default `/`.

### 5.1 Connection authentication (handshake middleware, `io.use(authHandler)`)

* Reads `socket.handshake.auth.token` (i.e. the client must connect with
  `io(SOCKET_URL, {auth: {token}})`).
* The token **must** be the full `Bearer <jwt>` string: it is split on whitespace and
  `authType` must equal `'Bearer'`.
* `jwt.verify(tokenValue, JWT_SECRET, {algorithms:['HS256']})` → payload `{id}` →
  `User.findById(id)` (`firstName lastName role`).
* Failure paths call `next(new Error('no token'))` / `next(new Error('no user found'))` /
  `next(new Error('invalid token'))` → the client receives a `connect_error` event; a bad or expired
  token only rejects that handshake.
* On success the connection is registered in process memory (`support.registerConnection`); name and
  role are **refreshed from the database on every handshake**, so a demoted account keeps no cached
  privileges. A user is `{id, name, role, isAdmin, connections}`; presence is a **connection count**, so
  several tabs of one account work and the user is `online` while the count is > 0.
* **State is process-local**: `users` (a `Map`) and `messages` are module-level
  (`server/socket/support.js`). Nothing is persisted to MongoDB, and nothing survives a restart.
  The log is capped at **500** messages and offline users no stored message references are pruned.
  There is no multi-instance support (no Redis adapter).

### 5.2 Events

Direction legend: **C→S** client emits · **S→C** server emits. Every handler is wrapped (`safe`):
a malformed payload is dropped silently and never crashes the process.

The only user shape that leaves the server is `{id, name, role, isAdmin}`; list entries add `online`.
**No `socketId` is ever sent** (C9).

| Event | Dir | Payload | Behaviour |
|---|---|---|---|
| `connectUser` | C→S | *(no payload)* | If the caller **is an admin** → broadcast `connectUser` with their listed user to everyone else. Otherwise → emit it **only to the `admins` room**. |
| `connectUser` | S→C | `{id, name, role, isAdmin, online}` | Fired by the above. |
| `getUsers` | C→S | *(no payload)* | Presence list request. |
| `getUsers` | S→C | `listedUser[]` | **Admin callers** receive every other known user; **non-admin callers** receive only the admins. Emitted to the caller only. |
| `getMessages` | C→S | *(no payload)* | |
| `getMessages` | S→C | `message[]` | the messages where the caller is `from` **or** `to`, in log order. |
| `message` | C→S | `{ text: string, to: <user id string> }` | `text` is trimmed and must be 1..2000 characters; `to` must be a known user other than the sender; **a member may only message an admin** (admins may message anyone). Anything else is dropped. **Throttled per socket** by a token bucket (burst 5, refilled over 10 s); excess messages are dropped silently, so one account cannot flush the shared 500-message log. Builds `{id: crypto.randomUUID(), value: text, time: Date.now(), from, to, user: {id, name, role, isAdmin}}`, appends it to the in-memory log, then emits to the recipient's room **and** the sender's room (every tab of both). |
| `message` | S→C | `{id, value, time, from, to, user}` | Note the text field is `value`, **not** `text`. |
| `disconnect` | C→S | *(socket.io lifecycle)* | Decrements the connection count; when it reaches 0 emits `disconnectUser` and prunes unreferenced offline users. |
| `disconnectUser` | S→C | `{id, name, role, isAdmin, online}` | Same audience as `connectUser`: an admin's departure goes to everyone, a member's only to the admin room (members never see other customers' presence). |

### 5.3 Client wiring (for parity)

`web/src/components/support/useSupportSocket.js` exports `SOCKET_URL` =
`import.meta.env.VITE_SOCKET_URL || window.location.origin` — the page's **own origin**. In dev
and `vite preview` Vite proxies `/socket.io` (with `ws: true`) to the API (`API_PROXY_TARGET`); in
production `web/nginx.conf` does. The socket is **not** used for cart/order/notification — only for
the support chat (`pages/support/Support.jsx`, `components/support/*`).

### 5.4 Gaps to design around

* No persistence, no read receipts, no typing indicator, no conversation grouping by peer.
* Messages arrive for the sender *and* the recipient with identical payloads (the client has to
  deduplicate / align by `from`).
* A member can discover and message only admins; admins see every user that is connected or appears in
  the log. Offline history is lost when the API restarts.

---

## 6. `utils/queries.js` — aggregation pipelines

One exported factory, `getStoreProductsQuery(filters)`, used **only** by `GET /api/product/list`
(`server/routes/api/product.js`, which calls it twice: once with `$count` for the total, once with
sort/skip/limit for the page). The old separate wishlist factory (`getStoreProductsWishListQuery`, with
its `Q12`/`Q13`/`Q14` stage aliases) no longer exists.

### 6.1 `getStoreProductsQuery({ min, max, rating = 0, name, productIds, brandId, userId })`

The pipeline is built from the caller's filters:

1. **`$match`** `{ isActive: true }` plus, when supplied: `price: {$gte: min, $lte: max}` (each bound is
   applied on its own, when it is a finite number), `name: <RegExp 'i'>`, `_id: {$in: productIds}`
   (the category), `brand: brandId`.
2. **The join stage(s)** — backend specific, below. They attach `brand.{name,_id,isActive}`,
   `totalRatings`, `totalReviews`, `averageRating` (0 when there are no Approved reviews) and, when
   `userId` is set, `isLiked`.
3. **`$match { 'brand.isActive': true }`** — products of an inactive or missing brand are excluded.
4. **`$match { averageRating: {$gte: rating} }`** only when `rating > 0` (a missing/`0` rating adds no
   stage — the old `{ $gte: NaN }` match is gone).

`routes/api/product.js` then appends `[{$sort: sortOrder}, {$skip}, {$limit}]` for the page.

The backend is decided **once at module load**: `ORACLE_API = /loadBalanced/i.test(process.env.MONGO_URI)`
(§6.3).

#### Branch A — Oracle / load-balanced (`oracleJoinStage(userId)`)

On Oracle everything in step 2 is **one `$sql` stage**, placed after the raw-field `$match` of step 1.
(A `$sql` stage sees only the pipeline's original collection as `input` — the earlier design that chained
two `$sql` stages through generated aliases like `Q6` is gone, which is why the raw-field filters now run
*before* it.)

```sql
select json_mergepatch(i.data, json_object(
    'brand' value json_object('_id' value b.data."_id", 'name' value b.data.name, 'isActive' value b.data.isActive returning json),
    'totalRatings' value nvl(rv.total, 0),
    'totalReviews' value nvl(rv.cnt, 0),
    'averageRating' value case when nvl(rv.cnt, 0) = 0 then 0 else rv.total / rv.cnt end,
    'isLiked' value nvl((select json_value(w.data, '$.isLiked' returning boolean) from wishlists w
                          where w.data.product.idOnly() = i.data."_id".idOnly()
                            and w.data."user".idOnly() = hextoraw('<userId>') fetch first 1 row only), false)   -- only with a userId
    returning json) returning json)
  from input i
  left outer join brands b on i.data.brand.idOnly() = b.data."_id".idOnly()
  left outer join (select r.data.product.idOnly() pid, count(*) cnt, sum(r.data.rating.number()) total
                     from reviews r where r.data.status.string() = 'Approved'
                    group by r.data.product.idOnly()) rv
    on i.data."_id".idOnly() = rv.pid
```

* The reviews are **pre-aggregated to one row per product** (and restricted to `Approved`); joining raw review
  rows would duplicate a product once per review.
* The `isLiked` sub-select targets the migrated **`wishlists` JSON collection** (there is no `wishlists_root`
  duality table). It yields a boolean — `false` when the user has no row — so no `$arrayElemAt` stage is needed.
* `userId` is interpolated only after `new Mongoose.Types.ObjectId(userId).toString()` (a 24-hex string) and the
  route has already required `isObjectId(user.id)`, so it cannot carry SQL.
* `$sql` returns the projection **as documents** — a `select` that yields scalars (e.g.
  `select i.data.name from input i`) fails with *"Document instance is empty or is not a JSON
  object"*, so every `$sql` stage must project a JSON object (`json_object(... returning json)`,
  `json_mergepatch(...)`, or `i.data` itself).

#### Branch B — vanilla MongoDB (`mongoJoinStages(userId)`)

1. `$lookup` `brands` on `brand` → `_id` as `brands`
2. `$unwind '$brands'` (`preserveNullAndEmptyArrays:true`)
3. `$addFields` `'brand.name'`, `'brand._id'`, `'brand.isActive'`
4. `$lookup` `reviews` on `_id` → `product` as `reviews`
5. `$addFields { reviews: $filter(status == 'Approved') }`
6. `$addFields` `totalRatings` (`$sum: '$reviews.rating'`), `totalReviews` (`$size`)
7. `$addFields` `averageRating` (`$cond` → 0 when there are no reviews)
8. with a `userId`: `$lookup` `wishlists` (`let: {product: '$_id'}`, pipeline
   `$match { $and: [ {$expr: {$eq: ['$$product','$product']}}, {user: new ObjectId(userId)} ] }`) `as: 'isLiked'`, then
   `$addFields { isLiked: { $ifNull: [ { $arrayElemAt: ['$isLiked.isLiked', 0] }, false ] } }`
9. `$project { brands: 0, reviews: 0 }`

**Both branches now yield identical rows:** `brand.{name,_id,isActive}`, the Approved-only aggregates, and — for a
signed-in caller — `isLiked` as a boolean, `false` when there is no wishlist row. (The earlier MongoDB
branch left `isLiked` absent in that case; the `$ifNull` closes the difference.) Anonymous callers get no
`isLiked` key on either backend.

**Verified against both backends:** a set of 22 list requests (default, `price`/`name`/`rating`/`created`
sorts in both directions, `name=mug`, `min`/`max`, `rating`, pages 2/3/99, unknown slugs, `limit=1000`,
category, brand, category + brand), each anonymous and with a signed token, returned identical ids, order,
`count`, `totalPages`, `currentPage`, brand name, review aggregates and `isLiked` on local MongoDB
(`:3001`) and Oracle (`:3000`). `/api/brand/list` `productCount` matched too.

### 6.2 Wishlist flag — what changed

The wishlist join is no longer a separate pipeline factory with a position-dependent alias. It is part of
the single join stage of §6.1 (Oracle) / step 8 (MongoDB), switched on by `userId`, so the number of filter
stages `product.js` builds no longer matters.

| Query | Result |
|---|---|
| `GET /api/product/list?min=1&max=5000&rating=0&limit=50&sortOrder={"price":-1}` anonymous | 200, every row carries `brand.{name,_id,isActive}`, `totalRatings`, `totalReviews`, `averageRating`, no `isLiked` key |
| same call with a member/admin bearer token | 200, every row additionally carries `isLiked` (`true`/`false`) — on Oracle **and** MongoDB |
| same call with a forged/unsigned token | treated as anonymous (no `isLiked`) — `checkAuth` verifies the signature |

A React client should still treat a falsy `isLiked` as "not liked"; the shipped client reads the heart
state from `GET /api/wishlist` and the `isLiked` flag of the list.

### 6.3 `MONGO_URI` contains `loadBalanced` — what it means

* The check is a runtime string test on the connection string made **once when `utils/queries.js` is
  loaded**, not per request and not a build-time flag. The Oracle deployment uses a
  MongoDB-compatible load-balanced endpoint whose connection string contains the literal `loadBalanced`
  (e.g. `mongodb://…/?loadBalanced=true`).
* Consequently **both join implementations must be kept in the source tree**; the branch is fixed per
  process (the backend cannot change while it runs).
* Behavioural surface that a rewrite must not assume away: the aggregation returns products whose
  `brand` has been **replaced** by an embedded `{name, _id, isActive}` sub-document (the original
  `brand` ObjectId is overwritten), items are filtered by the brand's own `isActive`, and
  `averageRating`/`totalRatings`/`totalReviews` are present on every returned row with `brands`/`reviews`
  projected away.

---

## 7. `GET /api/product/list` request/response worked example

Request:

```
GET /api/product/list?sortOrder=%7B%22created%22%3A-1%7D&min=10&max=100&rating=3&category=shirts&brand=acme&name=mug&page=2&limit=10
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

`isLiked` is present only when a *verified* bearer token was sent (`true`/`false`). No match, or an
unknown category/brand slug, is `{"products":[],"totalPages":0,"currentPage":1,"count":0}`.

---

## 8. Summary of contract gaps a new client must be designed around

The authorization gaps of the first revision of this document — an order list readable by every member,
unauthenticated address/review writes, role-less merchant/review moderation, a client-supplied
`Order.total`, a writable `role`, cart pricing taken from the request — are **closed** (§3.2–§3.13). What
remains:

| # | Gap | Where |
|---|---|---|
| 1 | No persisted `averageRating` on Product; PDP has no rating | `models/product.js`, `routes/api/product.js` |
| 2 | Uploads are stubbed (no S3/SODA write); URLs are synthetic | `utils/storage.js` |
| 3 | `POST /api/auth/reset` uses `password` = old, `confirmPassword` = new (and does not compare them) | `auth.js` |
| 4 | `POST /api/product/add` never registers the product in its category; product delete leaves `Category.products` stale | `product.js` |
| 5 | `GET /api/product/item/:slug` returns no `averageRating`, but `/api/product/list` does | `product.js` |
| 6 | `isSubscribed` at registration is not persisted | `auth.js`, `models/user.js` |
| 7 | The support chat is process-local (no persistence, one API instance) | `socket/support.js` |
| 8 | One order per cart is enforced by "keep the earliest" at `/order/add`, not by a unique index (indexes are not added) | `order.js` |
| 9 | Stock reservation uses conditional per-line updates with manual rollback, not a multi-document transaction; a crash between steps can strand reserved stock | `utils/store.js` |
| 10 | Admin-DB showcase routes are public by design (cached 15 s, closed identifiers); the duality views are a snapshot | `adminDb.js` |
| 11 | Tax is `price * stateTaxRate` per unit; whether the percentage-times-100 formula is intended is `UNVERIFIED` | `config/tax.js`, `utils/store.js` |
