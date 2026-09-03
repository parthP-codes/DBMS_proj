import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

export default function Referrals() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/referrals').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);

  const openAdd = () => setForm({ Referrer_ID: '', Referred_ID: '' });

  const save = async () => {
    try {
      await api.post('/referrals', {
        Referrer_ID: Number(form.Referrer_ID),
        Referred_ID: Number(form.Referred_ID),
      });
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Referrals</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Recursive relationship — a customer refers another customer (CUSTOMER Refers_To CUSTOMER).
      </p>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>Referral Relationships ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Referral</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Referring Customer</th><th></th><th>Referred Customer</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Referred_ID}>
                  <td>{r.Referring_Customer} <span className="muted">(#{r.Referrer_ID})</span></td>
                  <td className="muted">➜ referred ➜</td>
                  <td>{r.Referred_Customer} <span className="muted">(#{r.Referred_ID})</span></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="3" className="empty">No referrals yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title="Add Referral" onClose={() => setForm(null)} onSubmit={save}>
          <div className="field">
            <label>Referring Customer *</label>
            <select required value={form.Referrer_ID} onChange={set('Referrer_ID')}>
              <option value="">— Select —</option>
              {customers.map((c) => <option key={c.Customer_ID} value={c.Customer_ID}>{c.Name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Referred Customer *</label>
            <select required value={form.Referred_ID} onChange={set('Referred_ID')}>
              <option value="">— Select —</option>
              {customers.filter((c) => String(c.Customer_ID) !== String(form.Referrer_ID)).map((c) => (
                <option key={c.Customer_ID} value={c.Customer_ID}>{c.Name}</option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
