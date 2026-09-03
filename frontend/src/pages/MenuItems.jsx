import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

const EMPTY = { Restaurant_ID: '', Item_Name: '', Category: '', Price: '', Availability: true };

export default function MenuItems() {
  const [rows, setRows] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/menu-items').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/restaurants').then(setRestaurants).catch((e) => setErr(e.message));
  }, []);

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); };
  const openEdit = (m) => {
    setForm({ Restaurant_ID: m.Restaurant_ID, Item_Name: m.Item_Name, Category: m.Category || '', Price: m.Price, Availability: !!m.Availability });
    setEditId(m.Item_ID);
  };

  const save = async () => {
    try {
      if (editId) await api.put(`/menu-items/${editId}`, form);
      else await api.post('/menu-items', form);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this menu item?')) return;
    try { await api.del(`/menu-items/${id}`); load(); } catch (e) { setErr(e.message); }
  };

  // Quick availability toggle straight from the table.
  const toggle = async (m) => {
    try {
      await api.put(`/menu-items/${m.Item_ID}`, { ...m, Availability: m.Availability ? 0 : 1 });
      load();
    } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Menu Items</h1>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Menu Items ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Menu Item</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Item</th><th>Restaurant</th><th>Category</th><th>Price</th><th>Available</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.Item_ID}>
                  <td>{m.Item_ID}</td>
                  <td>{m.Item_Name}</td>
                  <td>{m.Restaurant_Name}</td>
                  <td>{m.Category}</td>
                  <td>₹{m.Price}</td>
                  <td>
                    <span className={`badge ${m.Availability ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer' }} onClick={() => toggle(m)}>
                      {m.Availability ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => openEdit(m)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(m.Item_ID)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="empty">No menu items yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={editId ? 'Edit Menu Item' : 'Add Menu Item'} onClose={() => setForm(null)} onSubmit={save}>
          <div className="field">
            <label>Restaurant *</label>
            <select required value={form.Restaurant_ID} onChange={set('Restaurant_ID')}>
              <option value="">— Select —</option>
              {restaurants.map((r) => <option key={r.Restaurant_ID} value={r.Restaurant_ID}>{r.Name}</option>)}
            </select>
          </div>
          <div className="field"><label>Item Name *</label><input required value={form.Item_Name} onChange={set('Item_Name')} /></div>
          <div className="field-row">
            <div className="field"><label>Category</label><input value={form.Category} onChange={set('Category')} /></div>
            <div className="field"><label>Price *</label><input required type="number" step="0.01" min="0" value={form.Price} onChange={set('Price')} /></div>
          </div>
          <div className="field">
            <label>Availability</label>
            <select value={form.Availability ? '1' : '0'} onChange={(e) => setForm({ ...form, Availability: e.target.value === '1' })}>
              <option value="1">Available</option>
              <option value="0">Unavailable</option>
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
