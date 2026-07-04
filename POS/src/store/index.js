import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export const useStore = create((set, get) => ({
  user: null,
  outlet: null,
  tables: [],
  categories: [],
  menuItems: [],
  activeOrders: [],
  kots: [],
  
  posState: {
    selectedTable: null,
    cart: [],
    customerName: '',
  },

  // Auth
  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('rq_token');
      if (!token) return false;
      
      const userStr = await AsyncStorage.getItem('rq_user');
      if (userStr) {
        set({ user: JSON.parse(userStr) });
      } else {
        set({ user: { id: 'restored' } });
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  login: async (identifier, password, isPhone = false) => {
    const payload = isPhone ? { phone: identifier, password } : { email: identifier, password };
    try {
      const { data } = await api.post('/auth/login', payload);
      await AsyncStorage.setItem('rq_token', data.token);
      
      let userObj = data.user;
      if (userObj && !userObj.outlet_id) {
        try {
          const tokenPayload = JSON.parse(atob(data.token.split('.')[1]));
          userObj.outlet_id = tokenPayload.outlet_id;
        } catch (e) {}
      }
      if (userObj && !userObj.outlet_id) {
        userObj.outlet_id = 'out_main';
      }

      set({ user: userObj, outlet: userObj.outlet || null });
      await AsyncStorage.setItem('rq_user', JSON.stringify(userObj));
      return data;
    } catch (err) {
      throw err;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('rq_token');
    await AsyncStorage.removeItem('rq_user');
    set({ user: null, outlet: null });
  },

  // Tables
  fetchTables: async () => {
    const { user, logout } = get();
    if (!user) return;
    try {
      const { data } = await api.get('/tables');
      set({ tables: data });
    } catch (error) {
      console.error('fetchTables error:', error);
      if (error.response?.status === 401) logout();
    }
  },

  // Menu
  fetchMenu: async () => {
    const { user, logout } = get();
    if (!user) return;
    try {
      const [catsRes, menuRes] = await Promise.all([
        api.get('/categories'),
        api.get('/menu')
      ]);
      set({ categories: catsRes.data, menuItems: menuRes.data });
    } catch (error) {
      console.error('fetchMenu error:', error);
      if (error.response?.status === 401) logout();
    }
  },

  // Orders
  fetchOrders: async () => {
    const { user, logout } = get();
    if (!user) return;
    try {
      const { data } = await api.get('/orders');
      set({ activeOrders: data });
    } catch (error) {
      console.error('fetchOrders error:', error);
      if (error.response?.status === 401) logout();
    }
  },

  // KOTs
  fetchKots: async () => {
    const { user, logout } = get();
    if (!user) return;
    try {
      const { data } = await api.get('/kots');
      set({ kots: data });
    } catch (error) {
      console.error('fetchKots error:', error);
      if (error.response?.status === 401) logout();
    }
  },

  createOrder: async (orderPayload) => {
    try {
      const { data } = await api.post('/orders', orderPayload);
      set((s) => ({ activeOrders: [...s.activeOrders, data] }));
      get().fetchTables(); // Refresh table status
      return data;
    } catch (error) {
      console.error('createOrder error:', error);
      throw error;
    }
  },

  updateOrder: async (id, orderPayload) => {
    try {
      const { data } = await api.put(`/orders/${id}`, orderPayload);
      set((s) => ({ activeOrders: s.activeOrders.map(o => o.id === id ? data : o) }));
      get().fetchTables();
      return data;
    } catch (error) {
      console.error('updateOrder error:', error);
      throw error;
    }
  },

  generateBill: async (order_id, payment_method = 'cash', discount = 0) => {
    try {
      const order = get().activeOrders.find(o => o.id === order_id);
      const total = order ? (Number(order.subtotal || 0) - discount) : 0;
      
      const { data } = await api.post('/bills', {
        order_id,
        payment_method: { method: payment_method, amount: total },
        discount
      });
      set((s) => ({ activeOrders: s.activeOrders.filter((o) => o.id !== order_id) }));
      get().fetchTables(); // Refresh table status
      return data;
    } catch (error) {
      console.error('generateBill error:', error);
      throw error;
    }
  },

  // Cart actions
  setSelectedTable: (table) => set((s) => ({ posState: { ...s.posState, selectedTable: table } })),
  
  addToCart: (item) => set((s) => {
    const existing = s.posState.cart.find((i) => i.id === item.id);
    if (existing) {
      return {
        posState: {
          ...s.posState,
          cart: s.posState.cart.map((i) =>
            i.id === item.id ? { ...i, qty: i.qty + 1 } : i
          )
        }
      };
    }
    return {
      posState: {
        ...s.posState,
        cart: [...s.posState.cart, { ...item, qty: 1 }]
      }
    };
  }),

  removeFromCart: (itemId) => set((s) => ({
    posState: {
      ...s.posState,
      cart: s.posState.cart.filter((i) => i.id !== itemId)
    }
  })),

  updateCartQty: (itemId, qty) => set((s) => {
    if (qty <= 0) return s;
    return {
      posState: {
        ...s.posState,
        cart: s.posState.cart.map((i) => i.id === itemId ? { ...i, qty } : i)
      }
    };
  }),

  clearCart: () => set((s) => ({
    posState: { ...s.posState, cart: [], customerName: '' }
  }))
}));
