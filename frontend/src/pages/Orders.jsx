import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const STATUSES = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [menu, setMenu] = useState([]);
  const [err, setErr] = useState('');

  const [builder, setBuilder] = useState(null); // order creation state
  const [detail, setDetail] = useState(null);    // order + items to view

  const load = () => api.get('/orders').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/restaurants').then(setRestaurants).catch(() => {});
    api.get('/menu-items').then(setMenu).catch(() => {});
  }, []);

  // ---- Order builder ----
  const openBuilder = () =>
    setBuilder({ Customer_ID: '', Restaurant_ID: '', Status: 'Pending', items: [{ Item_ID: '', Quantity: 1 }] });

  const menuForRestaurant = builder
    ? menu.filter((m) => String(m.Restaurant_ID) === String(builder.Restaurant_ID))
    : [];

  const priceOf = (id) => Number(menu.find((m) => String(m.Item_ID) === String(id))?.Price || 0);

  const total = builder
    ? builder.items.reduce((sum, it) => sum + priceOf(it.Item_ID) * Number(it.Quantity || 0), 0)
    : 0;

  const setItem = (i, k, v) => {
    const items = builder.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it));
    setBuilder({ ...builder, items });
  };
  const addLine = () => setBuilder({ ...builder, items: [...builder.items, { Item_ID: '', Quantity: 1 }] });
  const removeLine = (i) => setBuilder({ ...builder, items: builder.items.filter((_, idx) => idx !== i) });

  const saveOrder = async () => {
    try {
      const items = builder.items
        .filter((it) => it.Item_ID)
        .map((it) => ({ Item_ID: Number(it.Item_ID), Quantity: Number(it.Quantity) }));
      if (items.length === 0) { setErr('Add at least one item'); return; }
      await api.post('/orders', {
        Customer_ID: Number(builder.Customer_ID),
        Restaurant_ID: Number(builder.Restaurant_ID),
        Status: builder.Status,
        items,
      });
      setBuilder(null); load();
    } catch (e) { setErr(e.message); }
  };

  const changeStatus = async (id, Status) => {
    try { await api.put(`/orders/${id}`, { Status }); load(); } catch (e) { setErr(e.message); }
  };

  const viewOrder = async (id) => {
    try { setDetail(await api.get(`/orders/${id}`)); } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <h1 className="page-title">Orders</h1>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Orders ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openBuilder}>+ Create Order</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Customer</th><th>Restaurant</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.Order_ID}>
                  <td>{o.Order_ID}</td>
                  <td>{o.Customer_Name}</td>
                  <td>{o.Restaurant_Name}</td>
                  <td>{new Date(o.Order_Date).toLocaleDateString()}</td>
                  <td>₹{o.Total_Amount}</td>
                  <td>
                    <select value={o.Status} onChange={(e) => changeStatus(o.Order_ID, e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="btn btn-sm btn-link" onClick={() => viewOrder(o.Order_ID)}>View Items</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="empty">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create order modal */}
      {builder && (
        <Modal title="Create Order" onClose={() => setBuilder(null)} onSubmit={saveOrder} submitLabel="Create Order">
          <div className="field-row">
            <div className="field">
              <label>Customer *</label>
              <select required value={builder.Customer_ID} onChange={(e) => setBuilder({ ...builder, Customer_ID: e.target.value })}>
                <option value="">— Select —</option>
                {customers.map((c) => <option key={c.Customer_ID} value={c.Customer_ID}>{c.Name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Restaurant *</label>
              <select required value={builder.Restaurant_ID}
                onChange={(e) => setBuilder({ ...builder, Restaurant_ID: e.target.value, items: [{ Item_ID: '', Quantity: 1 }] })}>
                <option value="">— Select —</option>
                {restaurants.map((r) => <option key={r.Restaurant_ID} value={r.Restaurant_ID}>{r.Name}</option>)}
              </select>
            </div>
          </div>

          <label className="muted" style={{ fontWeight: 600, fontSize: 13 }}>Items</label>
          {builder.Restaurant_ID === '' && <p className="muted" style={{ margin: '6px 0' }}>Select a restaurant first.</p>}
          {builder.Restaurant_ID !== '' && builder.items.map((it, i) => (
            <div className="order-line" key={i}>
              <div className="field" style={{ flex: 2 }}>
                <label>Item</label>
                <select value={it.Item_ID} onChange={(e) => setItem(i, 'Item_ID', e.target.value)}>
                  <option value="">— Select —</option>
                  {menuForRestaurant.map((m) => (
                    <option key={m.Item_ID} value={m.Item_ID} disabled={!m.Availability}>
                      {m.Item_Name} (₹{m.Price}){!m.Availability ? ' — N/A' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>Qty</label>
                <input type="number" min="1" value={it.Quantity} onChange={(e) => setItem(i, 'Quantity', e.target.value)} />
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>Subtotal</label>
                <input readOnly value={`₹${(priceOf(it.Item_ID) * Number(it.Quantity || 0)).toFixed(2)}`} />
              </div>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeLine(i)}>✕</button>
            </div>
          ))}
          {builder.Restaurant_ID !== '' && (
            <button type="button" className="btn btn-sm" onClick={addLine}>+ Add Item</button>
          )}
          <div className="order-total">Total: ₹{total.toFixed(2)}</div>
        </Modal>
      )}

      {/* View items modal */}
      {detail && (
        <Modal title={`Order #${detail.Order_ID} — Items`} onClose={() => setDetail(null)} onSubmit={() => setDetail(null)} submitLabel="Close">
          <p className="muted" style={{ marginBottom: 12 }}>
            {detail.Customer_Name} · {detail.Restaurant_Name} · <StatusBadge value={detail.Status} />
          </p>
          <table>
            <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead>
            <tbody>
              {detail.items.map((it) => (
                <tr key={it.Item_No}>
                  <td>{it.Item_No}</td><td>{it.Item_Name}</td><td>{it.Quantity}</td>
                  <td>₹{it.Unit_Price}</td><td>₹{it.Subtotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="order-total">Total: ₹{detail.Total_Amount}</div>
        </Modal>
      )}
    </div>
  );
}
