import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

const EMPTY = { Customer_ID: '', Order_ID: '', Rating: '5', Comment: '' };
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function Reviews() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/reviews').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/orders').then(setOrders).catch(() => {});
  }, []);

  const openAdd = () => setForm({ ...EMPTY });

  // Orders belonging to the chosen customer, to keep "writes review about own order" sensible.
  const ordersForCustomer = form
    ? orders.filter((o) => String(o.Customer_ID) === String(form.Customer_ID))
    : [];

  const save = async () => {
    try {
      await api.post('/reviews', {
        Customer_ID: Number(form.Customer_ID),
        Order_ID: Number(form.Order_ID),
        Rating: Number(form.Rating),
        Comment: form.Comment,
      });
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this review?')) return;
    try { await api.del(`/reviews/${id}`); load(); } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Reviews</h1>
      <p className="muted" style={{ marginBottom: 14 }}>A customer writes a review about one of their orders.</p>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Reviews ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Review</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>No</th><th>Customer</th><th>Order</th><th>Restaurant</th><th>Rating</th><th>Comment</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Review_No}>
                  <td>{r.Review_No}</td>
                  <td>{r.Customer_Name}</td>
                  <td>#{r.Order_ID}</td>
                  <td>{r.Restaurant_Name}</td>
                  <td className="star">{stars(r.Rating)}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 260 }}>{r.Comment}</td>
                  <td>{new Date(r.Review_Date).toLocaleDateString()}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => remove(r.Review_No)}>Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="8" className="empty">No reviews yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title="Add Review" onClose={() => setForm(null)} onSubmit={save}>
          <div className="field">
            <label>Customer *</label>
            <select required value={form.Customer_ID} onChange={(e) => setForm({ ...form, Customer_ID: e.target.value, Order_ID: '' })}>
              <option value="">— Select —</option>
              {customers.map((c) => <option key={c.Customer_ID} value={c.Customer_ID}>{c.Name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Order *</label>
            <select required value={form.Order_ID} onChange={set('Order_ID')} disabled={!form.Customer_ID}>
              <option value="">{form.Customer_ID ? '— Select —' : 'Pick a customer first'}</option>
              {ordersForCustomer.map((o) => <option key={o.Order_ID} value={o.Order_ID}>#{o.Order_ID} · {o.Restaurant_Name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Rating *</label>
            <select value={form.Rating} onChange={set('Rating')}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} — {stars(n)}</option>)}
            </select>
          </div>
          <div className="field"><label>Comment</label><textarea rows="3" value={form.Comment} onChange={set('Comment')} /></div>
        </Modal>
      )}
    </div>
  );
}
