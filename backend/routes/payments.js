// PAYMENT + ISA specialisation (CARD / UPI / COD).
// Creating a payment inserts the common PAYMENT row plus the matching
// subtype row inside one transaction.
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all payments, left-joined to every subtype so method-specific
// details show up in a single row.
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, o.Customer_ID, c.Name AS Customer_Name,
              cp.Card_Last4, up.UPI_ID, cod.Received_By
       FROM PAYMENT p
       JOIN ORDERS o        ON p.Order_ID   = o.Order_ID
       JOIN CUSTOMER c      ON o.Customer_ID = c.Customer_ID
       LEFT JOIN CARD_PAYMENT cp ON p.Payment_ID = cp.Payment_ID
       LEFT JOIN UPI_PAYMENT  up ON p.Payment_ID = up.Payment_ID
       LEFT JOIN COD_PAYMENT cod ON p.Payment_ID = cod.Payment_ID
       ORDER BY p.Payment_ID`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create payment for an order.
// Body: { Order_ID, Amount, Payment_Status, Method, Card_Last4|UPI_ID|Received_By }
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { Order_ID, Amount, Payment_Status, Method,
            Card_Last4, UPI_ID, Received_By } = req.body;

    await conn.beginTransaction();

    const [payRes] = await conn.query(
      `INSERT INTO PAYMENT (Order_ID, Amount, Payment_Status, Method)
       VALUES (?, ?, ?, ?)`,
      [Order_ID, Amount, Payment_Status || 'Pending', Method]
    );
    const paymentId = payRes.insertId;

    // Insert into the correct ISA subtype table.
    if (Method === 'Card') {
      await conn.query(
        'INSERT INTO CARD_PAYMENT (Payment_ID, Card_Last4) VALUES (?, ?)',
        [paymentId, Card_Last4]
      );
    } else if (Method === 'UPI') {
      await conn.query(
        'INSERT INTO UPI_PAYMENT (Payment_ID, UPI_ID) VALUES (?, ?)',
        [paymentId, UPI_ID]
      );
    } else if (Method === 'COD') {
      await conn.query(
        'INSERT INTO COD_PAYMENT (Payment_ID, Received_By) VALUES (?, ?)',
        [paymentId, Received_By || null]
      );
    } else {
      throw new Error('Method must be Card, UPI or COD');
    }

    await conn.commit();
    res.status(201).json({ Payment_ID: paymentId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
