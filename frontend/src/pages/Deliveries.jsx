import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const STATUSES = ['Assigned', 'Out for Delivery', 'Delivered'];
const EMPTY = { Order_ID: '', Agent_ID: '', Status: 'Assigned', Estimated_Time: '' };

export default function Deliveries() {
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/deliveries').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/orders').then(setOrders).catch(() => {});
    api.get('/agents').then(setAgents).catch(() => {});
  }, []);

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); };
  const openEdit = (d) => {
    setForm({ Order_ID: d.Order_ID, Agent_ID: d.Agent_ID || '', Status: d.Status, Estimated_Time: d.Estimated_Time || '' });
    setEditId(d.Delivery_ID);
  };

  const save = async () => {
    try {
      const body = { ...form, Agent_ID: form.Agent_ID || null };
      if (editId) await api.put(`/deliveries/${editId}`, body);
      else await api.post('/deliveries', body);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="page-title">Deliveries</h1>
      {err && <div className="error-bar">{err}</div>}
      <div className="panel">
        <div className="panel-head">
          <h2>All Deliveries ({rows.length})</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Create Delivery</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Order</th><th>Customer</th><th>Agent</th><th>Est. Time</th><th>Delivered At</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.Delivery_ID}>
                  <td>{d.Delivery_ID}</td>
                  <td>#{d.Order_ID}</td>
                  <td>{d.Customer_Name}</td>
                  <td>{d.Agent_Name || <span className="muted">Unassigned</span>}</td>
                  <td>{d.Estimated_Time}</td>
                  <td>{d.Delivery_Time ? new Date(d.Delivery_Time).toLocaleString() : <span className="muted">—</span>}</td>
                  <td><StatusBadge value={d.Status} /></td>
                  <td><button className="btn btn-sm" onClick={() => openEdit(d)}>Edit</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="8" className="empty">No deliveries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={editId ? 'Edit Delivery' : 'Create Delivery'} onClose={() => setForm(null)} onSubmit={save}>
          {!editId && (
            <div className="field">
              <label>Order *</label>
              <select required value={form.Order_ID} onChange={set('Order_ID')}>
                <option value="">— Select —</option>
                {orders.map((o) => <option key={o.Order_ID} value={o.Order_ID}>#{o.Order_ID} · {o.Customer_Name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Delivery Agent</label>
            <select value={form.Agent_ID} onChange={set('Agent_ID')}>
              <option value="">— Unassigned —</option>
              {agents.map((a) => <option key={a.Agent_ID} value={a.Agent_ID}>{a.Agent_Name}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Status</label>
              <select value={form.Status} onChange={set('Status')}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Estimated Time</label><input placeholder="e.g. 30 mins" value={form.Estimated_Time} onChange={set('Estimated_Time')} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
