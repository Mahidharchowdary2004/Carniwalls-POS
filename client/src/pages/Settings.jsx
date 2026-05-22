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
    { key:'outlet', label:'🏪 Outlet' },
    { key:'integrations', label:'🔌 Integrations' },
    { key:'printers', label:'🖨️ Printers' },
    { key:'users', label:'👤 Users & Roles' },
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
                  Check for Updates
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div className="grid-2" style={{ gap:20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Food Delivery Platforms</div></div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { name:'🛵 Swiggy', status:'Connected', badge:'badge-success', hint:'Orders synced automatically' },
                { name:'🍕 Zomato', status:'Connected', badge:'badge-success', hint:'Menu auto-synced' },
                { name:'🏠 Direct Orders (Website)', status:'Not configured', badge:'badge-warning', hint:'Set up your own ordering page' },
                { name:'📞 Call-in Orders', status:'Active', badge:'badge-success', hint:'Manual entry via POS' },
              ].map((int, i) => (
                <div key={i} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{int.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{int.hint}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className={`badge ${int.badge}`}>{int.status}</span>
                    <button className="btn btn-sm" onClick={() => toast.success(`${int.name} settings opened`)}>Config</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Payment Gateways</div></div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { name:'💳 Razorpay', status:'Connected', badge:'badge-success' },
                { name:'📱 Paytm Business', status:'Not connected', badge:'badge-danger' },
                { name:'🏦 PhonePe for Business', status:'Not connected', badge:'badge-danger' },
                { name:'💵 Cash', status:'Always active', badge:'badge-success' },
              ].map((gw, i) => (
                <div key={i} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{gw.name}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className={`badge ${gw.badge}`}>{gw.status}</span>
                    {gw.badge === 'badge-danger' && <button className="btn btn-sm btn-primary" onClick={() => toast.success('Opening setup…')}>Setup</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Notifications</div></div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { name:'📱 WhatsApp Business', status:'Configure', badge:'badge-warning' },
                { name:'📧 Email Reports', status:'Not connected', badge:'badge-danger' },
                { name:'🔔 SMS Alerts', status:'Active', badge:'badge-success' },
              ].map((n, i) => (
                <div key={i} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{n.name}</span>
                  <span className={`badge ${n.badge}`}>{n.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRINTERS */}
      {activeTab === 'printers' && (
        <div className="grid-2" style={{ gap:20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Configured Printers</div><button className="btn btn-primary btn-sm" onClick={() => toast.success('Add printer flow')}>+ Add Printer</button></div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { name:'Billing Printer (Counter)', type:'Thermal 80mm', ip:'192.168.1.101', status:'Online', badge:'badge-success' },
                { name:'KOT Printer (Kitchen)', type:'Thermal 58mm', ip:'192.168.1.102', status:'Online', badge:'badge-success' },
                { name:'Bar Printer', type:'Thermal 80mm', ip:'192.168.1.103', status:'Offline', badge:'badge-danger' },
                { name:'Label Printer', type:'Zebra ZD220', ip:'Not configured', status:'Not set', badge:'badge-warning' },
              ].map((p, i) => (
                <div key={i} style={{ padding:'14px', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>🖨️ {p.name}</span>
                    <span className={`badge ${p.badge}`}>{p.status}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{p.type} • {p.ip}</div>
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <button className="btn btn-sm" onClick={() => toast.success('Test page sent!')}>Test Print</button>
                    <button className="btn btn-sm" onClick={() => toast.success('Config opened')}>Configure</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Receipt Customization</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Receipt Header</label>
                <input className="form-input" defaultValue="Thank you for dining with us!" />
              </div>
              <div className="form-group">
                <label className="form-label">Receipt Footer</label>
                <textarea className="form-textarea" defaultValue="Visit us again! | WiFi: Restaurant_Guest | Instagram: @restauraq" style={{ minHeight:70 }} />
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor:'var(--orange)' }} />
                  Print logo
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor:'var(--orange)' }} />
                  Print QR code
                </label>
              </div>
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:14 }} onClick={() => toast.success('Receipt settings saved')}>
                Save Receipt Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header"><div className="card-title">System Users</div><button className="btn btn-primary btn-sm" onClick={() => toast.success('User invite flow')}>+ Invite User</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Last Login</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {[
                  { name:'Admin', email:'admin@restauraq.com', role:'Admin', last:'Just now', status:'active' },
                  { name:'Cashier', email:'cashier@restauraq.com', role:'Cashier', last:'2h ago', status:'active' },
                ].map((u, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight:600 }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{u.email}</div>
                    </td>
                    <td><span className={`badge ${u.role === 'Admin' ? 'badge-orange' : 'badge-info'}`}>{u.role}</span></td>
                    <td style={{ fontSize:12, color:'var(--text2)' }}>{u.last}</td>
                    <td><span className="badge badge-success">{u.status}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-sm" onClick={() => toast.success('Edit user')}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => toast.error('Cannot delete demo users')}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
