// ORDER_ITEM (weak entity) listing. Read-only view of all line items.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT oi.Order_ID, oi.Item_No, oi.Item_ID, m.Item_Name,
              oi.Quantity, oi.Unit_Price, oi.Subtotal
       FROM ORDER_ITEM oi
       JOIN MENU_ITEM m ON oi.Item_ID = m.Item_ID
       ORDER BY oi.Order_ID, oi.Item_No`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
