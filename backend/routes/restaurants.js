// RESTAURANT CRUD.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM RESTAURANT ORDER BY Restaurant_ID');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { Name, Address, Phone, Rating } = req.body;
    const [result] = await pool.query(
      'INSERT INTO RESTAURANT (Name, Address, Phone, Rating) VALUES (?, ?, ?, ?)',
      [Name, Address || null, Phone || null, Rating || 0]
    );
    res.status(201).json({ Restaurant_ID: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { Name, Address, Phone, Rating } = req.body;
    await pool.query(
      'UPDATE RESTAURANT SET Name=?, Address=?, Phone=?, Rating=? WHERE Restaurant_ID=?',
      [Name, Address || null, Phone || null, Rating || 0, req.params.id]
    );
    res.json({ message: 'Restaurant updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM RESTAURANT WHERE Restaurant_ID=?', [req.params.id]);
    res.json({ message: 'Restaurant deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
