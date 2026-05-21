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

  return (
    <div>
      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{
          background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)' }}>
              {lowStock.length} item{lowStock.length > 1 ? 's' : ''} below minimum stock
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {lowStock.map(i => i.name).join(' • ')}
            </div>
          </div>
          <button className="btn btn-sm" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
            📋 Generate PO
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
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
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div className="search-box" style={{ maxWidth: 320 }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>
              <input placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 160 }} value={cat} onChange={e => setCat(e.target.value)}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Stock Level</th><th>Current</th><th>Min Stock</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td><span className="badge badge-gray">{item.category}</span></td>
                      <td style={{ width: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${Math.min(100, (item.stock/(item.min_stock*3 || 1))*100)}%`, background: item.stock <= item.min_stock ? 'var(--red)' : 'var(--green)' }} />
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 600 }}>{item.stock}</span> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{item.unit}</span></td>
                      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{item.min_stock} {item.unit}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => openEdit(item)}>✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>🗑️</button>
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
                <tr><th>Vendor Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td>{v.contact_person}</td>
                    <td>{v.phone}</td>
                    <td>{v.email}</td>
                    <td><button className="btn btn-sm">✏️</button></td>
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
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
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
              <div className="modal-title">{editing ? 'Edit Item' : 'Add Inventory Item'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
                  {['kg','g','L','ml','pcs','box'].map(u => <option key={u} value={u}>{u}</option>)}
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
            <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>Save Item</button>
          </div>
        </div>
      )}

      {/* VENDOR MODAL */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVendorModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Vendor</div>
              <button className="btn btn-sm" onClick={() => setShowVendorModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Name *</label>
              <input className="form-input" value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} />
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
            <button className="btn btn-primary w-full" onClick={handleSaveVendor}>Add Vendor</button>
          </div>
        </div>
      )}

      {/* PURCHASE MODAL */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPurchaseModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">New Purchase Entry</div>
              <button className="btn btn-sm" onClick={() => setShowPurchaseModal(false)}>✕</button>
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
            <button className="btn btn-primary w-full" onClick={handleSavePurchase}>Record Purchase</button>
          </div>
        </div>
      )}
    </div>
  )
}
