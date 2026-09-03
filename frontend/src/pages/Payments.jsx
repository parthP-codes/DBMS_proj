import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const EMPTY = { Order_ID: '', Amount: '', Payment_Status: 'Paid', Method: 'Card', Card_Last4: '', UPI_ID: '', Received_By: '' };

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/payments').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/orders').then(setOrders).catch(() => {});
  }, []);

  const openAdd = () => setForm({ ...EMPTY });

  // Prefill amount from the selected order's total.
  const pickOrder = (e) => {
    const id = e.target.value;
    const o = orders.find((x) => String(x.Order_ID) === String(id));
    setForm({ ...form, Order_ID: id, Amount: o ? o.Total_Amount : '' });
  };

  const save = async () => {
    try {
      await api.post('/payments', {
        Order_ID: Number(form.Order_ID),
        Amount: Number(form.Amount),
        Payment_Status: form.Payment_Status,
        Method: form.Method,
        Card_Last4: form.Card_Last4,
        UPI_ID: form.UPI_ID,
        Received_By: form.Received_By,
      });
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const methodInfo = (p) => p.Card_Last4 ? `Card •••• ${p.Card_Last4}` : p.UPI_ID ? `UPI ${p.UPI_ID}` : p.Method === 'COD' ? `COD ${p.Received_By ? '· ' + p.Received_By : ''}` : '';

  return (
    <div>
      <h1 className="page-title">Payments</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        ISA specialisation — each payment stores common fields plus method-specific data in Card / UPI / COD subtype tables.
      </p>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Payments ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Create Payment</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Order</th><th>Customer</th><th>Amount</th><th>Method</th><th>Details</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.Payment_ID}>
                  <td>{p.Payment_ID}</td>
                  <td>#{p.Order_ID}</td>
                  <td>{p.Customer_Name}</td>
                  <td>₹{p.Amount}</td>
                  <td><span className="badge badge-blue">{p.Method}</span></td>
                  <td>{methodInfo(p)}</td>
                  <td><StatusBadge value={p.Payment_Status} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="empty">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title="Create Payment" onClose={() => setForm(null)} onSubmit={save} submitLabel="Create Payment">
          <div className="field">
            <label>Order *</label>
            <select required value={form.Order_ID} onChange={pickOrder}>
              <option value="">— Select —</option>
              {orders.map((o) => <option key={o.Order_ID} value={o.Order_ID}>#{o.Order_ID} · {o.Customer_Name} · ₹{o.Total_Amount}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field"><label>Amount *</label><input required type="number" step="0.01" value={form.Amount} onChange={set('Amount')} /></div>
            <div className="field">
              <label>Status</label>
              <select value={form.Payment_Status} onChange={set('Payment_Status')}>
                <option>Paid</option><option>Pending</option><option>Failed</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Method *</label>
            <select value={form.Method} onChange={set('Method')}>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="COD">Cash on Delivery</option>
            </select>
          </div>
          {form.Method === 'Card' && (
            <div className="field"><label>Card Last 4 Digits *</label><input required maxLength="4" value={form.Card_Last4} onChange={set('Card_Last4')} /></div>
          )}
          {form.Method === 'UPI' && (
            <div className="field"><label>UPI ID *</label><input required placeholder="name@bank" value={form.UPI_ID} onChange={set('UPI_ID')} /></div>
          )}
          {form.Method === 'COD' && (
            <div className="field"><label>Received By (agent)</label><input value={form.Received_By} onChange={set('Received_By')} /></div>
          )}
        </Modal>
      )}
    </div>
  );
}
