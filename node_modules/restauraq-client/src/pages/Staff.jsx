import React, { useEffect, useState } from 'react'
import { api } from '../store'
import toast from 'react-hot-toast'

const ROLES   = ['Head Chef','Sous Chef','Line Cook','Cashier','Waiter','Manager','Bartender','Delivery Boy','Cleaner']
const SHIFTS  = ['Morning (6am–2pm)','Evening (2pm–10pm)','Night (10pm–6am)','Split (9am–6pm)']
const STATUSES = ['active','on-leave','inactive']

export default function Staff() {
  const [staff, setStaff]       = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState('All')
  const [form, setForm] = useState({
    name:'', role:'Waiter', phone:'', email:'',
    shift:'Morning (6am–2pm)', salary:18000, status:'active', joining_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => { api.get('/staff').then(r => setStaff(r.data)) }, [])

  function openNew() {
    setEditing(null)
    setForm({ name:'', role:'Waiter', phone:'', email:'', shift:'Morning (6am–2pm)', salary:18000, status:'active', joining_date: new Date().toISOString().split('T')[0] })
    setShowModal(true)
  }
  function openEdit(s) { setEditing(s); setForm({ ...s }); setShowModal(true) }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      if (editing) {
        const { data } = await api.put(`/staff/${editing.id}`, form)
        setStaff(prev => prev.map(s => s.id === editing.id ? data : s))
        toast.success('Staff updated')
      } else {
        const { data } = await api.post('/staff', form)
        setStaff(prev => [...prev, data])
        toast.success('Staff member added')
      }
      setShowModal(false)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleDelete(s) {
    if (!window.confirm(`Remove ${s.name} from staff?`)) return
    try {
      await api.delete(`/staff/${s.id}`)
      setStaff(prev => prev.filter(x => x.id !== s.id))
      toast.success('Removed')
    } catch { toast.error('Failed') }
  }

  async function toggleStatus(s) {
    const next = s.status === 'active' ? 'inactive' : 'active'
    const { data } = await api.put(`/staff/${s.id}`, { ...s, status: next })
    setStaff(prev => prev.map(x => x.id === s.id ? data : x))
    toast.success(`${s.name} marked ${next}`)
  }

  const roles = ['All', ...new Set(staff.map(s => s.role))]
  const filtered = staff.filter(s => {
    const sm = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase())
    const rm = filterRole === 'All' || s.role === filterRole
    return sm && rm
  })

  const totalPayroll = staff.reduce((s,e) => s + (e.salary||0), 0)
  const activeCount  = staff.filter(s => s.status === 'active').length

  return (
    <div>
      {/* STATS */}
      <div className="grid-4 mb-6">
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--blue-bg)' }}>👥</div><div className="stat-label">Total Staff</div><div className="stat-value">{staff.length}</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--green-bg)' }}>✅</div><div className="stat-label">Active</div><div className="stat-value" style={{ color:'var(--green)' }}>{activeCount}</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--orange-bg)' }}>🌅</div><div className="stat-label">Morning Shift</div><div className="stat-value">{staff.filter(s => s.shift?.startsWith('Morning')).length}</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--purple-bg)' }}>💰</div><div className="stat-label">Monthly Payroll</div><div className="stat-value" style={{ fontSize:18 }}>₹{totalPayroll.toLocaleString()}</div></div>
      </div>

      {/* CONTROLS */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <div className="search-box" style={{ maxWidth:280 }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>
          <input placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width:160 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          {roles.map(r => <option key={r}>{r}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add Staff</button>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Contact</th><th>Shift</th><th>Salary</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>No staff found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--orange-bg)', color:'var(--orange)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {s.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                        {s.email && <div style={{ fontSize:11, color:'var(--text3)' }}>{s.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-info">{s.role}</span></td>
                  <td style={{ fontSize:12, color:'var(--text2)' }}>{s.phone || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--text2)' }}>{s.shift?.split('(')[0]?.trim() || s.shift}</td>
                  <td style={{ fontWeight:600 }}>₹{(s.salary||0).toLocaleString()}</td>
                  <td style={{ fontSize:12, color:'var(--text2)' }}>{s.joining_date ? new Date(s.joining_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <button onClick={() => toggleStatus(s)} className={`badge ${s.status==='active'?'badge-success':s.status==='on-leave'?'badge-warning':'badge-danger'}`} style={{ cursor:'pointer', border:'none', fontFamily:'inherit' }}>
                      {s.status}
                    </button>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(s)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)}>🗑️</button>
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
              <div className="modal-title">{editing ? 'Edit Staff Member' : 'Add Staff Member'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="e.g. Rahul Kumar" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({...f, role:e.target.value}))}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="9876543210" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} placeholder="staff@email.com" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Shift</label>
                <select className="form-select" value={form.shift} onChange={e => setForm(f => ({...f, shift:e.target.value}))}>
                  {SHIFTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monthly Salary (₹)</label>
                <input className="form-input" type="number" value={form.salary} onChange={e => setForm(f => ({...f, salary:parseInt(e.target.value)||0}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Joining Date</label>
                <input className="form-input" type="date" value={form.joining_date} onChange={e => setForm(f => ({...f, joining_date:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn" style={{ flex:1, justifyContent:'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }} onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width:16, height:16 }} /> : (editing ? '✓ Save Changes' : '+ Add Member')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
