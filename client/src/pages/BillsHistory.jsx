import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

// Convert a UTC date string to an IST date label like "24/05/2026"
function toISTDateLabel(utcStr) {
  const d = new Date(utcStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

// Group bills by IST date and assign per-day index starting from 1
function groupBillsByDate(bills) {
  // Sort ascending by bill_no so day-index is in order
  const sorted = [...bills].sort((a, b) => (parseInt(a.bill_no) || 0) - (parseInt(b.bill_no) || 0))

  const groups = {} // { "24/05/2026": [bill, bill, ...] }
  sorted.forEach(bill => {
    const label = toISTDateLabel(bill.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(bill)
  })

  // Return array of { dateLabel, bills } sorted by date desc (newest first)
  return Object.entries(groups)
    .map(([dateLabel, bills]) => ({ dateLabel, bills }))
    .sort((a, b) => {
      const parseLabel = (l) => {
        const [d, m, y] = l.split('/')
        return new Date(y, m - 1, d)
      }
      return parseLabel(b.dateLabel) - parseLabel(a.dateLabel)
    })
}

export default function BillsHistory() {
  const { fetchBills, setPosState, user } = useStore()
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('today')
  const [customDates, setCustomDates] = useState({ from: '', to: '' })
  const [viewingBill, setViewingBill] = useState(null)

  const summary = React.useMemo(() => {
    const totals = { cash: 0, upi: 0, card: 0, total: 0 }
    bills.forEach(bill => {
      totals.total += parseFloat(bill.total) || 0
      const pm = bill.payment_method
      if (typeof pm === 'object' && pm !== null) {
        totals.cash += parseFloat(pm.cash) || 0
        totals.upi += parseFloat(pm.upi) || 0
        totals.card += parseFloat(pm.card) || 0
      } else {
        if (pm === 'cash') totals.cash += parseFloat(bill.total) || 0
        else if (pm === 'upi') totals.upi += parseFloat(bill.total) || 0
        else if (pm === 'card') totals.card += parseFloat(bill.total) || 0
      }
    })
    return totals
  }, [bills])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params = {}

        const istDayStart = (d) => {
          const istStr = new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          return new Date(istStr + 'T00:00:00+05:30').toISOString()
        }
        const istDayEnd = (d) => {
          const istStr = new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          return new Date(istStr + 'T23:59:59+05:30').toISOString()
        }

        if (filterType === 'today') {
          params.from = istDayStart(new Date())
          params.to = istDayEnd(new Date())
        } else if (filterType === 'yesterday') {
          const y = new Date()
          y.setDate(y.getDate() - 1)
          params.from = istDayStart(y)
          params.to = istDayEnd(y)
        } else if (filterType === 'custom') {
          if (customDates.from) {
            const [yr, mo, dy] = customDates.from.split('-').map(Number)
            params.from = istDayStart(new Date(yr, mo - 1, dy))
          }
          if (customDates.to) {
            const [yr, mo, dy] = customDates.to.split('-').map(Number)
            params.to = istDayEnd(new Date(yr, mo - 1, dy))
          }
        }

        console.log('FILTER PARAMS:', JSON.stringify(params))
        const data = await fetchBills({ ...params, limit: 500 })
        console.log('RAW BILLS COUNT:', data?.length, 'First bill created_at:', data?.[0]?.created_at)
        const validBills = (data || []).filter(bill => bill.bill_no)
        setBills(validBills)
      } catch (err) {
        console.error('Failed to fetch bills:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchBills, filterType, customDates])

  function handleEditBill(bill) {
    const isToday = toISTDateLabel(bill.created_at) === toISTDateLabel(new Date().toISOString())
    if (user?.role !== 'admin' && !isToday) {
      setViewingBill(bill)
      return
    }

    let parsedItems = bill.items || []
    if (typeof parsedItems === 'string') {
      try { parsedItems = JSON.parse(parsedItems) } catch (e) { parsedItems = [] }
    }
    setPosState({
      editingBillId: bill.id,
      editingBillNo: bill.bill_no || bill.id.slice(-6).toUpperCase(),
      cart: parsedItems,
      originalCart: parsedItems,
      discount: bill.discount || 0,
      discountType: 'amt',
      orderType: bill.order_type || 'takeaway',
      customerName: bill.customer_name || '',
      selectedTable: null,
      activeOrderId: bill.order_id || null
    })
    navigate('/pos')
  }

  const grouped = groupBillsByDate(bills)

  return (
    <div>
      {/* Header */}
      <div className="card-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="card-title">Bills History</div>
          <div className="card-sub">All past generated bills</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f0f2f5', padding: 4, borderRadius: 8, gap: 4 }}>
            {['today', 'yesterday', 'custom', 'all'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: filterType === type ? '#fff' : 'transparent',
                  color: filterType === type ? 'var(--primary)' : 'var(--text2)',
                  boxShadow: filterType === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  textTransform: 'capitalize'
                }}
              >
                {type === 'custom' ? 'Custom Date' : type === 'all' ? 'All Time' : type}
              </button>
            ))}
          </div>
          {filterType === 'custom' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" className="form-input" value={customDates.from} onChange={e => setCustomDates(prev => ({ ...prev, from: e.target.value }))} style={{ padding: '6px 12px', height: 36 }} />
              <span style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 600 }}>to</span>
              <input type="date" className="form-input" value={customDates.to} onChange={e => setCustomDates(prev => ({ ...prev, to: e.target.value }))} style={{ padding: '6px 12px', height: 36 }} />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '4px solid #27ae60' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase' }}>Total Collections</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>₹{summary.total.toFixed(0)}</span>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '4px solid #f39c12' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase' }}>💵 Cash</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>₹{summary.cash.toFixed(0)}</span>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '4px solid #2980b9' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase' }}>📱 UPI</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>₹{summary.upi.toFixed(0)}</span>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '4px solid #8e44ad' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase' }}>💳 Card</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>₹{summary.card.toFixed(0)}</span>
        </div>
      </div>

      {/* Bills grouped by IST date */}
      {loading ? (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : bills.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
          <div style={{ fontWeight: 600 }}>No bills found.</div>
        </div>
      ) : (
        grouped.map(({ dateLabel, bills: dayBills }) => {
          // Day summary
          const dayTotal = dayBills.reduce((s, b) => s + (parseFloat(b.total) || 0), 0)
          return (
            <div key={dateLabel} className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
              {/* Date header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f0f2f5', borderBottom: '2px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{dateLabel}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{dayBills.length} bill{dayBills.length !== 1 ? 's' : ''}</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#c0392b' }}>₹{dayTotal.toFixed(0)}</span>
              </div>

              {/* Bills table for this day */}
              <div className="table-wrap" style={{ margin: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bill No.</th>
                      <th>Order Type</th>
                      <th>Subtotal</th>
                      <th>Discount</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBills.map((bill, idx) => (
                      <tr
                        key={bill.id}
                        onClick={() => handleEditBill(bill)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Global bill_no */}
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text2)', fontWeight: 700 }}>
                          {bill.bill_no}
                        </td>
                        <td>
                          <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                            {bill.order_type || 'N/A'}
                          </span>
                        </td>
                        <td>₹{bill.subtotal}</td>
                        <td style={{ color: 'var(--green)' }}>
                          {bill.discount > 0 ? `−₹${bill.discount}` : '—'}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--orange)' }}>₹{bill.total}</td>
                        <td>
                          <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                            {typeof bill.payment_method === 'object' && bill.payment_method !== null
                              ? (Object.keys(bill.payment_method).filter(k => (bill.payment_method[k] || 0) > 0).join('+') || Object.keys(bill.payment_method)[0])
                              : (bill.payment_method || 'N/A')}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text2)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {new Date(bill.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              timeZone: 'Asia/Kolkata'
                            })}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                            {new Date(bill.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit', minute: '2-digit', hour12: true,
                              timeZone: 'Asia/Kolkata'
                            }).replace('am', 'AM').replace('pm', 'PM')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {viewingBill && <ViewBillModal bill={viewingBill} onClose={() => setViewingBill(null)} />}
    </div>
  )
}

function ViewBillModal({ bill, onClose }) {
  let items = bill.items || []
  if (typeof items === 'string') {
    try { items = JSON.parse(items) } catch (e) { items = [] }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 450, padding: 0, overflow: 'hidden' }}>
        <div className="modal-header" style={{ padding: '16px 24px', background: '#f8f9fb', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-title" style={{ fontSize: 18 }}>Bill Details <span style={{ color: 'var(--text3)', fontSize: 14 }}>({bill.bill_no})</span></div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        
        <div style={{ padding: 24 }}>
          {bill.customer_name && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>Customer:</span>
              <strong style={{ marginLeft: 8 }}>{bill.customer_name}</strong>
            </div>
          )}

          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '8px 0', color: 'var(--text2)' }}>Item</th>
                  <th style={{ padding: '8px 0', textAlign: 'center', color: 'var(--text2)' }}>Qty</th>
                  <th style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text2)' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f0f2f5' }}>
                    <td style={{ padding: '12px 0' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.variant && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{item.variant.name}</div>}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>₹{item.price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f8f9fb', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>Subtotal</span>
              <span>₹{bill.subtotal}</span>
            </div>
            {bill.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}>
                <span>Discount</span>
                <span>−₹{bill.discount}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span>Total</span>
              <span>₹{bill.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
              <span>Payment Method</span>
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{bill.payment_method}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function toISTDateLabel(utcStr) {
  const d = new Date(utcStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function groupBillsByDate(bills) {
  const sorted = [...bills].sort((a, b) => (parseInt(a.bill_no) || 0) - (parseInt(b.bill_no) || 0))

  const groups = {} 
  sorted.forEach(bill => {
    const label = toISTDateLabel(bill.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(bill)
  })

  return Object.entries(groups)
    .map(([dateLabel, bills]) => ({ dateLabel, bills }))
    .sort((a, b) => {
      const parseLabel = (l) => {
        const [d, m, y] = l.split('/')
        return new Date(y, m - 1, d)
      }
      return parseLabel(b.dateLabel) - parseLabel(a.dateLabel)
    })
}
