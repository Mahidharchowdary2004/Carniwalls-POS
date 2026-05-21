// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────

export const BRAND = {
  name: 'RestauraQ',
  tagline: 'Cloud Restaurant Management',
  version: '2.0',
  primaryColor: '#c0392b',
  supportPhone: '1800-123-4567',
}

export const ORDER_TYPES = [
  { key: 'dine-in',   label: 'Dine In',   icon: '🍽️' },
  { key: 'takeaway',  label: 'Take Away',  icon: '🛍️' },
  { key: 'delivery',  label: 'Delivery',   icon: '🛵' },
]

export const PAYMENT_METHODS = [
  { key: 'cash',    label: 'Cash',    icon: '💵' },
  { key: 'card',    label: 'Card',    icon: '💳' },
  { key: 'upi',     label: 'UPI',     icon: '📱' },
  { key: 'wallet',  label: 'Wallet',  icon: '👛' },
]

export const TABLE_STATUSES = {
  free:     { label: 'Free',     color: '#27ae60', bg: '#f0fff4' },
  occupied: { label: 'Occupied', color: '#c0392b', bg: '#fff5f5' },
  reserved: { label: 'Reserved', color: '#2980b9', bg: '#eff6ff' },
}

export const PLATFORM_COLORS = {
  Swiggy: { color: '#fc8019', bg: 'rgba(252,128,25,0.1)', border: 'rgba(252,128,25,0.25)' },
  Zomato: { color: '#e71c24', bg: 'rgba(231,28,36,0.08)', border: 'rgba(231,28,36,0.2)' },
  Direct: { color: '#2980b9', bg: 'rgba(41,128,185,0.08)', border: 'rgba(41,128,185,0.2)' },
}

export const MENU_TYPES = [
  { key: 'veg',     label: 'Veg',     color: '#27ae60' },
  { key: 'non-veg', label: 'Non-Veg', color: '#e74c3c' },
  { key: 'egg',     label: 'Egg',     color: '#f39c12' },
]

export const STAFF_ROLES = [
  'Head Chef', 'Sous Chef', 'Line Cook', 'Cashier',
  'Waiter', 'Manager', 'Bartender', 'Delivery Boy', 'Cleaner',
]

export const SHIFTS = [
  'Morning (6am–2pm)',
  'Evening (2pm–10pm)',
  'Night (10pm–6am)',
  'Split (9am–6pm)',
]

export const INV_CATEGORIES = [
  'Meat & Seafood', 'Vegetables', 'Dairy',
  'Grains', 'Spices', 'Oils', 'Beverages', 'Packaging',
]

export const INV_UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'dozen', 'box']

export const CHART_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad',
  '#f39c12', '#1abc9c', '#e67e22', '#e74c3c',
]

// ─── SHARED UTILITIES ─────────────────────────────────────────────────────────

export function fmtCurrency(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'k'
  return '₹' + (n || 0)
}

export function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export function calcTax(subtotal, cgstPct = 2.5, sgstPct = 2.5) {
  const cgst  = Math.round(subtotal * cgstPct / 100)
  const sgst  = Math.round(subtotal * sgstPct / 100)
  return { cgst, sgst, total: subtotal + cgst + sgst }
}

export function stockStatus(item) {
  const pct = item.current_stock / item.max_stock
  if (item.current_stock <= item.min_stock) return { label: 'Critical', color: '#e74c3c', bg: '#fee2e2' }
  if (pct < 0.4) return { label: 'Low', color: '#f39c12', bg: '#fef9c3' }
  return { label: 'OK', color: '#27ae60', bg: '#dcfce7' }
}

export function marginColor(pct) {
  if (pct >= 60) return '#27ae60'
  if (pct >= 40) return '#f39c12'
  return '#e74c3c'
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

import React from 'react'

export function VegDot({ type }) {
  return <span className={type === 'veg' ? 'veg-dot' : 'nonveg-dot'} />
}

export function StatusBadge({ status }) {
  const map = {
    active:   'badge-success', inactive: 'badge-danger',
    'on-leave': 'badge-warning', paid: 'badge-success',
    pending:  'badge-warning',  new: 'badge-orange',
    preparing:'badge-warning',  ready: 'badge-success',
    delivered:'badge-info',     rejected: 'badge-danger',
  }
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>
}

export function LoadingScreen() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:16 }}>
      <div className="spinner" style={{ width:36, height:36, borderTopColor:'#c0392b' }} />
      <span style={{ color:'var(--text2)', fontSize:13, fontWeight:600 }}>Loading…</span>
    </div>
  )
}

export function EmptyState({ icon = '📭', message = 'Nothing here yet' }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text3)' }}>
      <div style={{ fontSize:40, marginBottom:12, opacity:0.5 }}>{icon}</div>
      <div style={{ fontSize:13, fontWeight:600 }}>{message}</div>
    </div>
  )
}

export function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
      <div>
        <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ icon, label, value, sub, color = 'var(--primary)', bg = 'var(--primary-bg)' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

export function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ width:380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn btn-sm" onClick={onCancel}>✕</button>
        </div>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>{message}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn" style={{ flex:1, justifyContent:'center' }} onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={{ flex:2, justifyContent:'center', background: danger ? '#c0392b' : undefined, color: danger ? '#fff' : undefined }}
            onClick={onConfirm}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
