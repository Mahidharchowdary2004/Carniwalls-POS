import React, { useEffect } from 'react'
import { useStore } from '../store'
import toast from 'react-hot-toast'

export default function KitchenDisplay() {
  const { kots, fetchKots, updateKotStatus } = useStore()

  useEffect(() => {
    fetchKots()
  }, [])

  async function handleStatusChange(id, newStatus) {
    try {
      await updateKotStatus(id, newStatus)
      toast.success(`KOT ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  return (
    <div style={{ padding: 20, height: 'calc(100vh - 52px)', background: '#1a1f2e', color: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>👨‍🍳 Kitchen Display System</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#2d3436', padding: '5px 15px', borderRadius: 20, fontSize: 13 }}>
            Live Orders: {kots.length}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, overflowY: 'auto', alignContent: 'start' }}>
        {kots.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 100, color: '#636e72' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🥘</div>
            <h2>No active orders in kitchen</h2>
          </div>
        ) : kots.map(kot => (
          <div key={kot.id} style={{ background: '#2d3436', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: 15, background: kot.status === 'preparing' ? '#d63031' : '#fdcb6e', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>TABLE {kot.table_number || 'DELIVERY'}</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{kot.id.split('_')[1]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{new Date(kot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{kot.status}</div>
              </div>
            </div>

            <div style={{ padding: 15, flex: 1 }}>
              {kot.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #3d4648' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ background: '#455052', padding: '2px 8px', borderRadius: 4, fontSize: 14, fontWeight: 800 }}>{item.qty}</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</span>
                  </div>
                </div>
              ))}
              {kot.notes && (
                <div style={{ marginTop: 15, padding: 10, background: 'rgba(214, 48, 49, 0.1)', borderLeft: '3px solid #d63031', fontSize: 13, color: '#fab1a0' }}>
                  <strong>Note:</strong> {kot.notes}
                </div>
              )}
            </div>

            <div style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#1e272e' }}>
              {kot.status === 'preparing' ? (
                <button 
                  onClick={() => handleStatusChange(kot.id, 'ready')}
                  style={{ gridColumn: '1/-1', background: '#27ae60', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
                >
                  MARK AS READY ✅
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => handleStatusChange(kot.id, 'preparing')}
                    style={{ background: '#34495e', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                  >
                    BACK TO PREP
                  </button>
                  <button 
                    onClick={() => handleStatusChange(kot.id, 'served')}
                    style={{ background: '#0984e3', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                  >
                    SERVED 🍽️
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
