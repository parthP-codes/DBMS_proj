// MENU_ITEM CRUD + availability toggle. Joined with restaurant name.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, r.Name AS Restaurant_Name
       FROM MENU_ITEM m
       JOIN RESTAURANT r ON m.Restaurant_ID = r.Restaurant_ID
       ORDER BY m.Item_ID`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { Restaurant_ID, Item_Name, Category, Price, Availability } = req.body;
    const [result] = await pool.query(
      `INSERT INTO MENU_ITEM (Restaurant_ID, Item_Name, Category, Price, Availability)
       VALUES (?, ?, ?, ?, ?)`,
      [Restaurant_ID, Item_Name, Category || null, Price, Availability ? 1 : 0]
    );
    res.status(201).json({ Item_ID: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { Restaurant_ID, Item_Name, Category, Price, Availability } = req.body;
    await pool.query(
      `UPDATE MENU_ITEM
       SET Restaurant_ID=?, Item_Name=?, Category=?, Price=?, Availability=?
       WHERE Item_ID=?`,
      [Restaurant_ID, Item_Name, Category || null, Price, Availability ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Menu item updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM MENU_ITEM WHERE Item_ID=?', [req.params.id]);
    res.json({ message: 'Menu item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
