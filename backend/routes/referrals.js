// REFERRALS: the recursive CUSTOMER Refers_To CUSTOMER relationship.
// GET lists referrer -> referred pairs via a SELF JOIN.
// POST links a referred customer to a referring customer.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT referred.Customer_ID   AS Referred_ID,
              referred.Name          AS Referred_Customer,
              referrer.Customer_ID   AS Referrer_ID,
              referrer.Name          AS Referring_Customer
       FROM CUSTOMER referred
       JOIN CUSTOMER referrer ON referred.Referred_By = referrer.Customer_ID
       ORDER BY referrer.Name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST body: { Referred_ID, Referrer_ID }  ->  sets Referred_By on the referred customer.
router.post('/', async (req, res) => {
  try {
    const { Referred_ID, Referrer_ID } = req.body;
    if (Number(Referred_ID) === Number(Referrer_ID)) {
      return res.status(400).json({ error: 'A customer cannot refer themselves' });
    }
    await pool.query(
      'UPDATE CUSTOMER SET Referred_By = ? WHERE Customer_ID = ?',
      [Referrer_ID, Referred_ID]
    );
    res.status(201).json({ message: 'Referral linked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
