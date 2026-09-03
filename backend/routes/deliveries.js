// DELIVERY: list (with order + agent info), create, update status/agent.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, a.Agent_Name, o.Customer_ID, c.Name AS Customer_Name
       FROM DELIVERY d
       JOIN ORDERS o    ON d.Order_ID = o.Order_ID
       JOIN CUSTOMER c  ON o.Customer_ID = c.Customer_ID
       LEFT JOIN DELIVERY_AGENT a ON d.Agent_ID = a.Agent_ID
       ORDER BY d.Delivery_ID`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create delivery for an order.
router.post('/', async (req, res) => {
  try {
    const { Order_ID, Agent_ID, Status, Estimated_Time } = req.body;
    const [result] = await pool.query(
      `INSERT INTO DELIVERY (Order_ID, Agent_ID, Status, Estimated_Time)
       VALUES (?, ?, ?, ?)`,
      [Order_ID, Agent_ID || null, Status || 'Assigned', Estimated_Time || null]
    );
    res.status(201).json({ Delivery_ID: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update delivery (agent, status, estimated time).
// Marking as Delivered stamps the delivery time.
router.put('/:id', async (req, res) => {
  try {
    const { Agent_ID, Status, Estimated_Time } = req.body;
    const deliveryTime = Status === 'Delivered' ? new Date() : null;
    await pool.query(
      `UPDATE DELIVERY
       SET Agent_ID=?, Status=?, Estimated_Time=?, Delivery_Time=?
       WHERE Delivery_ID=?`,
      [Agent_ID || null, Status, Estimated_Time || null, deliveryTime, req.params.id]
    );
    res.json({ message: 'Delivery updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
