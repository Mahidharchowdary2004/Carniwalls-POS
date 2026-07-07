import React, { useEffect, useState } from 'react'
import { useStore, api } from '../store'
import toast from 'react-hot-toast'

const CATS = ['All', 'Meat & Seafood', 'Vegetables', 'Dairy', 'Grains', 'Spices', 'Oils']

export default function Inventory() {
  const { inventory, fetchInventory, saveInventoryItem, deleteInventoryItem } = useStore()
  const [tab, setTab] = useState('items')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  // Vendors & Purchases
  const [vendors, setVendors] = useState([])
  const [purchases, setPurchases] = useState([])
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)

  const [form, setForm] = useState({
    name: '', category: 'Vegetables', unit: 'kg', stock: 0,
    min_stock: 5, cost: 0
  })

  const [vendorForm, setVendorForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' })
  const [purchaseForm, setPurchaseForm] = useState({ inventory_id: '', vendor_id: '', quantity: 0, cost_per_unit: 0, total_cost: 0 })

  async function loadData() {
    fetchInventory()
    try {
      const [v, p] = await Promise.all([api.get('/vendors'), api.get('/purchases')])
      setVendors(v.data); setPurchases(p.data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { loadData() }, [])

  const lowStock = inventory.filter(i => parseFloat(i.stock) <= parseFloat(i.min_stock))
  const totalValue = inventory.reduce((sum, i) => sum + (parseFloat(i.stock) || 0) * (parseFloat(i.cost) || 0), 0)
  let filtered = inventory.filter(i => {
    const catMatch = cat === 'All' || i.category === cat
    const searchMatch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  })

  function openNew() {
    setEditing(null)
    setForm({ name: '', category: 'Vegetables', unit: 'kg', stock: 0, min_stock: 5, cost: 0 })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ ...item })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name) return toast.error('Name is required')
    setSaving(true)
    try {
      await saveInventoryItem(editing ? { ...form, id: editing.id } : form)
      toast.success(editing ? 'Item updated' : 'Item added')
      setShowModal(false)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete ${item.name}?`)) return
    await deleteInventoryItem(item.id)
    toast.success('Deleted')
  }

  async function handleSaveVendor() {
    if (!vendorForm.name) return toast.error('Name required')
    try {
      await api.post('/vendors', vendorForm)
      toast.success('Vendor added')
      setShowVendorModal(false)
      loadData()
    } catch { toast.error('Failed') }
  }

  async function handleSavePurchase() {
    if (!purchaseForm.inventory_id || !purchaseForm.quantity) return toast.error('Item and quantity required')
    try {
      await api.post('/purchases', { ...purchaseForm, total_cost: purchaseForm.quantity * purchaseForm.cost_per_unit })
      toast.success('Purchase recorded')
      setShowPurchaseModal(false)
      loadData()
    } catch { toast.error('Failed') }
  }

  const stockPct = item => Math.min(100, Math.round((item.stock / (item.min_stock * 3 || 1)) * 100))

  return (
    <div>
      {/* SUMMARY STRIP */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ flex: 1, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Tracked Items</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{inventory.length}</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Stock Value</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Below Minimum</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: lowStock.length > 0 ? 'var(--red)' : 'inherit' }}>{lowStock.length}</div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{
          background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(231,76,60,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17
          }}>⚠️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)' }}>
              {lowStock.length} item{lowStock.length > 1 ? 's' : ''} below minimum stock
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lowStock.map(i => i.name).join(' • ')}
            </div>
          </div>
          <button className="btn btn-sm" style={{ borderColor: 'var(--red)', color: 'var(--red)', flexShrink: 0 }}>
            📋 Generate PO
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <div className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>Stock Items</div>
          <div className={`tab ${tab === 'vendors' ? 'active' : ''}`} onClick={() => setTab('vendors')}>Vendors</div>
          <div className={`tab ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>Purchase Entries</div>
        </div>
        <div className="spacer" />
        {tab === 'items' && <button className="btn btn-primary" onClick={openNew}>+ Add Item</button>}
        {tab === 'vendors' && <button className="btn btn-primary" onClick={() => setShowVendorModal(true)}>+ Add Vendor</button>}
        {tab === 'purchases' && <button className="btn btn-primary" onClick={() => setShowPurchaseModal(true)}>+ New Entry</button>}
      </div>

      {tab === 'items' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ maxWidth: 320, flex: '1 1 220px', position: 'relative' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3 3" /></svg>
              <input placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: 4 }}
                >✕</button>
              )}
            </div>
            <select className="form-select" style={{ width: 160 }} value={cat} onChange={e => setCat(e.target.value)}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {filtered.length} of {inventory.length} item{inventory.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Stock Level</th><th>Current</th><th>Min Stock</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text3)' }}>
                        {inventory.length === 0
                          ? 'No inventory items yet — add your first one to get started.'
                          : 'No items match your search or filter.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td><span className="badge badge-gray">{item.category}</span></td>
                      <td style={{ width: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${stockPct(item)}%`, background: item.stock <= item.min_stock ? 'var(--red)' : 'var(--green)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text3)', width: 32, textAlign: 'right' }}>{stockPct(item)}%</span>
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 600 }}>{item.stock}</span> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{item.unit}</span></td>
                      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{item.min_stock} {item.unit}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm" title="Edit item" onClick={() => openEdit(item)}>✏️</button>
                          <button className="btn btn-sm btn-danger" title="Delete item" onClick={() => handleDelete(item)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'vendors' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Vendor Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text3)' }}>
                      No vendors added yet.
                    </td>
                  </tr>
                )}
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td>{v.contact_person || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td>{v.phone || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td>{v.email || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-sm" title="Edit vendor">✏️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'purchases' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Item</th><th>Vendor</th><th>Qty</th><th>Cost/Unit</th><th>Total</th></tr>
              </thead>
              <tbody>
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text3)' }}>
                      No purchase entries recorded yet.
                    </td>
                  </tr>
                )}
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text2)' }}>{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{p.item_name}</td>
                    <td>{p.vendor_name}</td>
                    <td>{p.quantity}</td>
                    <td>₹{p.cost_per_unit}</td>
                    <td style={{ fontWeight: 600 }}>₹{p.total_cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ITEM MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editing ? 'Edit Item' : 'Add Inventory Item'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {editing ? 'Update stock details for this ingredient.' : 'Track a new ingredient in your stock.'}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="e.g. Fresh Cream" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATS.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {['kg', 'g', 'L', 'ml', 'pcs', 'box'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Min Stock Level</label>
                <input className="form-input" type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cost per Unit</label>
              <input className="form-input" type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VENDOR MODAL */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVendorModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Add Vendor</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Save a supplier's details for future purchase entries.</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowVendorModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Name *</label>
              <input className="form-input" placeholder="e.g. Fresh Farms Co." value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input className="form-input" value={vendorForm.contact_person} onChange={e => setVendorForm(f => ({ ...f, contact_person: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={vendorForm.phone} onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={vendorForm.email} onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowVendorModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSaveVendor}>Add Vendor</button>
            </div>
          </div>
        </div>
      )}

      {/* PURCHASE MODAL */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPurchaseModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">New Purchase Entry</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Log a stock purchase to keep inventory levels accurate.</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowPurchaseModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Item *</label>
              <select className="form-select" value={purchaseForm.inventory_id} onChange={e => setPurchaseForm(f => ({ ...f, inventory_id: e.target.value }))}>
                <option value="">Select Item</option>
                {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor *</label>
              <select className="form-select" value={purchaseForm.vendor_id} onChange={e => setPurchaseForm(f => ({ ...f, vendor_id: e.target.value }))}>
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" value={purchaseForm.quantity} onChange={e => setPurchaseForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost per Unit</label>
                <input className="form-input" type="number" value={purchaseForm.cost_per_unit} onChange={e => setPurchaseForm(f => ({ ...f, cost_per_unit: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            {purchaseForm.quantity > 0 && purchaseForm.cost_per_unit > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, textAlign: 'right' }}>
                Total: <span style={{ fontWeight: 700 }}>₹{(purchaseForm.quantity * purchaseForm.cost_per_unit).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowPurchaseModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSavePurchase}>Record Purchase</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}