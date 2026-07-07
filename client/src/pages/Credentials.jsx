import React, { useEffect, useState } from 'react'
import { api, useStore } from '../store'
import toast from 'react-hot-toast'

export default function Credentials() {
  const { user } = useStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin') return
    api.get('/users')
      .then(r => {
        setUsers(Array.isArray(r.data) ? r.data : [])
        setLoading(false)
      })
      .catch(err => {
        toast.error('Failed to load users')
        setLoading(false)
      })
  }, [user])

  if (user?.role !== 'admin') {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Access Denied: Admins Only</div>
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 20 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>System Credentials</h2>
          <p style={{ color: 'var(--text2)', margin: '4px 0 0 0', fontSize: 13 }}>Manage login emails, phone numbers, and passwords for the Admin and Cashier accounts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add User</button>
      </div>
      
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading users...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {users.map(u => (
            <CredentialForm key={u.id} initialData={u} onDelete={(id) => setUsers(users.filter(x => x.id !== id))} />
          ))}
        </div>
      )}

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onAdded={u => setUsers([...users, u])} />}
    </div>
  )
}

function AddUserModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', role: 'cashier', phone: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (form.role === 'admin' && !/^\d{6}$/.test(form.password)) {
      return toast.error('Admin OTP must be exactly 6 digits')
    }
    setSaving(true)
    try {
      const { data } = await api.post('/users', form)
      toast.success('User added successfully')
      onAdded(data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 400 }}>
        <div className="modal-header">
          <div className="modal-title">Add New User</div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. John Doe" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" required type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="9876543210" />
          </div>
          {form.role !== 'admin' && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="user@restauraq.com" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{form.role === 'admin' ? 'Security OTP (6 Digits)' : 'Password'}</label>
            <input 
              className="form-input" 
              required 
              type="text" 
              value={form.password} 
              onChange={e => {
                if (form.role === 'admin') {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setForm(f => ({...f, password: val}))
                } else {
                  setForm(f => ({...f, password: e.target.value}))
                }
              }}
              maxLength={form.role === 'admin' ? 6 : undefined}
              placeholder={form.role === 'admin' ? "121212" : "Password"}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={saving}>
            {saving ? 'Adding...' : 'Add User'}
          </button>
        </form>
      </div>
    </div>
  )
}

function CredentialForm({ initialData, onDelete }) {
  const [form, setForm] = useState({ ...initialData, password: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {}
      if (initialData.role !== 'admin' && form.email !== initialData.email) data.email = form.email
      if (form.phone !== initialData.phone) data.phone = form.phone
      if (form.password) {
        if (initialData.role === 'admin' && !/^\d{6}$/.test(form.password)) {
          toast.error('Admin OTP must be exactly 6 digits')
          setSaving(false)
          return
        }
        data.password = form.password
      }
      
      if (Object.keys(data).length === 0) {
        toast('No changes to save')
        setSaving(false)
        return
      }

      await api.put(`/users/${initialData.id}`, data)
      toast.success(`${initialData.name} credentials updated`)
      setForm(f => ({ ...f, password: '' })) // clear password field
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: initialData.role === 'admin' ? 'var(--blue-bg)' : 'var(--green-bg)', color: initialData.role === 'admin' ? 'var(--blue)' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
          {initialData.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{initialData.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{initialData.role}</div>
        </div>
      </div>
      
      <form onSubmit={handleSave} className="form-row" style={{ alignItems: 'flex-start' }}>
        {initialData.role !== 'admin' && (
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
          </div>
        )}
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Phone</label>
          <input className="form-input" type="text" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} required />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">{initialData.role === 'admin' ? 'New Security OTP (6 Digits)' : 'New Password'}</label>
          <input 
            className="form-input" 
            type="text" 
            placeholder="Leave blank to keep" 
            value={form.password} 
            onChange={e => {
              if (initialData.role === 'admin') {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setForm(f => ({...f, password: val}))
              } else {
                setForm(f => ({...f, password: e.target.value}))
              }
            }}
            maxLength={initialData.role === 'admin' ? 6 : undefined}
          />
        </div>
        <div className="form-group" style={{ flex: 0.8, paddingTop: 26, display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, height: 40 }} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" className="btn btn-danger" style={{ height: 40, width: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={async () => {
            if (!window.confirm(`Delete ${initialData.name}?`)) return
            try {
              await api.delete(`/users/${initialData.id}`)
              toast.success('User deleted')
              onDelete(initialData.id)
            } catch (err) {
              toast.error(err.response?.data?.error || 'Delete failed')
            }
          }}>
            🗑️
          </button>
        </div>
      </form>
    </div>
  )
}
