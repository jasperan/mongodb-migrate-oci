require('dotenv').config();
const chalk = require('chalk');
const mongoose = require('mongoose');

// Mongoose 6 drops filter keys that are not in the schema; Mongoose 7 stops doing
// so by default. Pin the current behaviour: it is part of the query-injection guard.
mongoose.set('strictQuery', true);

// Read straight from the environment: the seed script needs the database but
// not the JWT secret that config/keys.js insists on.
const databaseUrl = process.env.MONGO_URI;

// `mongodb://user:pwd@host:27017/db` -> `mongodb://***:***@host:27017/db`
const maskCredentials = (value) => String(value || '').replace(/\/\/[^/]*@/, '//***:***@');

// A wrong MONGO_URI has to be obvious at launch: without a database every route
// fails, so the process reports the target (credentials masked) and stops instead
// of serving errors. The 15s server-selection bound keeps that wait short (the
// driver's default is 30s) and is far above the observed connect time.
const setupDB = () =>
  mongoose
    .connect(databaseUrl, { serverSelectionTimeoutMS: 15000 })
    .then(() => console.log(`${chalk.green('✓')} ${chalk.blue('MongoDB Connected!')}`))
    .catch((error) => {
      console.error(
        `${chalk.red('x')} MongoDB connection failed: ${maskCredentials(databaseUrl)} - ${maskCredentials(error.message)}`
      );
      process.exit(1);
    });

module.exports = setupDB;