import React, { useEffect, useState } from 'react'
import { useStore, api } from '../store'
import toast from 'react-hot-toast'

const EMOJIS = ['🍛','🧀','🫕','🫓','🍮','🥛','🍗','🍚','🥣','🍔','☕','🐟','🍦','🍖','🥗','🍜','🥘','🫔','🥙','🍱']

export default function MenuBuilder() {
  const { menuItems, categories, fetchMenu, saveMenuItem, deleteMenuItem, saveCategory, deleteCategory } = useStore()
  const [tab, setTab] = useState('items')
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', category_id: '', price: '', cost: '', type: 'veg',
    description: '', emoji: '🍛', active: true,
    available_dine: true, available_takeaway: true, available_delivery: true,
    stock: 0, min_stock: 0, stock_required: false
  })

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [catForm, setCatForm] = useState({ name: '', icon: '🍽️' })

  useEffect(() => { fetchMenu() }, [])

  const filtered = menuItems.filter(i => {
    const catMatch = activeCat === 'all' || i.category_id === activeCat
    const searchMatch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  })

  function openNew() {
    setEditing(null)
    setForm({ name: '', category_id: categories[0]?.id || '', price: '', cost: '', type: 'veg', description: '', emoji: '🍛', active: true, available_dine: true, available_takeaway: true, available_delivery: true, stock: 0, min_stock: 0, stock_required: false })
    setShowModal(true)
  }
  function openEdit(item) {
    setEditing(item)
    setForm({ ...item })
    setShowModal(true)
  }
  async function handleSave() {
    if (!form.name || form.price === '') return toast.error('Name and price required')
    if (form.stock_required && (form.stock === '' || form.stock < 0)) return toast.error('Valid stock quantity is required when stock tracking is enabled')
    
    setSaving(true)
    try {
      await saveMenuItem(editing ? { ...form, id: editing.id } : form)
      toast.success(editing ? 'Item updated' : 'Item added')
      setShowModal(false)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }
  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return
    await deleteMenuItem(item.id)
    toast.success('Deleted')
  }
  async function toggleActive(item) {
    await saveMenuItem({ ...item, active: !item.active })
    toast.success(`${item.name} ${!item.active ? 'activated' : 'deactivated'}`)
  }

  async function handleSaveCategory() {
    if (!catForm.name) return toast.error('Name required')
    setSaving(true)
    try {
      await saveCategory(editingCat ? { ...catForm, id: editingCat.id } : { ...catForm, sort_order: categories.length + 1 })
      await fetchMenu()
      toast.success(editingCat ? 'Category updated' : 'Category added')
      setShowCatModal(false)
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleDeleteCategory(cat) {
    if (!confirm(`Delete category "${cat.name}"? This might affect items under this category.`)) return
    setSaving(true)
    try {
      await deleteCategory(cat.id)
      await fetchMenu()
      toast.success('Category deleted')
    } catch { toast.error('Delete failed') }
    finally { setSaving(false) }
  }

  function openNewCategory() {
    setEditingCat(null)
    setCatForm({ name: '', icon: '🍽️' })
    setShowCatModal(true)
  }

  function openEditCategory(cat) {
    setEditingCat(cat)
    setCatForm({ name: cat.name, icon: cat.icon })
    setShowCatModal(true)
  }

  async function handleClearAll() {
    if (!confirm('⚠️ WARNING: This will permanently delete all menu items and categories! Are you sure?')) return
    setSaving(true)
    try {
      // 1. Delete on Cloud Postgres
      await api.delete('/categories')
      
      // 2. Delete on local SQLite if in Electron
      if (window.ipcRenderer) {
        const outletId = useStore.getState().user?.outlet_id || 'out_main'
        await window.ipcRenderer.invoke('sqlite-run', 'DELETE FROM menu_items WHERE outlet_id = ?', [outletId])
        await window.ipcRenderer.invoke('sqlite-run', 'DELETE FROM categories WHERE outlet_id = ?', [outletId])
      }

      await fetchMenu()
      toast.success('All menu items and categories successfully deleted')
    } catch (err) {
      console.error('Clear failed', err)
      toast.error('Failed to clear menu data')
    } finally {
      setSaving(false)
    }
  }

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  return (
    <div className="menu-builder-container">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--orange-bg)' }}>🍽️</div>
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{menuItems.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-bg)' }}>✅</div>
          <div className="stat-label">Active Items</div>
          <div className="stat-value">{menuItems.filter(i => i.active).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--blue-bg)' }}>📁</div>
          <div className="stat-label">Categories</div>
          <div className="stat-value">{categories.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--purple-bg)' }}>🌱</div>
          <div className="stat-label">Veg Items</div>
          <div className="stat-value">{menuItems.filter(i => i.type === 'veg').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--red-bg)' }}>⚠️</div>
          <div className="stat-label">Low Stock</div>
          <div className="stat-value">{menuItems.filter(i => i.stock <= i.min_stock).length}</div>
        </div>
      </div>

      {/* Tabs + Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <div className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>Menu Items</div>
          <div className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Categories</div>
        </div>
        <div className="spacer" />
        {(menuItems.length > 0 || categories.length > 0) && (
          <button className="btn btn-danger" onClick={handleClearAll} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            🗑️ Clear All Data
          </button>
        )}
        {tab === 'items' ? (
          <button className="btn btn-primary" onClick={openNew}>+ Add Item</button>
        ) : (
          <button className="btn btn-primary" onClick={openNewCategory}>+ Add Category</button>
        )}
      </div>

      {tab === 'items' && (
        <>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <div className="search-box" style={{ maxWidth: 280 }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>
              <input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              <button className={`btn btn-sm ${activeCat === 'all' ? 'btn-primary' : ''}`} onClick={() => setActiveCat('all')}>All</button>
              {categories.map(c => (
                <button key={c.id} className={`btn btn-sm ${activeCat === c.id ? 'btn-primary' : ''}`} onClick={() => setActiveCat(c.id)} style={{ whiteSpace: 'nowrap' }}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="menu-builder-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Channels</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{item.emoji}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 16 }}>{item.name}</div>
                              <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-gray">{catMap[item.category_id]?.icon} {catMap[item.category_id]?.name}</span></td>
                        <td>
                          <span className={`badge ${item.type === 'veg' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>{item.type}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{item.price}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {item.available_dine && <span className="badge badge-gray" style={{ padding: '3px 8px', fontSize: 12 }}>🪑</span>}
                            {item.available_takeaway && <span className="badge badge-gray" style={{ padding: '3px 8px', fontSize: 12 }}>🛍️</span>}
                            {item.available_delivery && <span className="badge badge-gray" style={{ padding: '3px 8px', fontSize: 12 }}>🛵</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, color: (item.stock || 0) <= (item.min_stock || 0) ? 'var(--red)' : 'inherit' }}>
                              {parseInt(item.stock || 0)} qty
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Min: {parseInt(item.min_stock || 0)}</div>
                          </div>
                        </td>
                        <td>
                          <button onClick={() => toggleActive(item)} className={`badge ${item.active ? 'badge-success' : 'badge-danger'}`} style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                            {item.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm" onClick={() => openEdit(item)}>✏️</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {categories.map(cat => (
            <div key={cat.id} className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>{cat.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 17 }}>{cat.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                {menuItems.filter(i => i.category_id === cat.id).length} items
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
                <button className="btn btn-sm" onClick={() => openEditCategory(cat)} style={{ padding: '6px 12px', fontSize: 13 }}>✏️ Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCategory(cat)} style={{ padding: '6px 12px', fontSize: 13 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ITEM MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ width: 720 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Edit Menu Item' : 'Add Menu Item'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Emoji picker */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Icon</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{
                    width: 36, height: 36, fontSize: 20, borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${form.emoji === e ? 'var(--orange)' : 'var(--border)'}`,
                    background: form.emoji === e ? 'var(--orange-bg)' : 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{e}</button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Item name" />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                {categories.length > 0 ? (
                  <select className="form-select" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="" disabled>Select a category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                ) : (
                  <div style={{ padding: '8px 12px', background: 'var(--orange-bg)', borderRadius: 8, fontSize: 12, color: 'var(--orange)', border: '1px solid var(--orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⚠️ No categories found.</span>
                    <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => { setShowModal(false); setTab('categories') }}>Create One First</button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Price (₹) *</label>
                <input className="form-input" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 16 }}>
                <input type="checkbox" id="stock_req" checked={form.stock_required} onChange={e => setForm(f => ({ ...f, stock_required: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                <label htmlFor="stock_req" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Track Stock & Require Entry</label>
              </div>
            </div>
            
            {form.stock_required && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Current Stock *</label>
                  <input className="form-input" type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value === '' ? '' : parseFloat(e.target.value) }))} placeholder="Enter stock quantity" />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Stock (Alert)</label>
                  <input className="form-input" type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value === '' ? '' : parseFloat(e.target.value) }))} />
                </div>
              </div>
            )}
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div>
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {['veg','non-veg','egg'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`btn btn-sm ${form.type === t ? 'btn-primary' : ''}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Available On</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {[['available_dine','🪑 Dine-in'],['available_takeaway','🛍️ Takeaway'],['available_delivery','🛵 Delivery']].map(([k, label]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, [k]: !f[k] }))} className={`btn btn-sm ${form[k] ? 'btn-primary' : ''}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : (editing ? '✓ Save Changes' : '+ Add Item')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCatModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal" style={{ width: 360 }}>
            <div className="modal-header">
              <div className="modal-title">{editingCat ? 'Edit Category' : 'Add Category'}</div>
              <button className="btn btn-sm" onClick={() => setShowCatModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setCatForm(f => ({ ...f, icon: e }))} style={{
                    width: 34, height: 34, fontSize: 18, borderRadius: 6, cursor: 'pointer',
                    border: `2px solid ${catForm.icon === e ? 'var(--orange)' : 'var(--border)'}`,
                    background: catForm.icon === e ? 'var(--orange-bg)' : 'var(--bg)',
                  }}>{e}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Category Name *</label>
              <input className="form-input" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Soups" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowCatModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSaveCategory} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : (editingCat ? '✓ Save Changes' : '+ Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
