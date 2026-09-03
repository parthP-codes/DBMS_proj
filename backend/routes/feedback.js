// FEEDBACK: customer submits feedback about a restaurant.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.Name AS Customer_Name, r.Name AS Restaurant_Name
       FROM FEEDBACK f
       JOIN CUSTOMER c   ON f.Customer_ID   = c.Customer_ID
       JOIN RESTAURANT r ON f.Restaurant_ID = r.Restaurant_ID
       ORDER BY f.Feedback_No DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { Customer_ID, Restaurant_ID, Description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO FEEDBACK (Customer_ID, Restaurant_ID, Description) VALUES (?, ?, ?)',
      [Customer_ID, Restaurant_ID, Description || null]
    );
    res.status(201).json({ Feedback_No: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM FEEDBACK WHERE Feedback_No=?', [req.params.id]);
    res.json({ message: 'Feedback deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
