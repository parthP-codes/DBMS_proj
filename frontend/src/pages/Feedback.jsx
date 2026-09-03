import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

const EMPTY = { Customer_ID: '', Restaurant_ID: '', Description: '' };

export default function Feedback() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/feedback').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/restaurants').then(setRestaurants).catch(() => {});
  }, []);

  const openAdd = () => setForm({ ...EMPTY });

  const save = async () => {
    try {
      await api.post('/feedback', {
        Customer_ID: Number(form.Customer_ID),
        Restaurant_ID: Number(form.Restaurant_ID),
        Description: form.Description,
      });
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this feedback?')) return;
    try { await api.del(`/feedback/${id}`); load(); } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Feedback</h1>
      <p className="muted" style={{ marginBottom: 14 }}>A customer submits feedback about a restaurant.</p>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Feedback ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Feedback</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>No</th><th>Customer</th><th>Restaurant</th><th>Description</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.Feedback_No}>
                  <td>{f.Feedback_No}</td>
                  <td>{f.Customer_Name}</td>
                  <td>{f.Restaurant_Name}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 300 }}>{f.Description}</td>
                  <td>{new Date(f.Feedback_Date).toLocaleDateString()}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => remove(f.Feedback_No)}>Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6" className="empty">No feedback yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title="Add Feedback" onClose={() => setForm(null)} onSubmit={save}>
          <div className="field">
            <label>Customer *</label>
            <select required value={form.Customer_ID} onChange={set('Customer_ID')}>
              <option value="">— Select —</option>
              {customers.map((c) => <option key={c.Customer_ID} value={c.Customer_ID}>{c.Name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Restaurant *</label>
            <select required value={form.Restaurant_ID} onChange={set('Restaurant_ID')}>
              <option value="">— Select —</option>
              {restaurants.map((r) => <option key={r.Restaurant_ID} value={r.Restaurant_ID}>{r.Name}</option>)}
            </select>
          </div>
          <div className="field"><label>Description</label><textarea rows="3" value={form.Description} onChange={set('Description')} /></div>
        </Modal>
      )}
    </div>
  );
}
