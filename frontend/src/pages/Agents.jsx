import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const EMPTY = { Agent_Name: '', Phone: '', Vehicle_No: '' };

export default function Agents() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [deliveries, setDeliveries] = useState(null); // {agent, list}
  const [err, setErr] = useState('');

  const load = () => api.get('/agents').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); };
  const openEdit = (a) => {
    setForm({ Agent_Name: a.Agent_Name, Phone: a.Phone || '', Vehicle_No: a.Vehicle_No || '' });
    setEditId(a.Agent_ID);
  };

  const save = async () => {
    try {
      if (editId) await api.put(`/agents/${editId}`, form);
      else await api.post('/agents', form);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this agent?')) return;
    try { await api.del(`/agents/${id}`); load(); } catch (e) { setErr(e.message); }
  };

  const viewDeliveries = async (a) => {
    try {
      const list = await api.get(`/agents/${a.Agent_ID}/deliveries`);
      setDeliveries({ agent: a, list });
    } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Delivery Agents</h1>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Agents ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Agent</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Phone</th><th>Vehicle No</th><th>Deliveries</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.Agent_ID}>
                  <td>{a.Agent_ID}</td>
                  <td>{a.Agent_Name}</td>
                  <td>{a.Phone}</td>
                  <td>{a.Vehicle_No}</td>
                  <td><span className="badge badge-blue">{a.Assigned_Deliveries}</span></td>
                  <td className="actions">
                    <button className="btn btn-sm btn-link" onClick={() => viewDeliveries(a)}>View</button>
                    <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(a.Agent_ID)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6" className="empty">No agents yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={editId ? 'Edit Agent' : 'Add Agent'} onClose={() => setForm(null)} onSubmit={save}>
          <div className="field"><label>Agent Name *</label><input required value={form.Agent_Name} onChange={set('Agent_Name')} /></div>
          <div className="field-row">
            <div className="field"><label>Phone</label><input value={form.Phone} onChange={set('Phone')} /></div>
            <div className="field"><label>Vehicle No</label><input value={form.Vehicle_No} onChange={set('Vehicle_No')} /></div>
          </div>
        </Modal>
      )}

      {deliveries && (
        <Modal title={`${deliveries.agent.Agent_Name} — Assigned Deliveries`} onClose={() => setDeliveries(null)} onSubmit={() => setDeliveries(null)} submitLabel="Close">
          {deliveries.list.length === 0 ? (
            <p className="muted">No deliveries assigned.</p>
          ) : (
            <table>
              <thead><tr><th>Delivery</th><th>Order</th><th>Est.</th><th>Status</th></tr></thead>
              <tbody>
                {deliveries.list.map((d) => (
                  <tr key={d.Delivery_ID}>
                    <td>#{d.Delivery_ID}</td><td>#{d.Order_ID}</td><td>{d.Estimated_Time}</td>
                    <td><StatusBadge value={d.Status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}
