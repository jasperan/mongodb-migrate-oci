# Run the Storefront on MongoDB

## Introduction

Before you migrate anything, you need something to migrate. In this lab you start a local MongoDB 7 container, seed it with demo data, and run the MERN storefront (an Express and Mongoose API plus a React client) against it. This MongoDB database, `mern_ecommerce`, is the **source** of the migration.

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

The workshop script starts (or reuses) a container named `mern-mongo` from the `mongo:7` image, published on `127.0.0.1:27017`, and waits until the server answers a ping. It detects Docker or Podman automatically.

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

2. Confirm that the database answers.

    ```
    <copy>
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --quiet --eval "db.runCommand({ ping: 1 })"
    </copy>
    ```

    The output contains `ok: 1`.

> **Note:** To force a specific container engine, set `CONTAINER_ENGINE=podman` (Linux) or pass `-Engine podman` (Windows). When you want to remove the container at the end of the workshop, the Clean Up lab uses the script's `stop` argument (Linux) or `-Stop` switch (Windows).

## Task 2: Configure and seed the API

The API reads its settings from `mern-ecommerce/server/.env`. The repository ships `.env.example` with the local MongoDB URI already filled in as `MONGO_URI`.

1. Install the API dependencies.

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

3. Generate a random JWT secret. The API refuses to start without `JWT_SECRET`, or with the placeholder value, and warns if it is shorter than 32 characters.

    ```
    <copy>
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    </copy>
    ```

4. Open `.env` in an editor, paste the generated value after `JWT_SECRET=`, and save the file. Leave `MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce` unchanged for now.

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

5. Seed the database. This creates the admin account you sign in with, 10 categories, 10 brands and 100 random products. The command is idempotent, so running it again does not duplicate the data. Replace `<password>` with a password you choose for the storefront admin, and remember it.

    ```
    <copy>
    npm run seed:db admin@example.com "<password>"
    </copy>
    ```

    The log ends with messages such as *Admin user seeded.*, *Categories seeded.*, *Brands seeded.* and *Products seeded and associated with categories.*

6. The seed creates no shopper activity, but the duality-view converter in Lab 8 needs at least one document in every collection. Add a little sample activity (one address, merchant, cart, order, two reviews, a wishlist entry and a contact message) with the helper script. The commands below go to the repository root and back. The script is idempotent too.

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

    The output lists `addresses`, `cartitems`, `carts`, `contacts`, `merchants`, `orders`, `reviews` and `wishlists` as inserted, and ends with `collections with documents: 12`.

## Task 3: Start the API and the client

You need two terminals. Keep both open for the rest of the workshop.

1. In the current terminal (still in `mern-ecommerce/server`), start the API.

    ```
    <copy>
    npm start
    </copy>
    ```

    The API listens on `http://localhost:3000`. If it exits right away, read the message: a missing `JWT_SECRET` or an unreachable `MONGO_URI` stops the process on purpose.

2. Open a **second terminal** at the repository root, then install and start the React client.

    ```
    <copy>
    cd mern-ecommerce/web
    npm install
    npm run dev
    </copy>
    ```

    Vite serves the client on `http://localhost:8080` and proxies `/api` and `/socket.io` to the API on port 3000.

3. Open `http://localhost:8080` in your browser. You see the MERN Store home page with products from the seeded catalogue.

    ![The MERN Store home page served by the API running on MongoDB](images/storefront.png " ")

    > **Note:** `npm run seed:db` generates random products, so the products on your page differ from the screenshot.

4. Click **Shop**, open a product, and use the search box. Sign in with `admin@example.com` and the password you chose in Task 2 to confirm that authentication works.

## Task 4 (Optional): Know the Docker Compose alternative

The repository also contains a Docker Compose setup in `mern-ecommerce/` that starts the web client, the API and a MongoDB 7 container together on `http://localhost:8080`. It needs `JWT_SECRET` and `ADMIN_PASSWORD` in your environment. This workshop uses the step-by-step path above because the later labs edit `server/.env` and restart the API by hand. See `mern-ecommerce/README.md` if you want to try Compose on your own.

You may now **proceed to the next lab**.

## Learn More

* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/index.html)
* [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/)
* [Source repository: oracle-devrel/mongodb-migrate-oci](https://github.com/oracle-devrel/mongodb-migrate-oci)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
