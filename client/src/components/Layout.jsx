import React, { useState } from 'react'
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
  { to: '/bills',         icon: '🧾', label: 'Bills History' },
  { to: '/menu',          icon: '🍽️', label: 'Menu Builder' },
  { section: 'People' },
  { to: '/employee-summary', icon: '📝', label: 'Employee Summary' },
  { section: 'System' },
  { to: '/settings',      icon: '⚙️', label: 'Settings' },
  { to: '/credentials',   icon: '🔐', label: 'Credentials' },
]

const pageMeta = {
  '/dashboard':     { title: 'Dashboard',          sub: 'Overview & analytics' },
  '/pos':           { title: '',         sub: '' },
  '/online-orders': { title: 'Online Orders',       sub: 'Swiggy • Zomato • Direct orders' },
  '/reports':       { title: 'Reports & Analytics', sub: 'Sales, GST & performance data' },
  '/sales-summary': { title: 'Daily Sales Summary', sub: 'Sales performance day by day' },
  '/bills':         { title: 'Bills History',       sub: 'All past generated bills' },
  '/menu':          { title: 'Menu Builder',        sub: 'Items, categories & pricing' },
  '/staff':         { title: 'Staff Management',    sub: 'Employees, shifts & roles' },
  '/employee-summary': { title: 'Employee Summary', sub: 'Daily collection & remittance report' },
  '/customers':     { title: 'Customers',           sub: 'CRM & loyalty program' },
  '/settings':      { title: 'Settings',            sub: 'Outlet, tax & integrations' },
  '/credentials':   { title: 'System Credentials',  sub: 'Manage login accounts' },
  '/live-monitor':  { title: 'Live Monitor',        sub: 'Real-time restaurant tracking' },
}

export default function Layout() {
  const { user, logout, activeOrders, onlineOrders, sidebarOpen, toggleSidebar, setPosState, fetchBills } = useStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const meta      = pageMeta[location.pathname] || { title: 'RestauraQ', sub: '' }
  const pendingOnline = onlineOrders.filter(o => o.status === 'new').length

  const [searchBillNo, setSearchBillNo] = useState('')

  async function handleBillSearch(e) {
    e.preventDefault();
    if (!searchBillNo) return;
    try {
      const bills = await fetchBills({ limit: 500 });
      const bill = bills.find(b => String(b.bill_no) === String(searchBillNo));
      if (bill) {
        let parsedItems = bill.items || [];
        if (typeof parsedItems === 'string') {
          try { parsedItems = JSON.parse(parsedItems) } catch (err) { parsedItems = [] }
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
        });
        setSearchBillNo('');
        if (location.pathname !== '/pos') navigate('/pos');
      } else {
        toast.error('Bill not found');
      }
    } catch (err) {
      toast.error('Error fetching bill');
    }
  }

  function handleNewOrder() {
    setPosState({
      editingBillId: null,
      editingBillNo: null,
      cart: [],
      originalCart: [],
      discount: 0,
      activeOrderId: null,
      selectedTable: null,
      customerName: ''
    });
    if (location.pathname !== '/pos') navigate('/pos');
  }

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
          <img src="./logo.png" alt="Logo" className="logo-img" />
        </div>

        <nav className="nav">
          {nav.map((item, i) => {
            if (item.section) return <div key={i} className="nav-section">{item.section}</div>
            const badge = item.badge === 'pos' ? activeOrders.length
              : item.badge === 'online' ? pendingOnline 
              : 0
            if (item.to === '/credentials' && user?.role !== 'admin') return null;
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
                Carniwalls
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
          
          <img src="./logo.png" alt="Logo" style={{ height: 34, marginLeft: 12, objectFit: 'contain', borderRadius: 4 }} />
          
          <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn" onClick={handleNewOrder} style={{ fontSize: 13, height: 34, padding: '0 14px', background: '#27ae60', color: '#fff', border: 'none', fontWeight: 700, borderRadius: 6, cursor: 'pointer' }}>
              + New Order
            </button>
            <form onSubmit={handleBillSearch} style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="number" 
                placeholder="Bill No." 
                value={searchBillNo}
                onChange={e => setSearchBillNo(e.target.value)}
                style={{ height: 34, width: 90, padding: '0 10px', border: '1px solid var(--border)', borderRadius: '6px 0 0 6px', fontSize: 13, outline: 'none' }} 
              />
              <button type="submit" style={{ height: 34, padding: '0 12px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: '0 6px 6px 0', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
                Find
              </button>
            </form>
          </div>

          <div style={{ marginLeft: 16 }}>
            {meta.title && <div className="topbar-title">{meta.title}</div>}
            {meta.sub && <div className="topbar-sub">{meta.sub}</div>}
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
