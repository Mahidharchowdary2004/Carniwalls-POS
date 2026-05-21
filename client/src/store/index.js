import axios from 'axios'
import { create } from 'zustand'
import { io } from 'socket.io-client'

const BASE = '/api'
const socket = io(window.location.origin.replace('5173', '3001')) // Assuming dev server proxy

const api = axios.create({ baseURL: BASE })
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('rq_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('rq_token')
    window.location.href = '/login'
  }
  return Promise.reject(err)
})

export { api, socket }

export const useStore = create((set, get) => ({
  user: null,
  outlet: null,
  tables: [],
  categories: [],
  menuItems: [],
  activeOrders: [],
  onlineOrders: [],
  inventory: [],
  sidebarOpen: false,
  posState: {
    selectedTable: null,
    activeOrderId: null,
    cart: [],
    customerName: '',
    discount: 0,
    discountType: 'amt', // 'amt' or 'pct'
    orderType: 'dine-in'
  },

  setUser: (user) => {
    set({ user });
    if (user && user.outlet_id) {
      socket.emit('join-outlet', user.outlet_id);
    }
  },
  setOutlet: (outlet) => set({ outlet }),

  initSocket: () => {
    const { user } = get();
    if (user && user.outlet_id) {
      socket.emit('join-outlet', user.outlet_id);
    }

    socket.on('new-order', (order) => {
      set(s => ({ activeOrders: [...s.activeOrders, order] }));
    });

    socket.on('order-update', (order) => {
      set(s => ({ activeOrders: s.activeOrders.map(o => o.id === order.id ? order : o) }));
    });

    socket.on('table-update', (table) => {
      set(s => ({ tables: s.tables.map(t => t.id === table.id ? { ...t, ...table } : t) }));
    });
  },

  login: async (identifier, password, isPhone = false) => {
    const payload = isPhone ? { phone: identifier, password } : { email: identifier, password }
    const { data } = await api.post('/auth/login', payload)
    localStorage.setItem('rq_token', data.token)
    set({ user: data.user })
    if (data.user.outlet_id) socket.emit('join-outlet', data.user.outlet_id);
    return data
  },
  logout: () => {
    localStorage.removeItem('rq_token')
    set({ user: null })
  },

  fetchTables: async () => {
    const { data } = await api.get('/tables')
    set({ tables: data })
  },
  updateTable: async (id, updates) => {
    const { data } = await api.put(`/tables/${id}`, updates)
    set(s => ({ tables: s.tables.map(t => t.id === id ? data : t) }))
  },
  saveTableLayout: async (tables) => {
    await api.post('/tables/bulk-update', { tables })
    set({ tables })
  },

  fetchMenu: async () => {
    const [cats, items] = await Promise.all([api.get('/categories'), api.get('/menu')])
    set({ categories: cats.data, menuItems: items.data })
  },
  saveMenuItem: async (item) => {
    const { data } = item.id ? await api.put(`/menu/${item.id}`, item) : await api.post('/menu', item)
    set(s => ({
      menuItems: item.id ? s.menuItems.map(i => i.id === item.id ? data : i) : [...s.menuItems, data]
    }))
    return data
  },
  toggleFavorite: async (id, is_favorite) => {
    const { data } = await api.put(`/menu/${id}`, { is_favorite })
    set(s => ({ menuItems: s.menuItems.map(i => i.id === id ? data : i) }))
  },

  fetchOrders: async () => {
    const { data } = await api.get('/orders')
    set({ activeOrders: data })
  },
  createOrder: async (order) => {
    const { data } = await api.post('/orders', order)
    // socket will handle state update via 'new-order' event
    return data
  },
  updateOrder: async (id, updates) => {
    const { data } = await api.put(`/orders/${id}`, updates)
    return data
  },
  generateBill: async (order_id, payment_method, discount) => {
    const { data } = await api.post('/bills', { order_id, payment_method, discount })
    set(s => ({ activeOrders: s.activeOrders.filter(o => o.id !== order_id) }))
    return data
  },
  cancelOrder: async (id) => {
    await api.delete(`/orders/${id}`)
    set(s => ({ activeOrders: s.activeOrders.filter(o => o.id !== id) }))
  },
  transferTable: async (fromId, toId) => {
    await api.post('/tables/transfer', { from_table_id: fromId, to_table_id: toId })
    // socket will handle table-update and order-update
  },
  fetchBills: async (params) => {
    const { data } = await api.get('/bills', { params })
    return data
  },

  fetchOnlineOrders: async () => {
    const { data } = await api.get('/online-orders')
    set({ onlineOrders: data })
  },
  updateOnlineOrder: async (id, updates) => {
    const { data } = await api.put(`/online-orders/${id}`, updates)
    set(s => ({ onlineOrders: s.onlineOrders.map(o => o.id === id ? data : o) }))
  },

  fetchInventory: async () => {
    const { data } = await api.get('/inventory')
    set({ inventory: data })
  },
  saveInventoryItem: async (item) => {
    const { data } = item.id ? await api.put(`/inventory/${item.id}`, item) : await api.post('/inventory', item)
    set(s => ({
      inventory: item.id ? s.inventory.map(i => i.id === item.id ? data : i) : [...s.inventory, data]
    }))
    return data
  },
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setPosState: (updates) => set(s => ({ posState: { ...s.posState, ...updates } })),
}))
