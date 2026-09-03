// DASHBOARD: aggregate counts and totals for the summary cards.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM CUSTOMER)                              AS totalCustomers,
        (SELECT COUNT(*) FROM RESTAURANT)                           AS totalRestaurants,
        (SELECT COUNT(*) FROM ORDERS)                               AS totalOrders,
        (SELECT COUNT(*) FROM MENU_ITEM)                            AS totalMenuItems,
        (SELECT COALESCE(SUM(Amount),0) FROM PAYMENT
           WHERE Payment_Status = 'Paid')                           AS totalRevenue,
        (SELECT COUNT(*) FROM DELIVERY
           WHERE Status <> 'Delivered')                             AS pendingDeliveries`
    );
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
