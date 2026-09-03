import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Restaurants from './pages/Restaurants.jsx';
import MenuItems from './pages/MenuItems.jsx';
import Orders from './pages/Orders.jsx';
import OrderItems from './pages/OrderItems.jsx';
import Payments from './pages/Payments.jsx';
import Deliveries from './pages/Deliveries.jsx';
import Agents from './pages/Agents.jsx';
import Reviews from './pages/Reviews.jsx';
import Feedback from './pages/Feedback.jsx';
import Referrals from './pages/Referrals.jsx';

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/menu-items" element={<MenuItems />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order-items" element={<OrderItems />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/referrals" element={<Referrals />} />
        </Routes>
      </main>
    </div>
  );
}
