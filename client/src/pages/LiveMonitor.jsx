import React, { useEffect, useState } from 'react'
import { useStore, api } from '../store'
import toast from 'react-hot-toast'

export default function LiveMonitor() {
  const { tables, fetchTables, orders, fetchOrders } = useStore()
  const [kots, setKots] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      await Promise.all([fetchTables(), fetchOrders()])
      const { data } = await api.get('/kots')
      setKots(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 10000)
    return () => clearInterval(t)
  }, [])

  const occupiedTables = tables.filter(t => t.status === 'occupied')
  const pendingOrders = orders.filter(o => o.status === 'open')
  const preparingKots = kots.filter(k => k.status === 'preparing')
  const readyKots = kots.filter(k => k.status === 'ready')

  if (loading) return <div className="p-6 text-center">Loading Live Data...</div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Restaurant Monitoring</h1>
          <p className="text-sm text-gray-500">Real-time overview of your floor and kitchen</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div> LIVE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Active Tables', value: occupiedTables.length, sub: `${tables.length} Total`, color: 'blue', icon: '🪑' },
          { label: 'Live Orders', value: pendingOrders.length, sub: 'In progress', color: 'orange', icon: '🧾' },
          { label: 'Pending KOT', value: preparingKots.length, sub: 'In kitchen', color: 'red', icon: '👨‍🍳' },
          { label: 'Ready to Serve', value: readyKots.length, sub: 'Waiting for pickup', color: 'green', icon: '🛎️' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className={`w-10 h-10 rounded-xl bg-${s.color}-50 flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
            <div className="text-gray-500 text-sm font-medium">{s.label}</div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Table Status Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-bottom bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Table Occupancy</h3>
            <span className="text-xs font-semibold text-gray-500">{occupiedTables.length}/{tables.length} Occupied</span>
          </div>
          <div className="p-6 grid grid-cols-4 md:grid-cols-6 gap-4">
            {tables.map(t => (
              <div 
                key={t.id} 
                className={`aspect-square relative rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                  t.status === 'occupied' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-gray-100 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`font-bold ${t.status === 'occupied' ? 'text-red-700' : 'text-gray-700'}`} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 32, opacity: 0.2 }}>{String(t.number).replace(/^T-?/i, '')}</div>
                {t.status === 'occupied' && (
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live Order List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-bottom bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Recent Orders</h3>
            <button className="text-xs font-bold text-blue-600">View All</button>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 font-bold">
                  <tr>
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Table/Customer</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">KOT</th>
                    <th className="px-6 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingOrders.slice(0, 8).map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">#{o.id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-800">{o.table_id ? `Table ${tables.find(t => t.id === o.table_id)?.number}` : o.customer_name || 'Takeaway'}</div>
                        <div className="text-[11px] text-gray-400">{o.order_type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          o.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>{o.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          o.kot_status === 'preparing' ? 'bg-orange-100 text-orange-700' : 
                          o.kot_status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>{o.kot_status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">₹{o.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
