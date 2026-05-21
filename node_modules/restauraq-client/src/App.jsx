import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

import { useStore } from './store'

function PrivateRoute({ children }) {
  return localStorage.getItem('rq_token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { initSocket } = useStore()
  
  React.useEffect(() => {
    initSocket()
  }, [])

  return (
    <BrowserRouter>
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
          <Route path="menu"          element={<MenuBuilder />} />
          <Route path="staff"         element={<Staff />} />
          <Route path="customers"     element={<Customers />} />
          <Route path="settings"      element={<Settings />} />
          <Route path="live-monitor"  element={<LiveMonitor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
