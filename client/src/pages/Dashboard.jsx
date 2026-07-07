import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts'
import { api } from '../store'
import { useNavigate } from 'react-router-dom'

// Brand palette derived from the logo: red + gold lead, supported by a few
// distinguishable hues for multi-category charts (pies/bars need contrast,
// not just two colors, to stay readable).
const COLORS = ['#e00000', '#ffd400', '#8a3d00', '#3b82f6', '#22c55e', '#a855f7', '#06b6d4']
const fmt = n => n >= 100000 ? '₹' + (n / 100000).toFixed(1) + 'L' : n >= 1000 ? '₹' + (n / 1000).toFixed(1) + 'k' : '₹' + n

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#2a0a00', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#d9b48f', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || '#ffd400' }}>{p.name}: {typeof p.value === 'number' && p.value > 100 ? '₹' + p.value : p.value}</div>)}
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('today')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [menuSummary, setMS] = useState(null)
  const [orderSummary, setOS] = useState(null)
  const [weekly, setWeekly] = useState([])
  const [topItems, setTopItems] = useState([])
  const [invAlerts, setInvAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load() {
    if (period === 'custom' && (!fromDate || !toDate)) return;
    try {
      let q = `?period=${period}`
      if (period === 'custom') q += `&from=${fromDate}&to=${toDate}`

      const [s, r, ms, os, w, t, inv] = await Promise.all([
        api.get('/dashboard/stats' + q),
        api.get('/dashboard/recent-orders' + q),
        api.get('/dashboard/menu-summary' + q),
        api.get('/dashboard/order-summary' + q),
        api.get('/reports/weekly'),
        api.get('/reports/top-items' + q),
        api.get('/dashboard/inventory-alerts'),
      ])
      setStats(s.data); setRecent(r.data)
      setMS(ms.data); setOS(os.data)
      setWeekly(w.data); setTopItems(t.data)
      setInvAlerts(inv.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { setLoading(true); load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [period, fromDate, toDate])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <span style={{ color: 'var(--text2)' }}>Loading dashboard…</span>
    </div>
  )

  const channelData = stats?.channel_split ? Object.entries(stats.channel_split).map(([name, value]) => ({ name, value })) : []
  const hourlyData = (orderSummary?.hourly || []).filter(h => (period === 'today' || period === 'yesterday') ? parseInt(h.hour) >= 9 : true)
  const catData = menuSummary?.by_category || []
  const priceData = menuSummary?.price_ranges ? Object.entries(menuSummary.price_ranges).map(([name, value]) => ({ name, value })) : []
  const rc = parseFloat(stats?.revenue?.change || 0)

  return (
    <div>
      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['today', 'yesterday', 'month', 'custom'].map(p => (
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
      </div>

      {/* KPI CARDS */}
      <div className="grid-4 mb-6">
        {[
          { label: `Revenue (${period})`, value: fmt(stats?.revenue?.today || 0), sub: period === 'custom' ? '' : `${rc >= 0 ? '▲' : '▼'} ${Math.abs(rc)}% vs previous`, color: 'var(--orange)', icon: '💰', bg: 'var(--orange-bg)' },
          { label: `Orders (${period})`, value: orderSummary?.today?.count || 0, sub: `${orderSummary?.online_pending || 0} online pending`, color: 'var(--green)', icon: '🧾', bg: 'var(--green-bg)' },
          { label: 'Avg Order Value', value: fmt(stats?.avg_order_value || 0), sub: `Per bill (${period})`, color: 'var(--blue)', icon: '📈', bg: 'var(--blue-bg)' },
          { label: 'Tables Occupied', value: `${orderSummary?.tables_occupied || 0}/${orderSummary?.tables_total || 0}`, sub: `${orderSummary?.tables_total ? Math.round(orderSummary.tables_occupied / orderSummary.tables_total * 100) : 0}% occupancy`, color: 'var(--purple)', icon: '🪑', bg: 'var(--purple-bg)' },
        ].map((k, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: k.bg }}>{k.icon}</div>
            <div className="stat-label">{k.label}</div>
            <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: k.color, opacity: 0.8 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* REVENUE AREA + CHANNEL PIE */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">{period === 'today' || period === 'yesterday' ? 'Hourly Revenue' : 'Daily Revenue'}</div><div className="card-sub">{period} performance</div></div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e00000" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e00000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4a5568' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#e00000" fill="url(#rg)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Order Channels</div><div className="card-sub">Split by source</div></div>
          <div style={{ padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" innerRadius={36} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#2a0a00', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
              {channelData.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--text2)', flex: 1 }}>{item.name}</span>
                  <span style={{ fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WEEKLY BAR + TOP ITEMS */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">Weekly Revenue & Orders</div><div className="card-sub">Last 7 days</div></div>
          <div style={{ padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekly} barSize={16} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#4a5568' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#4a5568' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `₹${v / 1000}k` : v} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: '#4a5568' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#e00000" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="ord" dataKey="orders" name="Orders" fill="#ffd400" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Top Selling Items</div><div className="card-sub">By order count</div></div>
          <div style={{ padding: '16px 20px' }}>
            {topItems.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: 20 }}>No sales data yet</div>}
            {topItems.slice(0, 7).map((item, i) => (
              <div key={i} style={{ marginBottom: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{item.name}</span>
                  <span style={{ color: 'var(--text2)' }}>{item.count} sold</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.round(item.count / (topItems[0]?.count || 1) * 100)}%`, background: COLORS[i % COLORS.length] }} />
                </div>
              </div>
            ))}

            {invAlerts.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                  <span>⚠️ Low Stock Alerts</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invAlerts.slice(0, 3).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(224, 0, 0, 0.06)', padding: '6px 10px', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--red)' }}>{item.stock} {item.unit} left</span>
                    </div>
                  ))}
                  {invAlerts.length > 3 && (
                    <button className="btn btn-sm" style={{ padding: 0, fontSize: 11, border: 'none', background: 'none', color: 'var(--blue)' }} onClick={() => navigate('/inventory')}>
                      View all {invAlerts.length} alerts →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ITEM SUMMARY + CATEGORY SUMMARY + PRICE DIST */}
      <div className="grid-3 mb-6">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Item Summary</div>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/menu')}>Manage →</button>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {[
              [period ? 'Total Items Sold' : 'Total Items', menuSummary?.total || 0, 'var(--text)'],
              [period ? 'Unique Items Sold' : 'Active Items', menuSummary?.active || 0, 'var(--green)'],
              [period ? 'Veg Items Sold' : 'Veg Items', menuSummary?.veg || 0, 'var(--green)'],
              [period ? 'Non-Veg Items Sold' : 'Non-Veg Items', menuSummary?.non_veg || 0, 'var(--red)'],
              [period ? 'Avg Sold Price' : 'Avg Item Price', `₹${menuSummary?.avg_price || 0}`, 'var(--orange)'],
              [period ? 'Categories Sold' : 'Categories', catData.length, 'var(--blue)'],
            ].map(([label, val, color], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Category Summary</div></div>
          <div style={{ padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catData} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#4a5568' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8b95b0' }} axisLine={false} tickLine={false} width={85} />
                <Tooltip contentStyle={{ background: '#2a0a00', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" name="Items" fill="#e00000" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Price Distribution</div></div>
          <div style={{ padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={priceData} cx="50%" cy="50%" outerRadius={58} dataKey="value" label={({ name, value }) => value > 0 ? value : ''} labelLine={false} fontSize={10}>
                  {priceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#2a0a00', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {priceData.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: 'var(--text2)' }}>{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PERIOD SUMMARY */}
      <div className="grid-3 mb-6">
        {[
          { label: 'Today', rev: orderSummary?.today?.revenue || 0, cnt: orderSummary?.today?.count || 0 },
          { label: 'This Week', rev: orderSummary?.week?.revenue || 0, cnt: orderSummary?.week?.count || 0 },
          { label: 'This Month', rev: orderSummary?.month?.revenue || 0, cnt: orderSummary?.month?.count || 0 },
        ].map((p, i) => (
          <div key={i} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div className="stat-label">{p.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>{fmt(p.rev)}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{p.cnt} orders</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Avg/order</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.cnt ? fmt(Math.round(p.rev / p.cnt)) : '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT BILLS TABLE */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">Recent Transactions</div><div className="card-sub">Latest bills</div></div>
          <button className="btn btn-sm" onClick={() => navigate('/reports')}>Full Reports →</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Bill ID</th><th>Type</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>Total</th><th>Payment</th><th>Time</th></tr>
            </thead>
            <tbody>
              {recent.slice(0, 10).map(bill => (
                <tr key={bill.id}>
                  <td style={{ fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--text2)' }}>#{bill.id.slice(-6).toUpperCase()}</td>
                  <td><span className={`badge ${bill.order_type === 'dine-in' ? 'badge-orange' : bill.order_type === 'delivery' ? 'badge-info' : 'badge-gray'}`}>{bill.order_type}</span></td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{bill.items?.length || 0} items</td>
                  <td>₹{bill.subtotal}</td>
                  <td style={{ color: 'var(--green)' }}>{(bill.discount || 0) > 0 ? `−₹${bill.discount}` : '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--orange)' }}>₹{bill.total}</td>
                  <td>
                    <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                      {typeof bill.payment_method === 'object' && bill.payment_method !== null
                        ? (Object.keys(bill.payment_method).length > 1 ? 'Split' : Object.keys(bill.payment_method)[0])
                        : bill.payment_method}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 11 }}>{new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}