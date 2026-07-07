import React, { useEffect, useState } from 'react'
import { api, useStore } from '../store'
import toast from 'react-hot-toast'

export default function Credentials() {
  const { user } = useStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

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
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>System Credentials</h2>
        <p style={{ color: 'var(--text2)', margin: '4px 0 0 0', fontSize: 13 }}>Manage login emails, phone numbers, and passwords for the Admin and Cashier accounts.</p>
      </div>
      
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading users...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {users.map(u => (
            <CredentialForm key={u.id} initialData={u} />
          ))}
        </div>
      )}
    </div>
  )
}

function CredentialForm({ initialData }) {
  const [form, setForm] = useState({ ...initialData, password: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {}
      if (form.email !== initialData.email) data.email = form.email
      if (form.phone !== initialData.phone) data.phone = form.phone
      if (form.password) data.password = form.password
      
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
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Phone</label>
          <input className="form-input" type="text" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} required />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">New Password</label>
          <input className="form-input" type="text" placeholder="Leave blank to keep" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
        </div>
        <div className="form-group" style={{ flex: 0.8, paddingTop: 26 }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 40 }} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
