// CUSTOMER CRUD. Includes referrer name via self-join.
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all customers (with the name of who referred them, if any)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, r.Name AS Referred_By_Name
       FROM CUSTOMER c
       LEFT JOIN CUSTOMER r ON c.Referred_By = r.Customer_ID
       ORDER BY c.Customer_ID`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create customer
router.post('/', async (req, res) => {
  try {
    const { Name, Phone, Email, Address, Referred_By } = req.body;
    const [result] = await pool.query(
      `INSERT INTO CUSTOMER (Name, Phone, Email, Address, Referred_By)
       VALUES (?, ?, ?, ?, ?)`,
      [Name, Phone, Email || null, Address || null, Referred_By || null]
    );
    res.status(201).json({ Customer_ID: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update customer
router.put('/:id', async (req, res) => {
  try {
    const { Name, Phone, Email, Address, Referred_By } = req.body;
    await pool.query(
      `UPDATE CUSTOMER
       SET Name=?, Phone=?, Email=?, Address=?, Referred_By=?
       WHERE Customer_ID=?`,
      [Name, Phone, Email || null, Address || null, Referred_By || null, req.params.id]
    );
    res.json({ message: 'Customer updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE customer
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM CUSTOMER WHERE Customer_ID=?', [req.params.id]);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
