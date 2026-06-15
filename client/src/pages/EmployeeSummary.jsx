import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import toast from 'react-hot-toast'

// Convert a UTC date string to an IST date label like "24/05/2026"
function toISTDateLabel(utcStr) {
  const d = new Date(utcStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

// Map payment method text/object to categorized values
function aggregatePayments(bill) {
  const values = {
    not_paid: 0,
    cash: 0,
    card: 0,
    upi: 0,
    due: 0,
    other: 0,
    online: 0,
    cod: 0,
    total: parseFloat(bill.total) || 0
  }

  const pm = bill.payment_method

  if (bill.status === 'cancelled') {
    return values
  }

  if (typeof pm === 'object' && pm !== null) {
    values.cash = parseFloat(pm.cash) || 0
    values.card = parseFloat(pm.card) || 0
    values.upi = parseFloat(pm.upi) || 0
    values.not_paid = parseFloat(pm.not_paid) || parseFloat(pm['not paid']) || 0
    values.due = parseFloat(pm.due) || parseFloat(pm.due_payment) || parseFloat(pm['due payment']) || 0
    values.online = parseFloat(pm.online) || parseFloat(pm.online_order) || parseFloat(pm['online order']) || 0
    values.cod = parseFloat(pm.cod) || parseFloat(pm.online_cod) || parseFloat(pm['online cod']) || 0
    values.other = parseFloat(pm.other) || 0
  } else if (typeof pm === 'string') {
    const method = pm.toLowerCase().trim()
    if (method === 'cash') {
      values.cash = values.total
    } else if (method === 'card') {
      values.card = values.total
    } else if (method === 'upi') {
      values.upi = values.total
    } else if (method === 'not_paid' || method === 'not paid') {
      values.not_paid = values.total
    } else if (method === 'due' || method === 'due_payment' || method === 'due payment') {
      values.due = values.total
    } else if (method === 'online' || method === 'online_order' || method === 'online order') {
      values.online = values.total
    } else if (method === 'cod' || method === 'online_cod' || method === 'online cod') {
      values.cod = values.total
    } else {
      values.other = values.total
    }
  } else {
    values.other = values.total
  }

  return values
}

// Group bills by IST date and aggregate categories
function groupBillsByDate(bills) {
  const sorted = [...bills].sort((a, b) => (parseInt(a.bill_no) || 0) - (parseInt(b.bill_no) || 0))

  const groups = {}
  sorted.forEach(bill => {
    const label = toISTDateLabel(bill.created_at)
    if (!groups[label]) {
      groups[label] = {
        dateLabel: label,
        not_paid: 0,
        cash: 0,
        card: 0,
        upi: 0,
        due: 0,
        other: 0,
        online: 0,
        cod: 0,
        total: 0,
        orders: 0
      }
    }

    const aggr = aggregatePayments(bill)
    groups[label].not_paid += aggr.not_paid
    groups[label].cash += aggr.cash
    groups[label].card += aggr.card
    groups[label].upi += aggr.upi
    groups[label].due += aggr.due
    groups[label].other += aggr.other
    groups[label].online += aggr.online
    groups[label].cod += aggr.cod
    groups[label].total += aggr.total
    groups[label].orders += 1
  })

  // Return list sorted by date desc (newest first)
  return Object.values(groups).sort((a, b) => {
    const parseLabel = (l) => {
      const [d, m, y] = l.split('/')
      return new Date(y, m - 1, d)
    }
    return parseLabel(b.dateLabel) - parseLabel(a.dateLabel)
  })
}

export default function EmployeeSummary() {
  const fsSize = parseInt(localStorage.getItem('pos_print_font_size')) || 16
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [customDates, setCustomDates] = useState({ from: '', to: '' })

  const { fetchBills } = useStore()

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

        if (period === 'today') {
          params.from = istDayStart(new Date())
          params.to = istDayEnd(new Date())
        } else if (period === 'yesterday') {
          const y = new Date()
          y.setDate(y.getDate() - 1)
          params.from = istDayStart(y)
          params.to = istDayEnd(y)
        } else if (period === 'week') {
          const w = new Date()
          w.setDate(w.getDate() - 7)
          params.from = istDayStart(w)
          params.to = istDayEnd(new Date())
        } else if (period === 'month') {
          const m = new Date()
          m.setDate(m.getDate() - 30)
          params.from = istDayStart(m)
          params.to = istDayEnd(new Date())
        } else if (period === 'custom') {
          if (customDates.from) {
            const [yr, mo, dy] = customDates.from.split('-').map(Number)
            params.from = istDayStart(new Date(yr, mo - 1, dy))
          }
          if (customDates.to) {
            const [yr, mo, dy] = customDates.to.split('-').map(Number)
            params.to = istDayEnd(new Date(yr, mo - 1, dy))
          }
        }

        const data = await fetchBills({ ...params, limit: 1000 })
        const validBills = (data || []).filter(bill => bill.bill_no)
        setBills(validBills)
      } catch (err) {
        console.error('Failed to fetch employee summary bills:', err)
        toast.error('Failed to load bills data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchBills, period, customDates])

  const groupedSummary = React.useMemo(() => {
    return groupBillsByDate(bills)
  }, [bills])

  const totals = React.useMemo(() => {
    const acc = { not_paid: 0, cash: 0, card: 0, upi: 0, due: 0, other: 0, online: 0, cod: 0, total: 0, orders: 0 }
    groupedSummary.forEach(day => {
      acc.not_paid += day.not_paid
      acc.cash += day.cash
      acc.card += day.card
      acc.upi += day.upi
      acc.due += day.due
      acc.other += day.other
      acc.online += day.online
      acc.cod += day.cod
      acc.total += day.total
      acc.orders += day.orders
    })
    return acc
  }, [groupedSummary])

  return (
    <div>
      <div className="no-print">
        {/* Period Selector Header */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            {['today', 'yesterday', 'week', 'month', 'custom'].map(p => (
              <div
                key={p}
                className={`tab ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
                style={{ textTransform: 'capitalize' }}
              >
                {p === 'week' ? 'Last 7 Days' : p === 'month' ? 'Last 30 Days' : p}
              </div>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                className="form-input"
                value={customDates.from}
                onChange={e => setCustomDates(prev => ({ ...prev, from: e.target.value }))}
                style={{ padding: '6px 12px', height: 36, width: 135 }}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 600 }}>to</span>
              <input
                type="date"
                className="form-input"
                value={customDates.to}
                onChange={e => setCustomDates(prev => ({ ...prev, to: e.target.value }))}
                style={{ padding: '6px 12px', height: 36, width: 135 }}
              />
            </div>
          )}

          <div className="spacer" />

          <button
            className="btn btn-sm"
            onClick={() => {
              if (window.ipcRenderer) {
                const printerName = localStorage.getItem('pos_printer') || ''
                const printScale = localStorage.getItem('pos_print_scale') || 100
                window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale })
              } else {
                window.print()
              }
            }}
          >
            🖨️ Print Report
          </button>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div className="grid-4 mb-6">
          <div className="stat-card" style={{ borderLeft: '4px solid #27ae60' }}>
            <div className="stat-icon" style={{ background: '#e8f8f0' }}>💰</div>
            <div className="stat-label">Total Settle</div>
            <div className="stat-value" style={{ color: '#27ae60' }}>₹{totals.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-change" style={{ color: 'var(--text3)' }}>{totals.orders} orders collected</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f39c12' }}>
            <div className="stat-icon" style={{ background: '#fef5e7' }}>💵</div>
            <div className="stat-label">Cash Summary</div>
            <div className="stat-value" style={{ color: '#f39c12' }}>₹{totals.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-change" style={{ color: 'var(--text3)' }}>{((totals.cash / (totals.total || 1)) * 100).toFixed(0)}% of total</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #2980b9' }}>
            <div className="stat-icon" style={{ background: '#ebf5fb' }}>📱</div>
            <div className="stat-label">UPI / QR</div>
            <div className="stat-value" style={{ color: '#2980b9' }}>₹{totals.upi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-change" style={{ color: 'var(--text3)' }}>{((totals.upi / (totals.total || 1)) * 100).toFixed(0)}% of total</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #c0392b' }}>
            <div className="stat-icon" style={{ background: '#fadbd8' }}>⚠️</div>
            <div className="stat-label">Not Paid & Due</div>
            <div className="stat-value" style={{ color: '#c0392b' }}>₹{(totals.not_paid + totals.due).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-change" style={{ color: 'var(--text3)' }}>Due: ₹{totals.due.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>

        {/* DETAILED SUMMARY TABLE */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title">Employee Remittance Summary</div>
            <div className="card-sub">Daily channel-wise sales collections overview</div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : groupedSummary.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
              <div>No collections data found for this period.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'right', color: '#c0392b' }}>Not Paid</th>
                    <th style={{ textAlign: 'right' }}>Cash</th>
                    <th style={{ textAlign: 'right' }}>Card</th>
                    <th style={{ textAlign: 'right' }}>UPI</th>
                    <th style={{ textAlign: 'right', color: '#d35400' }}>Due Payment</th>
                    <th style={{ textAlign: 'right' }}>Other</th>
                    <th style={{ textAlign: 'right' }}>Online Order</th>
                    <th style={{ textAlign: 'right' }}>Online COD</th>
                    <th style={{ textAlign: 'right', fontWeight: 800 }}>Total Settle</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedSummary.map(day => (
                    <tr key={day.dateLabel}>
                      <td style={{ fontWeight: 700 }}>{day.dateLabel}</td>
                      <td style={{ textAlign: 'right', color: '#c0392b', fontWeight: day.not_paid > 0 ? 600 : 400 }}>
                        {day.not_paid > 0 ? `₹${day.not_paid.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: day.cash > 0 ? 600 : 400 }}>
                        {day.cash > 0 ? `₹${day.cash.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: day.card > 0 ? 600 : 400 }}>
                        {day.card > 0 ? `₹${day.card.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: day.upi > 0 ? 600 : 400 }}>
                        {day.upi > 0 ? `₹${day.upi.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#d35400', fontWeight: day.due > 0 ? 600 : 400 }}>
                        {day.due > 0 ? `₹${day.due.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: day.other > 0 ? 600 : 400 }}>
                        {day.other > 0 ? `₹${day.other.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: day.online > 0 ? 600 : 400 }}>
                        {day.online > 0 ? `₹${day.online.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: day.cod > 0 ? 600 : 400 }}>
                        {day.cod > 0 ? `₹${day.cod.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                        ₹{day.total.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: '#f8f9fb', borderTop: '2px solid var(--border)' }}>
                    <td style={{ fontWeight: 900 }}>Total Settle</td>
                    <td style={{ textAlign: 'right', color: '#c0392b', fontWeight: 900 }}>
                      {totals.not_paid > 0 ? `₹${totals.not_paid.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totals.cash > 0 ? `₹${totals.cash.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totals.card > 0 ? `₹${totals.card.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totals.upi > 0 ? `₹${totals.upi.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: '#d35400', fontWeight: 900 }}>
                      {totals.due > 0 ? `₹${totals.due.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totals.other > 0 ? `₹${totals.other.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totals.online > 0 ? `₹${totals.online.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totals.cod > 0 ? `₹${totals.cod.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#c0392b', fontSize: 15 }}>
                      ₹{totals.total.toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* THERMAL PRINTER SUMMARY FORMAT (Hidden on screen, visible only when printing) */}
      <div className="print-only receipt-content">
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: `${fsSize}px`, marginTop: '10px' }}>
          EMPLOYEE SUMMARY
        </div>
        <div style={{ textAlign: 'center', fontSize: `${Math.round(fsSize * 0.875)}px`, margin: '4px 0' }}>
          Period: {period.toUpperCase()}
          {period === 'custom' && ` (${customDates.from} to ${customDates.to})`}
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        
        <table style={{ width: '100%', fontSize: `${Math.round(fsSize * 0.8125)}px`, borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '2px 0' }}>Total Collected:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{totals.total.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Total Orders:</td><td style={{ textAlign: 'right' }}>{totals.orders}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Cash:</td><td style={{ textAlign: 'right' }}>₹{totals.cash.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>UPI:</td><td style={{ textAlign: 'right' }}>₹{totals.upi.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Card:</td><td style={{ textAlign: 'right' }}>₹{totals.card.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Not Paid:</td><td style={{ textAlign: 'right' }}>₹{totals.not_paid.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Due Payment:</td><td style={{ textAlign: 'right' }}>₹{totals.due.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Online Order:</td><td style={{ textAlign: 'right' }}>₹{totals.online.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Online COD:</td><td style={{ textAlign: 'right' }}>₹{totals.cod.toFixed(0)}</td></tr>
            <tr><td style={{ padding: '2px 0' }}>Other:</td><td style={{ textAlign: 'right' }}>₹{totals.other.toFixed(0)}</td></tr>
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
        
        <table style={{ width: '100%', fontSize: `${Math.round(fsSize * 0.75)}px` }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'right' }}>Cash</th>
              <th style={{ textAlign: 'right' }}>UPI</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedSummary.map(day => (
              <tr key={day.dateLabel}>
                <td>{day.dateLabel.split('/').slice(0, 2).join('/')}</td>
                <td style={{ textAlign: 'right' }}>{day.cash.toFixed(0)}</td>
                <td style={{ textAlign: 'right' }}>{day.upi.toFixed(0)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{day.total.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ textAlign: 'center', fontSize: `${Math.round(fsSize * 0.75)}px`, marginTop: '6px' }}>
          Printed on {new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  )
}
