import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import toast from 'react-hot-toast'

const PLATFORM_COLORS = {
  Swiggy: { bg: 'rgba(252,128,25,0.15)', color: '#fc8019', border: 'rgba(252,128,25,0.3)' },
  Zomato: { bg: 'rgba(231,28,36,0.12)', color: '#e71c24', border: 'rgba(231,28,36,0.25)' },
  Direct: { bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'rgba(59,130,246,0.25)' },
}

const STATUS_FLOW = { new: 'preparing', preparing: 'ready', ready: 'delivered' }
const STATUS_LABEL = { new: 'Accept & Prepare', preparing: 'Mark Ready', ready: 'Mark Delivered', delivered: 'Completed' }

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export default function OnlineOrders() {
  const { onlineOrders, fetchOnlineOrders, updateOnlineOrder } = useStore()
  const [tab, setTab] = useState('new')
  const [platform, setPlatform] = useState('all')

  useEffect(() => {
    fetchOnlineOrders()
    const t = setInterval(fetchOnlineOrders, 15000)
    return () => clearInterval(t)
  }, [])

  const counts = {
    new: onlineOrders.filter(o => o.status === 'new').length,
    preparing: onlineOrders.filter(o => o.status === 'preparing').length,
    ready: onlineOrders.filter(o => o.status === 'ready').length,
    delivered: onlineOrders.filter(o => o.status === 'delivered').length,
  }

  let filtered = onlineOrders.filter(o => o.status === tab)
  if (platform !== 'all') filtered = filtered.filter(o => o.platform === platform)

  async function advanceStatus(order) {
    const next = STATUS_FLOW[order.status]
    if (!next) return
    await updateOnlineOrder(order.id, { status: next })
    toast.success(`Order ${order.platform_order_id} → ${next}`)
  }

  async function rejectOrder(order) {
    await updateOnlineOrder(order.id, { status: 'rejected' })
    toast.error(`Order ${order.platform_order_id} rejected`)
  }

  return (
    <div>
      {/* Stats Row */}
      <div className="grid-4 mb-6">
        {[
          { label: 'New Orders', key: 'new', icon: '🆕', color: 'var(--orange)' },
          { label: 'Preparing', key: 'preparing', icon: '👨‍🍳', color: 'var(--yellow)' },
          { label: 'Ready', key: 'ready', icon: '✅', color: 'var(--green)' },
          { label: 'Delivered Today', key: 'delivered', icon: '🛵', color: 'var(--blue)' },
        ].map(s => (
          <div key={s.key} className="stat-card" onClick={() => setTab(s.key)} style={{ cursor: 'pointer', borderColor: tab === s.key ? s.color : 'var(--border)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{counts[s.key]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {Object.entries(counts).map(([key, count]) => (
            <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)} style={{ textTransform: 'capitalize' }}>
              {key} {count > 0 && <span className="nav-badge" style={{ marginLeft: 4 }}>{count}</span>}
            </div>
          ))}
        </div>
        <div className="spacer" />
        <select className="form-select" style={{ width: 140 }} value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          <option value="Swiggy">Swiggy</option>
          <option value="Zomato">Zomato</option>
          <option value="Direct">Direct</option>
        </select>
        <button className="btn btn-sm" onClick={fetchOnlineOrders}>↻ Refresh</button>
      </div>

      {/* Orders Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div>No {tab} orders right now</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map(order => {
            const pc = PLATFORM_COLORS[order.platform] || PLATFORM_COLORS.Direct
            return (
              <div key={order.id} style={{
                background: 'var(--bg2)',
                border: `1px solid var(--border)`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'DM Mono, monospace' }}>{order.platform_order_id}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{order.platform}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{timeAgo(order.created_at)}</span>
                </div>

                {/* Customer */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{order.customer}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {order.address}</div>
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding: '10px 16px', flex: 1 }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text2)' }}>{item.name} × {item.qty}</span>
                      <span>₹{item.price}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Subtotal: ₹{order.subtotal} + Del: ₹{order.delivery_fee}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--orange)' }}>₹{order.total}</div>
                  </div>
                  <span className={`badge ${order.status === 'new' ? 'badge-orange' : order.status === 'preparing' ? 'badge-warning' : order.status === 'ready' ? 'badge-success' : 'badge-info'}`} style={{ textTransform: 'capitalize' }}>{order.status}</span>
                </div>

                {/* Actions */}
                {order.status !== 'delivered' && order.status !== 'rejected' && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button className="btn btn-success btn-sm" style={{ flex: 2, justifyContent: 'center' }} onClick={() => advanceStatus(order)}>
                      ✓ {STATUS_LABEL[order.status]}
                    </button>
                    {order.status === 'new' && (
                      <button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => rejectOrder(order)}>
                        ✕ Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
