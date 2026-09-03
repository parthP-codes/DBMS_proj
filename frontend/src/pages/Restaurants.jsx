import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

const EMPTY = { Name: '', Address: '', Phone: '', Rating: '' };

export default function Restaurants() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/restaurants').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); };
  const openEdit = (r) => {
    setForm({ Name: r.Name, Address: r.Address || '', Phone: r.Phone || '', Rating: r.Rating });
    setEditId(r.Restaurant_ID);
  };

  const save = async () => {
    try {
      if (editId) await api.put(`/restaurants/${editId}`, form);
      else await api.post('/restaurants', form);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this restaurant (and its menu items)?')) return;
    try { await api.del(`/restaurants/${id}`); load(); } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Restaurants</h1>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Restaurants ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Restaurant</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Address</th><th>Phone</th><th>Rating</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Restaurant_ID}>
                  <td>{r.Restaurant_ID}</td>
                  <td>{r.Name}</td>
                  <td>{r.Address}</td>
                  <td>{r.Phone}</td>
                  <td>⭐ {r.Rating}</td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(r.Restaurant_ID)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6" className="empty">No restaurants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={editId ? 'Edit Restaurant' : 'Add Restaurant'} onClose={() => setForm(null)} onSubmit={save}>
          <div className="field"><label>Name *</label><input required value={form.Name} onChange={set('Name')} /></div>
          <div className="field"><label>Address</label><input value={form.Address} onChange={set('Address')} /></div>
          <div className="field-row">
            <div className="field"><label>Phone</label><input value={form.Phone} onChange={set('Phone')} /></div>
            <div className="field"><label>Rating (0–5)</label><input type="number" step="0.1" min="0" max="5" value={form.Rating} onChange={set('Rating')} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
