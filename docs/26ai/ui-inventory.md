# Legacy Client UI Inventory — `mern-ecommerce/client/app`

> **Historical record.** This inventory drove the React 19 rewrite in `mern-ecommerce/web`
> (every container/component below is ported or deliberately dropped, see §"Dropped").
> The legacy `client/` tree was retired at cutover and no longer exists in the repository,
> so the `client/app/**` paths cited here refer to the pre-cutover revision.

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
| `cart_id` | the server cart id minted by `POST /api/cart/add` |

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
* **Gaps**: the routes in the UI are the *unauthenticated* ones (`GET/PUT/DELETE` by id have no
  server-side auth and no ownership check); `Edit.js` passes a `defaultChange` prop that has no
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
* **API**: `POST /api/cart/add` (`getCartId`, called from the Order module) body
  `{products:[{quantity, price, taxable, product:_id}]}` → `SET_CART_ID` + `localStorage['cart_id']`.
  **No other cart API is ever called.**
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
* **Gaps**: the cart is client-authoritative; the server cart minted by `POST /api/cart/add` is
  never read back, never cleared on removal, and its stock decrement is never reversed when the user
  removes a line item locally; `handleRemoveFromCart` filters by `_id` and drops duplicates.
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
  `{orderId, cartId, status}`, `POST /api/order/add` (`addOrder`) body `{cartId, total}`.
* **Behaviour to preserve**:
  * `placeOrder()` (bound to the Checkout button) requires `localStorage.token` **and** a non-empty
    cart; it runs `Promise.all([dispatch(getCartId())]).then(() => dispatch(addOrder()))` and then
    always `toggleCart()`.
  * `addOrder` reads `cartId = localStorage['cart_id']` and `total = state.cart.cartTotal`; on success
    `push('/order/success/' + response.data.order._id)` then `clearCart()`.
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
  payload must include `products[]`, `_id`, `cartId` and per-item `_id`/`status` — `cartId` is
  required by the item-status endpoint.

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
  `mern-ecommerce/client/app/components/Manager/AdminDbPanel` must not be ported; the admin DB panel
  is reachable without authentication at the client route level and the server endpoints have no
  auth either.

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
* **Gaps**: there is **no tax and no shipping computation anywhere in the client** — the amount sent
  to `POST /api/order/add` is the pre-tax line-item sum, while the server recomputes tax on every
  order read. A rewrite must decide which is authoritative.

### 4.6 `components/Store/Checkout`

* **Rendered by**: `containers/Cart`.
* **Purpose**: checkout CTA with an auth branch.
* **UI to preserve**: always `Continue shopping` → `handleShopping()`; authenticated →
  `Place Order` → `placeOrder()`; unauthenticated → `Proceed To Checkout` → `handleCheckout()`
  (which closes the drawer, pushes `/login` and shows
  `Please Login to proceed to checkout`).
* **API chain behind `placeOrder`**: `POST /api/cart/add` (only if `localStorage.cart_id` is empty)
  → `POST /api/order/add` `{cartId, total}` → `push('/order/success/<orderId>')` + `clearCart()`.
* **Gaps**: no shipping address or payment is collected before the order is created; no error toast
  if `cart_id` is missing.

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
* **Approval buttons are NOT here** — they live in the admin `ReviewList` (§5.27).
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
* **Gaps**: the server exposes `POST /api/chat` (`{message} → {response}`) which this component
  **does not use** — it posts to its own hardcoded `http://localhost:8000/rag` host instead. The
  server's unmounted `routes/api/llmChat.js` handler (the only thing that ever defined
  `/api/llm-chat/message`) has since been deleted, so `POST /api/chat` is the only chat route.

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

## 6. What the legacy client does that the API contract does not support

These are the places where a faithful port cannot simply call the existing endpoints — each needs a
decision (change the API, or change the client behaviour) before the rewrite is complete.

| # | Client behaviour | API reality | Consequence for the port |
|---|---|---|---|
| 1 | `components/Store/LlmChat` posts to `http://localhost:8000/rag` with `{question}` and reads `data.answer` | The server exposes `POST /api/chat` (`{message} → {response}`) and nothing else on that path — the unmounted `routes/api/llmChat.js` handler was removed | Repoint the chat at `POST /api/chat` (or a new streaming endpoint); a hardcoded host is not deployable |
| 2 | `AdminDbPanel` calls `/api/admin-db/*` with no auth | The endpoints exist and are correct — but they are **unauthenticated on the server** | Decide the auth policy; add `auth` + `role.check(ROLES.Admin)` server-side and gate the client route |
| 3 | The PDP (`/product/:slug`) shows a rating via `ProductReviews` | `GET /api/product/item/:slug` returns **no `averageRating`/`totalReviews`** — only `GET /api/product/list` computes them | A rewrite must either add the field to the product detail response (or a dedicated summary endpoint), or keep fetching `/api/review/:slug` and computing client-side as today |
| 4 | `ProductList` cards render `averageRating`/`totalReviews` | Present only in the `GET /api/product/list` aggregation, and `isLiked` only when a bearer token is sent | Listing pages are fine; any other product surface must not assume these fields |
| 5 | The cart lives in `localStorage`; the server cart is minted by `POST /api/cart/add` and then forgotten | There is **no `GET /api/cart`** and no cart-update/AI endpoint; removing a line item locally never reverses the server-side stock decrement done at cart creation | Either add cart read/update endpoints, or accept that server carts accumulate and stock is only restored by cancelling the order |
| 6 | `Order.total` is computed client-side (`Σ price×quantity`, **pre-tax, no shipping**) and posted to `POST /api/order/add` | The server stores it verbatim and recomputes `totalTax`/`totalWithTax` only on read | The stored total and the displayed total can disagree; decide the single source of truth |
| 7 | `CartSummary` shows `Shipping — Free` and `OrderSummary` shows `Shipping & Handling — $0` | No shipping concept exists in the API or the models | Shipping must be added to the API or removed from the UI |
| 8 | Order creation collects **no shipping address and no payment** | `POST /api/order/add` accepts only `{cartId, total}` | The checkout flow is effectively "order from cart"; a real checkout needs new API surface |
| 9 | Admin `Order/List` search filters `order._id.includes(search)` locally; other lists use the server | `GET /api/order/search` exists and is used only by `Order/Customer` | Standardise on the server endpoint |
| 10 | `Merchant`, `Users`, `Review` search results are unpaginated | The search endpoints return bare arrays with no `totalPages`/`currentPage`/`count` | Add pagination to the search responses, or keep search unpaginated |
| 11 | `GET /api/product` (manager product list), `GET /api/brand`, `GET /api/category` render everything at once | These endpoints have **no pagination parameters** | Large catalogues will need pagination added server-side |
| 12 | `AddProduct` requires an image (`image: required`) and uploads `multipart/form-data` field `image` | `s3Upload` is **stubbed** — `imageUrl` becomes `/images/products/<originalname>` and nothing is persisted | Either implement real storage (S3 / Oracle) or make the image optional and accept a URL |
| 13 | `AddProduct`/`EditProduct` accept a `brand` only; there is no category picker on the product form | `POST /api/product/add` does **not** push the product into `Category.products`; category membership is only editable from the category form | Products added via the API are unreachable from category filters unless the admin edits the category |
| 14 | `DeleteProduct` is a hard delete from the manager UI | The API hard-deletes and leaves stale ids in `Category.products` and orphan `reviews` | Add cleanup to the API or make the client accept orphans |
| 15 | `UserRole` is a read-only badge; there is no role-change UI | No endpoint accepts a role change (`PUT /api/user` accepts arbitrary fields, including `role`, by accident) | If role management is wanted, add an explicit admin endpoint rather than relying on the unwhitelisted profile PUT |
| 16 | `Address` edit/delete, `Review` edit/delete, all `adminDb` reads are performed by logged-in users | Those endpoints have **no `auth` middleware** and (except review) no ownership check | Tighten server-side auth; the client already assumes it is authenticated |
| 17 | `Merchant` approve/reject and `Review` approve/reject buttons are shown only to admins | Both endpoints require only `auth` — **any** authenticated user can call them | Add `role.check(ROLES.Admin)` server-side |
| 18 | `Login.signOut()` clears local state only | There is **no logout endpoint**; tokens stay valid for 7 days | Acceptable, but the client should not imply a server session was ended |
| 19 | `AuthSuccess` trusts the `?token=` query parameter | The server does not verify it either | A rewrite should call `GET /api/user/me` before marking the session authenticated |
| 20 | `PUT /api/auth/reset` (account security) takes `password` = **old** and `confirmPassword` = **new** | The server verifies `password` against the hash and stores `confirmPassword` | The form labels must be mapped deliberately, not by field name |
| 21 | `MerchantSignup` parses the invite email with `location.search.split('=')[1]` | The invite link is server-generated (`merchant-signup` email) | Use `URLSearchParams` in the rewrite |
| 22 | `Newsletter` submits a single email; `Signup` sends an `isSubscribed` checkbox | The `User` model has **no `isSubscribed` field** — registration only triggers a Mailchimp call | Persist the flag if the client is to read it back |
| 23 | The client funnels every HTTP error through `utils/error.handleError` and expects `error`/`message` keys | The API returns `{error}` for 400s but `{message}` for 404s, and **plain text** (`Unauthorized`, `You are not allowed…`) for 401/403 | Error rendering must handle three shapes |
| 24 | The client expects `{success, message}` on most mutations and toasts `response.data.message` | True for most routes, but `Address` update, `Brand` update, `Category` update, `Review` delete, and the `PUT .../active` toggles return narrower shapes (some echo `deleteOne` results under a misleading key, e.g. `product` for a deleted category) | Normalise the response envelope in the rewrite |
| 25 | `ProductList` (manager) and `OrderList` show product/order images from `product.imageUrl` | Image URLs are synthetic (`/images/products/<name>`) with a static fallback `/images/placeholder-image.png` under `client/public` | Ship the placeholder assets or change the fallback |
| 26 | Search only fires on every 3rd keystroke (`Navigation`) or after a 1000 ms debounce (`SearchBar`) with a ≥2-char gate | The search endpoints accept any string and use raw regex | Keep the debounce; the endpoints are otherwise compatible |
| 27 | Two dashboard routes are documented but effectively unreachable/dead: the literal junk route `mern-ecommerce/client/app/components/Manager/AdminDbPanel`, and `Merchant/List.handleOnPagination` (calls a non-existent `fetchUsers`) | — | Drop both in the rewrite |
| 28 | `/support/llm-chat` and `/support/admin-db` render **without** the auth HOC; `/dashboard/product/add` and `/dashboard/category/add` have their admin guards commented out | Server-side equivalents are also unguarded (`/api/admin-db`, and `/api/merchant/{approve,reject}`) | Decide the guard policy in one place rather than per component |

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
