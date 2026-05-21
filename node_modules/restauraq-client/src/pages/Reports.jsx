import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { api } from '../store'

const COLORS = ['#ff6b35','#3b82f6','#22c55e','#a855f7','#f59e0b','#06b6d4','#ec4899']
const fmt = n => '₹' + (n >= 100000 ? (n/100000).toFixed(1) + 'L' : n >= 1000 ? (n/1000).toFixed(1) + 'k' : n)

export default function Reports() {
  const [period, setPeriod] = useState('month')
  const [sales, setSales] = useState(null)
  const [weekly, setWeekly] = useState([])
  const [topItems, setTopItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [s, w, t] = await Promise.all([
          api.get(`/reports/sales?period=${period}`),
          api.get('/reports/weekly'),
          api.get('/reports/top-items')
        ])
        setSales(s.data); setWeekly(w.data); setTopItems(t.data)
      } finally { setLoading(false) }
    }
    load()
  }, [period])

  const paymentData = sales ? Object.entries(sales.by_payment || {}).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value) })) : []
  const typeData = sales ? Object.entries(sales.by_type || {}).map(([name, value]) => ({ name, value: Math.round(value) })) : []
  const maxTop = topItems[0]?.count || 1

  return (
    <div>
      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['today','week','month'].map(p => (
            <div key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)} style={{ textTransform: 'capitalize' }}>{p}</div>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn btn-sm">📄 Export PDF</button>
        <button className="btn btn-sm">📊 Export Excel</button>
      </div>

      {loading && !sales ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid-4 mb-6">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--orange-bg)' }}>💰</div>
              <div className="stat-label">Gross Revenue</div>
              <div className="stat-value">{fmt(sales?.total_revenue || 0)}</div>
              <div className="stat-change up">▲ 18.2% vs previous</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--blue-bg)' }}>🧾</div>
              <div className="stat-label">Total Orders</div>
              <div className="stat-value">{sales?.total_orders || 0}</div>
              <div className="stat-change" style={{ color: 'var(--text2)' }}>Avg ₹{sales?.avg_order_value || 0}/order</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--green-bg)' }}>🎁</div>
              <div className="stat-label">Discounts Given</div>
              <div className="stat-value">{fmt(sales?.total_discount || 0)}</div>
              <div className="stat-change down">
                {sales?.total_revenue ? ((sales.total_discount / sales.total_revenue * 100).toFixed(1)) : 0}% of revenue
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid-2 mb-6">
            {/* Weekly Revenue */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Weekly Revenue</div>
                <div className="card-sub">Last 7 days</div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weekly} barSize={24}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => ['₹'+v, 'Revenue']} itemStyle={{ color: 'var(--orange)' }} />
                    <Bar dataKey="revenue" fill="var(--orange)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Split */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Payment Methods</div>
                <div className="card-sub">Revenue by method</div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => ['₹'+v]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                  {paymentData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i] }} />
                      <span style={{ color: 'var(--text2)' }}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Items + Order Type */}
          <div className="grid-2 mb-6">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Top Selling Items</div>
                <div className="card-sub">By order count</div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {topItems.slice(0, 8).map((item, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      <span style={{ color: 'var(--text2)', fontSize: 12 }}>{item.count} orders</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.round(item.count / maxTop * 100)}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Order Type Split</div>
                <div className="card-sub">Revenue by type</div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={typeData} layout="vertical" barSize={16}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => ['₹'+v, 'Revenue']} itemStyle={{ color: 'var(--orange)' }} />
                    <Bar dataKey="value" fill="var(--orange)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
                {typeData.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, marginTop: 4 }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{item.name}</span>
                    <span style={{ fontWeight: 600 }}>₹{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Bills */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Transactions</div>
              <div className="card-sub">{sales?.bills?.length || 0} bills for this period</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Bill ID</th><th>Type</th><th>Subtotal</th><th>Discount</th><th>Total</th><th>Payment</th><th>Date</th></tr></thead>
                <tbody>
                  {(sales?.bills || []).map(bill => (
                    <tr key={bill.id}>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text2)' }}>#{bill.id.slice(-6).toUpperCase()}</td>
                      <td><span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{bill.order_type}</span></td>
                      <td>₹{bill.subtotal}</td>

                      <td style={{ color: 'var(--green)' }}>{bill.discount > 0 ? `−₹${bill.discount}` : '—'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--orange)' }}>₹{bill.total}</td>
                      <td>
                        <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                          {typeof bill.payment_method === 'object' && bill.payment_method !== null 
                            ? (Object.keys(bill.payment_method).length > 1 ? 'Split' : Object.keys(bill.payment_method)[0])
                            : bill.payment_method}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
