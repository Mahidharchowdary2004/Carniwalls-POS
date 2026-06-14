import React, { useEffect, useState } from 'react'
import { api, useStore } from '../store'
import toast from 'react-hot-toast'

export default function Settings() {
  const [outlet, setOutlet]   = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [activeTab, setActiveTab] = useState('outlet')
  const [syncingAll, setSyncingAll] = useState(false)

  const pullAllDataFromServer = useStore(state => state.pullAllDataFromServer)
  const isOffline = useStore(state => state.isOffline)

  // Updater State
  const [version, setVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [updateProgress, setUpdateProgress] = useState(0)

  // Hardware State
  const [printers, setPrinters] = useState([])
  const [selectedPrinter, setSelectedPrinter] = useState(localStorage.getItem('pos_printer') || '')
  const [printScale, setPrintScale] = useState(localStorage.getItem('pos_print_scale') || '100')
  const [printFontSize, setPrintFontSize] = useState(localStorage.getItem('pos_print_font_size') || '16')

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
      window.ipcRenderer.invoke('get-printers').then(list => setPrinters(list || []))

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
    { key:'hardware', label:'🖨️ Hardware' },
    { key:'sync', label:'🔄 Database Sync' }
  ]

  function handlePrinterChange(e) {
    const val = e.target.value
    setSelectedPrinter(val)
    localStorage.setItem('pos_printer', val)
    
    // Auto-detect and set defaults based on common printer names
    const nameLower = val.toLowerCase()
    let newScale = printScale
    let newFontSize = printFontSize
    
    if (nameLower.includes('58')) {
      // 58mm thermal printers usually need smaller font and scale
      newScale = '80'
      newFontSize = '12'
      toast.success(`Printer saved! Auto-configured for 58mm receipt.`)
    } else if (nameLower.includes('80') || nameLower.includes('bill')) {
      // 80mm thermal printers or generic 'bill' printers
      newScale = '100'
      newFontSize = '16'
      toast.success(`Printer saved! Auto-configured for standard 80mm receipt.`)
    } else {
      toast.success('Printer saved successfully')
    }

    if (newScale !== printScale || newFontSize !== printFontSize) {
      setPrintScale(newScale)
      setPrintFontSize(newFontSize)
      localStorage.setItem('pos_print_scale', newScale)
      localStorage.setItem('pos_print_font_size', newFontSize)
    }
  }

  function handleScaleChange(e) {
    const val = e.target.value
    setPrintScale(val)
    localStorage.setItem('pos_print_scale', val)
    toast.success('Print scale saved')
  }

  function handleFontSizeChange(e) {
    const val = e.target.value
    setPrintFontSize(val)
    localStorage.setItem('pos_print_font_size', val)
    toast.success('Print font size saved')
  }

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

      {/* HARDWARE DETAILS */}
      {activeTab === 'hardware' && (
        <div className="grid-2" style={{ gap:20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Thermal Printer</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Default POS Printer</label>
                {window.ipcRenderer ? (
                  <select className="form-select" value={selectedPrinter} onChange={handlePrinterChange}>
                    <option value="">-- Select Printer --</option>
                    {printers.map((p, i) => (
                      <option key={i} value={p.name}>{p.displayName || p.name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ color: 'var(--red)', fontSize: 13, background: '#fceaea', padding: 10, borderRadius: 6 }}>
                    Hardware settings are only available in the Desktop App.
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                  This printer will be used silently for bills and KOTs without showing a print dialog.
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Print Scale (%)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={printScale} 
                  onChange={handleScaleChange} 
                  min="10" 
                  max="200" 
                />
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                  Adjust if your prints are cut off. Default is 100. Lower it (e.g., 80) if content goes off-page.
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Base Font Size (px)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={printFontSize} 
                  onChange={handleFontSizeChange} 
                  min="8" 
                  max="32" 
                />
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                  Adjust the base font size for the printed receipt. Default is 16.
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Live Receipt Preview</div></div>
            <div className="card-body" style={{ background: '#f8f9fb', display: 'flex', justifyContent: 'center', padding: 20, overflow: 'hidden' }}>
              {/* Dummy thermal receipt container */}
              <div style={{
                background: '#fff',
                width: 300,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '20px 15px',
                fontFamily: 'monospace',
                color: '#000',
                transform: `scale(${parseFloat(printScale) / 100})`,
                transformOrigin: 'top center'
              }}>
                {(() => {
                  const fs = parseInt(printFontSize) || 16;
                  const dummyCart = [
                    { name: "Paneer Butter Masala", qty: 1, price: 250 },
                    { name: "Butter Naan", qty: 2, price: 40 }
                  ];
                  return (
                    <>
                      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: `${fs * 1.25}px`, marginTop: '10px' }}>
                        BABA DAIRY MILK PRODUCTS
                      </div>
                      <div style={{ textAlign: 'center', fontSize: `${Math.round(fs * 0.9375)}px`, fontWeight: 'bold', margin: '4px 0' }}>
                        D.No. 2-13-80, Servey No. 411-A,<br />
                        Kovur, Nellore -524137
                      </div>
                      <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fs}px`, fontWeight: 'bold' }}>
                        <span>Date: 14/06/26</span>
                        <span>dine in: T-1</span>
                      </div>
                      <div style={{ fontSize: `${fs}px`, fontWeight: 'bold' }}>
                        19:45:00
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fs}px`, fontWeight: 'bold' }}>
                        <span>Cashier: admin</span>
                        <span>Bill No.: 104</span>
                      </div>
                      <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />
                      <table style={{ width: '100%', fontSize: `${fs}px`, fontWeight: 'bold' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '2px 0' }}>Item</th>
                            <th style={{ textAlign: 'center', padding: '2px 0' }}>Qty.</th>
                            <th style={{ textAlign: 'right', padding: '2px 0' }}>Price</th>
                            <th style={{ textAlign: 'right', padding: '2px 0' }}>Amt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dummyCart.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ textAlign: 'left', paddingRight: '2px', padding: '2px 0' }}>{item.name}</td>
                              <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.qty}</td>
                              <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.price.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', padding: '2px 0' }}>{(item.price * item.qty).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />
                      <div style={{ textAlign: 'right', fontSize: `${Math.round(fs * 1.125)}px`, fontWeight: 'bold', margin: '4px 0' }}>
                        Grand Total &nbsp; ₹ 330.00
                      </div>
                      <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />
                      <div style={{ textAlign: 'center', fontSize: `${fs}px`, fontWeight: 'bold', marginTop: '6px' }}>
                        Thank You | Visit Again
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SYNC DETAILS */}
      {activeTab === 'sync' && (
        <div style={{ maxWidth: 650 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Cloud to Local Replication</div>
              <div className="card-sub">Synchronize your central cloud database with your local high-performance SQLite engine</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Environment Info Banner */}
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(239, 131, 40, 0.08) 0%, rgba(239, 131, 40, 0.03) 100%)',
                  border: '1px solid rgba(239, 131, 40, 0.25)', 
                  padding: 16, 
                  borderRadius: 8 
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 6 }}>
                    🖥️ Running Mode: {window.ipcRenderer ? 'Desktop Application (SQLite Local-First)' : 'Web Browser Context (API Only)'}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                    Your desktop app is built with a <strong>Local-First Relational Architecture</strong>. All POS bills, menu changes, categories, and inventory items are permanently saved in your local SQLite engine first, giving you <strong>0ms instant UI responses</strong> and full offline capabilities.
                  </p>
                </div>

                {/* Connection Status Indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Network Connection Status:</div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontWeight: 700, 
                    fontSize: 13,
                    color: isOffline ? '#c0392b' : '#27ae60' 
                  }}>
                    <span style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      background: isOffline ? '#c0392b' : '#27ae60',
                      display: 'inline-block'
                    }} />
                    {isOffline ? 'Offline' : 'Connected to Cloud'}
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  To duplicate all your remote tables from the cloud Postgres database (including unlimited historical bills, categories, items, and inventory) to your local SQLite database file, click the replication button below.
                </div>

                {/* Database Force Pull Button */}
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    if (isOffline) {
                      toast.error('Replication requires an active internet connection.')
                      return
                    }
                    setSyncingAll(true)
                    const toastId = toast.loading('Initiating full database copy from cloud to local SQLite...')
                    try {
                      await pullAllDataFromServer()
                      toast.success('Successfully copied all data from cloud to SQLite! 🚀', { id: toastId, duration: 4000 })
                    } catch (err) {
                      toast.error('Data copy failed: ' + (err.message || err), { id: toastId })
                    } finally {
                      setSyncingAll(false)
                    }
                  }} 
                  disabled={syncingAll || isOffline}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    fontSize: 14, 
                    fontWeight: 700, 
                    justifyContent: 'center',
                    gap: 8,
                    cursor: syncingAll || isOffline ? 'not-allowed' : 'pointer'
                  }}
                >
                  {syncingAll ? (
                    <><span className="spinner" style={{ width: 16, height: 16 }} /> Downloading Remote Data...</>
                  ) : (
                    '📥 Copy Cloud Data to Local SQLite'
                  )}
                </button>

                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: -8 }}>
                  * This will perform a non-destructive insert/update. No local offline changes will be wiped.
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
