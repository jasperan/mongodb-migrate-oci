require('dotenv').config();
const chalk = require('chalk');
const mongoose = require('mongoose');

const keys = require('../config/keys');
const { database } = keys;

// `mongodb://user:pwd@host:27017/db` -> `mongodb://***:***@host:27017/db`
const maskCredentials = (value) => String(value || '').replace(/\/\/[^/]*@/, '//***:***@');

// A wrong MONGO_URI has to be obvious at launch: without a database every route
// fails, so the process reports the target (credentials masked) and stops instead
// of serving errors. The 15s server-selection bound keeps that wait short (the
// driver's default is 30s) and is far above the observed connect time.
const setupDB = () =>
  mongoose
    .connect(database.url, { serverSelectionTimeoutMS: 15000 })
    .then(() => console.log(`${chalk.green('✓')} ${chalk.blue('MongoDB Connected!')}`))
    .catch((error) => {
      console.error(
        `${chalk.red('x')} MongoDB connection failed: ${maskCredentials(database.url)} - ${maskCredentials(error.message)}`
      );
      process.exit(1);
    });

module.exports = setupDB;