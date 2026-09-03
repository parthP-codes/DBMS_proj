// DELIVERY_AGENT CRUD + view assigned deliveries for one agent.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, COUNT(d.Delivery_ID) AS Assigned_Deliveries
       FROM DELIVERY_AGENT a
       LEFT JOIN DELIVERY d ON a.Agent_ID = d.Agent_ID
       GROUP BY a.Agent_ID
       ORDER BY a.Agent_ID`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET deliveries assigned to one agent
router.get('/:id/deliveries', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.Delivery_ID, d.Order_ID, d.Status, d.Estimated_Time, d.Delivery_Time
       FROM DELIVERY d
       WHERE d.Agent_ID = ?
       ORDER BY d.Delivery_ID`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { Agent_Name, Phone, Vehicle_No } = req.body;
    const [result] = await pool.query(
      'INSERT INTO DELIVERY_AGENT (Agent_Name, Phone, Vehicle_No) VALUES (?, ?, ?)',
      [Agent_Name, Phone || null, Vehicle_No || null]
    );
    res.status(201).json({ Agent_ID: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { Agent_Name, Phone, Vehicle_No } = req.body;
    await pool.query(
      'UPDATE DELIVERY_AGENT SET Agent_Name=?, Phone=?, Vehicle_No=? WHERE Agent_ID=?',
      [Agent_Name, Phone || null, Vehicle_No || null, req.params.id]
    );
    res.json({ message: 'Agent updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM DELIVERY_AGENT WHERE Agent_ID=?', [req.params.id]);
    res.json({ message: 'Agent deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
