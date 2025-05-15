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

// List Oracle tables
router.get('/collections/oracle', async (req, res) => {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    const result = await conn.execute('SELECT table_name FROM user_tables');
    await conn.close();
    res.json(result.rows.map(r => r[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get row count for an Oracle table
router.get('/collections/oracle/:name/count', async (req, res) => {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    const sql = `SELECT COUNT(*) FROM "${req.params.name}"`;
    const result = await conn.execute(sql);
    await conn.close();
    res.json({ table: req.params.name, count: result.rows[0][0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 