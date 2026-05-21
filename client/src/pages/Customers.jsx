import React, { useEffect, useState } from 'react'
import { api } from '../store'
import toast from 'react-hot-toast'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')
  const [form, setForm] = useState({ name:'', phone:'', email:'', notes:'' })

  useEffect(() => { api.get('/customers').then(r => setCustomers(r.data)) }, [])

  function openNew() {
    setEditing(null)
    setForm({ name:'', phone:'', email:'', notes:'' })
    setShowModal(true)
  }
  function openEdit(c) { setEditing(c); setForm({ ...c }); setShowModal(true) }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      if (editing) {
        const { data } = await api.put(`/customers/${editing.id}`, form)
        setCustomers(prev => prev.map(c => c.id === editing.id ? data : c))
        toast.success('Customer updated')
      } else {
        const { data } = await api.post('/customers', form)
        setCustomers(prev => [...prev, data])
        toast.success('Customer added')
      }
      setShowModal(false)
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Remove ${c.name}?`)) return
    try {
      await api.delete(`/customers/${c.id}`)
      setCustomers(prev => prev.filter(x => x.id !== c.id))
      toast.success('Removed')
    } catch { toast.error('Failed') }
  }

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone||'').includes(search) || (c.email||'').toLowerCase().includes(search.toLowerCase())
  )

  const totalSpent  = customers.reduce((s,c) => s + (c.total_spent||0), 0)
  const totalPoints = customers.reduce((s,c) => s + (c.loyalty_points||0), 0)
  const repeatCount = customers.filter(c => c.visits > 1).length

  return (
    <div>
      {/* STATS */}
      <div className="grid-4 mb-6">
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--blue-bg)' }}>🤝</div><div className="stat-label">Total Customers</div><div className="stat-value">{customers.length}</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--green-bg)' }}>🔄</div><div className="stat-label">Repeat Visitors</div><div className="stat-value" style={{ color:'var(--green)' }}>{repeatCount}</div><div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>{customers.length ? Math.round(repeatCount/customers.length*100) : 0}% of total</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--orange-bg)' }}>⭐</div><div className="stat-label">Total Loyalty Pts</div><div className="stat-value">{totalPoints.toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--purple-bg)' }}>💰</div><div className="stat-label">Total Revenue</div><div className="stat-value" style={{ fontSize:18 }}>₹{totalSpent.toLocaleString()}</div></div>
      </div>

      {/* CONTROLS */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <div className="search-box" style={{ maxWidth:320 }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>
          <input placeholder="Search by name, phone, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add Customer</button>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>Visits</th><th>Total Spent</th><th>Loyalty Points</th><th>Notes</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>No customers found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--blue-bg)', color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                        {c.email && <div style={{ fontSize:11, color:'var(--text3)' }}>{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text2)' }}>{c.phone || '—'}</td>
                  <td><span className="badge badge-gray">{c.visits||0} visits</span></td>
                  <td style={{ fontWeight:600, color:'var(--orange)' }}>₹{(c.total_spent||0).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-success">⭐ {c.loyalty_points||0} pts</span>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text2)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.notes||'—'}</td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(c)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Edit Customer' : 'Add Customer'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="Customer name" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="9876543210" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} placeholder="customer@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Allergies, preferences, VIP…" style={{ minHeight:80 }} />
            </div>
            {editing && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Visits</label>
                  <input className="form-input" type="number" value={form.visits||0} onChange={e => setForm(f => ({...f, visits:parseInt(e.target.value)||0}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Loyalty Points</label>
                  <input className="form-input" type="number" value={form.loyalty_points||0} onChange={e => setForm(f => ({...f, loyalty_points:parseInt(e.target.value)||0}))} />
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn" style={{ flex:1, justifyContent:'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }} onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width:16, height:16 }} /> : (editing ? '✓ Save Changes' : '+ Add Customer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
