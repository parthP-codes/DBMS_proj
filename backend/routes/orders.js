// ORDERS: list, single (with items), create (order + order_items in a
// transaction with server-side subtotal/total calculation), update status.
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all orders with customer + restaurant names
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.*, c.Name AS Customer_Name, r.Name AS Restaurant_Name
       FROM ORDERS o
       JOIN CUSTOMER c   ON o.Customer_ID   = c.Customer_ID
       JOIN RESTAURANT r ON o.Restaurant_ID = r.Restaurant_ID
       ORDER BY o.Order_ID DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one order + its order items (with menu item names)
router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await pool.query(
      `SELECT o.*, c.Name AS Customer_Name, r.Name AS Restaurant_Name
       FROM ORDERS o
       JOIN CUSTOMER c   ON o.Customer_ID   = c.Customer_ID
       JOIN RESTAURANT r ON o.Restaurant_ID = r.Restaurant_ID
       WHERE o.Order_ID = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [items] = await pool.query(
      `SELECT oi.*, m.Item_Name
       FROM ORDER_ITEM oi
       JOIN MENU_ITEM m ON oi.Item_ID = m.Item_ID
       WHERE oi.Order_ID = ?
       ORDER BY oi.Item_No`,
      [req.params.id]
    );
    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create order.
// Body: { Customer_ID, Restaurant_ID, Status, items: [{Item_ID, Quantity}] }
// Unit price is read from MENU_ITEM; subtotal & total are computed on the server.
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { Customer_ID, Restaurant_ID, Status, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    await conn.beginTransaction();

    // Insert the order with a temporary total of 0.
    const [orderRes] = await conn.query(
      `INSERT INTO ORDERS (Customer_ID, Restaurant_ID, Status, Total_Amount)
       VALUES (?, ?, ?, 0)`,
      [Customer_ID, Restaurant_ID, Status || 'Pending']
    );
    const orderId = orderRes.insertId;

    // Insert each order item with a computed subtotal.
    let total = 0;
    let itemNo = 1;
    for (const it of items) {
      const [[menu]] = await conn.query(
        'SELECT Price FROM MENU_ITEM WHERE Item_ID = ?',
        [it.Item_ID]
      );
      if (!menu) throw new Error(`Menu item ${it.Item_ID} not found`);

      const unitPrice = Number(menu.Price);
      const subtotal = unitPrice * Number(it.Quantity);
      total += subtotal;

      await conn.query(
        `INSERT INTO ORDER_ITEM (Order_ID, Item_No, Item_ID, Quantity, Unit_Price, Subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, itemNo++, it.Item_ID, it.Quantity, unitPrice, subtotal]
      );
    }

    // Update the order with the calculated total.
    await conn.query('UPDATE ORDERS SET Total_Amount = ? WHERE Order_ID = ?', [total, orderId]);

    await conn.commit();
    res.status(201).json({ Order_ID: orderId, Total_Amount: total });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT update order status
router.put('/:id', async (req, res) => {
  try {
    const { Status } = req.body;
    await pool.query('UPDATE ORDERS SET Status=? WHERE Order_ID=?', [Status, req.params.id]);
    res.json({ message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
