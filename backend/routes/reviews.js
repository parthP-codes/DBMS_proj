// REVIEW: customer writes a review about an order.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rv.*, c.Name AS Customer_Name, r.Name AS Restaurant_Name
       FROM REVIEW rv
       JOIN CUSTOMER c   ON rv.Customer_ID = c.Customer_ID
       JOIN ORDERS o     ON rv.Order_ID    = o.Order_ID
       JOIN RESTAURANT r ON o.Restaurant_ID = r.Restaurant_ID
       ORDER BY rv.Review_No DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { Customer_ID, Order_ID, Rating, Comment } = req.body;
    const [result] = await pool.query(
      'INSERT INTO REVIEW (Customer_ID, Order_ID, Rating, Comment) VALUES (?, ?, ?, ?)',
      [Customer_ID, Order_ID, Rating, Comment || null]
    );
    res.status(201).json({ Review_No: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM REVIEW WHERE Review_No=?', [req.params.id]);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
