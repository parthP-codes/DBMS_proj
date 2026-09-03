import { NavLink } from 'react-router-dom';

const links = [
  ['/', '📊 Dashboard'],
  ['/customers', '👤 Customers'],
  ['/restaurants', '🏪 Restaurants'],
  ['/menu-items', '🍽️ Menu Items'],
  ['/orders', '🧾 Orders'],
  ['/order-items', '📦 Order Items'],
  ['/payments', '💳 Payments'],
  ['/deliveries', '🚚 Deliveries'],
  ['/agents', '🛵 Delivery Agents'],
  ['/reviews', '⭐ Reviews'],
  ['/feedback', '💬 Feedback'],
  ['/referrals', '🔗 Referrals'],
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">🍔 FoodDelivery</div>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
