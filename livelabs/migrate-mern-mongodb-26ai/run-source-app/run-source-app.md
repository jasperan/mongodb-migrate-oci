# Run the Storefront on MongoDB

## Introduction

Before you migrate anything, you need something to migrate, and a known-good baseline to compare against later. In this lab you start a local MongoDB 7 container, seed it with demo data, and run the MERN storefront (an Express and Mongoose API plus a React client) against it. This MongoDB database, `mern_ecommerce`, is the **source** of the migration. When the lab ends you will have a working storefront on MongoDB, which you will later move to Autonomous AI Database.

Estimated Time: 20 minutes

### Objectives

In this lab, you will:

* Start a local MongoDB 7 container that acts as the migration source
* Configure and seed the storefront API against that MongoDB
* Start the API and the React client, and browse the storefront

### Prerequisites

This lab assumes you have:

* Completed **Lab 1: Prepare Your Workstation** (Git, Node.js 20.19+ or 22.12+, Docker or Podman, MongoDB Database Tools, mongosh, Python and SQLcl installed, and the repository cloned)
* A terminal open at the **root of the cloned repository** (`mongodb-migrate-oci`)

> **Note:** Seeding writes demo data into whatever database `MONGO_URI` points at. In this lab it points at the local container only.

## Task 1: Start the source MongoDB

Run the source database as a container so you need no local MongoDB install. The workshop script starts (or reuses) a container named `mern-mongo` from the `mongo:7` image, published on `127.0.0.1:27017`, and waits until the server answers a ping. It detects Docker or Podman automatically.

1. From the repository root, start the source MongoDB.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/start-source-mongo.sh
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\start-source-mongo.ps1
    </copy>
    ```

    </if>

    You should see `MongoDB is ready: mongodb://127.0.0.1:27017`.

2. Ping the database to confirm that it answers.

    ```
    <copy>
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --quiet --eval "db.runCommand({ ping: 1 })"
    </copy>
    ```

    You should see `ok: 1` in the output.

> **Note:** To force a specific container engine, set `CONTAINER_ENGINE=podman` (Linux) or pass `-Engine podman` (Windows). The Clean Up lab removes the container with the script's `stop` argument (Linux) or `-Stop` switch (Windows).

## Task 2: Configure and seed the API

The API reads its settings from `mern-ecommerce/server/.env`. The repository ships `.env.example` with `MONGO_URI` already set to the local MongoDB. You create your own `.env`, add a signing secret, and load the demo data.

1. Change to the API directory and install its dependencies.

    ```
    <copy>
    cd mern-ecommerce/server
    npm install
    </copy>
    ```

2. Create your `.env` file from the example.

    <if type="linux">

    ```bash
    <copy>
    cp .env.example .env
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    Copy-Item .env.example .env
    </copy>
    ```

    </if>

3. Generate a random JWT secret (the key the API uses to sign login tokens). The API refuses to start without `JWT_SECRET`, or with the placeholder value, and warns if it is shorter than 32 characters.

    ```
    <copy>
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    </copy>
    ```

4. Open `.env` in an editor, paste the generated value after `JWT_SECRET=`, and save the file. Leave `MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce` unchanged; you change it in Lab 7.

    <if type="linux">

    ```bash
    <copy>
    nano .env
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    notepad .env
    </copy>
    ```

    </if>

5. Seed the database. This creates the admin account you sign in with, 10 categories, 10 brands and 100 random products. Replace `<password>` with a password you choose for the storefront admin, and remember it.

    ```
    <copy>
    npm run seed:db admin@example.com "<password>"
    </copy>
    ```

    You should see these messages. The lines that npm prints before them are left out:

    ```text
    ✓ MongoDB Connected!
    ✓ Seed database started
    ! Seeding admin user...
    ✓ Admin user seeded.
    ✓ Categories seeded.
    ✓ Brands seeded.
    ✓ Products seeded and associated with categories.
    ✓ Database connection closed!
    ```

    The command is idempotent: running it again skips data that already exists.

6. Add a little sample shopper activity: one address, merchant, cart, order, two reviews, a wishlist entry and a contact message. The seed creates none, and the optional duality-view converter in Lab 8 needs at least one document in every collection. The commands go to the repository root, run the helper script and return. The script is idempotent too.

    <if type="linux">

    ```bash
    <copy>
    cd ../..
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --file mern-ecommerce/server/scripts/seed_sample_activity.js
    cd mern-ecommerce/server
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    cd ..\..
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --file mern-ecommerce/server/scripts/seed_sample_activity.js
    cd mern-ecommerce\server
    </copy>
    ```

    </if>

    You should see each of the eight collections reported as inserted, and a last line of `collections with documents: 12`:

    ```text
    addresses    1 inserted
    merchants    1 inserted
    carts        1 inserted
    cartitems    4 inserted
    orders       1 inserted
    reviews      2 inserted
    wishlists    1 inserted
    contacts     1 inserted

    collections with documents: 12
    ```

## Task 3: Start the API and the client

Start the API and the React client in two terminals. Keep both open for the rest of the workshop.

1. In the current terminal (still in `mern-ecommerce/server`), start the API.

    ```
    <copy>
    npm start
    </copy>
    ```

    You should see the log line `API listening on port 3000. Start the web client and open http://localhost:8080/ for the storefront.` at the end of the start-up output. Port 3000 serves only the API (`/api`); opening `http://localhost:3000/` in a browser shows `Cannot GET /`. The storefront is the web client you start in the next step. The notices before it about Mailchimp, Mailgun, Google and Facebook are expected, because the workshop does not configure them. Node.js can also print a deprecation warning here, which you can ignore.

    ```text
    Mailchimp is not configured (MAILCHIMP_KEY, MAILCHIMP_LIST_KEY): newsletter sign-up is unavailable.
    Mailgun is not configured (MAILGUN_KEY, MAILGUN_DOMAIN, MAILGUN_EMAIL_SENDER): e-mail is skipped.
    Missing google keys
    Missing facebook keys
    ✓ MongoDB Connected!
    ✓ API listening on port 3000. Start the web client and open http://localhost:8080/ for the storefront.
    ```

    If the process exits right away, read the message: a missing `JWT_SECRET` or an unreachable `MONGO_URI` stops it on purpose.

2. Open a **second terminal** at the repository root, then install and start the React client.

    ```
    <copy>
    cd mern-ecommerce/web
    npm install
    npm run dev
    </copy>
    ```

    Vite (the React dev server) serves the client on `http://localhost:8080` and proxies `/api` and `/socket.io` to the API on port 3000.

3. Open `http://localhost:8080` in your browser. You should see the MERN Store home page with products from the seeded catalogue.

    ![The MERN Store home page served by the API running on MongoDB](images/storefront.png " ")

    > **Note:** `npm run seed:db` generates random products, so the products on your page differ from the screenshot.

4. Click **Shop** and open a product. Then use the search box. Finally, sign in with `admin@example.com` and the password you chose in Task 2 to confirm that authentication works.

The storefront now runs entirely on your local MongoDB. Lab 4 profiles what it asks of the database, and Lab 7 repoints it at Oracle.

You may now **proceed to the next lab**.

## Learn More

* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/index.html)
* [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/)
* [Source repository: jasperan/mongodb-migrate-oci](https://github.com/jasperan/mongodb-migrate-oci)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
