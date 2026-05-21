import React from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import toast from 'react-hot-toast'

const nav = [
  { section: 'Operations' },
  { to: '/dashboard',     icon: '▦',  label: 'Dashboard' },
  { to: '/pos',           icon: '🖥️', label: 'POS Billing',    badge: 'pos' },
  { to: '/online-orders', icon: '🛵', label: 'Online Orders',  badge: 'online' },
  { section: 'Management' },
  { to: '/reports',       icon: '📊', label: 'Reports' },
  { to: '/sales-summary', icon: '📈', label: 'Sales Summary' },
  { to: '/menu',          icon: '🍽️', label: 'Menu Builder' },
  { to: '/live-monitor',  icon: '📡', label: 'Live Monitor' },
  { section: 'People' },
  { to: '/staff',         icon: '👥', label: 'Staff' },
  { to: '/customers',     icon: '🤝', label: 'Customers' },
  { section: 'System' },
  { to: '/settings',      icon: '⚙️', label: 'Settings' },
]

const pageMeta = {
  '/dashboard':     { title: 'Dashboard',          sub: 'Overview & analytics' },
  '/pos':           { title: 'POS Billing',         sub: 'Table management & order taking' },
  '/online-orders': { title: 'Online Orders',       sub: 'Swiggy • Zomato • Direct orders' },
  '/reports':       { title: 'Reports & Analytics', sub: 'Sales, GST & performance data' },
  '/sales-summary': { title: 'Daily Sales Summary', sub: 'Sales performance day by day' },
  '/menu':          { title: 'Menu Builder',        sub: 'Items, categories & pricing' },
  '/staff':         { title: 'Staff Management',    sub: 'Employees, shifts & roles' },
  '/customers':     { title: 'Customers',           sub: 'CRM & loyalty program' },
  '/settings':      { title: 'Settings',            sub: 'Outlet, tax & integrations' },
  '/live-monitor':  { title: 'Live Monitor',        sub: 'Real-time restaurant tracking' },
}

export default function Layout() {
  const { user, logout, activeOrders, onlineOrders, sidebarOpen, toggleSidebar } = useStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const meta      = pageMeta[location.pathname] || { title: 'RestauraQ', sub: '' }
  const pendingOnline = onlineOrders.filter(o => o.status === 'new').length

  // POS and Kitchen pages get full height with no extra padding
  const isFullPage = ['/pos'].includes(location.pathname)

  function handleLogout() {
    logout(); toast.success('Logged out'); navigate('/login')
  }

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Logo" className="logo-img" />
        </div>

        <nav className="nav">
          {nav.map((item, i) => {
            if (item.section) return <div key={i} className="nav-section">{item.section}</div>
            const badge = item.badge === 'pos' ? activeOrders.length
              : item.badge === 'online' ? pendingOnline 
              : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span>{item.icon}</span>
                {item.label}
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="outlet-info">
            <div className="outlet-dot" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Koramangala
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {user?.name} · {user?.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 15, padding: '2px' }}
              title="Logout"
            >⏻</button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <button className="sidebar-toggle" onClick={toggleSidebar}>☰</button>
          <div style={{ marginLeft: 10 }}>
            <div className="topbar-title">{meta.title}</div>
            <div className="topbar-sub">{meta.sub}</div>
          </div>
          <div className="spacer" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Date chip */}
            <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', fontWeight: 600 }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            {/* Notification bell */}
            <button style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', position: 'relative' }}>
              🔔
              {pendingOnline > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, background: '#c0392b', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                  {pendingOnline}
                </span>
              )}
            </button>
            {/* Avatar */}
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff5f5', color: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: '1px solid #fca5a5', cursor: 'pointer' }}>
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </div>

        {/* CONTENT — no padding on full-page views */}
        <div className={isFullPage ? '' : 'content'} style={isFullPage ? { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
