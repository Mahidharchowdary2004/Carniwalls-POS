import React, { useEffect, useState } from 'react'
import { api } from '../store'

export default function SalesSummary() {
  const [period, setPeriod] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [daily, setDaily] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (period === 'custom' && (!fromDate || !toDate)) return;
      setLoading(true)
      try {
        let url = `/reports/daily?period=${period}`
        if (period === 'custom') url += `&from=${fromDate}&to=${toDate}`
        const d = await api.get(url)
        setDaily(Array.isArray(d.data) ? d.data : [])
      } finally { setLoading(false) }
    }
    load()
  }, [period, fromDate, toDate])

  const totalRevenue = daily.reduce((sum, d) => sum + Number(d.revenue || 0), 0)
  const totalOrders = daily.reduce((sum, d) => sum + Number(d.orders || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['today','week','month','custom'].map(p => (
            <div key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)} style={{ textTransform: 'capitalize' }}>{p}</div>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="input" style={{ width: 130, padding: '4px 8px', fontSize: 13, minHeight: 'auto' }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>to</span>
            <input type="date" className="input" style={{ width: 130, padding: '4px 8px', fontSize: 13, minHeight: 'auto' }} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}
        <div className="spacer" />
        <button className="btn btn-sm">📄 Export PDF</button>
        <button className="btn btn-sm">📊 Export Excel</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : (
        <>
          <div className="grid-2 mb-6">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--orange-bg)' }}>💰</div>
              <div className="stat-label">Total Sales ({period})</div>
              <div className="stat-value" style={{ color: 'var(--orange)' }}>₹{totalRevenue.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--blue-bg)' }}>🧾</div>
              <div className="stat-label">Total Orders ({period})</div>
              <div className="stat-value" style={{ color: 'var(--blue)' }}>{totalOrders.toLocaleString()}</div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="card-header">
            <div className="card-title">Daily Sales Summary</div>
            <div className="card-sub">Sales performance day by day</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th><th>Discount</th></tr></thead>
              <tbody>
                {(daily || []).map(d => (
                  <tr key={d.date}>
                    <td style={{ fontWeight: 500 }}>{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td>{d.orders}</td>
                    <td style={{ fontWeight: 600, color: 'var(--orange)' }}>₹{Number(d.revenue).toLocaleString()}</td>
                    <td style={{ color: 'var(--green)' }}>{d.discount > 0 ? `−₹${Number(d.discount).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
                {(!daily || daily.length === 0) && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>No sales data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
