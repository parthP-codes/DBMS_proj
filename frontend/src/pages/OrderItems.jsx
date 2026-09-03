import { useEffect, useState } from 'react';
import { api } from '../api';

export default function OrderItems() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/order-items').then(setRows).catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Order Items</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Weak entity — each line item belongs to an order (Order_ID + Item_No) and refers to a menu item.
      </p>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head"><h2>All Order Items ({rows.length})</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order ID</th><th>Item No</th><th>Menu Item</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.Order_ID}-${r.Item_No}`}>
                  <td>{r.Order_ID}</td>
                  <td>{r.Item_No}</td>
                  <td>{r.Item_Name}</td>
                  <td>{r.Quantity}</td>
                  <td>₹{r.Unit_Price}</td>
                  <td>₹{r.Subtotal}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6" className="empty">No order items yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
