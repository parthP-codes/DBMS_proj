import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

const EMPTY = { Name: '', Phone: '', Email: '', Address: '', Referred_By: '' };

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/customers').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); };
  const openEdit = (c) => {
    setForm({ Name: c.Name, Phone: c.Phone, Email: c.Email || '', Address: c.Address || '', Referred_By: c.Referred_By || '' });
    setEditId(c.Customer_ID);
  };

  const save = async () => {
    try {
      const body = { ...form, Referred_By: form.Referred_By || null };
      if (editId) await api.put(`/customers/${editId}`, body);
      else await api.post('/customers', body);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try { await api.del(`/customers/${id}`); load(); } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Customers</h1>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Customers ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Referred By</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.Customer_ID}>
                  <td>{c.Customer_ID}</td>
                  <td>{c.Name}</td>
                  <td>{c.Phone}</td>
                  <td>{c.Email}</td>
                  <td>{c.Address}</td>
                  <td>{c.Referred_By_Name || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(c.Customer_ID)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="empty">No customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={editId ? 'Edit Customer' : 'Add Customer'} onClose={() => setForm(null)} onSubmit={save}>
          <div className="field"><label>Name *</label><input required value={form.Name} onChange={set('Name')} /></div>
          <div className="field-row">
            <div className="field"><label>Phone *</label><input required value={form.Phone} onChange={set('Phone')} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.Email} onChange={set('Email')} /></div>
          </div>
          <div className="field"><label>Address</label><input value={form.Address} onChange={set('Address')} /></div>
          <div className="field">
            <label>Referred By (customer)</label>
            <select value={form.Referred_By} onChange={set('Referred_By')}>
              <option value="">— None —</option>
              {rows.filter((r) => r.Customer_ID !== editId).map((r) => (
                <option key={r.Customer_ID} value={r.Customer_ID}>{r.Name}</option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
