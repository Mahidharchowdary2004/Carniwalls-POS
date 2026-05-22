import React, { useEffect, useState } from 'react'
import { api } from '../store'
import toast from 'react-hot-toast'

export default function Settings() {
  const [outlet, setOutlet]   = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [activeTab, setActiveTab] = useState('outlet')

  // Updater State
  const [version, setVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [updateProgress, setUpdateProgress] = useState(0)

  useEffect(() => {
    api.get('/outlets/out_main').then(r => { 
      if (r.data) {
        setOutlet(r.data); 
        setForm(r.data);
      } else {
        toast.error('Outlet not found');
        setOutlet({}); // Prevent infinite load
      }
    }).catch(e => {
      console.error(e);
      toast.error('Failed to load settings');
      setOutlet({});
    })

    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('get-version').then(v => setVersion(v))

      window.ipcRenderer.on('updater-status', (event, data) => {
        setUpdateStatus(data.status)
        if (data.status === 'error') toast.error('Update error: ' + data.message)
        if (data.status === 'not-available') toast.success('You are on the latest version!')
      })

      window.ipcRenderer.on('updater-progress', (event, percent) => {
        setUpdateProgress(Math.round(percent))
      })
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const { data } = await api.put('/outlets/out_main', form)
      setOutlet(data)
      toast.success('Settings saved ✓')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (!outlet) return (
    <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  )

  const tabs = [
    { key:'outlet', label:'🏪 Outlet' }
  ]

  return (
    <div>
      <div className="tab-bar mb-6">
        {tabs.map(t => (
          <div key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* OUTLET DETAILS */}
      {activeTab === 'outlet' && (
        <div className="grid-2" style={{ gap:20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Outlet Information</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Restaurant Name *</label>
                <input className="form-input" value={form.name||''} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Full Address</label>
                <textarea className="form-textarea" value={form.address||''} onChange={e => setForm(f => ({...f, address:e.target.value}))} style={{ minHeight:80 }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone||''} onChange={e => setForm(f => ({...f, phone:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">GSTIN</label>
                  <input className="form-input" value={form.gstin||''} onChange={e => setForm(f => ({...f, gstin:e.target.value}))} placeholder="29AABCU9603R1ZX" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Restaurant Type</label>
                <select className="form-select" value={form.type||'multi'} onChange={e => setForm(f => ({...f, type:e.target.value}))}>
                  <option value="multi">Multi-format</option>
                  <option value="dine">Dine-in Only</option>
                  <option value="qsr">Quick Service (QSR)</option>
                  <option value="cloud">Cloud Kitchen</option>
                  <option value="cafe">Café</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
                {saving ? <><span className="spinner" style={{ width:14, height:14 }} /> Saving…</> : '✓ Save Changes'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Business Hours</div></div>
            <div className="card-body">
              {['Mon–Fri','Saturday','Sunday'].map((day, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <div style={{ width:80, fontSize:13, fontWeight:500 }}>{day}</div>
                  <input type="time" className="form-input" defaultValue={i === 2 ? '10:00' : '09:00'} style={{ flex:1 }} />
                  <span style={{ color:'var(--text2)', fontSize:12 }}>to</span>
                  <input type="time" className="form-input" defaultValue={i === 2 ? '22:00' : '23:00'} style={{ flex:1 }} />
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)', cursor:'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor:'var(--orange)' }} />
                    Open
                  </label>
                </div>
              ))}
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={() => toast.success('Hours saved')}>
                Save Hours
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Software Updates</div></div>
            <div className="card-body">
              <div style={{ marginBottom: 14, fontSize: 14 }}>
                Current Version: <span className="badge badge-info">v{version || '1.0.0'}</span>
              </div>
              
              {updateStatus === 'checking' && <div style={{ color: 'var(--text2)', marginBottom: 10, fontSize: 13 }}>Checking for updates...</div>}
              {updateStatus === 'available' && <div style={{ color: 'var(--text2)', marginBottom: 10, fontSize: 13 }}>Update found! Downloading... {updateProgress}%</div>}
              {updateStatus === 'downloaded' && <div style={{ color: '#27ae60', marginBottom: 10, fontSize: 13 }}>Update ready to install!</div>}

              {updateStatus === 'downloaded' ? (
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={() => window.ipcRenderer.send('install-update')}>
                  Restart & Install Update
                </button>
              ) : (
                <button className="btn" style={{ width:'100%', justifyContent:'center', border: '1px solid var(--border)' }} onClick={() => {
                  if (window.ipcRenderer) {
                    setUpdateStatus('checking')
                    window.ipcRenderer.send('check-for-updates')
                  } else {
                    toast.error('Updates only available in Desktop App')
                  }
                }} disabled={updateStatus === 'checking' || updateStatus === 'available'}>
                  {updateStatus === 'checking' ? 'Checking for updates...' : 
                   updateStatus === 'available' ? `Downloading Update... (${updateProgress}%)` : 
                   'Check for Updates'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
