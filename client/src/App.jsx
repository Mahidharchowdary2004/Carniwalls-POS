import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import OnlineOrders from './pages/OnlineOrders'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import MenuBuilder from './pages/MenuBuilder'
import Staff from './pages/Staff'
import Customers from './pages/Customers'
import Settings from './pages/Settings'
import LiveMonitor from './pages/LiveMonitor'
import SalesSummary from './pages/SalesSummary'
import BillsHistory from './pages/BillsHistory'
import { useNetwork } from './hooks/useNetwork'
import { WifiOff } from 'lucide-react'

import { useStore } from './store'

function PrivateRoute({ children }) {
  return localStorage.getItem('rq_token') ? children : <Navigate to="/login" replace />
}

function OfflineBanner() {
  const isOffline = useNetwork();
  
  if (!isOffline) return null;
  
  return (
    <div style={{
      backgroundColor: '#c0392b',
      color: 'white',
      textAlign: 'center',
      padding: '8px',
      fontSize: '14px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      position: 'sticky',
      top: 0,
      zIndex: 9999
    }}>
      <WifiOff size={16} /> You are currently offline. Changes will be synced when connection is restored.
    </div>
  );
}

export default function App() {
  const { initSocket } = useStore()
  
  React.useEffect(() => {
    initSocket()
  }, [])

  return (
    <HashRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#fff',
            color: '#1a1f2e',
            border: '1px solid #e2e6ec',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            borderRadius: 8,
          },
          success: { iconTheme: { primary: '#27ae60', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#c0392b', secondary: '#fff' } },
          duration: 3000,
        }}
      />
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"     element={<Dashboard />} />
          <Route path="pos"           element={<POS />} />
          <Route path="online-orders" element={<OnlineOrders />} />
          <Route path="inventory"     element={<Inventory />} />
          <Route path="reports"       element={<Reports />} />
          <Route path="sales-summary" element={<SalesSummary />} />
          <Route path="bills"         element={<BillsHistory />} />
          <Route path="menu"          element={<MenuBuilder />} />
          <Route path="staff"         element={<Staff />} />
          <Route path="customers"     element={<Customers />} />
          <Route path="settings"      element={<Settings />} />
          <Route path="live-monitor"  element={<LiveMonitor />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
