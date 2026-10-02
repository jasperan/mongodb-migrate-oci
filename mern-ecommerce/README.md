# MERN Ecommerce

## Description

An ecommerce store built with the MERN stack (Express + Mongoose API, React 19 + Vite + Tailwind client). It runs unchanged on a local MongoDB or on Oracle AI Database 26ai through the Oracle Database API for MongoDB, and enables three main flows:

1. Buyers browse the store categories, products and brands, keep a wishlist, check out and review products
2. Sellers or Merchants manage their own brand
3. Admins manage and control the entire store

### Features:

  * Node + Express 4 backend; every API error is JSON `{ error, ...extra }`
  * Mongoose schemas model the application data
  * React 19, Vite and Tailwind CSS 4 for the UI (`web/`)
  * Redux Toolkit with RTK Query for state and API caching
  * Product list filtering (name, category, brand, price, rating) with whitelisted sorting and pagination
  * Checkout via `POST /api/order/checkout`: prices come from the database and stock is reserved per line (conditional update with rollback); failures answer `INVALID_CART`, `INSUFFICIENT_STOCK` or `PRODUCT_UNAVAILABLE`
  * Owner-scoped carts and orders (other users get 404); order listing and search are admin-only; cancelling restocks exactly once
  * Reviews are moderated (new reviews wait for approval; only approved ones are public)
  * Support chat over Socket.io (members can message admins only)
  * AI product assistant `POST /api/chat` (in-database embeddings, remote embeddings or keyword fallback) plus the migration-showcase endpoints under `/api/admin-db/*`
  * `GET /api/health` reports API, MongoDB and Oracle status

### Security and operations

  * Per-IP rate limiters: `RATE_LIMIT_AUTH`, `RATE_LIMIT_FORMS`, `RATE_LIMIT_AI` (the AI limiter covers `/api/chat` and `/api/ai/*`); `0` disables a limiter
  * `CORS_ORIGINS` lists the browser origins allowed by CORS and the chat socket (default `CLIENT_URL`)
  * `TRUST_PROXY` must match the number of reverse proxies in front of the API (1 behind `web/nginx.conf`)
  * `JWT_SECRET` is required (at least 32 characters); the server refuses to start without it
  * Oracle pool tuning: `ORACLE_POOL_MAX` (default 6) and `ORACLE_CALL_TIMEOUT_MS` (default 15000). The Oracle application pool uses `ORACLE_APP_USER`/`ORACLE_APP_PASSWORD` only; it does not fall back to `ORACLE_USER`/`ORACLE_PASSWORD`
  * Newsletter sign-up and forgot-password answer 503 when Mailchimp/Mailgun are not configured

## Demo

This application is deployed on Vercel Please check it out :smile: [here](https://mern-store-gold.vercel.app).

See admin dashboard [demo](https://mernstore-bucket.s3.us-east-2.amazonaws.com/admin.mp4)

## Docker Guide

`docker-compose.yml` starts three services: `web` (nginx serving the built client on port 8080 and proxying `/api` and `/socket.io`), `server` (the API) and `mongo` (MongoDB 7, bound to `127.0.0.1:27017`). The API port is **not** published; reach it through the web container at http://localhost:8080.

Clone the repository
```
git clone https://github.com/mohamedsamara/mern-ecommerce.git
cd mern-ecommerce
```

Set the required secrets in your environment (compose refuses to start without them). `ADMIN_EMAIL` is optional and defaults to `admin@example.com`:

```
export JWT_SECRET=$(openssl rand -hex 32)
export ADMIN_PASSWORD='choose-a-password'
```

Then build and start:

```
docker-compose build
docker-compose up
```

On first start the server seeds the admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and then runs `npm start`.

## Database Seed

* The seed command will create an admin user in the database
* The email and password are passed with the command as arguments
* Like below command, replace brackets with email and password.
* For more information, see code [here](server/utils/seed.js)

```
cd server
npm run seed:db [email-***@****.com] [password-******] // This is just an example.
```

## Install

`npm install` in the project root will install dependencies in both `web` and `server` (`install:web`, `install:server`). [See package.json](package.json)

```
git clone https://github.com/mohamedsamara/mern-ecommerce.git
cd mern-ecommerce
npm install
```

## ENV

Create `server/.env` from [server/.env.example](server/.env.example) (`cp server/.env.example server/.env`). The client needs no `.env`; in development Vite proxies `/api` and `/socket.io` to the API (`API_PROXY_TARGET`, default `http://localhost:3000`).

Variables in `server/.env.example`:

| Group | Variables |
| --- | --- |
| Server | `PORT`, `JWT_SECRET` (required), `BASE_API_URL`, `CLIENT_URL` |
| HTTP hardening | `CORS_ORIGINS`, `TRUST_PROXY`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_FORMS`, `RATE_LIMIT_AI` |
| Data store | `MONGO_URI` |
| Oracle SQL access | `ORACLE_CONNECT_STRING`, `ORACLE_APP_PASSWORD`, `ORACLE_USER`, `ORACLE_PASSWORD` (setup scripts only), `ORACLE_APP_USER`, `ORACLE_DV_USER` |
| AI | `LLM_PROVIDER`, `OCI_GENAI_ENDPOINT`, `OCI_GENAI_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_EMBEDDING_MODEL`, `VECTOR_EMBEDDING_MODEL`, `EMBEDDING_DIM`, `VECTOR_TABLE`, `SELECT_AI_PROFILE`, `MIGRATION_REPORT` |
| Optional integrations | `MAILCHIMP_KEY`, `MAILCHIMP_LIST_KEY`, `MAILGUN_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_EMAIL_SENDER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_CALLBACK_URL` |

`ORACLE_POOL_MAX` and `ORACLE_CALL_TIMEOUT_MS` are optional and not listed in the example file.

## Vercel Deployment

The backend is deployed on Vercel from the same repository; specify the root directory `server` when importing it (see [server vercel.json](server/vercel.json)). The client in `web/` is a static Vite build (`npm run build`, output `web/dist`).

## Start development

From the project root (starts the API and the Vite dev server on http://localhost:8080):

```
npm run dev
```

Or separately: `npm run dev:server` and `npm run dev:web`.

Client scripts (run in `web/`): `npm run dev`, `npm run build`, `npm run preview` (serves the build with the same proxies), `npm run lint`, and `npm run images:thumbs` (builds product thumbnails with `scripts/build-thumbnails.mjs`). Server scripts (run in `server/`): `npm run dev`, `npm start`, `npm run seed:db`.

## Languages & tools

- [Node](https://nodejs.org/en/)

- [Express](https://expressjs.com/)

- [Mongoose](https://mongoosejs.com/)

- [React](https://react.dev/)

- [Vite](https://vite.dev/)

- [Tailwind CSS](https://tailwindcss.com/)

- [Redux Toolkit](https://redux-toolkit.js.org/)


### Code Formatter

- Add a `.vscode` directory
- Create a file `settings.json` inside `.vscode`
- Install Prettier - Code formatter in VSCode
- Add the following snippet:  

```json

    {
      "editor.formatOnSave": true,
      "prettier.singleQuote": true,
      "prettier.arrowParens": "avoid",
      "prettier.jsxSingleQuote": true,
      "prettier.trailingComma": "none",
      "javascript.preferences.quoteStyle": "single",
    }

```
