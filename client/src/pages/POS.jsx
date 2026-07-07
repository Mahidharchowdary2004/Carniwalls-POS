import React, { useEffect, useState } from 'react'
import { useStore, api } from '../store'
import toast from 'react-hot-toast'

const ORDER_TYPES = [
  { key: 'dine-in', label: 'DINE IN', icon: '🍽️', cls: 'dine' },
  { key: 'delivery', label: 'DELIVERY', icon: '🛵', cls: 'delivery' },
  { key: 'takeaway', label: 'TAKE AWAY', icon: '🛍️', cls: 'takeaway' },
]

export default function POS() {
  const { tables, menuItems, categories, activeOrders,
    fetchTables, fetchMenu, fetchOrders,
    createOrder, updateOrder, cancelOrder, generateBill, posState, setPosState } = useStore()

  const fsFontSize = parseInt(localStorage.getItem('pos_print_font_size')) || 16;
  const { orderType, selectedTable, activeOrderId, cart, originalCart, customerName, discount, discountType, editingBillId, editingBillNo, billPrinted } = posState

  const cartChanged = React.useMemo(() => {
    return JSON.stringify(cart) !== JSON.stringify(originalCart || [])
  }, [cart, originalCart])

  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('all')
  const [step, setStep] = useState('tables') // 'tables' | 'items'
  const [printMode, setPrintMode] = useState('kot')
  const [kotPrintItems, setKotPrintItems] = useState([])
  const [payMethod, setPayMethod] = useState('cash')
  const [showPay, setShowPay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [splitPay, setSplitPay] = useState(false)
  const [splitAmts, setSplitAmts] = useState({ cash: 0, card: 0, upi: 0, not_paid: 0, due: 0, online: 0, cod: 0, other: 0 })
  const [lastBill, setLastBill] = useState(null)

  const { subtotal, discountAmt, total, isInvalidDiscount } = React.useMemo(() => {
    const s = cart.reduce((sum, i) => sum + (Number(i.price || 0) * i.qty), 0)
    const base = s
    const dAmt = discountType === 'pct' ? Math.round(base * (discount / 100)) : discount
    const invalid = dAmt > base
    return { subtotal: s, discountAmt: dAmt, total: invalid ? base : base - dAmt, isInvalidDiscount: invalid }
  }, [cart, discount, discountType])

  useEffect(() => { fetchTables(); fetchMenu(); fetchOrders() }, [])

  // When switching to takeaway/delivery, skip table selection, or if editing a bill
  useEffect(() => {
    if (editingBillId) {
      setStep('items')
    } else if (orderType !== 'dine-in') {
      setPosState({ selectedTable: null })
      setStep('items')
    } else {
      setStep('tables')
    }
  }, [orderType, editingBillId])

  // Print reply listener
  useEffect(() => {
    if (window.ipcRenderer) {
      const handlePrintReply = (event, data) => {
        if (data.success) {
          toast.success('🖨️ Printing started')
        } else {
          toast.error(`🖨️ Print Failed: ${data.failureReason || 'Printer offline'}`)
        }
      }
      window.ipcRenderer.on('print-reply', handlePrintReply)
    }
  }, [])

  // Reset split state when opening modal
  useEffect(() => {
    if (showPay) {
      setSplitPay(false)
      setSplitAmts({ cash: total, card: 0, upi: 0, not_paid: 0, due: 0, online: 0, cod: 0, other: 0 })
    }
  }, [showPay])

  // Sync splitAmts with total changes (e.g. when discount changes)
  useEffect(() => {
    if (splitPay) {
      const other = (splitAmts.card || 0) + (splitAmts.upi || 0) + (splitAmts.not_paid || 0) + (splitAmts.due || 0) + (splitAmts.online || 0) + (splitAmts.cod || 0) + (splitAmts.other || 0)
      setSplitAmts(prev => ({ ...prev, cash: Math.max(0, total - other) }))
    }
  }, [total])

  // Auto-save cart to database
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cart.length > 0 && selectedTable && !editingBillId && !saving) {
        syncOrder();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [cart, customerName, editingBillId, saving]);

  async function syncOrder() {
    try {
      const payload = {
        table_id: selectedTable?.id,
        items: cart.map(i => ({ id: i.id, menu_item_id: i.id, name: i.name, price: i.price, qty: i.qty })),
        order_type: orderType,
        customer_name: customerName || undefined
      }
      if (activeOrderId) {
        await updateOrder(activeOrderId, payload)
      } else {
        const ord = await createOrder(payload)
        setPosState({ activeOrderId: ord.id })
      }
      fetchOrders()
      fetchTables()
    } catch (e) { console.error('Auto-save failed', e) }
  }

  const sections = ['all', ...new Set(tables.map(t => t.section))]
  const visibleTables = (section === 'all' ? tables : tables.filter(t => t.section === section))
    .sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0))

  const filteredMenu = menuItems.filter(i => {
    const itemCat = i.category_id || i.category;
    const catOk = activeCat === 'all' || String(itemCat) === String(activeCat)
    const srchOk = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return catOk && srchOk && i.active !== false
  })


  /* ── TABLE SELECT ── */
  function selectTable(table) {
    const existing = activeOrders.find(o => String(o.table_id) === String(table.id))
    if (existing) {
      let items = existing.items
      if (typeof items === 'string') {
        try { items = JSON.parse(items) } catch (e) { items = [] }
      }
      setPosState({ selectedTable: table, activeOrderId: existing.id, cart: items || [], originalCart: items || [], discount: 0, billPrinted: false })
    } else {
      setPosState({ selectedTable: table, activeOrderId: null, cart: [], originalCart: [], discount: 0, billPrinted: false })
    }
    setStep('items')
  }

  /* ── CART ── */
  function addItem(item) {
    if (parseFloat(item.stock || 0) <= 0) {
      toast.error(`${item.name} is out of stock!`);
      return;
    }
    const ex = cart.find(i => i.id === item.id)
    if (ex && ex.qty >= parseFloat(item.stock || 0)) {
      toast.error(`Cannot add more. Only ${parseFloat(item.stock || 0)} in stock!`);
      return;
    }
    const newCart = ex ? cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      : [...cart, { ...item, qty: 1 }]
    setPosState({ cart: newCart })
    toast.success(`${item.name} added`, { icon: '🛒', duration: 800, position: 'bottom-center' })
  }
  function changeQty(id, delta) {
    const itemInMenu = menuItems.find(i => i.id === id);
    const stockLimit = itemInMenu ? parseFloat(itemInMenu.stock || 0) : 999;

    let hitLimit = false;
    const newCart = cart.map(i => {
      if (i.id === id) {
        if (delta > 0 && i.qty >= stockLimit) {
          hitLimit = true;
          return i;
        }
        return { ...i, qty: i.qty + delta };
      }
      return i;
    }).filter(i => i.qty > 0)

    if (hitLimit) {
      toast.error(`Cannot add more. Only ${stockLimit} in stock!`);
    } else {
      setPosState({ cart: newCart })
    }
  }
  function removeItem(id) {
    setPosState({ cart: cart.filter(i => i.id !== id) })
  }

  /* ── KOT ── */
  async function printKOT() {
    if (!cart.length) return toast.error('Add items first')
    setSaving(true)
    try {
      await syncOrder() // Ensure latest state is saved
      const oId = activeOrderId || useStore.getState().posState.activeOrderId;
      if (oId) {
        await updateOrder(oId, { kot_printed: true });
        await fetchOrders();
      }

      const oldCartMap = {}
      ;(originalCart || []).forEach(i => { oldCartMap[i.id] = (oldCartMap[i.id] || 0) + i.qty })
      const diffItems = cart.map(i => ({ ...i, qty: i.qty - (oldCartMap[i.id] || 0) })).filter(i => i.qty > 0)
      
      const itemsToPrint = (diffItems.length === 0) ? cart : diffItems
      setKotPrintItems(itemsToPrint)
      setPosState({ originalCart: cart })

      toast.success('KOT Sent to Kitchen', { icon: '👨‍🍳' })
      setPrintMode('kot')
      setTimeout(async () => {
        if (window.ipcRenderer) {
          const printerName = localStorage.getItem('pos_printer') || ''
          const printScale = localStorage.getItem('pos_print_scale') || 100
          try {
            await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
          } catch (err) {
            console.warn('print-silent invoke failed, falling back to send:', err)
            window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
          }
        } else {
          window.print()
        }
      }, 100);
    } catch (e) { toast.error('KOT Failed') }
    finally { setSaving(false) }
  }

  async function printBillAndKot() {
    if (!cart.length) return toast.error('Add items first')
    setPrintMode('both')
    
    setSaving(true)
    try {
      await syncOrder()
      const oId = activeOrderId || useStore.getState().posState.activeOrderId;
      if (oId) {
        await updateOrder(oId, { kot_printed: true });
        await fetchOrders();
      }

      const oldCartMap = {}
      ;(originalCart || []).forEach(i => { oldCartMap[i.id] = (oldCartMap[i.id] || 0) + i.qty })
      const diffItems = cart.map(i => ({ ...i, qty: i.qty - (oldCartMap[i.id] || 0) })).filter(i => i.qty > 0)
      
      const itemsToPrint = (diffItems.length === 0) ? cart : diffItems
      setKotPrintItems(itemsToPrint)
      setPosState({ originalCart: cart, billPrinted: true })
    } catch (e) { console.error('KOT save failed', e) }
    finally { setSaving(false) }

    setTimeout(async () => {
      if (window.ipcRenderer) {
        const printerName = localStorage.getItem('pos_printer') || ''
        const printScale = localStorage.getItem('pos_print_scale') || 100
        try {
          await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
        } catch (err) {
          console.warn('print-silent invoke failed, falling back to send:', err)
          window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
        }
      } else {
        window.print()
      }
    }, 100);
  }

  async function printPreBill() {
    if (!cart.length) return toast.error('Add items first')
    setPrintMode('bill')
    setPosState({ billPrinted: true })
    setTimeout(async () => {
      if (window.ipcRenderer) {
        const printerName = localStorage.getItem('pos_printer') || ''
        const printScale = localStorage.getItem('pos_print_scale') || 100
        try {
          await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
        } catch (err) {
          console.warn('print-silent invoke failed, falling back to send:', err)
          window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
        }
      } else {
        window.print()
      }
    }, 100);
  }

  /* ── BILL ── */
  async function confirmBill() {
    if (!cart.length) return toast.error('Add items first')
    setSaving(true)
    try {
      if (editingBillId) {
        const payload = {
          items: cart,
          discount: discountAmt,
          payment_method: splitPay ? splitAmts : { [payMethod]: total }
        }
        await api.put(`/bills/${editingBillId}`, payload)
        toast.success(`✅ Bill Updated`)

        setShowPay(false);
        setLastBill({ bill_no: editingBillNo });
        setPrintMode('bill')
        setTimeout(async () => {
          if (window.ipcRenderer) {
            const printerName = localStorage.getItem('pos_printer') || ''
            const printScale = localStorage.getItem('pos_print_scale') || 100
            try {
              await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
            } catch (err) {
              console.warn('print-silent invoke failed, falling back to send:', err)
              window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
            }
          } else {
            window.print()
          }
          setPosState({ cart: [], originalCart: [], activeOrderId: null, selectedTable: null, discount: 0, discountType: 'amt', customerName: '', editingBillId: null, editingBillNo: null })
          setStep(orderType === 'dine-in' ? 'tables' : 'items')
          fetchTables()
        }, 300);
        setSaving(false);
        return;
      }

      let orderId = activeOrderId
      if (!orderId) {
        const payload = {
          table_id: selectedTable?.id,
          items: cart.map(i => ({ id: i.id, menu_item_id: i.id, name: i.name, price: i.price, qty: i.qty })),
          order_type: orderType,
          customer_name: customerName || undefined
        }
        const ord = await createOrder(payload)
        orderId = ord.id
      }

      const payData = splitPay ? splitAmts : { [payMethod]: total }
      const bill = await generateBill(orderId, payData, discountAmt)
      setShowPay(false);
      setLastBill(bill);
      toast.success(`✅ Bill ₹${bill.total} — ${payMethod.toUpperCase()}`)

      const needsKOT = !activeOrderId || !(activeOrders.find(o => o.id === activeOrderId)?.kot_printed);

      const printFinalBill = () => {
        setPrintMode('bill')
        setTimeout(async () => {
          if (window.ipcRenderer) {
            const printerName = localStorage.getItem('pos_printer') || ''
            const printScale = localStorage.getItem('pos_print_scale') || 100
            try {
              await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
            } catch (err) {
              console.warn('print-silent invoke failed, falling back to send:', err)
              window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
            }
          } else {
            window.print()
          }
          setPosState({ cart: [], originalCart: [], activeOrderId: null, selectedTable: null, discount: 0, discountType: 'amt', customerName: '', editingBillId: null, editingBillNo: null })
          setStep(orderType === 'dine-in' ? 'tables' : 'items')
          fetchTables()
        }, 300);
      };

      if (needsKOT && !editingBillId) {
        setPrintMode('kot')
        setTimeout(async () => {
          if (window.ipcRenderer) {
            const printerName = localStorage.getItem('pos_printer') || ''
            const printScale = localStorage.getItem('pos_print_scale') || 100
            try {
              await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
            } catch (err) {
              console.warn('print-silent invoke failed, falling back to send:', err)
              window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
            }
          } else {
            window.print()
          }
          setTimeout(printFinalBill, 500);
        }, 300);
      } else {
        printFinalBill();
      }
    } catch (err) { toast.error('Billing failed') }
    finally { setSaving(false) }
  }

  const tbColor = { free: '#e2e6ec', occupied: '#c0392b', reserved: '#2980b9' }

  const getCat = (id) => categories.find(c => String(c.id) === String(id))

  const currentOrder = activeOrders.find(o => o.id === activeOrderId);
  const displayTokenNo = currentOrder?.token_no || '1';
  const displayBillNo = lastBill?.bill_no || displayTokenNo;

  return (
    <div className="pos-root" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', overflow: 'hidden', background: '#f4f6f9' }}>
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* ── ORDER TYPE BAR (Petpooja style) ── */}
      <div className="pos-topbar">
        {editingBillId && (
          <div style={{ background: '#f39c12', color: '#fff', padding: '0 14px', display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: 14 }}>
            Editing Bill #{editingBillNo}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: '100%', width: 400 }}>
          <input className="form-input" placeholder="🔍 Search menu item..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', height: 40, padding: '0 14px', fontSize: 14, borderRadius: 20 }} />
        </div>
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        {selectedTable && (
          <div style={{ padding: '0 14px', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#c0392b', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              Table {selectedTable.number}
            </span>
            <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => { setStep('tables'); setPosState({ selectedTable: null, cart: [] }); }}>Change</button>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ═══════════ LEFT PANEL ═══════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* STEP 1: TABLE SELECTION */}
          {step === 'tables' && orderType === 'dine-in' && (
            <div style={{ flex: 1, overflow: 'auto', background: '#f4f6f9' }}>
              {/* Section tabs */}
              <div style={{ display: 'flex', gap: 6, padding: '10px 14px', background: '#fff', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {sections.map(s => (
                  <button key={s} className={`section-tab ${section === s ? 'active' : ''}`} onClick={() => setSection(s)}>
                    {s === 'all' ? 'All Sections' : s}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#fff', border: '2px solid #e2e6ec', borderRadius: 2, display: 'inline-block' }} /> Free</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#fff5f5', border: '2px solid #c0392b', borderRadius: 2, display: 'inline-block' }} /> Occupied</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#eff6ff', border: '2px solid #2980b9', borderRadius: 2, display: 'inline-block' }} /> Reserved</span>
                </div>
              </div>

              {/* Table grid */}
              <div style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 10 }}>
                  {visibleTables.map(table => {
                    const hasOrder = activeOrders.find(o => String(o.table_id) === String(table.id))
                    return (
                      <div
                        key={table.id}
                        className={`table-cell ${table.status} ${selectedTable?.id === table.id ? 'selected' : ''}`}
                        onClick={() => selectTable(table)}
                        style={{ padding: '12px 10px', minHeight: 110, height: 'auto', position: 'relative' }}
                      >
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 48, fontWeight: 900, color: 'var(--text)', opacity: 0.2, lineHeight: 1 }}>{String(table.number).replace(/^T-?/i, '')}</div>
                        {hasOrder && (
                          <div style={{ marginTop: 'auto', paddingTop: 8, width: '100%', display: 'flex', gap: 6, alignItems: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 900, color: '#c0392b', marginRight: 'auto' }}>
                              ₹{(() => {
                                let items = hasOrder.items;
                                if (typeof items === 'string') {
                                  try { items = JSON.parse(items) } catch (e) { items = [] }
                                }
                                return Array.isArray(items) ? items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(0) : 0;
                              })()}
                            </div>
                            <div
                              onClick={(e) => { e.stopPropagation(); selectTable(table); setTimeout(() => setShowPay(true), 50); }}
                              style={{ background: 'var(--primary-bg)', color: 'var(--primary)', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Settle Amount"
                            >
                              💳
                            </div>
                            <div
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (window.confirm(`Clear Table ${table.number} and cancel active order?`)) {
                                  cancelOrder(hasOrder.id);
                                  toast.success(`Table ${table.number} cleared`);
                                }
                              }}
                              style={{ background: '#fce4e4', color: '#c0392b', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Clear Table"
                            >
                              🧹
                            </div>
                          </div>
                        )}
                        {hasOrder && <div style={{ width: 10, height: 10, background: '#c0392b', borderRadius: '50%', position: 'absolute', top: 6, right: 6, border: '2px solid #fff' }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MENU ITEMS */}
          {step === 'items' && (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Category Sidebar */}
              <div style={{ width: 120, background: '#fff', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
                <button
                  onClick={() => setActiveCat('all')}
                  style={{
                    padding: '12px 8px', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center',
                    background: activeCat === 'all' ? '#fff5f5' : 'transparent',
                    color: activeCat === 'all' ? '#c0392b' : '#5a6478',
                    borderLeft: activeCat === 'all' ? '4px solid #c0392b' : '4px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>🍽️</div>
                  ALL
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    style={{
                      padding: '12px 8px', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center',
                      background: activeCat === c.id ? '#fff5f5' : 'transparent',
                      color: activeCat === c.id ? '#c0392b' : '#5a6478',
                      borderLeft: activeCat === c.id ? '4px solid #c0392b' : '4px solid transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{c.icon}</div>
                    {c.name.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Menu grid — Petpooja style white boxes */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#f4f6f9' }}>
                {filteredMenu.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                    <div>No items found</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 8 }}>
                    {filteredMenu.map(item => {
                      const inCart = cart.find(c => c.id === item.id)
                      return (
                        <div
                          key={item.id}
                          className={`menu-item-card ${inCart ? 'in-cart' : ''}`}
                          onClick={() => addItem(item)}
                          style={{ opacity: parseFloat(item.stock || 0) <= 0 ? 0.5 : 1, cursor: parseFloat(item.stock || 0) <= 0 ? 'not-allowed' : 'pointer' }}
                        >
                          {inCart && (
                            <div style={{ position: 'absolute', top: 6, right: 6, background: '#c0392b', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                              {inCart.qty}
                            </div>
                          )}
                          <div style={{ fontSize: 24, marginBottom: 6, display: 'block' }}>{item.emoji}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>{getCat(item.category_id)?.icon}</span>
                            <span>{getCat(item.category_id)?.name || ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                            <span className={item.type === 'veg' ? 'veg-dot' : 'nonveg-dot'} style={{ marginTop: 2, flexShrink: 0 }} />
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{item.name}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#c0392b' }}>₹{item.price}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: (item.stock || 0) <= 0 ? '#c0392b' : '#27ae60' }}>Qty: {parseInt(item.stock || 0)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ RIGHT PANEL — ORDER CART (Petpooja style) ═══════════ */}
        {step === 'items' && (
          <div style={{ width: 420, background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {/* Order Modes in Cart */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8f9fb', height: 64 }}>
              <div style={{ display: 'flex', flex: 1 }}>
                {ORDER_TYPES.map(t => (
                  <button
                    key={t.key}
                    className={`pos-type-btn ${orderType === t.key ? `active-${t.cls}` : ''}`}
                    style={{ opacity: orderType === t.key ? 1 : 0.38, flex: 1 }}
                    onClick={() => setPosState({ orderType: t.key })}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span>{t.icon}</span>
                      <span style={{ fontSize: 10 }}>{t.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers — like Petpooja */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 80px', gap: 4, padding: '7px 10px', background: '#f0f2f5', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <div>ITEMS</div>
              <div style={{ textAlign: 'center' }}>CHECK ITEMS</div>
              <div style={{ textAlign: 'center' }}>QTY.</div>
              <div style={{ textAlign: 'right' }}>PRICE</div>
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>🛒</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {step === 'tables' ? 'Select a table first' : 'Tap items to add to order'}
                  </div>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 80px', gap: 4, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {getCat(item.category_id)?.name || ''}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text3)' }}>₹{item.price}</div>
                  </div>
                  {/* Remove X button (Petpooja style) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button onClick={() => removeItem(item.id)} style={{ width: 18, height: 18, borderRadius: '50%', background: '#e74c3c', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'inherit', lineHeight: 1 }}>✕</button>
                  </div>
                  {/* Qty controls */}
                  <div className="qty-ctrl" style={{ justifyContent: 'center' }}>
                    <button className="qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                    <span className="qty-val">{item.qty}</span>
                    <button className="qty-btn" onClick={() => changeQty(item.id, 1)}>+</button>
                  </div>
                  {/* Price */}
                  <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    {(Number(item.price || 0) * item.qty).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>


            {/* Totals + Bill actions */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: '#f8f9fb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)', marginBottom: 3 }}>
                <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
              </div>

              {discountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#27ae60', marginBottom: 6 }}>
                  <span>Discount {discountType === 'pct' ? `(${discount}%)` : ''}</span><span>−₹{discountAmt.toFixed(2)}</span>
                </div>
              )}

              {/* Total — big like Petpooja */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Total</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#c0392b' }}>₹{total.toFixed(0)}</span>
              </div>



              {/* Action buttons — KOT & Bill */}
              <div style={{ display: 'grid', gridTemplateColumns: (activeOrders.find(o => o.id === activeOrderId)?.kot_printed && !cartChanged) ? '1fr' : '1fr 1fr', gap: 8 }}>
                {editingBillId ? (
                  <button className="btn" onClick={() => {
                    setLastBill({ bill_no: editingBillNo });
                    setPrintMode('bill');
                    setTimeout(async () => {
                      if (window.ipcRenderer) {
                        const printerName = localStorage.getItem('pos_printer') || ''
                        const printScale = localStorage.getItem('pos_print_scale') || 100
                        try {
                          await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale })
                        } catch (err) {
                          console.warn('print-silent invoke failed, falling back to send:', err)
                          window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
                        }
                      } else {
                        window.print()
                      }
                    }, 100);
                  }} style={{ fontSize: 15, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2980b9', color: '#fff', border: 'none', gridColumn: '1 / -1' }}>
                    🖨️ Reprint Bill
                  </button>
                ) : (
                  <>
                    {(activeOrders.find(o => o.id === activeOrderId)?.kot_printed && !cartChanged) ? (
                      billPrinted ? (
                        <button className="bill-btn" onClick={() => { if (!cart.length) { toast.error('No items'); return; } setShowPay(true) }}
                          style={{ fontSize: 15, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          💳 Settle
                        </button>
                      ) : (
                        <button className="btn" onClick={printPreBill} disabled={!cart.length || saving}
                          style={{ fontSize: 15, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f39c12', color: '#fff', border: 'none' }}>
                          🖨️ Print Bill
                        </button>
                      )
                    ) : (
                      <button className="btn" onClick={printBillAndKot} disabled={!cart.length || saving}
                        style={{ fontSize: 15, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f39c12', color: '#fff', border: 'none' }}>
                        🖨️ Print Bill & KOT
                      </button>
                    )}
                  </>
                )}
                {(!(activeOrders.find(o => o.id === activeOrderId)?.kot_printed) || cartChanged) && !editingBillId && (
                  <button className="btn" onClick={printKOT} disabled={!cart.length || saving}
                    style={{ fontSize: 15, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2c3e50', color: '#fff', border: 'none' }}>
                    {saving ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : '👨‍🍳 Print KOT'}
                  </button>
                )}
              </div>

              {(cart.length > 0 || editingBillId) && (
                <button onClick={() => setPosState({ cart: [], originalCart: [], discount: 0, activeOrderId: null, editingBillId: null, editingBillNo: null, billPrinted: false })}
                  style={{ width: '100%', marginTop: 6, padding: '6px', background: 'none', border: '1px solid #95a5a6', color: '#7f8c8d', borderRadius: 'var(--radius)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ PAYMENT MODAL ═══════════ */}
      {showPay && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPay(false)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, background: '#c0392b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧾</div>
                <div>
                  <div className="modal-title">Generate Bill</div>
                  {selectedTable && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Table {selectedTable.number} — {selectedTable.section}</div>}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowPay(false)}>✕</button>
            </div>

            {/* Order summary */}
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16 }}>
              {cart.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 6, color: 'var(--text2)' }}>
                  <span>{i.name} × {i.qty}</span>
                  <span>₹{(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 8 }}>
                {[['Subtotal', `₹${subtotal.toFixed(2)}`],
                ].map(([l, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}><span>{l}</span><span>{v}</span></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#c0392b', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span>Grand Total</span><span>₹{total.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Discount */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Discount</label>
                <div style={{ display: 'flex', gap: 4, background: '#f0f2f5', padding: 2, borderRadius: 6 }}>
                  <button
                    onClick={() => setPosState({ discountType: 'amt' })}
                    style={{ border: 'none', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer', background: discountType === 'amt' ? '#fff' : 'transparent', boxShadow: discountType === 'amt' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >₹ Amt</button>
                  <button
                    onClick={() => setPosState({ discountType: 'pct' })}
                    style={{ border: 'none', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer', background: discountType === 'pct' ? '#fff' : 'transparent', boxShadow: discountType === 'pct' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >% Pct</button>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  className={`form-input ${isInvalidDiscount ? 'invalid' : ''}`}
                  type="number"
                  value={discount}
                  min={0}
                  onChange={e => setPosState({ discount: parseFloat(e.target.value) || 0 })}
                  style={{ borderColor: isInvalidDiscount ? '#e74c3c' : '' }}
                />
                {discountType === 'pct' && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)' }}>%</span>}
                {discountType === 'amt' && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)' }}>₹</span>}
              </div>
              {isInvalidDiscount && <div style={{ color: '#e74c3c', fontSize: 10, fontWeight: 700, marginTop: 4 }}>⚠️ Invalid discount: Exceeds total amount!</div>}
              {discountType === 'pct' && discount > 0 && !isInvalidDiscount && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Equivalent to ₹{discountAmt} discount</div>
              )}
            </div>

            {/* Payment methods */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Payment Method</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: splitPay ? '#c0392b' : 'var(--text3)' }}>
                <input type="checkbox" checked={splitPay} onChange={e => { setSplitPay(e.target.checked); if (e.target.checked) setSplitAmts({ cash: total, card: 0, upi: 0, not_paid: 0, due: 0, online: 0, cod: 0, other: 0 }) }} />
                Split Payment
              </label>
            </div>

            {splitPay ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, background: '#f8f9fb', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
                {[
                  ['cash', '💵 Cash'],
                  ['card', '💳 Card'],
                  ['upi', '📱 UPI'],
                  ['not_paid', '❌ Not Paid'],
                  ['due', '⏳ Due Payment'],
                  ['online', '🌐 Online Order'],
                  ['cod', '🛵 Online COD'],
                  ['other', '⚙️ Other']
                ].map(([m, label]) => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                    <input
                      className="form-input"
                      type="number"
                      value={splitAmts[m] || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        const newAmts = { ...splitAmts, [m]: val };
                        if (m !== 'cash') {
                          const other = Object.keys(splitAmts)
                            .filter(k => k !== 'cash' && k !== m)
                            .reduce((sum, k) => sum + (splitAmts[k] || 0), 0) + val;
                          newAmts.cash = Math.max(0, total - other);
                        }
                        setSplitAmts(newAmts);
                      }}
                      style={{ maxWidth: 100, textAlign: 'right', height: 30, fontSize: 13 }}
                      placeholder="0"
                    />
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: (Object.values(splitAmts).reduce((a, b) => a + b, 0) === total) ? '#27ae60' : '#c0392b' }}>
                  <span>Allocated: ₹{Object.values(splitAmts).reduce((a, b) => a + b, 0)}</span>
                  <span>Balance: ₹{total - Object.values(splitAmts).reduce((a, b) => a + b, 0)}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
                {[
                  ['cash', '💵', 'Cash'],
                  ['card', '💳', 'Card'],
                  ['upi', '📱', 'UPI / QR'],
                  ['not_paid', '❌', 'Not Paid'],
                  ['due', '⏳', 'Due Payment'],
                  ['online', '🌐', 'Online Order'],
                  ['cod', '🛵', 'Online COD'],
                  ['other', '⚙️', 'Other']
                ].map(([m, icon, label]) => (
                  <button key={m} onClick={() => setPayMethod(m)} style={{
                    padding: '12px 8px', borderRadius: 'var(--radius)', fontFamily: 'inherit',
                    border: `2px solid ${payMethod === m ? '#c0392b' : 'var(--border)'}`,
                    background: payMethod === m ? '#fff5f5' : '#fff',
                    color: payMethod === m ? '#c0392b' : 'var(--text2)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'center'
                  }}>{icon}<br />{label}</button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowPay(false)}>Cancel</button>
              <button className="bill-btn" style={{ flex: 2, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={confirmBill} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : `✓ Confirm & Print — ₹${total.toFixed(0)}`}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* THERMAL PRINTER RECEIPT / KOT FORMAT (Hidden on screen, visible only when printing) */}
      <div className="print-only receipt-content">
        {(printMode === 'kot' || printMode === 'both') && (
          <div className="kot-print-block">
            <div style={{ textAlign: 'center', marginBottom: 4, fontSize: `${fsFontSize}px`, fontWeight: 'bold' }}>
              <div>{new Date().toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' })} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
              <div>KOT - {displayTokenNo}</div>
              <div>{orderType === 'dine-in' ? 'dine in' : orderType}</div>
              <div>Table No: {selectedTable?.number || 'N/A'}</div>
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />
            <table style={{ width: '100%', fontSize: `${fsFontSize}px`, fontWeight: 'bold', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '75%', textAlign: 'left', padding: '2px 0' }}>Item</th>
                  <th style={{ width: '25%', textAlign: 'right', padding: '2px 0' }}>Qty.</th>
                </tr>
              </thead>
              <tbody>
                {(kotPrintItems.length ? kotPrintItems : cart).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ width: '75%', textAlign: 'left', padding: '2px 0', wordBreak: 'break-word', whiteSpace: 'normal' }}>{item.name}</td>
                    <td style={{ width: '25%', textAlign: 'right', padding: '2px 0' }}>{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printMode === 'both' && <div style={{ height: '40px', borderBottom: '2px dashed #000', marginBottom: '20px' }} />}

        {(printMode === 'bill' || printMode === 'both') && (
          <div className="bill-print-block">
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: `${fsFontSize * 1.25}px`, marginTop: '10px' }}>
              BABA DAIRY MILK PRODUCTS
            </div>
            <div style={{ textAlign: 'center', fontSize: `${Math.round(fsFontSize * 0.9375)}px`, fontWeight: 'bold', margin: '4px 0' }}>
              D.NO. 2-13-80, Servey No. 411-A,<br />
              411-B, 2nd Ward<br />
              East Side of National Highway Road<br />
              Sri Potti Sriramulu Nellore Andhar<br />
              pradesh -5241437
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ fontSize: `${fsFontSize}px`, fontWeight: 'bold', margin: '2px 0' }}>
              Name: {customerName || ''}
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fsFontSize}px`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              <span>Date: {new Date().toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' })}</span>
              <span>dine in: {selectedTable?.number || ''}</span>
            </div>
            <div style={{ fontSize: `${fsFontSize}px`, fontWeight: 'bold' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fsFontSize}px`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              <span>Cashier: biller</span>
              <span>Bill No.: {displayBillNo}</span>
            </div>
            <div style={{ fontSize: `${fsFontSize}px`, fontWeight: 'bold' }}>
              Token No.: {displayTokenNo}
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <table style={{ width: '100%', fontSize: `${fsFontSize}px`, fontWeight: 'bold', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '45%', textAlign: 'left', padding: '2px 0' }}>Item</th>
                  <th style={{ width: '15%', textAlign: 'center', padding: '2px 0' }}>Qty.</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>Price</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ width: '45%', textAlign: 'left', padding: '2px 0', wordBreak: 'break-word', whiteSpace: 'normal' }}>{item.name}</td>
                    <td style={{ width: '15%', textAlign: 'center', padding: '2px 0' }}>{item.qty}</td>
                    <td style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>{Number(item.price || 0).toFixed(2)}</td>
                    <td style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>{(Number(item.price || 0) * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fsFontSize}px`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              <span>Total Qty: {cart.reduce((sum, i) => sum + i.qty, 0)}</span>
              <span>Sub Total {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'right', fontSize: `${Math.round(fsFontSize * 1.125)}px`, fontWeight: 'bold', margin: '4px 0' }}>
              Grand Total &nbsp; ₹ {total.toFixed(2)}
            </div>
            <div style={{ fontSize: `${Math.round(fsFontSize * 0.875)}px`, fontWeight: 'bold', margin: '2px 0' }}>
              Paid via {splitPay ? 'Split' : 'Other'} [{payMethod.toUpperCase()}]
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontSize: `${fsFontSize}px`, fontWeight: 'bold', marginTop: '6px' }}>
              Thank You | Please Visit Again
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
