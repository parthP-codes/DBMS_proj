import { useEffect, useState } from 'react';
import { api } from '../api';

const CARDS = [
  ['Total Customers', 'totalCustomers', '👤'],
  ['Total Restaurants', 'totalRestaurants', '🏪'],
  ['Total Orders', 'totalOrders', '🧾'],
  ['Total Menu Items', 'totalMenuItems', '🍽️'],
  ['Total Revenue', 'totalRevenue', '💰'],
  ['Pending Deliveries', 'pendingDeliveries', '🚚'],
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(setStats).catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      {err && <div className="error-bar">{err} — is the backend running?</div>}
      <div className="cards">
        {CARDS.map(([label, key, icon]) => (
          <div className="stat-card" key={key}>
            <span className="icon">{icon}</span>
            <div className="label">{label}</div>
            <div className="value">
              {!stats ? '—' : key === 'totalRevenue' ? `₹${Number(stats[key]).toLocaleString('en-IN')}` : stats[key]}
            </div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head"><h2>About this project</h2></div>
        <div className="modal-body">
          <p className="muted">
            Food Delivery Management System — a DBMS assignment demonstrating a relational
            database built from a Chen ER diagram. It covers primary &amp; foreign keys, a
            many-to-many relationship (Orders ↔ Menu Items via Order Items), a weak entity
            (Order Item), a recursive relationship (Customer refers Customer), and an ISA
            specialisation (Payment → Card / UPI / COD). Use the sidebar to manage each entity.
          </p>
        </div>
      </div>
    </div>
  );
}
