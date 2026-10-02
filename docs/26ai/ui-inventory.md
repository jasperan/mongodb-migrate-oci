# UI Inventory — current web app (`mern-ecommerce/web`) and the legacy client it replaced

> **Part A** documents the UI that ships today: `mern-ecommerce/web` (React 19, Vite 8, Tailwind 4,
> React Router 7, Redux Toolkit + RTK Query). **Part B** is the historical inventory of the legacy React 16
> client (`mern-ecommerce/client/app`) that drove the rewrite; every container/component in it is ported or
> deliberately dropped. The legacy `client/` tree was retired at cutover and no longer exists in the
> repository, so the `client/app/**` paths cited in Part B refer to the pre-cutover revision. Where Part B
> describes behaviour the current stack replaced (cart/order creation, unauthenticated routes), it says so
> and points back to Part A.

# Part A — Current UI (`mern-ecommerce/web/src`)

## A.1 Foundations

| Concern | Current behaviour |
|---|---|
| Router | `createBrowserRouter` in `routes.jsx`: one `Layout` route with `errorElement: <RouteError />`; every page except `Home` and `RouteError` is `React.lazy` behind `Suspense` (`withSuspense`) |
| State | `app/store.js` registers `api` (RTK Query), `auth`, `cart`, `ui`; endpoint slices live in `features/*/…Api.js` and are registered by `features/index.js`. **There is no `features/cart/cartApi.js`**: the bag is a plain slice and checkout is an order mutation |
| API base | `VITE_API_URL` or `/api` (`app/api.js`); Vite dev and `vite preview` proxy both `/api` and `/socket.io` to `API_PROXY_TARGET` (default `http://localhost:3000`); `nginx.conf` does the same in the container |
| Error handling | `lib/apiError.js` (`apiErrorMessage`, `describeApiError`, `isUnauthorized`) reads the API's JSON `{ error, … }` body (and passport's plain-text 401) |
| Fonts | Self-hosted: `@fontsource-variable/inter` and `@fontsource-variable/space-grotesk` imported in `main.jsx`; no Google Fonts request |
| Images | Product photos are `public/products/*.jpg` resolved by `lib/productImages.js`; cards, bag lines and category tiles load the 640 px WebP rendition via `thumbUrl()` (`/products/x.jpg` → `/products/thumbs/x.webp`) and fall back to the full JPG, then a gradient. The product page gallery uses the full JPGs. Regenerate thumbnails with `npm run images:thumbs` (`scripts/build-thumbnails.mjs`, uses `sharp`) |
| Class merging | `lib/cn.js` (`clsx` + `tailwind-merge`) |

### A.1.1 Session handling

| Concern | Behaviour |
|---|---|
| Storage | `localStorage['mern26.auth']` = `{ token, user }` (`features/auth/authSlice.js`); the token is the server's `Bearer <jwt>` string and is sent verbatim as the `authorization` header (`prepareHeaders` in `app/api.js`) |
| Startup | `main.jsx` dispatches `GET /user/me` (`forceRefetch`) whenever a stored token exists, so a stale role or account is not trusted; `DashboardLayout` re-reads the profile and `profileReceived` replaces `merchant` (null for non-merchants) |
| 401 | `app/api.js` base query: a 401 on a request that **carried a token** dispatches `loggedOut()` plus one toast `Your session has expired. Please sign in again.` (the first 401 clears the token, so concurrent 401s toast once; `toastShown` also drops a message that is already on screen, so the failing caller's own error toast does not repeat it); a wrong password on `POST /auth/login` is a 401 without a token and does not trigger it |
| Cache reset | `app/store.js` listener middleware: on `loggedOut` it waits one macrotask (so the 401 request that triggered it settles instead of rejecting with `Aborted`) and then dispatches `api.util.resetApiState()`, so orders, addresses and wishlists never leak to the next account on the tab |
| Sign-out | Dashboard button: `loggedOut`, toast `You have signed out!`, navigate `/login`. Header menu: toast `Signed out`, navigate `/`. There is no logout endpoint (tokens simply expire); the Security page says other devices stay signed in |
| Route guard | `components/auth/RequireAuth.jsx`: no token → `/login` with `state.from` = full path + search + hash (Login and Register honour it); signed in without the required role → toast `You do not have access to that page.` and redirect to `/dashboard` |
| OAuth landing | `pages/auth/AuthSuccess.jsx` reads `?token=` with `useSearchParams`, stores the credentials and goes to `/dashboard`, where the profile request validates them (a bad token is logged out by the 401 rule); a missing token shows an error page |

## A.2 Route table (`routes.jsx`)

| Path | Page | Guard |
|---|---|---|
| `/` | `Home` | public |
| `/shop` | `Shop` (all filters are URL query parameters, §A.3.1) | public |
| `/product/:slug` | `Product` | public |
| `/brands` | `Brands` (cards link to `/shop?brand=<slug>`) | public |
| `/sell`, `/contact` | `Sell`, `Contact` | public |
| `/cart`, `/checkout` | `Cart`, `Checkout` (`Checkout` redirects guests to `/login` with `from: '/checkout'`) | public route / session required inside the page |
| `/order/success/:id`, `/order/:id` | `OrderSuccess`, `OrderDetail` | public routes; the API scopes order reads to the owner (404 for anyone else) |
| `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/auth/success`, `/merchant-signup/:token` | `pages/auth/*` | public |
| `/support/llm-chat` | `pages/support/LlmChat` (AI assistant) | public |
| `/support/admin-db` | `pages/support/AdminDb` (database showcase) | public |
| `/support` | `pages/support/Support` (socket chat) | `RequireAuth` |
| `/dashboard` (+ `security`, `address`, `orders`, `wishlist`) | `DashboardLayout` + `Overview`, `Security`, `Addresses`, `Orders`, `Wishlist` | `RequireAuth` |
| `/dashboard/product`, `/dashboard/brand` | `Products`, `Brands` | `RequireAuth roles=[ADMIN, MERCHANT]` |
| `/dashboard/category`, `/dashboard/users`, `/dashboard/merchant`, `/dashboard/review` | `Categories`, `Users`, `Merchants`, `Reviews` | `RequireAuth roles=[ADMIN]` |
| `/404` and `*` | `NotFound` | public |

The legacy `/shop/category/:slug` and `/shop/brand/:slug` routes, `/dashboard/orders/customers` and the
`/dashboard/address/{add,edit/:id}` sub-routes do not exist any more (category/brand are query parameters,
the admin orders view is a tab, address add/edit is a modal on one page). `RouteError` is the root error
element (below); `NotFound` handles unknown paths.

## A.3 Storefront

### A.3.1 Shop (`pages/Shop.jsx`) — URL filters and mobile filter sheet

State lives in the query string, so every filter is linkable and survives reload and back/forward.

| Query parameter | Meaning | Sent to `GET /api/product/list` as |
|---|---|---|
| `q` | free-text search (header search submits `/shop?q=<term>`) | `name` |
| `category`, `brand` | category / brand **slug** (header category bar, home tiles, brand cards, dashboard links use `/shop?category=<slug>` / `/shop?brand=<slug>`) | `category`, `brand` |
| `min`, `max` | optional price bounds (non-negative numbers; either side may be absent) | `min`, `max` |
| `rating` | minimum average rating, floored and clamped to 0–5 | `rating` (0 = any) |
| `sort` | `newest` (default, omitted from the URL), `price-desc`, `price-asc`, `rating`, `name` (`components/store/SortSelect.jsx`) | `sortOrder` JSON: `{created:-1}`, `{price:-1}`, `{price:1}`, `{averageRating:-1}`, `{name:1}` |
| `page` | 1-based page; any change other than paging resets it | `page` (`PAGE_SIZE` 12 → `limit`) |

* Header text `a–b of N products` and the pager follow the server's `currentPage`: an out-of-range `?page=` is clamped by the API and replaced in the URL; active-filter chips (category, brand, price, rating, search) each with a clear
  button, plus `Clear all`.
* An unknown `category`/`brand` slug (checked against `GET /category/list` and `GET /brand/list`) renders
  `Category not found` / `Brand not found` and skips the product request (the API also returns an empty page for an unknown slug).
* **Desktop**: sticky `Filters` column (price presets and min/max inputs committed on blur/Enter, rating
  options, category and brand selects; `categoryLabels` disambiguates categories that share a name).
* **Below `lg`**: a `Filters (n)` button opens `FilterSheet` — a bottom-sheet dialog (`useDialog`, portal) holding the same
  `Filters` in `bare` mode, with footer buttons `Clear all` and `Show N products`.
* States: card skeletons while loading, `The products did not load` + Retry on error, `No products match` + `Clear all filters` when empty.
* `isLiked`, `averageRating` (Approved reviews only) and `totalReviews` come from the list response.

### A.3.2 Product page (`pages/Product.jsx`)

`GET /product/item/:slug` (no rating fields), reviews from `GET /review/:slug` (Approved only; the summary is computed in
`components/store/ReviewList.jsx#reviewStats`). `ReviewForm` posts `POST /review/add`; the review is queued as
`Waiting Approval` and the form says so. Add-to-bag stores the product's `quantity` as the line's `stock`;
the wishlist heart posts `POST /wishlist { product, isLiked }` (guests are sent to sign in).

### A.3.3 Bag: stock clamp and revalidation notices

* `features/cart/cartSlice.js` persists lines in `localStorage['mern26.cart']`. Each line carries
  `product, name, slug, imageUrl, brand, quantity, price, taxable, stock` plus derived `totalPrice/totalTax`.
* **Clamp**: `lineLimit(item)` = `min(stock, 99)` (99 when stock is unknown, never below 1); `itemAdded`,
  `itemQuantityChanged` and `cartLinesSynced` all clamp the quantity, and `QuantityStepper` / the drawer disable `+` at the limit.
* **Revalidation**: `features/cart/useRevalidateCart.js`, run once when `Cart` or `Checkout` mounts, re-fetches every line's
  product (`GET /product/item/:slug`, forced) and dispatches `cartLinesSynced({ updates, removed })`:
  a 404 (inactive product or deactivated brand) or an inactive/zero-stock product removes the line; lower stock lowers
  the quantity; a changed price updates the line. Each correction yields one sentence
  (`… was removed from your bag.`, `Only N left of …; your quantity was lowered to N.`, `The price of … changed from $a to $b.`)
  rendered by `components/store/BagNotices.jsx` (`role="status"`, dismissible). Any other failure keeps the line.
* Totals are a preview: pre-tax line totals, `TAX_RATE` (5 % on taxable lines) and a `Shipping: Free` row are display-only;
  the server re-prices every line.
* The header shows the pre-tax subtotal and `aria-label="Open bag, N items"`; `CartDrawer` is a dialog (`useDialog`).

### A.3.4 Checkout (`pages/Checkout.jsx`)

1. Guests are redirected to `/login`; an empty bag shows an empty state; `useRevalidateCart` runs first and `Place order` is disabled while it checks.
2. The shopper picks a saved address (`GET /address`) or adds one with `components/account/AddressForm.jsx`
   (`POST /address/add`); the default address (else the first) is preselected.
3. `Place order` calls `useCheckoutMutation` → **`POST /api/order/checkout`** with `{ products: [{ product, quantity }] }` only
   (ids and quantities; prices come from the database, stock is reserved per line and rolled back on failure). **No cart document is created
   and no `POST /order/add` is made at checkout**; the chosen address is a UI step and is not part of the request body.
   An `inFlight` ref blocks double submits.
4. Success: `cartCleared`, success toast, `navigate('/order/success/<order._id>', { replace: true })`.
5. Errors: `409 INSUFFICIENT_STOCK { product, available }` lowers the line to `available` (or removes it at 0) and appends
   `We lowered the quantity in your bag.`; `409 PRODUCT_UNAVAILABLE { product }` removes the line; `400 INVALID_CART` and other errors show the server message
   in the page alert and a toast. The bag is untouched on any failure that is not a stock/availability correction.

## A.4 Dashboard (`pages/dashboard/*`)

### A.4.1 Navigation (`DashboardLayout.jsx`)

| Group | Links | Roles |
|---|---|---|
| Account | `/dashboard` (Account details), `/dashboard/security`, `/dashboard/address`, `/dashboard/orders`, `/dashboard/wishlist` | all signed-in users (Security is shown for every provider; external-provider accounts get an explanation instead of the form) |
| Manage | Products, Categories, Brands, Users, Merchants, Reviews | `ROLE ADMIN` |
| Manage | Brand, Products | `ROLE MERCHANT` (the "merchant nav": no Categories, Users, Merchants or Reviews) |
| Help | `/support` | all |

* **Disabled merchant** (`role === 'ROLE MERCHANT' && user.merchant.isActive === false`): the Manage group is removed, a
  `Merchant account disabled.` notice (`DisabledMerchantNotice`) is shown under the nav, and visiting `/dashboard/product` or `/dashboard/brand`
  shows the same notice in the content area. Orders, addresses and wishlist keep working; the API answers 403 to a disabled merchant on management routes.
* `/dashboard/review`, `/dashboard/category`, `/dashboard/users`, `/dashboard/merchant` are admin-only (a merchant or member is redirected to `/dashboard` with a toast).
* Below `lg` the nav collapses into a disclosure button (`aria-expanded`, `aria-controls="dashboard-nav"`).

### A.4.2 Pages

| Page | API used | Notes |
|---|---|---|
| `Overview` | `GET /user/me`, `PUT /user { profile }` (first name, last name, phone), plus `GET /order/me`, `GET /wishlist`, `GET /address` for the summary counts | account details form and summary |
| `Security` | `POST /auth/reset` (`password` = current, `confirmPassword` = new) | signs out on this device after the change |
| `Addresses` | `GET /address`, `POST /address/add`, `PUT /address/:id`, `DELETE /address/delete/:id` | one page; add/edit in a `Modal` hosting `AddressForm`, delete confirmed in a second `Modal` |
| `Orders` | `GET /order/me`, `GET /order`, `GET /order/search`, `GET /order/:id`, `DELETE /order/cancel/:id`, `PUT /order/status/item/:itemId` | see A.4.3 |
| `Wishlist` | `GET /wishlist`, `DELETE /wishlist/:id` | rows link to the product; remove deletes the entry by its own id |
| `Products` | `GET /product`, `POST /product/add` (multipart, field `image`), `PUT /product/:id`, `PUT /product/:id/active`, `DELETE /product/delete/:id` | edits send only changed fields; quantity 0 is allowed |
| `Categories` | `GET /category` (admin manager list), `POST /category/add`, `PUT /category/:id`, `PUT /category/:id/active`, `DELETE /category/delete/:id` | storefront link `/shop?category=<slug>` |
| `Brands` | `POST /brand/add` (flat `{name, description, isActive}`), `PUT /brand/:id`, `PUT /brand/:id/active`, `DELETE /brand/delete/:id` | deactivation asks for confirmation; link `/shop?brand=<slug>` |
| `Users` | `GET /user`, `GET /user/search` | admin; read-only role badge |
| `Merchants` | `GET /merchant`, `GET /merchant/search`, approve / reject / active / delete | active switch and delete invalidate Brand and Merchant caches |
| `Reviews` | see A.4.4 | admin |

### A.4.3 Orders: "All orders" / "My orders" and line status

* **Members and merchants** see only their own orders (`GET /order/me`), no tabs.
* **Admins** get a `SegmentedTabs` control `All orders` (default; `GET /order`, page title `All orders`) / `My orders` (`GET /order/me`).
  Search (all-orders tab only) takes a **full 24-character order id** (`GET /order/search` matches one order by its id).
* Expanding an all-orders row mounts `components/manager/OrderLines.jsx` (`Fulfilment`): the order is fetched with `GET /order/:id`, and each line shows its
  `StatusBadge`, a `Mark <next>` button along `Not processed → Processing → Shipped → Delivered`, and a `Cancel line` button (confirmed in a `ConfirmDialog`,
  available until the line is Delivered or Cancelled) calling `PUT /order/status/item/:itemId { status }`. Cancelling a line returns its stock; when
  every line is cancelled the server deletes the order (`orderCancelled: true`): the row closes and the toast says the order was removed. A line that is
  already cancelled answers 409 and the lists refetch. The server validates the status and derives the order and cart itself.
* `OrderDetailPanel` shows the totals; `Cancel order` (shown only while every line is Not processed, Processing or Cancelled — `lib/orders.js canCancelOrder`, also used by `OrderDetail`) opens a confirm `Modal` and calls `DELETE /order/cancel/:id`.
  The API refuses with 409 `ORDER_DISPATCHED` once a line is Shipped or Delivered; the dialog then closes, the order refetches and a toast explains.
  Line amounts on every order and bag screen are pre-tax (`lib/orders.js lineTotal`); tax appears once, in the totals.

### A.4.4 Reviews (`/dashboard/review`, admin only)

`SegmentedTabs` `All reviews` (`GET /review?page&limit`) and `Pending` (`GET /review?status=Waiting%20Approval`), both queries mounted so the counters are accurate.
Rows show product, reviewer, rating, text, date and status with approve (`PUT /review/approve/:id`), reject (`PUT /review/reject/:id`) and delete (`DELETE /review/delete/:id`)
actions, each behind a `ConfirmDialog`. The public `GET /review` returns Approved reviews only; the admin sees every status.

## A.5 Support surfaces

### A.5.1 AI assistant (`pages/support/LlmChat.jsx`, public)

* `POST /api/chat { message (≤500 chars), history }` where `history` is the last 6 user/assistant turns (each truncated to 2000 characters); the reply is
  `{ response, model, retrieval }`. `GET /ai/status` drives the status pill (`Configured · <model>` / `Not configured` / `Assistant status unknown`); when
  the server has no LLM the composer is disabled and the 503 `hint` is shown.
* Six suggested questions (sidebar on desktop, inline on mobile); `Clear` aborts an in-flight request and drops a late answer.
* `chat/FormattedAnswer.jsx` renders the model output as React text only: paragraphs, `-`/`1.` lists and `**bold**` — never HTML.
* `chat/SourceChips.jsx` under each answer: up to 8 chips for `retrieval.documents` (name, price; link `/product/<slug>`; tooltip brand · category · stock) and a
  **retrieval badge** from `retrieval.source`: `in-database:<MODEL>` → "In-database vector search · <MODEL>", `remote:<model>` → "Vector search · <model> embeddings",
  anything else (`keyword-fallback`) → "Keyword fallback · no embeddings available".
* Errors show an `Assistant · error` bubble with the HTTP status and message.

### A.5.2 Database showcase (`pages/support/AdminDb.jsx`, public)

One `GET /admin-db/collections` request (`usePanel`) decides the layout: `oracleStatus === 'not-configured'` shows a single banner plus `JsonCollections`;
otherwise the sections render in this order, each in its own file under `pages/support/admin-db/` with a skeleton and a `QueryBoundary` error state:

| Section (file) | Endpoint |
|---|---|
| Migration summary (`MigrationSummary.jsx`) | `GET /admin-db/migration-status` |
| JSON collections (`JsonCollections.jsx`) | `GET /admin-db/collections` → `{ mongo:[{name,count}], oracle:[{name,type,count}], oracleStatus }` |
| Views over the JSON store (`ViewsCatalogue.jsx`) | `GET /admin-db/views` |
| Duality views (`DualityViews.jsx`) | `GET /admin-db/duality-views` |
| JSON validity report (`ValidityReport.jsx`) | `GET /admin-db/validity` |
| Vector search (`VectorSearch.jsx`) | `POST /ai/similar { text }` (public) |
| Ask the database (`AskDatabase.jsx`) | `POST /ai/ask { question }` (admin only; a 401/403 shows `Sign in as an administrator to run generated SQL`) |

The panel `Refresh` buttons re-request with `?fresh=1` (the server otherwise caches for 15 s) while keeping the previous data on screen.

### A.5.3 Support chat (`pages/support/Support.jsx`, auth)

Socket.io through `components/support/useSupportSocket.js`. `SOCKET_URL` defaults to `window.location.origin` in every mode (Vite dev and preview proxy `/socket.io`);
`VITE_SOCKET_URL` overrides it. The handshake sends the full `Bearer <jwt>`. Members can message administrators only and payloads carry no socket ids;
`disconnectUser` only marks a known contact offline. The selected conversation is stored per user under `mern26.support.selectedUser.<userId>`; the input is capped at 2000 characters.

## A.6 Shell and accessibility

| Piece | Behaviour |
|---|---|
| Skip link | `Layout.jsx`: `Skip to content` (first focusable element) focuses `<main id="main" tabIndex={-1}>` |
| Route error page | `pages/RouteError.jsx` is the root `errorElement`: it renders without Header/Footer, with a stale-chunk message when a lazy import fails after a deploy, `Try again` (full reload) and `Back to the store` |
| Dialogs | `components/ui/useDialog.js` powers `Modal`, `FilterSheet` and `CartDrawer`: portal into `document.body`, `aria-labelledby` title, Escape closes (topmost only), Tab is trapped, body scroll is locked, focus moves in and returns to the opener. `components/manager/ConfirmDialog.jsx` wraps `Modal` for destructive actions |
| Forms | `components/ui/Field.jsx` passes `aria-invalid`, `aria-describedby`, `aria-required`; `Button` sets `aria-busy` while loading; toggles use `role="switch"` / `aria-checked`, segmented tabs `aria-pressed` |
| Contrast, motion | `index.css` colour tokens were darkened to meet AA; `prefers-reduced-motion` stops pulse/bounce/ping animations |
| Toasts | `components/ui/Toaster.jsx`, fed by `features/ui/uiSlice.js#toastShown` |

---

# Part B — Legacy client inventory (historical, `mern-ecommerce/client/app`)


Source of truth: `client/app/**` (React 16 + redux + redux-thunk + connected-react-router),
plus `client/app/containers/Application/index.js` (the single top-level router),
`client/app/containers/Dashboard/links.json` (dashboard nav source) and
`client/app/components/Manager/Dashboard/{Admin,Merchant,Customer}.js` (the `/dashboard/*` routers).

**Total containers: 37 directories under `client/app/containers/`** (listed in §3; a container
directory may hold several files — `index.js`, `actions.js`, `constants.js`, `reducer.js` and
sub-pages such as `Add.js`, `Edit.js`, `List.js`, `Customer.js`).

**Component groups covered:** `client/app/components/Store/**` (11 directories, 13 `.js` files)
and `client/app/components/Manager/**` (34 directories, 37 `.js` files). `components/Common/**`
is a set of generic UI primitives (`Button`, `Input`, `Table`, `Pagination`, `RangeSlider`,
`SelectOption`, `SearchBar`, `Switch`, `Checkbox`, `Popover`, `DropdownConfirm`, `Badge`, `Icon`,
`LoadingIndicator`, `NotFound`, `Page404`, `CarouselSlider`, `SignupProvider`, `ResetPasswordForm`,
`Tooltip`, `Radio`, `CartIcon`, `Footer`, `ComingSoon`) and is listed only where behaviour matters.

Endpoints are quoted as `METHOD /api/...`. The literal client code writes
`` `${API_URL}/...` `` where `API_URL = process.env.API_URL` (`client/app/constants/index.js`) and
`.env` sets `API_URL=http://localhost:3000/api`, so `${API_URL}/product/list` **is**
`GET /api/product/list`. Two places bypass that and use a literal `/api/...` string
(`components/Manager/AdminDbPanel/AdminDbPanel.js`), and one bypasses the API entirely
(`utils/llmChatApi.js` → `http://localhost:8000/rag`).

---

## 1. Global behaviour a rewrite must reproduce

### 1.1 Auth

| Concern | Legacy behaviour |
|---|---|
| Token storage | `localStorage['token']`, value **already prefixed with `Bearer `** (the server returns it that way) |
| Header injection | `client/app/utils/token.js` → `setToken(token)` sets `axios.defaults.headers.common['Authorization'] = token`; `setToken()` with no argument deletes it |
| Bootstrap | `app.js` reads `localStorage.token` at module load, calls `setToken(token)` and dispatches `SET_AUTH` |
| Route guard | `Authentication(Component)` HOC (`containers/Authentication/index.js`) — `!authenticated` → `<Redirect to='/login' />`. No `from` state, so the return path is lost |
| Profile bootstrap | `Application.componentDidMount` calls `fetchProfile()` (`GET /api/user/me`) whenever a token exists |
| Sign-out | `Login.signOut()` → `clearAuth()`, `clearAccount()`, `push('/login')`, `localStorage.removeItem('token')`, success toast `You have signed out!`. **No server call — there is no logout endpoint.** |

### 1.2 Redux store

Single barrel `client/app/actions.js` re-exports every container's action creators; containers do
`connect(mapStateToProps, actions)`, so **any container can dispatch any feature's actions**
(cross-feature dispatches are load-bearing, e.g. Cart dispatching Product's `RESET_PRODUCT_SHOP`,
AccountSecurity dispatching ResetPassword's `resetAccountPassword`, Checkout dispatching Order's
`placeOrder`).

Root slice keys (`client/app/reducers.js`):
`router`, `notifications`, `application`, `homepage`, `signup`, `login`, `forgotPassword`,
`navigation`, `authentication`, `cart`, `newsletter`, `dashboard`, `account`, `address`,
`resetPassword`, `users`, `product`, `category`, `brand`, `menu` (NavigationMenu), `shop`,
`merchant`, `contact`, `order`, `review`, `wishlist`.

### 1.3 Notifications

`react-notification-system-redux`; the host component is `containers/Notification`
(reducer slice `notifications`), rendered first inside `.application`.
Conventions: success → `success({title, position:'tr', autoDismiss:1})`; warnings →
`warning({...})`; every HTTP error funnels through `utils/error.handleError(error, dispatch, title?)`.
`Notification/index.js` hard-overrides `style.NotificationItem.success.color = 'red'`
(success toasts render red — deliberate or fix, but it is current behaviour).

### 1.4 Cart persistence (client-authoritative)

The cart is **entirely `localStorage`** — there is no `GET /api/cart`:

| Key | Meaning |
|---|---|
| `cart_items` | JSON array of the products added (full product objects, plus `quantity`, `totalPrice`) |
| `cart_total` | `Σ(price × quantity)`, rounded to 2dp — **pre-tax, no shipping** |
| `cart_id` | legacy server-cart id; dropped — the current bag (`mern26.cart`, Part A §A.3.3) has no server cart and checkout creates the order directly |

`Application.componentDidMount` rehydrates via `handleCart()`, and a `window` `storage` listener
re-runs `handleCart()` when another tab changes `cart_items`.

### 1.5 Route table

Top level — `containers/Application/index.js`:

| Path | Component | Guard |
|---|---|---|
| `/` (exact) | `Homepage` | public |
| `/shop` | `Shop` (nests `ProductsShop`, `/shop/category/:slug` → `CategoryShop`, `/shop/brand/:slug` → `BrandsShop`) | public |
| `/sell` | `Sell` | public |
| `/contact` | `Contact` | public |
| `/brands` | `BrandsPage` | public |
| `/product/:slug` | `ProductPage` | public |
| `/order/success/:id` | `OrderSuccess` | public |
| `/order/:id` | `OrderPage` | public (API scopes by owner unless Admin) |
| `/login` | `Login` | public |
| `/register` | `Signup` | public |
| `/forgot-password` | `ForgotPassword` | public |
| `/reset-password/:token` | `ResetPassword` | public |
| `/auth/success` | `AuthSuccess` | public |
| `/merchant-signup/:token` | `MerchantSignup` | public |
| `/support/llm-chat` | `Support/LlmChatPage` | **public** (not wrapped) |
| `/support/admin-db` | `Support/AdminDbPanelPage` | **public** (not wrapped) |
| `mern-ecommerce/client/app/components/Manager/AdminDbPanel` | `AdminDbPanelPage` | public — **junk copy-paste route; do not port** |
| `/support` | `Authentication(Support)` | auth |
| `/dashboard` | `Authentication(Dashboard)` | auth |
| `/404` and `*` | `Page404` | public |

Dashboard nested routes — chosen by `containers/Dashboard/index.js` from `state.account.user.role`:

| Route | Admin | Merchant | Member/Customer |
|---|---|---|---|
| `/dashboard` (exact) → `Account` | ● | ● | ● |
| `/dashboard/security` → `AccountSecurity` | ● | ● | ● only when `!isProviderAllowed(user.provider)` |
| `/dashboard/address` → `Address` | ● | ● | ● |
| `/dashboard/product` → `Product` | ● | ● | — |
| `/dashboard/category` → `Category` | ● | — | — |
| `/dashboard/brand` → `Brand` | ● | ● | — |
| `/dashboard/users` → `Users` | ● | — | — |
| `/dashboard/merchant` → `Merchant` | ● | — | — |
| `/dashboard/orders` → `Order` | ● | ● | ● |
| `/dashboard/orders/customers` → `Order/Customer` | ● | — | — |
| `/dashboard/review` → `Review` | ● | — | — |
| `/dashboard/wishlist` → `WishList` | ● | ● | ● |
| `*` | `Page404` | `Page404` | `Page404` |

`isProviderAllowed(provider)` (`utils/app.js`) is `true` for Google/Facebook — i.e. it means
*"this account is OAuth-linked"*; it is used **inverted** in `Customer.js` to hide
`/dashboard/security`. `isDisabledMerchantAccount(user)` (`utils/app.js`) is
`role === 'ROLE MERCHANT' && user.merchant && user.merchant.isActive === false`, and short-circuits
the whole dashboard into `components/Manager/DisabledAccount/Merchant`.

Sidebar links come from `containers/Dashboard/links.json` — an object keyed by
`"ROLE ADMIN"` / `"ROLE MERCHANT"` / `"ROLE MEMBER"`, each an array of
`{to: string, name: string, prefix?: '/dashboard', provider?: ['Email']}`. `AccountMenu` hides any
link whose `provider` array does not include `user.provider`. The `Support` entries have **no**
`prefix`, so they navigate to the top-level `/support` (outside the dashboard shell).

---

## 2. Shared UI contracts

| Topic | Contract to preserve |
|---|---|
| Sort options | `utils/store.js`: `[{value:0,label:'Newest First'},{value:1,label:'Price High to Low'},{value:2,label:'Price Low to High'}]`; mapped to `sortOrder` `{_id:-1}` / `{price:-1}` / `{price:1}` |
| Storefront list query | keys sent to `GET /api/product/list`: `name, category, brand, min, max, rating, order, page, limit, sortOrder` |
| Pagination component | `components/Common/Pagination` wraps `react-paginate`; it calls `onPagination('pagination', selectedPage + 1)` — i.e. the host's handler always receives `('pagination', <page>)` |
| SearchBar | `components/Common/SearchBar` debounces typing by **1000 ms** before calling `onSearch`; containers then gate on `value.length >= 2` |
| Filter combination | `productsFilterOrganizer` (Product actions): `category` resets `brand` to `'all'`; `brand` resets `category` to `'all'`; `price` sets `min`/`max` from the `[lo,hi]` tuple; `rating` sets `rating`; `sorting` sets `order`; `pagination` sets `page`; the `default` branch forces `category:'all', brand:'all'` |
| Manager list limits | Order / Users / Review / Merchant fetch with `limit: 20`; the storefront uses `limit: 10` |
| Redirect-on-success | Address / Brand / Category / Product-Add / Merchant-Add all `goBack()` after a successful mutation |
| Toasts | `response.data.message` is used verbatim as the toast title in most flows |

---

## 3. Containers (37)

### 3.1 `containers/Account`

* **Route**: `/dashboard` (exact) in all three dashboard shells.
* **Purpose**: view/edit the signed-in user's profile.
* **Reads**: `state.account.user`, `state.resetPassword.*` (unused here). No fetch of its own — the
  `componentDidMount` fetch is commented out; data arrives from `Dashboard`/`Application`
  `fetchProfile()`.
* **API**: `GET /api/user/me` (`fetchProfile`, dispatched by the parent), `PUT /api/user`
  (`updateProfile`) with body `{ profile: state.account.user }` — the **whole** user object is sent.
* **Actions**: `accountChange` → `ACCOUNT_CHANGE`, `fetchProfile` → `FETCH_PROFILE`,
  `updateProfile` → `FETCH_PROFILE` + `success(response.data.message)` + `CLEAR_ACCOUNT` (project
  `clearAccount`), `setProfileLoading` → `SET_PROFILE_LOADING`.
* **UI to preserve**: `SubPage title='Account Details'` hosting `components/Manager/AccountDetails`.
* **Gaps**: the PUT body is not whitelisted (the client sends server-owned `_id`/`role`/`provider`);
  `ACCOUNT_CHANGE` only tracks `firstName`/`lastName`; the email input is commented out in the
  component (`TODO` in source).
* **Reducer**: `{ user: {firstName:'', lastName:'', provider:'', role:''}, isLoading:false }`.

### 3.2 `containers/AccountSecurity`

* **Route**: `/dashboard/security`.
* **Purpose**: in-session password change.
* **Reads**: `state.resetPassword.resetFormData`, `state.resetPassword.formErrors`.
* **API**: `POST /api/auth/reset` (`resetAccountPassword`, owned by the ResetPassword module) with
  body `{ password, confirmPassword }` → then `signOut()`.
* **UI to preserve**: `SubPage title='Account Security'` + `ResetPasswordForm` (no `isToken`).
* **Note**: the server treats `password` as the **old** password and `confirmPassword` as the new
  one — the labels in the storefront reset form must follow that mapping.
* **Gaps**: no reducer of its own; shares `state.resetPassword` with the token flow (a token-flow
  validation error is visible on this page too).

### 3.3 `containers/Address`

* **Route**: `/dashboard/address`; nested `exact /dashboard/address` → `List`,
  `/dashboard/address/edit/:id` → `Edit`, `/dashboard/address/add` → `Add`, `*` → `Page404`.
* **Purpose**: shipping-address CRUD.
* **API**: `GET /api/address` (`fetchAddresses`), `GET /api/address/:id` (`fetchAddress`),
  `POST /api/address/add` (`addAddress`) body `{isDefault, ...addressFormData}`,
  `PUT /api/address/:id` (`updateAddress`) body = the **bare** address object (no wrapper key — unique
  among the manager modules), `DELETE /api/address/delete/:id` (`deleteAddress`).
* **Actions**: `addressChange`→`ADDRESS_CHANGE`, `addressEditChange`→`ADDRESS_EDIT_CHANGE`,
  `handleAddressSelect`→`ADDRESS_SELECT`, `setAddressLoading`→`SET_ADDRESS_LOADING`,
  `SET_ADDRESS_FORM_ERRORS`, `SET_ADDRESS_FORM_EDIT_ERRORS`, `RESET_ADDRESS`. Mutations `goBack()`.
* **UI to preserve**: List → `NotFound 'No addresses found.'`; SubPage action `Add`;
  Add/Edit action `Cancel` → `history.goBack()`; Edit refetches on `params.id` change and shows
  `NotFound 'No address found.'` until `address._id`.
* **Validation**: add — `address|city|state|country` required, `zipCode` `required|min:5`;
  edit — same fields required without the `min:5`.
* **Gaps**: the legacy client used the by-id address routes; they are all `auth`-protected and scoped to the owner
  (a foreign or unknown id is a 404) in the current server. `Edit.js` passes a `defaultChange` prop that has no
  action creator; `state.address.isDefault` is read but absent from the reducer initial state.
* **Reducer**: `{ addresses:[], addressFormData:{address,city,state,country,zipCode,isDefault},
  address:{_id,address,city,state,country,zipCode,isDefault}, formErrors:{}, editFormErrors:{} }`.

### 3.4 `containers/Application`

* **Route**: not a route — the app shell (`Notification`, `Navigation`, `Container > .wrapper >
  Switch`, `Footer`).
* **Purpose**: layout, top-level router, global bootstrap.
* **Behaviour to preserve**: `fetchProfile()` when `localStorage.token` exists; `handleCart()`;
  `user-is-tabbing` body class on Tab keydown, removed on mousedown; cross-tab cart rehydrate via
  the `storage` listener on `cart_items`; no unmount cleanup.
* **Gaps**: no listener teardown; a token added after mount is not re-detected;
  `/support/llm-chat` and `/support/admin-db` bypass the auth HOC.
* **Reducer**: `{}` (only `DEFAULT_ACTION`).

### 3.5 `containers/AuthSuccess`

* **Route**: `/auth/success` (the OAuth callback landing page).
* **Purpose**: persist the JWT delivered in the query string and finish sign-in.
* **Behaviour to preserve**: token = everything after the first `=` in `location.search`, then a
  single `.replace('%20',' ')`; `setToken(token)` + `localStorage.setItem('token', token)` +
  `setAuth()`; unauthenticated → `LoadingIndicator`; authenticated → `<Redirect to='/dashboard' />`.
* **Gaps**: no `GET /api/user/me` verification, so any `?token=` value flips `authenticated`; a
  missing/malformed parameter spins forever; no error branch. The token contains
  `Bearer%20<jwt>` and the server produced it with `res.redirect(...?token=Bearer <jwt>)`.
  A rewrite should decode the query properly (`URLSearchParams`) and validate via `/api/user/me`.

### 3.6 `containers/Authentication`

* **Route**: not a route — HOC wrapping `Dashboard` and `Support`.
* **Purpose**: redirect unauthenticated users to `/login`.
* **Gaps**: no token re-validation on mount (a hard refresh with a stale local token lands on
  `/login` because nothing dispatches `SET_AUTH` except `app.js` at module load and the login flows).

### 3.7 `containers/Brand`

* **Route**: `/dashboard/brand` (Admin + Merchant shells). Nested: `exact /dashboard/brand` → `List`,
  `exact /dashboard/brand/edit/:id` → `Edit`, `exact /dashboard/brand/add` → `Add` **only when
  `user.role === ROLES.Admin`**, else `Page404`.
* **Purpose**: brand CRUD; also owns the storefront brand fetch used by `/brands` and the navbar.
* **API**: `GET /api/brand/list` (`fetchStoreBrands`), `GET /api/brand` (`fetchBrands`),
  `GET /api/brand/:id` (`fetchBrand`), `GET /api/brand/list/select` (`fetchBrandsSelect` →
  `formatSelectOptions(brands, true)`), `POST /api/brand/add` (`addBrand`, body = `brandFormData`),
  `PUT /api/brand/:id` (`updateBrand`, body `{brand:{name,slug,description}}`),
  `PUT /api/brand/:id/active` (`activateBrand`, body `{brand:{isActive:value}}`),
  `DELETE /api/brand/delete/:id` (`deleteBrand`).
* **Actions**: `BRAND_CHANGE`, `BRAND_EDIT_CHANGE`, `SET_BRAND_FORM_ERRORS`,
  `SET_BRAND_FORM_EDIT_ERRORS`, `RESET_BRAND`, `FETCH_BRANDS`, `SET_BRANDS_LOADING`,
  `FETCH_STORE_BRANDS`, `FETCH_BRAND`, `FETCH_BRANDS_SELECT`, `ADD_BRAND`, `REMOVE_BRAND`.
* **UI to preserve**: List title `Brands` for admin, `Brand` otherwise; the `Add` action button is
  rendered only for admin (`actionTitle={user.role === ROLES.Admin && 'Add'}` — `false` hides it);
  empty → `NotFound 'No brands found.'`.
* **Validation**: add — `name` required, `description` `required|max:200`; update — `name` required,
  `slug` `required|alpha_dash`, `description` `required|max:200`.
* **Gaps**: the `Add` route is only client-guarded; `activateBrand` refetches the brand currently in
  `state.brand.brand` rather than the toggled one (wrong record when toggled from a list, but the
  List UI has no toggle so it is masked); `EditBrand`'s `Delete` button is `disabled` for Merchant
  even though the server allows Merchant deletes only for Admin — the client is stricter.
* **Reducer**: `{ brands:[], storeBrands:[], brand:{name,description}, brandsSelect:[],
  brandFormData:{name,description,isActive:true}, formErrors:{}, editFormErrors:{}, isLoading:false }`.

### 3.8 `containers/BrandsPage`

* **Route**: `/brands` (public).
* **Purpose**: public "Shop By Brand" index.
* **API**: `GET /api/brand/list` on mount → `FETCH_STORE_BRANDS`.
* **UI to preserve**: renders `components/Store/BrandList` directly; no loading/empty/error state.
* **Gaps**: assumes the endpoint returns only active brands (it does).

### 3.9 `containers/BrandsShop`

* **Route**: `/shop/brand/:slug`, nested inside `Shop`.
* **Purpose**: product grid filtered by brand slug.
* **API**: `GET /api/product/list` with `{...advancedFilters, brand:<slug>, sortOrder}`.
* **UI to preserve**: `isLoading` → `LoadingIndicator`; results → `ProductList` (gets
  `authenticated` + `updateWishlist`); empty → `NotFound 'No products found.'`.
* **Gaps**: reuses the shop-wide `advancedFilters` (stale page/sort on first mount); the API must
  accept a brand **slug**.

### 3.10 `containers/Cart`

* **Route**: not a route — the mini-cart drawer rendered by `containers/Navigation`
  (`state.navigation.isCartOpen`).
* **Purpose**: cart line items, totals, checkout CTA.
* **API**: none of its own in the current stack — the bag is client-side and checkout is a single
  `POST /api/order/checkout` (Part A §A.3.3–A.3.4); the legacy server-cart round trip is gone.
* **Actions**: `handleAddToCart` → `ADD_TO_CART` (+ Product's `SET_PRODUCT_SHOP_FORM_ERRORS` /
  `RESET_PRODUCT_SHOP`), writes `cart_items`, `calculateCartTotal()`; `handleRemoveFromCart` →
  `REMOVE_FROM_CART` + `calculateCartTotal()`; `calculateCartTotal` → `HANDLE_CART_TOTAL` +
  `cart_total`; `handleCart` → `HANDLE_CART`; `handleCheckout` → `toggleCart()` + `push('/login')` +
  success toast `Please Login to proceed to checkout`; `handleShopping` → `push('/shop')` +
  `toggleCart()`; `clearCart` → `CLEAR_CART` + removes all three localStorage keys.
* **UI to preserve**: close button only when open; empty state `BagIcon` + `Your shopping cart is
  empty`; `CartList` then `CartSummary(cartTotal)` + `Checkout`. Quantity validation tiers from
  `calculatePurchaseQuantity(inventory)`: `≤25→1`, `26–100→5`, `101–499→25`, `≥500→50`, with
  messages `Quantity must be at least 1.` / `Quantity may not be greater than N.`
* **Gaps**: the cart was client-authoritative, with `handleRemoveFromCart` filtering by `_id` and dropping
  duplicates. Superseded by the server-priced checkout and stock revalidation of Part A §A.3.3.
* **Reducer**: `{ cartItems:[], cartTotal:0, cartId:'' }`.

### 3.11 `containers/Category`

* **Route**: `/dashboard/category` (Admin shell only; the in-container admin guard is **commented
  out**). Nested: List / `edit/:id` / `add`.
* **Purpose**: category CRUD with product attachments.
* **API**: `GET /api/category/list` (`fetchStoreCategories`), `GET /api/category` (`fetchCategories`),
  `GET /api/category/:id` (`fetchCategory`, products → `formatSelectOptions`),
  `POST /api/category/add` (`addCategory`) body `{name, description, products: ids}`,
  `PUT /api/category/:id` (`updateCategory`) body `{category:{name,slug,description,products}}`,
  `PUT /api/category/:id/active` (`activateCategory`) body `{category:{isActive:value}}`,
  `DELETE /api/category/delete/:id` (`deleteCategory`). Add/Edit also call
  `GET /api/product/list/select` (`fetchProductsSelect`).
* **Actions**: `CATEGORY_CHANGE`, `CATEGORY_EDIT_CHANGE`, `RESET_CATEGORY`, `categorySelect`,
  `FETCH_CATEGORIES`, `FETCH_STORE_CATEGORIES`, `FETCH_CATEGORY`, `ADD_CATEGORY`, `REMOVE_CATEGORY`.
* **UI to preserve**: `SubPage 'Categories'` + `Add`; empty → `NotFound 'No categories found.'`;
  Edit shows `NotFound 'No category found.'` until `category._id`; the multi-select's
  `defaultValue` is `category.products`.
* **Validation**: add — `name` required, `description` `required|max:200`, `products` required;
  update adds `slug` `required|alpha_dash`.
* **Gaps**: `activateCategory` does not refetch; `categorySelect` references an **undeclared**
  `CATEGORY_SELECT` (would throw if dispatched); the loading constant is the string
  `'src/Product/SET_CATEGORIES_LOADING'`, colliding with the Product module.
* **Reducer**: `{ categories:[], storeCategories:[], category:{_id:''},
  categoryFormData:{name,description,products:[],isActive:true}, formErrors:{}, editFormErrors:{},
  isLoading:false }`.

### 3.12 `containers/CategoryShop`

* **Route**: `/shop/category/:slug`, nested inside `Shop`.
* **Purpose**: product grid filtered by category slug.
* **API**: `GET /api/product/list` with `{...advancedFilters, category:<slug>, sortOrder}`.
* **UI to preserve**: three mutually exclusive blocks (spinner / `ProductList` / `NotFound 'No
  products found.'`).
* **Gaps**: same shared-`advancedFilters` coupling; requires the API to treat `category` as a slug.

### 3.13 `containers/Contact`

* **Route**: `/contact` (public).
* **Purpose**: public enquiry form.
* **API**: `POST /api/contact/add` (`contactUs`) body = `contactFormData`.
* **Actions**: `contactFormChange` → `CONTACT_FORM_CHANGE`; success → `CONTACT_FORM_RESET` +
  toast `response.data.message`.
* **Validation**: `name` required; `email` `required|email`; `message` `required|min:10`.
* **Gaps**: the toast fires regardless of `response.data.success`; there is no double-submit guard.
* **Reducer**: `{ contactFormData:{name:'',email:'',message:''}, formErrors:{} }`.

### 3.14 `containers/Dashboard`

* **Route**: `/dashboard` (auth-wrapped); it owns all `/dashboard/*` routes.
* **Purpose**: role-based dashboard frame + sidebar + disabled-merchant gate.
* **API**: `GET /api/user/me` on mount (`fetchProfile`).
* **Behaviour to preserve (order matters)**: `isDisabledMerchantAccount(user)` → render
  `DisabledAccount/Merchant` **before** the loading check; then `isLoading` → inline
  `LoadingIndicator`; then Admin → `Dashboard/Admin`, `ROLES.Merchant && user.merchant` →
  `Dashboard/Merchant`, else → `Dashboard/Customer` (a Merchant with no `user.merchant` silently
  falls through to Customer).
* **Actions**: `toggleDashboardMenu` → `TOGGLE_DASHBOARD_MENU`.
* **Reducer**: `{ isMenuOpen: false }`.

### 3.15 `containers/ForgotPassword`

* **Route**: `/forgot-password` (public).
* **Purpose**: request a reset email.
* **API**: `POST /api/auth/forgot` (`forgotPassowrd` — sic) body = `forgotFormData` `{email}`.
* **Behaviour to preserve**: authenticated → `<Redirect to='/dashboard' />`; on
  `response.data.success === true` → `push('/login')`; always a success toast with
  `response.data.message` + `FORGOT_PASSWORD_RESET`; on exception the toast title is
  `Please try again!`.
* **Validation**: `email` `required|email`, custom message `Email is required.`
* **Gaps**: `FORGOT_PASSWORD_RESET` clears the email but not `formErrors` (a stale error can persist).
* **Reducer**: `{ forgotFormData:{email:''}, formErrors:{} }`.

### 3.16 `containers/Homepage`

* **Route**: `/` (exact, public).
* **Purpose**: static storefront hero.
* **Reads/writes**: none (`mapStateToProps` returns `{}`; only `DEFAULT_ACTION` exists).
* **UI to preserve**: a row of three columns — centre `CarouselSlider` (`swipeable showDots infinite
  autoPlay={false}`, slides from `banners.json`, `responsive` config) and two side columns with
  hard-coded banner images (`/images/banners/banner-2.jpg` appears **twice**, plus `banner-5.jpg`
  and `banner-6.jpg`).
* **`banners.json`**: array of `{imageUrl, link, title, content}` — two entries
  (`banner-3.jpg`, `banner-4.jpg`); `link`/`title`/`content` are unused by the JSX.
* **Gaps**: fully static committed content (no CMS/API); `DEFAULT_ACTION` returns an `undefined` state.

### 3.17 `containers/Login`

* **Route**: `/login` (public).
* **API**: `POST /api/auth/login` (`login`) body = `loginFormData` `{email, password}`.
* **Behaviour to preserve**: `authenticated` → `<Redirect to='/dashboard' />`; on success
  `localStorage.setItem('token', response.data.token)`, `setToken(response.data.token)`,
  toast `` `Hey ${response.data.user.firstName}, Welcome Back!` `` (position `tr`, autoDismiss 1),
  `LOGIN_RESET`; failure → `handleError(error, dispatch, 'Please try to login again!')`.
* **Actions**: `loginChange`→`LOGIN_CHANGE`, `SET_LOGIN_FORM_ERRORS`, `SET_LOGIN_SUBMITTING`,
  `SET_LOGIN_LOADING`, `LOGIN_RESET`; also `setAuth`, `clearAuth`, `clearAccount`, `signOut`.
* **UI to preserve**: `isLoading` → `LoadingIndicator`; submit disabled while `isSubmitting`;
  `Create an account` → `/register`; `Forgot Password?` → `/forgot-password`; right column
  `SignupProvider` (OAuth buttons link to `${API_URL}/auth/google` and `${API_URL}/auth/facebook`).
* **Validation**: `email` `required|email`; `password` `required|min:6`.
* **Gaps**: `clearCart()` on login is commented out, so a previous user's local cart survives;
  sign-out makes no server call.
* **Reducer**: `{ loginFormData:{email:'',password:''}, formErrors:{}, isSubmitting:false,
  isLoading:false }`.

### 3.18 `containers/Merchant`

* **Route**: `/dashboard/merchant` (Admin shell only). Files: `index.js`, `List.js`, `Add.js`,
  `actions.js`, `constants.js`, `reducer.js` — there is **no `Edit.js` and no `Customer.js`**.
* **Purpose**: admin merchant administration (approve/reject/enable/disable/delete) + add-merchant
  form; also owns the merchant-invite signup thunk reused by `MerchantSignup`.
* **API**: `GET /api/merchant?page=&limit=20` (`fetchMerchants`),
  `GET /api/merchant/search?search=` (`searchMerchants`), `POST /api/merchant/add` (`addMerchant`),
  `PUT /api/merchant/:id/active` (`disableMerchant`) body `{merchant:{isActive:value}}`,
  `PUT /api/merchant/approve/:id` (`approveMerchant`), `PUT /api/merchant/reject/:id`
  (`rejectMerchant`), `DELETE /api/merchant/delete/:id` (`deleteMerchant`),
  `POST /api/merchant/signup/:token` (`merchantSignUp`) body = `signupFormData`.
* **Actions**: `FETCH_MERCHANTS`, `FETCH_SEARCHED_MERCHANTS`, `SET_ADVANCED_FILTERS`,
  `REMOVE_MERCHANT` (defined but **never dispatched**), `MERCHANT_CHANGE`, `SET_MERCHANT_FORM_ERRORS`,
  `SET_MERCHANTS_LOADING`, `SET_MERCHANTS_SUBMITTING`, `RESET_MERCHANT`, `SIGNUP_CHANGE`,
  `SET_SIGNUP_FORM_ERRORS`, `SIGNUP_RESET`.
* **UI to preserve**: mount → `fetchMerchants()` (page 1, limit 20); search is **server-side** for
  input ≥2 chars and swaps in `searchedMerchants`; pagination only when not searching and
  `totalPages > 1`; `SearchResultMeta label='merchants'`; `SubPage 'Merchants'` with an admin-only
  `Add`; `isLoading` → `LoadingIndicator`; empty → `NotFound 'No merchants found.'`; every
  approve/reject/disable/delete refetches the list (no optimistic update).
* **Validation (add)**: `name` required; `email` `required|email`; `phoneNumber` required + US
  10-digit regex `/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/`; `brandName` required;
  `business` `required|min:10`.
* **Gaps**: `List.js` defines an unwired `handleOnPagination` that would call a non-existent
  `fetchUsers`; search results are unpaginated; `REMOVE_MERCHANT` is dead code.
* **Reducer**: `{ merchants:[], searchedMerchants:[], advancedFilters:{totalPages:1,currentPage:1,
  count:0}, merchantFormData:{name,email,phoneNumber,brandName,business}, formErrors:{},
  signupFormData:{email,firstName,lastName,password}, signupFormErrors:{}, isLoading:false,
  isSubmitting:false }`.

### 3.19 `containers/MerchantSignup`

* **Route**: `/merchant-signup/:token` (public).
* **Files**: `index.js` only — reuses `state.merchant.signupFormData` / `signupFormErrors`.
* **API**: `POST /api/merchant/signup/:token` (`merchantSignUp`) using the path token.
* **Behaviour to preserve**: on mount,
  `const email = this.props.location.search.split('=')[1]; merchantSignupChange('email', email);`
  — i.e. the **first** query parameter's value is taken as the email, with no decoding.
  On success → `signOut()` → `push('/login')` + toast `You have signed up successfully! Please sign
  in with the email and password.`
* **UI to preserve**: fields email / firstName / lastName / password, button `Get Started`; no
  submitting state, no disabled button, no confirm-password field.
* **Validation (in the thunk)**: `email` `required|email`, `password` `required|min:6`,
  `firstName` required, `lastName` required.
* **Gaps**: fragile query parsing (`split('=')[1]` breaks on `%40`-encoded or non-first params) —
  the rewrite should use `URLSearchParams`.

### 3.20 `containers/Navigation`

* **Route**: not a route — rendered on every page by `Application`.
* **Purpose**: global header — product autosuggest, brands dropdown, category drawer, cart drawer,
  auth links.
* **API**: `GET /api/product/list/search/:name` (`onSuggestionsFetchRequested`),
  `GET /api/brand/list` (`fetchStoreBrands`), `GET /api/category/list` (`fetchStoreCategories`).
* **Behaviour to preserve**:
  * The autosuggest request fires **only when `inputValue.length % 3 === 0`** (not a debounce) —
    a rewrite should debounce but keep the endpoint.
  * Selecting a suggestion pushes `/product/<slug>`.
  * `toggleMenu()` re-fetches categories; `toggleBrand()` re-fetches brands; both then toggle.
  * Static links: `Shop` → `/shop`, `LLM Chat` → `/support/llm-chat`,
    `Admin DB Panel` → `/support/admin-db`.
  * Auth dropdown: authenticated → `Dashboard` / `Sign Out`; unauthenticated → `Login` / `Sign Up`.
  * `CartIcon` (`Cart.Navigation` toggle) and the drawer classnames
    `mini-cart-open`/`hidden-mini-cart`, `mini-menu-open`/`hidden-mini-menu`, backdrop `dark-overflow`.
  * Info bar: `Free Shipping`, `Payment Methods`, `Call us 951-999-9999`.
* **Actions**: `TOGGLE_MENU`, `TOGGLE_CART`, `TOGGLE_BRAND`, `SEARCH_CHANGE`,
  `SUGGESTIONS_FETCH_REQUEST`, `SUGGESTIONS_CLEAR_REQUEST`, plus `signOut`.
* **Reducer**: `{ isMenuOpen:false, isCartOpen:false, isBrandOpen:false, searchValue:'',
  searchSuggestions:[] }` — `TOGGLE_MENU` also force-closes the cart, and vice versa.

### 3.21 `containers/NavigationMenu`

* **Route**: not a route — rendered inside the Navigation drawer as `<Menu />`.
* **Purpose**: slide-out "Shop By Category" list.
* **API**: none of its own (categories come from Navigation's `fetchStoreCategories`).
* **Actions**: `toggleMenu` (close on category click); `DEFAULT_ACTION` is an unused noop.
* **UI to preserve**: header `Shop By Category`; close icon only when `isMenuOpen`; each item is a
  `NavLink` to `/shop/category/<slug>` with `activeClassName='active-link'` that closes the drawer.
* **Gaps**: no empty/loading state — `categories.map` throws if the slice is ever null.

### 3.22 `containers/Newsletter`

* **Route**: not a route — rendered by `components/Common/Footer`, which is on every page.
* **API**: `POST /api/newsletter/subscribe` (`subscribeToNewsletter`) body `{email}`.
* **Actions**: `NEWSLETTER_CHANGE` (payload is the **raw value**, not an object), success →
  `NEWSLETTER_RESET` + toast `response.data.message`; `SET_NEWSLETTER_FORM_ERRORS`.
* **UI to preserve**: single text input (`type='text'`, not email), placeholder
  `Please Enter Your Email`, inline submit button `Subscribe`, label `Sign Up for Our Newsletter`.
* **Validation**: `email` `required|email` with `Email is required.` / `Email format is invalid.`
* **Gaps**: no loading/success state; no dedupe; the toast and error handling differ from Contact.
* **Reducer**: `{ email:'', formErrors:{} }`.

### 3.23 `containers/Notification`

* **Route**: not a route — first child of `.application`.
* **Purpose**: `react-notification-system-redux` toast host.
* **Reads**: `state.notifications` (the library reducer, aliased in `reducers.js`).
* **UI to preserve**: `<Notifications notifications={notifications} style={style} />` with
  `NotificationItem.DefaultStyle.margin = '10px 5px 2px 1px'` and
  `NotificationItem.success.color = 'red'`.
* **Gaps**: the red-success override is surprising; per-caller `position:'tr'` + `autoDismiss:1`.

### 3.24 `containers/Order`

* **Route**: `/dashboard/orders`. Nested: `List` (exact) and `Customer` (exact
  `/dashboard/orders/customers`, **Admin only**); `*` → `Page404`. Mounted in all three shells.
* **Purpose**: order history for the account; admin view of all orders.
* **API**: `GET /api/order/me?page=&limit=20` (`fetchAccountOrders`),
  `GET /api/order?page=&limit=20` (`fetchOrders`), `GET /api/order/search?search=`
  (`searchOrders`), `GET /api/order/:id` (`fetchOrder`),
  `DELETE /api/order/cancel/:id` (`cancelOrder`),
  `PUT /api/order/status/item/:itemId` (`updateOrderItemStatus`) body
  `{orderId, cartId, status}`. Order creation is no longer an Order-container concern: see Part A §A.3.4.
* **Behaviour to preserve**:
  * `updateOrderItemStatus`: if `response.data.orderCancelled` → `push('/dashboard/orders')`, else
    `UPDATE_ORDER_STATUS {itemId,status}` + refetch the order + success toast.
  * Lists: `LoadingIndicator` while loading; `SET_ADVANCED_FILTERS {totalPages,currentPage,count}`;
    `clearOrders()` on fetch failure.
* **UI to preserve**: `List` filters **client-side** on `order._id.includes(search)` for ≥2 chars
  (no API call) and hides pagination while searching; `Customer` uses the API search; empty states
  `You have no orders yet.` / `No orders found.`; the admin-only `Customer Orders` ↔ `My Orders`
  toggle.
* **Gaps**: the API search endpoint exists but `List` never uses it; `cancelOrder` needs
  `state.order.order` loaded first.
* **Reducer**: `{ orders:[], searchedOrders:[],
  order:{_id:'',cartId:'',products:[],totalTax:0,total:0,status:''}, isLoading:false,
  advancedFilters:{totalPages:1,currentPage:1,count:0} }`.

### 3.25 `containers/OrderPage`

* **Route**: `/order/:id` (public).
* **Purpose**: single-order detail.
* **API**: `GET /api/order/:id` (`fetchOrder`) on mount and on `match.params.id` change.
* **UI to preserve**: `LoadingIndicator backdrop` while loading; `OrderDetails` when `order._id`,
  else `NotFound 'No order found.'`; `onBack` pushes `/dashboard/orders` when the URL contains
  `success`, otherwise `history.goBack()`.
* **Gaps**: shares `state.order` with the Order container (no independent loading guard); the
  payload must include `products[]`, `_id` and per-item `_id`/`status`.

### 3.26 `containers/OrderSuccess`

* **Route**: `/order/success/:id` (public).
* **API**: `GET /api/order/:id` (`fetchOrder`).
* **UI to preserve**: loading indicator; confirmation with a link to
  `/order/<id>?success` (the `?success` flag drives OrderPage's back button) plus
  `Manage Orders` → `/dashboard/orders` and `Continue Shopping` → `/shop`; text
  `A confirmation email will be sent to you shortly.`; else `NotFound 'No order found.'`.

### 3.27 `containers/Product`

* **Route**: `/dashboard/product` (Admin + Merchant shells). Nested: `List` (exact), `Edit`
  (`edit/:id`), `Add` (`add`) — the admin guard around `Add` is **commented out**, so a Merchant can
  reach it.
* **Purpose**: product CRUD dashboard **and** the storefront list/filter engine reused by `Shop`.
* **API**: `GET /api/product` (`fetchProducts`, unpaginated), `GET /api/product/:id` (`fetchProduct`,
  sets `inventory = product.quantity`), `GET /api/product/list/select` (`fetchProductsSelect`),
  `GET /api/product/list` (`filterProducts`), `GET /api/product/item/:slug` (`fetchStoreProduct`),
  `POST /api/product/add` (`addProduct`, **multipart/form-data**), `PUT /api/product/:id`
  (`updateProduct`, JSON `{product:{...}}`), `PUT /api/product/:id/active` (`activateProduct`),
  `DELETE /api/product/delete/:id` (`deleteProduct`).
* **Filter engine to preserve** (`productsFilterOrganizer` / `getSortOrder`):
  `sorting` sets `order`; `price` sets `min`/`max`; `rating` sets `rating`; `pagination` sets
  `page`; `category` resets `brand` to `'all'`; `brand` resets `category` to `'all'`.
  `sortOrder` sent to the API: `0 → {_id:-1}`, `1 → {price:-1}`, `2 → {price:1}`, else `{}`.
* **Validation (add)**: `sku` `required|alpha_dash`, `name` required, `description`
  `required|max:200`, `quantity` `required|numeric`, `price` `required|numeric`, `taxable` required,
  `image` required (message `Please upload files with jpg, jpeg, png format.`), `brand` required.
* **UI to preserve**: List `SubPage 'Products'` + `Add`, empty → `NotFound 'No products found.'`;
  Add/Edit `Cancel` → `history.goBack()`; Edit refetches on id change and shows
  `NotFound 'No product found.'` until `product._id`.
* **Gaps**: `fetchProducts` returns everything with no pagination; `addProduct` forces a Merchant's
  brand to `brandsSelect[1]` (index-based, brittle); `updateProduct` does not send `image` or
  `isActive`; the API's `POST /api/product/add` does not attach the product to its category.
* **Reducer**: `{ products:[], storeProducts:[], product:{_id:''}, storeProduct:{},
  productsSelect:[], productFormData:{sku,name,description,quantity:1,price:1,image:{},
  isActive:true, taxable:{value:0,label:'No'}, brand:{value:0,label:'No Options Selected'}},
  isLoading:false, productShopData:{quantity:1}, formErrors:{}, editFormErrors:{},
  shopFormErrors:{}, advancedFilters:{name:'all',category:'all',brand:'all',min:1,max:2500,
  rating:0,order:0,totalPages:1,currentPage:1,count:0,limit:10} }`.

### 3.28 `containers/ProductPage`

* **Route**: `/product/:slug` (public).
* **Purpose**: storefront product detail — image, info, quantity picker, add/remove bag, reviews.
* **API**: `GET /api/product/item/:slug` (`fetchStoreProduct`), `GET /api/review/:slug`
  (`fetchProductReviews`).
* **UI to preserve**: `document.body.classList.add('product-page')` on mount, removed on unmount;
  loading indicator; `NotFound 'No product found.'` when the product object is empty; image fallback
  `/images/placeholder-image.png`; stock label `Out of stock` / `In stock`; brand link
  `/shop/brand/<brand.slug>`; quantity input min 1 / max `product.inventory`; the button label
  toggles `Add To Bag` ↔ `Remove From Bag` based on `itemInCart` (derived from
  `state.cart.cartItems.find(item => item._id === storeProduct._id)`); renders `ProductReviews` with
  the review form data/errors/summary.
* **Gaps**: reviews are **not** refetched when `:slug` changes (only the product is);
  `fetchStoreProduct` copies `quantity` into `inventory` and the UI reads both inconsistently;
  the add-button disabled condition uses `product.quantity` while the stock label uses
  `product.inventory`; the API response has **no `averageRating`** — the PDP rating must come from
  the reviews endpoint.

### 3.29 `containers/ProductsShop`

* **Route**: `/shop` (exact), rendered by `Shop`.
* **Purpose**: storefront product grid for the shop landing page.
* **API**: `GET /api/product/list` via `filterProducts(slug)` called with **one** argument, so the
  `default` branch runs and the filters are `category:'all', brand:'all'` plus the current
  min/max/rating/order/page/limit and `sortOrder={}`.
* **UI to preserve**: `LoadingIndicator`; `ProductList` (with `authenticated`, `updateWishlist`);
  `NotFound 'No products found.'`.
* **Gaps**: only fetches on mount (no refetch when returning to `/shop`); the "slug" argument is
  unused.

### 3.30 `containers/ResetPassword`

* **Route**: `/reset-password/:token` (public). Also owns `resetAccountPassword` used by
  `AccountSecurity`.
* **API**: `POST /api/auth/reset/:token` (`resetPassword`) body `{password, confirmPassword}`;
  `POST /api/auth/reset` (`resetAccountPassword`) body `{password, confirmPassword}`.
* **Behaviour to preserve**: authenticated → `<Redirect to='/dashboard' />`; on
  `response.data.success == true` → `push('/login')` + success toast + `RESET_PASSWORD_RESET`;
  `resetAccountPassword` on success dispatches `signOut()`.
* **Validation**: `password` `required|min:6`; `confirmPassword` `required|min:6|same:password`
  (the account variant drops `same:password`).
* **Gaps**: the token flow never sends the token in the body (it is a path param — fine for the
  current server); `success == true` vs `=== true` is inconsistent between the two thunks.
* **Reducer**: `{ resetFormData:{password:'',confirmPassword:''}, formErrors:{} }`.

### 3.31 `containers/Review`

* **Route**: `/dashboard/review` (Admin shell only).
* **Purpose**: admin review moderation (approve/reject/delete) with pagination; also owns the
  storefront review fetch + summary computation used by `ProductPage`.
* **API**: `GET /api/review?page=&limit=20` (`fetchReviews`), `GET /api/review/:slug`
  (`fetchProductReviews`), `POST /api/review/add` (`addProductReview`),
  `PUT /api/review/approve/:id` (`approveReview`), `PUT /api/review/reject/:id` (`rejectReview`),
  `DELETE /api/review/delete/:id` (`deleteReview`).
* **Behaviour to preserve**:
  * `addProductReview` validates then sanitises with DOMPurify (`santizeFields`) and posts
    `{product: storeProduct._id, isRecommended: reviewFormData.isRecommended.value, rating, review,
    title}`; on success → toast + `fetchProductReviews(product.slug)` + `RESET_REVIEW`. The
    `ADD_REVIEW` dispatch is commented out (refetch instead).
  * Approve/reject send **no body** and refetch page 1 afterwards (the current page index is lost).
  * `fetchProductReviews(slug)` computes `reviewsSummary` **client-side**:
    `ratingSummary = [{5:n},{4:n},{3:n},{2:n},{1:n}]` bucketed by `Math.round(review.rating)`,
    `totalRatings = Σ rating`, `totalReviews = count`, `totalSummary = bucketed count`.
* **Validation (add)**: `title` required, `review` required, `rating` `required|numeric|min:1`,
  `isRecommended` required; messages `Title is required.`, `Review is required.`,
  `Rating is required.`, `Recommendable is required.`
* **UI to preserve**: `SubPage 'Reviews'`, `Pagination` when `totalPages > 1`,
  `SearchResultMeta label='reviews'`, `ReviewList`, `NotFound 'No reviews found.'`.
* **Gaps**: `GET /api/review/:param` is the same route for "fetch by slug" and "get by id" — the
  rewrite must be explicit; the client-side average is `Math.round`ed and can disagree with the
  server-side `averageRating` from `/api/product/list`.
* **Reducer**: `{ reviews:[], isLoading:false, advancedFilters:{totalPages:1,currentPage:1,count:0},
  productReviews:[], reviewsSummary:{ratingSummary:[],totalRatings:0,totalReviews:0,totalSummary:0},
  reviewFormData:{title:'',review:'',rating:0,isRecommended:{value:1,label:'Yes'}},
  reviewFormErrors:{} }`.

### 3.32 `containers/Sell`

* **Route**: `/sell` (public).
* **Purpose**: "Become A MERN Store Seller!" page wrapping `components/Manager/AddMerchant`.
* **API**: none directly — `addMerchant` (Merchant module) → `POST /api/merchant/add`.
* **UI to preserve**: `LoadingIndicator` while loading; heading `Become A MERN Store Seller!`;
  two-column layout with an agreement banner `/images/banners/agreement.svg`; submit title
  `Submit`, button disabled while `isSubmitting`; validation is the Merchant module's
  (`name` required, `email` `required|email`, `phoneNumber` required + US regex, `brandName`
  required, `business` `required|min:10`).
* **Gaps**: reads `state.merchant.*` which this container never initialises.

### 3.33 `containers/Shop`

* **Route**: `/shop`; owns the nested switch for `/shop`, `/shop/category/:slug`,
  `/shop/brand/:slug`.
* **Purpose**: shop layout — filter sidebar, sort dropdown, result meta, sub-route grid, pagination.
* **API**: `GET /api/product/list` indirectly (the child containers fetch); the sort select and the
  pagination call `filterProducts`.
* **UI to preserve**: `document.body.classList.add('shop-page')` on mount / removed on unmount;
  result range text `` `${left}-${right} products of ${count} products` `` where
  `left = limit*(currentPage-1)+1`; sort select valued `{value: order, label: sortOptions[order].label}`
  whose handler is `filterProducts('sorting', n.value)` (the **numeric** 0/1/2);
  `Pagination` when `totalPages > 1` with `onPagination={filterProducts}` (receives
  `('pagination', page)`); `ProductFilter` on the left with `filterProducts('price', [min,max])` and
  `filterProducts('rating', rating(v))`.
* **Filter slider mapping to preserve**: price range `defaultValue={[1,2500]}`, `max={5000}`;
  rating slider `step={20}`, `defaultValue={[100]}`, where `100→0 (Any)`, `80→1`, `60→2`, `40→3`,
  `20→4`, default `→5`.
* **Gaps**: `sortOptions[order].label` throws if `order` is ever out of range; the container itself
  dispatches no initial fetch.
* **Reducer**: `{}` (placeholder).

### 3.34 `containers/Signup`

* **Route**: `/register` (public).
* **API**: `POST /api/auth/register` (`signUp`) body
  `{isSubscribed, email, firstName, lastName, password}`.
* **Behaviour to preserve**: authenticated → `<Redirect to='/dashboard' />`; on success
  `localStorage.setItem('token', response.data.token)`, `setToken(...)`, `setAuth()`, success toast,
  `SIGNUP_RESET`; `SET_SIGNUP_SUBMITTING`/`SET_SIGNUP_LOADING` true before the request and false in
  `finally`; errors → `handleError(error, dispatch, 'Please try to signup again!')`.
* **UI to preserve**: fields email / firstName / lastName / password; a `Subscribe to newsletter`
  checkbox bound to `isSubscribed` (`subscribeChange`); submit disabled while `isSubmitting`;
  `Back to login` link; `SignupProvider` for OAuth.
* **Validation**: `email` `required|email`, `password` `required|min:6`, `firstName` required,
  `lastName` required.
* **Gaps**: the server returns `subscribed` but the User document never stores it;
  `SIGNUP_RESET` leaves `isSubmitting`/`isSubscribed` untouched.
* **Reducer**: `{ signupFormData:{email,firstName,lastName,password}, formErrors:{},
  isSubmitting:false, isLoading:false, isSubscribed:false }`.

### 3.35 `containers/Support`

* **Files**: `index.js`, `LlmChatPage.js`, `AdminDbPanelPage.js`.
* **Route**: `/support` → `Authentication(Support)`; `/support/llm-chat` → `LlmChatPage`;
  `/support/admin-db` → `AdminDbPanelPage`; **both feature pages are public** (no auth HOC). The two
  feature pages are also re-exported from this directory and imported directly by `Application`.
* **Purpose**: support landing (`components/Manager/Support`, socket chat) + the two feature pages.
* **API**: no axios in this container. `LlmChatPage` renders `components/Store/LlmChat/LlmChat`
  (which calls `http://localhost:8000/rag` directly); `AdminDbPanelPage` renders
  `components/Manager/AdminDbPanel/AdminDbPanel` (literal `/api/admin-db/*` calls).
* **Gaps**: the junk route path
  `mern-ecommerce/client/app/components/Manager/AdminDbPanel` must not be ported. Both feature pages were
  public at the client route level; they remain public in `web` by design (Part A §A.2), with `/ai/ask` admin-only on the server.

### 3.36 `containers/Users`

* **Route**: `/dashboard/users` (Admin shell only).
* **Purpose**: admin user directory with API search + pagination.
* **API**: `GET /api/user?page=&limit=20` (`fetchUsers`), `GET /api/user/search?search=`
  (`searchUsers`).
* **UI to preserve**: `SubPage 'Users'` + `UserSearch`; search server-side for ≥2 chars and swaps in
  `searchedUsers`; pagination only when not searching and `totalPages > 1`
  (`handleOnPagination = (n, v) => fetchUsers(v)`); `SearchResultMeta label='users'`;
  `UserList`; `NotFound 'No users found.'`.
* **Gaps**: no role filter parameter exists on the API; `filter.name='user'` is never sent; search
  results are unpaginated.
* **Reducer**: `{ users:[], searchedUsers:[], advancedFilters:{totalPages:1,currentPage:1,count:0},
  isLoading:false }`.

### 3.37 `WishList`

* **Route**: `/dashboard/wishlist` (all three shells).
* **Purpose**: the signed-in user's wishlist.
* **API**: `GET /api/wishlist` (`fetchWishlist`), `POST /api/wishlist` (`updateWishlist`) body
  `{isLiked, product: productId}` — the thunk is guarded by
  `getState().authentication.authenticated === true`; if not authenticated it dispatches a
  `warning` toast `Please login to wishlist a product` (no redirect); on success a toast +
  `fetchWishlist()`.
* **UI to preserve**: `SubPage 'Your Wishlist'`; `LoadingIndicator`; rows from `WishList` component;
  `NotFound 'You have no items in your wishlist yet.'`
* **Gaps**: `wishlistForm` exists in the reducer but is never used; the item key is `product._id`.
* **Reducer**: `{ wishlist:[], isLoading:false, wishlistForm:{} }`.

---

## 4. `components/Store/**` (11 directories)

All Store components are **presentational** — they receive props from connected containers and
dispatch through the single `actions` barrel. Only `LlmChat` performs I/O itself.

### 4.1 `components/Store/ProductFilter`

* **Rendered by**: `containers/Shop` (left column).
* **Purpose**: price-range + rating filter panel.
* **Reads**: props only. **Writes**: `filterProducts('price', [lo,hi])` and
  `filterProducts('rating', rating(v))`.
* **UI to preserve**: two `RangeSlider`s — price (`defaultValue={[1,2500]}`, `max={5000}`, marks
  `$1`/`$5000`) and rating (`type='slider'`, `step={20}`, `defaultValue={[100]}`, marks
  `5★,4★,3★,2★,1★,Any` at `0/20/40/60/80/100`); the rating mapping is `100→0, 80→1, 60→2, 40→3,
  20→4, else 5` (note the stray unreachable `0;` before the `return 5`).
* **Gaps**: the sliders are uncontrolled after mount (internal state), so a redux-driven reset would
  not move them.

### 4.2 `components/Store/ProductList`

* **Rendered by**: `ProductsShop`, `CategoryShop`, `BrandsShop`.
* **Purpose**: responsive product-card grid linking to `/product/<slug>`, each with a wishlist heart.
* **Reads (from the item)**: `_id, slug, imageUrl` (fallback `/images/placeholder-image.png`),
  `name, brand.name, description, price, totalReviews, averageRating, isLiked`.
* **UI to preserve**: rating rendered as `parseFloat(averageRating).toFixed(1)` **only when
  `totalReviews > 0`**; `$` price prefix; `By <brand.name>` only when `brand` exists.
* **Gaps**: requires `isLiked`/`averageRating`/`totalReviews`/populated `brand` from
  `GET /api/product/list` — all present in that aggregation, but **absent** from
  `GET /api/product/item/:slug`.

### 4.3 `components/Store/AddToWishList`

* **Rendered by**: `ProductList` only.
* **Purpose**: heart checkbox toggle.
* **Props**: `id` (= `product._id`), `liked` (= `product.isLiked ?? false`),
  `enabled` (= `authenticated`), `updateWishlist`.
* **API**: `POST /api/wishlist` (`updateWishlist(value, id)`) — see `containers/WishList`.
* **UI to preserve**: `disabled={!enabled}` when unauthenticated, `id='checkbox_<productId>'`,
  heart icon label.

### 4.4 `components/Store/CartList`

* **Rendered by**: `containers/Cart` (inside the Navigation drawer).
* **Purpose**: cart line items with a remove button.
* **Reads**: `item.imageUrl` (fallback), `item.slug`, `item.name`, `item.totalPrice`, `item.quantity`.
* **UI to preserve**: remove button (`ariaLabel='remove <name> from cart'`), price row as
  `$${item.totalPrice}`, quantity, product link that closes the drawer (`toggleCart()`).

### 4.5 `components/Store/CartSummary`

* **Rendered by**: `containers/Cart` when there is at least one item.
* **Purpose**: two-row summary.
* **Reads**: `cartTotal` prop.
* **UI to preserve**: `Shipping` hard-coded `Free`; `Total` `$${cartTotal}`.
* **Gaps**: the legacy client did no tax or shipping computation; its `Shipping — Free` row was a literal. The current bag
  shows a tax preview (`TAX_RATE`) and the server re-prices on checkout (Part A §A.3.3).

### 4.6 `components/Store/Checkout`

* **Rendered by**: `containers/Cart`.
* **Purpose**: checkout CTA with an auth branch.
* **UI to preserve**: always `Continue shopping` → `handleShopping()`; authenticated →
  `Place Order` → `placeOrder()`; unauthenticated → `Proceed To Checkout` → `handleCheckout()`
  (which closes the drawer, pushes `/login` and shows
  `Please Login to proceed to checkout`).
* **Superseded**: `Place Order` is now `pages/Checkout.jsx` — address step plus `POST /api/order/checkout` (Part A §A.3.4).

### 4.7 `components/Store/BrandList`

* **Rendered by**: `containers/BrandsPage` (`/brands`).
* **Purpose**: "Shop By Brand" card grid.
* **Reads**: `state.brand.storeBrands` → `slug`, `name`, `description`.
* **API**: `GET /api/brand/list` (dispatched by the container on mount).
* **UI to preserve**: cards link to `/shop/brand/<slug>`; responsive `xs=6 md=4 lg=3` columns.

### 4.8 `components/Store/MiniBrand`

* **Rendered by**: `containers/Navigation` (brands dropdown).
* **Purpose**: navbar brand quick-links.
* **UI to preserve**: `See all` → `/brands`; each brand → `/shop/brand/<slug>`; clicking closes the
  dropdown (`toggleBrand()`); the dropdown renders only when `brands.length > 0`.

### 4.9 `components/Store/SocialShare`

* **Rendered by**: `containers/ProductPage`.
* **Purpose**: share buttons (`react-share`: Facebook / Twitter / Email / WhatsApp).
* **UI to preserve**: the shared URL is
  `` `I ♥ ${product.name} product on Mern Store!  Here's the link, ${protocol}//${host}/product/${product.slug}` ``;
  icon classes `share-btn facebook|twitter|envelope|whatsapp`.

### 4.10 `components/Store/ProductReviews` (`index.js`, `Add.js`, `List.js`, `Summary.js`)

* **Rendered by**: `containers/ProductPage`.
* **Purpose**: review summary + list + add form.
* **Reads**: `state.review.productReviews`, `state.review.reviewsSummary`,
  `state.review.reviewFormData`, `state.review.reviewFormErrors`.
* **API**: `GET /api/review/:slug` (parent), `POST /api/review/add` (form submit).
* **UI to preserve**:
  * `Summary` renders `ReactStars` (size 17) plus `based on <n> reviews.`; the average is
    `Math.round(totalRatings / totalReviews)`; distribution bars from `ratingSummary` with widths
    `percentage(count, totalSummary).toFixed(2)%`; zero-review state is a `NotFound` with a review
    icon and `Be the first to add a review.`
  * `List` is memoised; per review: avatar initial from `user.firstName.charAt(0)` with a random
    background colour, `ReactStars` (size 16, `edit={false}`, `isHalf`, active `#ffb302`),
    `formatDate(review.created)`, `title`, three-line-clamped `review`. Keyed by array index.
  * `Add` fields: `title`, `review` (textarea), `rating` (star input), `isRecommended`
    (`[{value:1,label:'Yes'},{value:0,label:'No'}]`); submit button `Publish Review`.
* **Approval buttons are NOT here** — they live in the admin `ReviewList` (row 5.29 in §5).
* **Gaps**: the review endpoint returns only `user.firstName` (no avatar/id) — the avatar is
  synthetic; reviews are refetched only on ProductPage mount.

### 4.11 `components/Store/LlmChat` (`LlmChat.js`)

* **Rendered by**: `containers/Support/LlmChatPage` at `/support/llm-chat` (public).
* **Purpose**: minimal chat UI to the RAG backend.
* **API**: `utils/llmChatApi.js` → **`axios.post('http://localhost:8000/rag', {question: message})`**
  — hardcoded absolute host, **bypasses `API_URL`, sends no auth, non-streaming**; the reply is read
  from `res.data.answer`.
* **UI to preserve**: local state `{input, messages:[{from:'user'|'llm', text}], loading}`;
  blank/whitespace input is ignored; user messages right-aligned, LLM left-aligned; `Loading...`
  while pending; on error the assistant bubble reads `Error: Could not get response.`;
  send button `disabled={loading}`; placeholder `Type your message...`; no auto-scroll.
* **Gaps**: the component posted to its own hardcoded `http://localhost:8000/rag` host. It is replaced by
  `pages/support/LlmChat.jsx` on `POST /api/chat` (Part A §A.5.1).

---

## 5. `components/Manager/**` (34 directories)

Presentational; the contracts below are the containers that render them.

| # | Component | Rendered by | Role | Key API / behaviour |
|---|---|---|---|---|
| 5.1 | `AccountDetails` | `Account` (`/dashboard`) | all | `PUT /api/user` with the whole `user` object; shows `user.email` or `Logged in With <provider>`; inputs firstName/lastName/phoneNumber; **no client validation**; email input commented out |
| 5.2 | `AccountMenu` | `Dashboard/{Admin,Merchant,Customer}` | all | sidebar from `links.json`, filtered by `link.provider.includes(user.provider)`; `toggleDashboardMenu` (`TOGGLE_DASHBOARD_MENU`); `Dashboard Menu` toggle drives class `menu-panel`/`menu-panel collapse` |
| 5.3 | `AddAddress` | `Address/Add` | all | `POST /api/address/add`; fields address/city/state/country/zipCode + `isDefault` checkbox (`As the Default`); validation `address\|city\|state\|country` required, `zipCode required\|min:5` |
| 5.4 | `AddBrand` | `Brand/Add` (admin-guarded) | admin | `POST /api/brand/add`; name, description, `Switch` `Active?`; `description required\|max:200` |
| 5.5 | `AddCategory` | `Category/Add` (guard commented out) | admin (unguarded) | `GET /api/product/list/select` on mount; `POST /api/category/add` with `products` as an id array; name, description, products multi-select, `Active?` switch |
| 5.6 | `AddMerchant` | `Merchant/Add` (admin-guarded) **and** `Sell` | admin / public | `POST /api/merchant/add`; name, email, phoneNumber, brandName, business; US phone regex; `business required\|min:10`; button disabled while submitting. **Bug**: the `brandName` input's value is bound to `merchantFormData.brand`, which does not exist |
| 5.7 | `AddProduct` | `Product/Add` (guard commented out) | admin+merchant | `GET /api/brand/list/select`; `POST /api/product/add` **multipart/form-data** with the file field named **`image`**; fields sku/name/description/quantity/price/taxable/brand + `Active?` switch; `brand` is omitted from the FormData when null; for a Merchant the brand select is disabled and forced to `brandsSelect[1]`; client requires the image |
| 5.8 | `AddressList` | `Address/List` | all | cards link to `/dashboard/address/edit/<id>`; `Default Delivery Address` badge on `isDefault`; line `` `${address.address} ${address.city}, ${address.country}, ${address.zipCode}` `` (the `state` field is never rendered); `NotFound 'No addresses found.'` |
| 5.9 | `AdminDbPanel/AdminDbPanel.js` | `Support/AdminDbPanelPage` | **none enforced** | literal `axios.get('/api/admin-db/collections/mongo')`, `/collections/mongo/<name>/count`, `/collections/oracle`, `/collections/oracle/<name>/count`; counts fetched **sequentially per collection**; two buttons `Refresh MongoDB` / `Refresh OracleDB`, both disabled while loading; a single shared `error` string; **not tabs** — both lists are always rendered (`MongoDB Collections`, `OracleDB Tables`); nothing is fetched on mount |
| 5.10 | `BrandList` (Manager) | `Brand/List` | admin+merchant | cards → `/dashboard/brand/edit/<id>`; `By <brand.merchant.name>` only when the merchant differs from the viewer's; inline loading; `NotFound 'No brands found.'` |
| 5.11 | `CategoryList` | `Category/List` | admin | cards → `/dashboard/category/edit/<id>`; `NotFound 'No categories found.'` |
| 5.12 | `Dashboard/Admin.js` | `Dashboard` | admin | `/dashboard/*` routes: Account, Security, Address, Product, Category, Brand, Users, Merchant, Orders, Review, Wishlist, `*`→404 |
| 5.13 | `Dashboard/Merchant.js` | `Dashboard` | merchant | Account, Security, Address, Product, Brand, Orders, Wishlist (no Category/Users/Merchant/Review) |
| 5.14 | `Dashboard/Customer.js` | `Dashboard` | member | Account, Security (hidden for OAuth providers), Address, Orders, Wishlist |
| 5.15 | `DisabledAccount/Merchant.js` | `Dashboard` (short-circuit) | disabled merchant | static notice + `Call us 951-999-9999`; renders instead of the whole dashboard |
| 5.16 | `EditAddress` | `Address/Edit` | all | `GET /api/address/<id>`; `PUT /api/address/<id>` with the **bare** address object; `DELETE /api/address/delete/<id>`; `Save` + danger `Delete`; all fields required |
| 5.17 | `EditBrand` | `Brand/Edit` | admin+merchant | `PUT /api/brand/<id>` `{brand:{name,slug,description}}`; `PUT /api/brand/<id>/active` `{brand:{isActive}}` (re-fetches); `DELETE /api/brand/delete/<id>` **disabled for merchants**; slug `required\|alpha_dash`; tooltip warns that disabling cascades to products; header link to `/shop/brand/<slug>` |
| 5.18 | `EditCategory` | `Category/Edit` | admin | `GET /api/category/<id>` + `GET /api/product/list/select`; `PUT /api/category/<id>` `{category:{name,slug,description,products}}`; active toggle; `DELETE /api/category/delete/<id>`; tooltip warns of the product cascade; link to `/shop/category/<slug>` |
| 5.19 | `EditProduct` | `Product/Edit` | admin+merchant | `GET /api/product/<id>` + `GET /api/brand/list/select`; `PUT /api/product/<id>` `{product:{name,sku,slug,description,quantity,price,taxable,brand}}` — **no `isActive`**; the `Active?` switch calls **both** `productChange('isActive',…)` and `activateProduct(id, value)`; brand select is admin-only; `DELETE`; link to `/product/<slug>`; no redirect after save |
| 5.20 | `MerchantList` | `Merchant/List` | admin | full state machine on `merchant.status` + `isActive` + presence of `email`: Approved → check + delete + enable/disable toggle (popover warns that disabling kills brand + access); Rejected → `Re-Approve` + delete; Waiting Approval with email → `Approve` + `Reject` + delete; Waiting Approval without email → `Merchant doesn't have email. Call at <tel link>` + delete. Buttons: `PUT /api/merchant/approve/:id`, `/reject/:id`, `DELETE /api/merchant/delete/:id`, `PUT /api/merchant/:id/active`. Each action refetches the list (or repeats the search) |
| 5.21 | `MerchantSearch` | `Merchant/List` | admin | `SearchBar` wrapper, `name='merchant'`, placeholder `Type email, phone number, brand or status`; 1000 ms debounce; container gates at ≥2 chars |
| 5.22 | `OrderDetails` | `OrderPage` (`/order/:id`) | shared | composes `OrderMeta` + `OrderItems` + `OrderSummary`; loading backdrop; `NotFound 'No order found.'` |
| 5.23 | `OrderItems` | `OrderDetails` | shared | per item: `item._id`, `item.status`, name/slug/imageUrl/price; `PUT /api/order/status/item/<itemId>` `{orderId, cartId, status}`; statuses `['Processing','Shipped','Delivered','Cancelled','Not processed']`; `Delivered` → `Reivew Product` link (sic); `Cancelled` → no action; otherwise customer sees a `Cancel` confirm and admin sees a status dropdown. Mobile and desktop layouts |
| 5.24 | `OrderList` | `Order/List`, `Order/Customer` | shared / admin | cards → `/order/<id>`; thumbnail `order.products[0].product.imageUrl`; shows first product's status, order id, `formatDate(created)`, `order.totalWithTax`; `Pagination` when `totalPages > 1`; `NotFound 'You have no orders yet.'` / `'No orders found.'` |
| 5.25 | `OrderMeta` | `OrderDetails` | shared | order id/date; `DELETE /api/order/cancel/<id>` then `push('/dashboard/orders')`; the **Cancel Order** button is rendered only when *no* item has status `Delivered` |
| 5.26 | `OrderSearch` | `Order/List`, `Order/Customer` | shared | `SearchBar` `name='order'`, placeholder `Type the complete order ID` |
| 5.27 | `OrderSummary` | `OrderDetails` | shared | rows `Subtotal` `$order.total`, `Est. Sales Tax` `$order.totalTax`, `Shipping & Handling` hard-coded `$0`, then `Total` `$order.totalWithTax` |
| 5.28 | `ProductList` (Manager) | `Product/List` | admin+merchant | cards → `/dashboard/product/edit/<id>`; `product.imageUrl` else placeholder; `NotFound 'No products found.'`; the list is unpaginated (`GET /api/product` returns everything) |
| 5.29 | `ReviewList` | `Review` (`/dashboard/review`) | admin | per card: title, body, reviewer avatar (memoised random colour keyed on `user._id`), product link to `/product/<slug>`, star rating, `Review Added on <date>`; action rows by `review.status` — Approved → check + Delete; Rejected → `Re Approve Review` + `Approve` + `Delete`; Waiting Approval → `Approve` + `Reject` + `Delete`. `PUT /api/review/approve/:id` and `/reject/:id` send **no body** and refetch; `DELETE /api/review/delete/:id` |
| 5.30 | `SearchResultMeta` | Merchant/Order/Users/Review lists | — | plain `<p>{count} {label}</p>` |
| 5.31 | `SubPage` | every dashboard feature | — | header `<h3>{title}</h3>` + action button rendered only when `actionTitle` is truthy (containers pass `user.role === ROLES.Admin && 'Add'`, i.e. boolean `false` hides it) |
| 5.32 | `Support/*` (`index.js`, `UserList.js`, `MessageList.js`, `AddMessage.js`) | `Support` (`/support`, auth) | all | **socket-only, no axios, no redux**: connects with `io(SOCKET_URL, {autoConnect:false})` and `sk.auth = {token: localStorage.token}`; on connect emits `connectUser`, `getUsers`, `getMessages`; listens for `getUsers`, `getMessages`, `message`, `connectUser`, `disconnectUser`; sends with `socket.emit('message', {text, to: selectedUser.id})`. Right pane: `NotFound 'Select chat to start messaging'` / `'No users connected.'` / `'Not connected.'`; the selected conversation is persisted under `localStorage['selected_suport_chat']` (typo); consecutive messages from the same sender collapse their header; `MessageList` auto-scrolls on message count change; message bubbles render `message.value`, `message.user.name`, `formatTime(message.time)`; `AddMessage` blocks empty input with `alert('Please type message.')` |
| 5.33 | `UserList` | `Users` (`/dashboard/users`) | admin | card per user: name, email (`-` fallback), provider, `formatDate(created)`, `UserRole` badge |
| 5.34 | `UserRole` | `AccountDetails`, `UserList` | — | **read-only badge**: `Admin` (primary) / `Merchant` (dark) / `Member` (default). **There is no role-change UI and no role-change endpoint anywhere in the client** |
| — | `UserSearch` | `Users` | admin | `SearchBar` `name='user'`, placeholder `Type user name or email` |
| — | `WishList` | `WishList` container (`/dashboard/wishlist`) | all | rows link to `/product/<slug>`; `$<price>`; `Wishlist Added on <date>`; danger remove button → `updateWishlist(!item.isLiked, item.product._id)` → `POST /api/wishlist` |

---

## 6. Legacy gaps and how the current stack resolves them

Each row is a place where the legacy client and the API contract disagreed. **Status** is what the current
`web` app and server do today.

| # | Legacy client behaviour | Status today |
|---|---|---|
| 1 | `components/Store/LlmChat` posted to `http://localhost:8000/rag` | Resolved: `pages/support/LlmChat.jsx` calls `POST /api/chat` (`{message, history}` → `{response, model, retrieval}`); the unmounted `routes/api/llmChat.js` is gone |
| 2 | `AdminDbPanel` called `/api/admin-db/*` with no auth | Deliberately public and read-only: `/api/admin-db/*` and `POST /api/ai/similar` need no sign-in; `POST /api/ai/ask` requires an admin (`auth` + `role.check`). The client routes `/support/llm-chat` and `/support/admin-db` are public |
| 3 | PDP rating relied on `ProductReviews` | `GET /api/product/item/:slug` still returns no `averageRating`/`totalReviews`; `pages/Product.jsx` computes the summary from `GET /api/review/:slug` (Approved only). Only `GET /api/product/list` aggregates ratings (Approved reviews only) |
| 4 | `ProductList` cards needed `averageRating`/`totalReviews`/`isLiked` | `GET /api/product/list` returns them; `isLiked` is present (false when not liked) for signed-in callers |
| 5 | Cart in `localStorage`, server cart minted by `POST /api/cart/add` and forgotten | Resolved: the bag is `mern26.cart` and checkout is `POST /api/order/checkout`, which prices from the database and reserves stock per line with rollback. The `/api/cart/*` routes still exist (owner-scoped; a cart backing an order answers 409 `CART_ORDERED`; deleting an unordered cart or line restocks) but `web` does not call them |
| 6 | `Order.total` computed client-side and posted | Resolved: the client sends only `{product, quantity}` lines; totals come from the database |
| 7 | `Shipping — Free` / `Shipping & Handling — $0` | Still display-only: the API has no shipping concept (`TotalsPanel` shows `Free`, `OrderDetailPanel` shows `$0`) |
| 8 | Order creation collected no address or payment | The checkout page collects an address, but `POST /order/checkout` takes no address or payment and the order does not store one |
| 9 | Admin `Order/List` filtered locally | The admin all-orders view uses `GET /api/order/search` with a full order id (Part A §A.4.3); `GET /api/order` and `/order/search` are admin-only |
| 10 | Merchant/Users/Review search unpaginated | Unchanged for `GET /api/user/search`, `/merchant/search`, `/order/search` (bare `{users}`, `{merchants}`, `{orders}`); paginated lists are `GET /user`, `/merchant`, `/order`, `/order/me`, `/review` |
| 11 | `GET /api/product` manager list unpaginated | Unchanged for `GET /api/product` (scoped to the merchant's brand for merchants) |
| 12 | `AddProduct` image upload | `utils/storage.js#s3Upload` is still a stub: `imageUrl` becomes `/images/products/<safe name>`, nothing is stored |
| 13 | No category picker on the product form | Unchanged: `POST /api/product/add` does not add the product to `Category.products` |
| 14 | `DeleteProduct` hard delete | Unchanged: `DELETE /api/product/delete/:id` is a `deleteOne`; it does not touch `Category.products` |
| 15 | `UserRole` read-only badge; `PUT /api/user` accepted any field | Resolved: `PUT /api/user` whitelists `PROFILE_FIELDS` (string values only). There is still no role-change endpoint |
| 16 | Address/review edit and delete without `auth` or ownership | Resolved: address routes are `auth` + owner-scoped; review edit/delete are owner-or-admin; order reads are owner-scoped (404 for others) |
| 17 | Merchant and review approve/reject open to any authenticated user | Resolved: both are `auth` + `role.check(ROLES.Admin)`; `GET /api/category` and the order list/search are admin-only |
| 18 | `signOut` local only | Unchanged: no logout endpoint; sign-out discards the token, and the Security page says other sessions stay signed in |
| 19 | `AuthSuccess` trusted `?token=` | `AuthSuccess` stores the token; the dashboard's `GET /user/me` validates it and a 401 logs out (Part A §A.1.1) |
| 20 | `POST /auth/reset` takes old password as `password`, new as `confirmPassword` | Unchanged: `Security.jsx` maps `{ password: current, confirmPassword: next }` explicitly |
| 21 | `MerchantSignup` parsed the query with `split('=')[1]` | Resolved: `pages/auth/MerchantSignup.jsx` uses `useSearchParams` |
| 22 | Signup `isSubscribed` never persisted | Unchanged: `Register.jsx` sends `isSubscribed`; the server subscribes through Mailchimp when configured and returns `subscribed`; the `User` model stores nothing. `POST /newsletter/subscribe` and forgot-password answer 503 when mail is not configured |
| 23 | Mixed error shapes (`{error}`, `{message}`, plain text) | Resolved: every API error is JSON `{ error, … }` (401 `{error:'Unauthorized'}`, 403 `{error:'You are not allowed to make this request.'}`, 429 and malformed JSON 400 included; unknown `/api` path 404 `{error:'Not found'}`); `lib/apiError.js` reads it (and passport's plain-text 401) |
| 24 | Narrow/inconsistent mutation envelopes | Partly unchanged: several handlers still echo `deleteOne` results under a model key (e.g. `product` on `DELETE /product/delete/:id`); `web` toasts a fixed message or `message` when present |
| 25 | Image URLs synthetic, fallback under `client/public` | `web` resolves product pictures from `public/products` by product name/category (`lib/productImages.js`, WebP thumbnails via `thumbUrl`) |
| 26 | Search fired every 3rd keystroke / 1000 ms debounce | Header search is a form submit to `/shop?q=` plus a product suggestion dropdown (≥ 2 characters) |
| 27 | Junk route and dead `Merchant/List.handleOnPagination` | Dropped |
| 28 | Unguarded `/support/*` pages and add routes | Client guards live in `routes.jsx` (`RequireAuth roles`); the server enforces roles on every management route |

### 6.1 Redux/state defects to fix rather than port

| Defect | Where |
|---|---|
| `ADDRESS_SELECT === 'src/Brand/BRAND_SELECT'` (copy-paste constant value) | `containers/Address/constants.js` |
| `SET_CATEGORIES_LOADING === 'src/Product/SET_CATEGORIES_LOADING'` (collides with Product) | `containers/Category/constants.js` |
| `categorySelect` references an **undeclared** `CATEGORY_SELECT` (ReferenceError if ever dispatched) | `containers/Category/actions.js` |
| `address.isLoading` and `address.isDefault` are written/read but missing from the reducer's initial state | `containers/Address/reducer.js` |
| `REMOVE_MERCHANT` action + reducer branch exist but are never dispatched | `containers/Merchant/*` |
| `ADD_REVIEW` is dispatched nowhere (the add flow refetches instead) | `containers/Review/actions.js` |
| `wishlistForm` is never used | `containers/WishList/reducer.js` |
| `Homepage`/`Application` `DEFAULT_ACTION` return an `undefined` state | `containers/{Homepage,Application}/reducer.js` |
| `FORGOT_PASSWORD_RESET` clears the email but not `formErrors` | `containers/ForgotPassword/actions.js` |
| `Notification` hard-overrides success toasts to red | `containers/Notification/index.js` |
| `Login` leaves the local cart intact on sign-in (`clearCart()` commented out) | `containers/Login/actions.js` |
| `ProductReviews` (`ProductPage`) does not refetch reviews when `:slug` changes | `containers/ProductPage/index.js` |
| `activateBrand` refetches `state.brand.brand` instead of the toggled brand | `containers/Brand/actions.js` |
| `AddProduct` forces a merchant's brand to `brandsSelect[1]` (index-based) | `containers/Product/actions.js` |
| `AddMerchant` binds the `brandName` input to the non-existent `merchantFormData.brand` | `components/Manager/AddMerchant/index.js` |
| `EditProduct` stores `taxable` as an option object while `AddProduct` stores it raw | `components/Manager/{AddProduct,EditProduct}` |
| Support chat: the `getMessages` handler appends to state (a re-emit duplicates), and the `connectUser`/`disconnectUser` effect re-registers listeners whenever `users` changes | `components/Manager/Support/index.js` |
