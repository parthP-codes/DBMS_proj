// Express server entry point for the Food Delivery Management System.
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Mount API routes.
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/restaurants',  require('./routes/restaurants'));
app.use('/api/menu-items',   require('./routes/menuItems'));
app.use('/api/orders',       require('./routes/orders'));
app.use('/api/order-items',  require('./routes/orderItems'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/deliveries',   require('./routes/deliveries'));
app.use('/api/agents',       require('./routes/agents'));
app.use('/api/reviews',      require('./routes/reviews'));
app.use('/api/feedback',     require('./routes/feedback'));
app.use('/api/referrals',    require('./routes/referrals'));
app.use('/api/dashboard',    require('./routes/dashboard'));

app.get('/', (req, res) => res.json({ message: 'Food Delivery API is running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
