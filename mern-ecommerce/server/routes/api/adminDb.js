const express = require('express');
const mongoose = require('mongoose');
const oracledb = require('oracledb');
const router = express.Router();

// List MongoDB collections
router.get('/collections/mongo', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    res.json(collections.map(c => c.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get document count for a MongoDB collection
router.get('/collections/mongo/:name/count', async (req, res) => {
  try {
    const count = await mongoose.connection.db.collection(req.params.name).countDocuments();
    res.json({ collection: req.params.name, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Oracle SODA collections
router.get('/collections/oracle', async (req, res) => {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    const soda = conn.getSodaDatabase();
    const collectionNames = await soda.getCollectionNames();
    await conn.close();
    res.json(collectionNames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get document count for a SODA collection
router.get('/collections/oracle/:name/count', async (req, res) => {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    const soda = conn.getSodaDatabase();
    const collection = await soda.openCollection(req.params.name);
    let count = 0;
    if (collection) {
      count = await collection.find().count();
    }
    await conn.close();
    res.json({ collection: req.params.name, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 