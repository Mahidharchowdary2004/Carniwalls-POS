import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { api, socket } from './api'
import { dbAdapter, isElectron } from './dbAdapter'

// Re-export api and socket for backward compatibility
export { api, socket }

const localOfflineStorage = {
  getItem: async (name) => {
    if (window.ipcRenderer) {
      return (await window.ipcRenderer.invoke('sqlite-get', name)) || null
    }
    return (await idbGet(name)) || null
  },
  setItem: async (name, value) => {
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('sqlite-set', name, value)
      return
    }
    await idbSet(name, value)
  },
  removeItem: async (name) => {
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('sqlite-del', name)
      return
    }
    await idbDel(name)
  }
}

export const useStore = create(
  persist(
    (set, get) => ({
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
        originalCart: [],
        customerName: '',
        discount: 0,
        discountType: 'amt', // 'amt' or 'pct'
        orderType: 'dine-in',
        editingBillId: null,
        editingBillNo: null
      },
      
      // Offline support
      isOffline: !navigator.onLine,
      syncQueue: [],
      lastCheckedDate: null,
      cachedUsers: [],
      
      setOfflineStatus: (status) => {
        set({ isOffline: status });
        if (status) {
          socket.disconnect();
        } else {
          if (!socket.connected) socket.connect();
          const { user } = get();
          if (user && user.outlet_id) {
            socket.emit('join-outlet', user.outlet_id);
          }
        }
      },

      setUser: (user) => {
        let enrichedUser = user;
        if (user && !user.outlet_id) {
          const token = localStorage.getItem('rq_token');
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              enrichedUser = { ...user, outlet_id: payload.outlet_id };
            } catch (e) {
              console.error('Failed to decode JWT token in setUser:', e);
            }
          }
        }
        
        // Final fallback
        if (enrichedUser && !enrichedUser.outlet_id) {
          enrichedUser.outlet_id = 'out_main';
        }

        set({ user: enrichedUser });
        if (enrichedUser && enrichedUser.outlet_id) {
          if (!get().isOffline && !socket.connected) socket.connect();
          socket.emit('join-outlet', enrichedUser.outlet_id);
          // Set outlet info from user if not set
          if (enrichedUser.outlet) {
            set({ outlet: enrichedUser.outlet })
          }
        }
      },
      setOutlet: (outlet) => set({ outlet }),

      initSocket: () => {
        if (!get().isOffline && !socket.connected) {
          socket.connect();
        }

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

        socket.on('midnight-reset', () => {
          console.log('⏰ Midnight reset broadcast received from server!');
          get().fetchTables();
          get().fetchOrders();
        });

        // Trigger startup database synchronization if online
        if (!get().isOffline) {
          get().processSyncQueue();
        }

        // Check for local midnight reset at startup
        get().checkMidnightReset();

        // Set up robust background polling interval for sync (every 60s)
        if (window.syncInterval) clearInterval(window.syncInterval);
        window.syncInterval = setInterval(() => {
          if (!get().isOffline && get().user) {
            get().processSyncQueue();
          }
        }, 60000);

        // Periodically check local midnight reset (every 10s)
        if (window.midnightInterval) clearInterval(window.midnightInterval);
        window.midnightInterval = setInterval(() => {
          get().checkMidnightReset();
        }, 10000);
      },

      checkMidnightReset: async () => {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const { lastCheckedDate, user } = get();
        
        // If the day has changed
        if (lastCheckedDate && lastCheckedDate !== today) {
          console.log('⏰ Midnight boundary crossed on client! Clearing open orders and tables locally...');
          try {
            if (window.ipcRenderer && user?.outlet_id) {
              // Local SQLite Reset for Electron POS
              await window.ipcRenderer.invoke('sqlite-run', "UPDATE orders SET status = 'cancelled' WHERE status = 'open' AND outlet_id = ?", [user.outlet_id]);
              await window.ipcRenderer.invoke('sqlite-run', "UPDATE tables SET status = 'free' WHERE outlet_id = ?", [user.outlet_id]);
            }
            // Refresh local store tables and orders
            await Promise.all([get().fetchTables(), get().fetchOrders()]);
          } catch (err) {
            console.error('Local midnight reset error:', err);
          }
        }
        
        set({ lastCheckedDate: today });
      },

      login: async (identifier, password, isPhone = false) => {
        const simpleHash = (str) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
          }
          return hash.toString();
        };

        const tryOfflineLogin = () => {
          const matchingUser = (get().cachedUsers || []).find(u => 
            isPhone ? u.phone === identifier : u.email === identifier
          );
          if (matchingUser && matchingUser.passwordHash === simpleHash(password)) {
            localStorage.setItem('rq_token', matchingUser.token);
            set({ user: matchingUser.user, outlet: matchingUser.user.outlet || null });
            return { user: matchingUser.user, token: matchingUser.token };
          } else {
            throw new Error('Invalid offline credentials');
          }
        };

        // Offline Login Fallback (forced offline state)
        if (get().isOffline) {
          return tryOfflineLogin();
        }

        const payload = isPhone ? { phone: identifier, password } : { email: identifier, password }
        try {
          const { data } = await api.post('/auth/login', payload)
          localStorage.setItem('rq_token', data.token)
          
          // Extract outlet_id from JWT
          let userObj = data.user
          if (userObj && !userObj.outlet_id) {
            try {
              const tokenPayload = JSON.parse(atob(data.token.split('.')[1]));
              userObj.outlet_id = tokenPayload.outlet_id;
            } catch (e) {
              console.error('Failed to extract outlet_id from token on login:', e);
            }
          }

          // Final fallback
          if (userObj && !userObj.outlet_id) {
            userObj.outlet_id = 'out_main';
          }
          
          // Fetch outlet details
          try {
            if (userObj.outlet_id) {
              const outRes = await api.get(`/outlets/${userObj.outlet_id}`)
              userObj.outlet = outRes.data
            }
          } catch (err) {
            console.warn('Failed to fetch outlet details on login:', err)
          }

          const enrichedUser = { ...userObj, outlet: userObj.outlet || null };
          set({ user: enrichedUser, outlet: enrichedUser.outlet || null })
          if (enrichedUser.outlet_id) socket.emit('join-outlet', enrichedUser.outlet_id);
          
          // Cache this user credentials locally for future offline logins
          const newCachedUser = {
            email: enrichedUser.email,
            phone: enrichedUser.phone,
            passwordHash: simpleHash(password),
            user: enrichedUser,
            token: data.token
          };
          const updatedCachedUsers = [
            ...(get().cachedUsers || []).filter(u => u.email !== enrichedUser.email && u.phone !== enrichedUser.phone),
            newCachedUser
          ];
          set({ cachedUsers: updatedCachedUsers });
          
          // Pull latest data and populate local SQLite
          if (userObj.outlet_id) {
            try {
              console.log('Online login - performing initial synchronization...')
              const [catsRes, menuRes, tablesRes, ordersRes, invRes, billsRes] = await Promise.all([
                api.get('/categories'),
                api.get('/menu'),
                api.get('/tables'),
                api.get('/orders'),
                api.get('/inventory'),
                api.get('/bills', { params: { limit: 500 } })
              ])

              const serverData = {
                categories: catsRes.data,
                menuItems: menuRes.data,
                tables: tablesRes.data,
                activeOrders: ordersRes.data,
                inventory: invRes.data,
                bills: billsRes.data
              }

              if (isElectron) {
                await dbAdapter.hydrateSQLite(serverData, userObj.outlet_id)
              }

              set({
                categories: serverData.categories,
                menuItems: serverData.menuItems,
                tables: serverData.tables,
                activeOrders: serverData.activeOrders,
                inventory: serverData.inventory
              })
            } catch (syncErr) {
              console.error('Initial database hydration failed:', syncErr)
            }
          }

          return data
        } catch (loginErr) {
          // If login fails due to a network connection/unreachable server, fall back to offline login
          if (!loginErr.response) {
            console.log('Server unreachable. Attempting offline authentication fallback...');
            try {
              return tryOfflineLogin();
            } catch (offlineErr) {
              throw offlineErr;
            }
          }
          throw loginErr;
        }
      },
      logout: () => {
        localStorage.removeItem('rq_token')
        set({ user: null, outlet: null })
      },

      // --- TABLES ---
      fetchTables: async () => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.getTables(user.outlet_id)
          set({ tables: data })
        } catch (error) {
          console.error('fetchTables error:', error)
          if (!get().isOffline) throw error
        }
      },
      updateTable: async (id, updates) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.updateTable(id, updates, user.outlet_id)
          if (data) {
            set(s => ({ tables: s.tables.map(t => t.id === id ? { ...t, ...data } : t) }))
          }
        } catch (error) {
          console.error('updateTable error:', error)
          throw error
        }
      },
      saveTableLayout: async (tables) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          await dbAdapter.saveTableLayout(tables, user.outlet_id)
          set({ tables })
        } catch (error) {
          console.error('saveTableLayout error:', error)
          throw error
        }
      },

      // --- MENU & CATEGORIES ---
      fetchMenu: async () => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const [cats, items] = await Promise.all([
            dbAdapter.getCategories(user.outlet_id),
            dbAdapter.getMenuItems(user.outlet_id)
          ])
          set({ categories: cats, menuItems: items })
        } catch (error) {
          console.error('fetchMenu error:', error)
          if (!get().isOffline) throw error
        }
      },
      saveMenuItem: async (item) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.saveMenuItem(item, user.outlet_id)
          set(s => ({
            menuItems: item.id ? s.menuItems.map(i => i.id === item.id ? data : i) : [...s.menuItems, data]
          }))
          return data
        } catch (error) {
          console.error('saveMenuItem error:', error)
          throw error
        }
      },
      saveCategory: async (category) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.saveCategory(category, user.outlet_id)
          set(s => ({
            categories: category.id ? s.categories.map(c => c.id === category.id ? data : c) : [...s.categories, data]
          }))
          return data
        } catch (error) {
          console.error('saveCategory error:', error)
          throw error
        }
      },
      deleteCategory: async (id) => {
        try {
          await dbAdapter.deleteCategory(id)
          set(s => ({
            categories: s.categories.filter(c => c.id !== id)
          }))
        } catch (error) {
          console.error('deleteCategory error:', error)
          throw error
        }
      },
      toggleFavorite: async (id, is_favorite) => {
        try {
          await dbAdapter.toggleFavorite(id, is_favorite)
          set(s => ({ menuItems: s.menuItems.map(i => i.id === id ? { ...i, is_favorite } : i) }))
        } catch (error) {
          console.error('toggleFavorite error:', error)
          throw error
        }
      },

      // --- ORDERS ---
      fetchOrders: async () => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.getOrders(user.outlet_id)
          set({ activeOrders: data })
        } catch (error) {
          console.error('fetchOrders error:', error)
          if (!get().isOffline) throw error
        }
      },
      createOrder: async (order) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.createOrder(order, user.outlet_id)
          set(s => ({ activeOrders: [...s.activeOrders, data] }))
          
          // Optimistically refresh tables
          get().fetchTables()
          
          return data
        } catch (error) {
          console.error('createOrder error:', error)
          throw error
        }
      },
      updateOrder: async (id, updates) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.updateOrder(id, updates, user.outlet_id)
          if (data) {
            set(s => ({ activeOrders: s.activeOrders.map(o => o.id === id ? data : o) }))
          }
          return data
        } catch (error) {
          console.error('updateOrder error:', error)
          throw error
        }
      },
      generateBill: async (order_id, payment_method, discount) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.createBill(order_id, payment_method, discount, user.outlet_id)
          set(s => ({ activeOrders: s.activeOrders.filter(o => o.id !== order_id) }))
          
          // Optimistically update tables
          get().fetchTables()
          
          return data
        } catch (error) {
          console.error('generateBill error:', error)
          throw error
        }
      },
      cancelOrder: async (id) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          await dbAdapter.cancelOrder(id, user.outlet_id)
          set(s => ({ activeOrders: s.activeOrders.filter(o => o.id !== id) }))
          
          // Optimistically update tables
          get().fetchTables()
        } catch (error) {
          console.error('cancelOrder error:', error)
          throw error
        }
      },
      transferTable: async (fromId, toId) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          await dbAdapter.transferTable(fromId, toId, user.outlet_id)
          // Refresh state
          await Promise.all([get().fetchTables(), get().fetchOrders()])
        } catch (error) {
          console.error('transferTable error:', error)
          throw error
        }
      },

      // --- BILLS ---
      fetchBills: async (params) => {
        const { user } = get()
        if (!user || !user.outlet_id) return []
        try {
          const data = await dbAdapter.getBills(params, user.outlet_id)
          return data
        } catch (error) {
          console.error('fetchBills error:', error)
          if (!get().isOffline) throw error
          return []
        }
      },

      // --- ONLINE ORDERS ---
      fetchOnlineOrders: async () => {
        try {
          const { data } = await api.get('/online-orders')
          set({ onlineOrders: data })
        } catch (error) {
          if (!get().isOffline) throw error
        }
      },
      updateOnlineOrder: async (id, updates) => {
        try {
          const { data } = await api.put(`/online-orders/${id}`, updates)
          set(s => ({ onlineOrders: s.onlineOrders.map(o => o.id === id ? data : o) }))
          return data
        } catch (error) {
          console.error('updateOnlineOrder error:', error)
          throw error
        }
      },

      // --- INVENTORY ---
      fetchInventory: async () => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.getInventory(user.outlet_id)
          set({ inventory: data })
        } catch (error) {
          console.error('fetchInventory error:', error)
          if (!get().isOffline) throw error
        }
      },
      saveInventoryItem: async (item) => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        try {
          const data = await dbAdapter.saveInventoryItem(item, user.outlet_id)
          set(s => ({
            inventory: item.id ? s.inventory.map(i => i.id === item.id ? data : i) : [...s.inventory, data]
          }))
          return data
        } catch (error) {
          console.error('saveInventoryItem error:', error)
          throw error
        }
      },

      // --- BACKGROUND SYNC ENGINE ---
      processSyncQueue: async () => {
        const { isOffline, user } = get()
        if (isOffline || !user || !user.outlet_id) return

        let queue = []
        if (isElectron) {
          queue = await dbAdapter.getSyncQueue()
        } else {
          queue = get().syncQueue
        }

        if (queue.length === 0) return
        console.log(`🔄 Syncing queue: ${queue.length} items outstanding.`)

        const remainingQueue = [...queue]

        for (const item of queue) {
          try {
            if (typeof item.data === 'string') {
              try { item.data = JSON.parse(item.data); } catch (e) {}
            }
            if (typeof item.data === 'string') {
              try { item.data = JSON.parse(item.data); } catch (e) {}
            }
            console.log(`Syncing sync-action: ${item.action} on ${item.table_name}`, item.data)
            
            switch (item.action) {
              case 'CREATE_CATEGORY':
              case 'UPDATE_CATEGORY': {
                const cleanData = { ...item.data }
                cleanData.is_active = !!cleanData.is_active
                if (item.action === 'CREATE_CATEGORY') {
                  await api.post('/categories', cleanData)
                } else {
                  await api.put(`/categories/${item.record_id}`, cleanData)
                }
                break
              }
              case 'DELETE_CATEGORY':
                await api.delete(`/categories/${item.record_id}`)
                break

              case 'CREATE_MENU_ITEM':
              case 'UPDATE_MENU_ITEM': {
                const cleanData = { ...item.data }
                cleanData.active = !!cleanData.active
                cleanData.available_dine = !!cleanData.available_dine
                cleanData.available_takeaway = !!cleanData.available_takeaway
                cleanData.available_delivery = !!cleanData.available_delivery
                cleanData.is_favorite = !!cleanData.is_favorite
                if (item.action === 'CREATE_MENU_ITEM') {
                  await api.post('/menu', cleanData)
                } else {
                  await api.put(`/menu/${item.record_id}`, cleanData)
                }
                break
              }
              case 'DELETE_MENU_ITEM':
                await api.delete(`/menu/${item.record_id}`)
                break

              case 'TOGGLE_FAVORITE':
                await api.put(`/menu/${item.record_id}`, { is_favorite: !!item.data.is_favorite })
                break

              case 'UPDATE_TABLE':
                await api.put(`/tables/${item.record_id}`, item.data.updates)
                break

              case 'SAVE_TABLE_LAYOUT':
                await api.post('/tables/bulk-update', { tables: item.data.tables })
                break

              case 'TRANSFER_TABLE':
                await api.post('/tables/transfer', { from_table_id: item.data.fromId, to_table_id: item.data.toId })
                break

              case 'CREATE_ORDER': {
                const cleanData = { ...item.data }
                if (typeof cleanData.items === 'string') {
                  cleanData.items = JSON.parse(cleanData.items)
                }
                await api.post('/orders', cleanData)
                break
              }
              case 'UPDATE_ORDER': {
                const cleanData = { ...item.data }
                if (typeof cleanData.updates.items === 'string') {
                  cleanData.updates.items = JSON.parse(cleanData.updates.items)
                }
                await api.put(`/orders/${item.record_id}`, cleanData.updates)
                break
              }
              case 'CANCEL_ORDER':
                await api.delete(`/orders/${item.record_id}`)
                break

              case 'CREATE_BILL': {
                const cleanData = { ...item.data }
                if (typeof cleanData.items === 'string') {
                  cleanData.items = JSON.parse(cleanData.items)
                }
                if (typeof cleanData.payment_method === 'string') {
                  cleanData.payment_method = JSON.parse(cleanData.payment_method)
                }
                await api.post('/bills', {
                  id: cleanData.id,
                  bill_no: cleanData.bill_no,
                  created_at: cleanData.created_at,
                  order_id: cleanData.order_id,
                  payment_method: cleanData.payment_method,
                  discount: cleanData.discount
                })
                break
              }
              case 'UPDATE_BILL': {
                await api.put(`/bills/${item.record_id}`, item.data.updates)
                break
              }

              case 'CREATE_INVENTORY_ITEM':
              case 'UPDATE_INVENTORY_ITEM':
                if (item.action === 'CREATE_INVENTORY_ITEM') {
                  await api.post('/inventory', item.data)
                } else {
                  await api.put(`/inventory/${item.record_id}`, item.data)
                }
                break
            }

            if (isElectron) {
              await dbAdapter.deleteFromSyncQueue(item.id)
            }
            remainingQueue.shift()
          } catch (err) {
            console.error('Failed to sync item:', item, err)
            // Skip item if it is a 4xx client-side bad request (invalid data / already exists / etc)
            if (err.response && err.response.status >= 400 && err.response.status < 500) {
              console.warn('Skipping queue item due to persistent 4xx client error.')
              if (isElectron) {
                await dbAdapter.deleteFromSyncQueue(item.id)
              }
              remainingQueue.shift()
              continue
            }
            // Halt sync on standard network errors
            break
          }
        }

        if (!isElectron) {
          set({ syncQueue: remainingQueue })
        }

        // Pull latest updates from cloud if queue was cleared successfully
        if (remainingQueue.length === 0) {
          await get().pullLatestDataFromServer()
        }
      },

      pullLatestDataFromServer: async () => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        
        try {
          console.log('📥 Pulling latest data from cloud server...')
          
          const [catsRes, menuRes, tablesRes, ordersRes, invRes, billsRes] = await Promise.all([
            api.get('/categories'),
            api.get('/menu'),
            api.get('/tables'),
            api.get('/orders'),
            api.get('/inventory'),
            api.get('/bills', { params: { limit: 500 } })
          ])

          const serverData = {
            categories: catsRes.data,
            menuItems: menuRes.data,
            tables: tablesRes.data,
            activeOrders: ordersRes.data,
            inventory: invRes.data,
            bills: billsRes.data
          }

          if (isElectron) {
            await dbAdapter.hydrateSQLite(serverData, user.outlet_id)
          }

          set({
            categories: serverData.categories,
            menuItems: serverData.menuItems,
            tables: serverData.tables,
            activeOrders: serverData.activeOrders,
            inventory: serverData.inventory
          })

          console.log('✅ SQLite database and Zustand state fully synchronized with Cloud Server!')
        } catch (err) {
          console.error('Failed to pull data from server:', err)
        }
      },

      pullAllDataFromServer: async () => {
        const { user } = get()
        if (!user || !user.outlet_id) return
        
        try {
          console.log('📥 Pulling ALL historical data from cloud database to local SQLite...')
          
          const [catsRes, menuRes, tablesRes, ordersRes, invRes, billsRes] = await Promise.all([
            api.get('/categories'),
            api.get('/menu'),
            api.get('/tables'),
            api.get('/orders'),
            api.get('/inventory'),
            api.get('/bills', { params: { limit: 100000 } })
          ])

          const serverData = {
            categories: catsRes.data,
            menuItems: menuRes.data,
            tables: tablesRes.data,
            activeOrders: ordersRes.data,
            inventory: invRes.data,
            bills: billsRes.data
          }

          if (isElectron) {
            await dbAdapter.hydrateSQLite(serverData, user.outlet_id)
          }

          set({
            categories: serverData.categories,
            menuItems: serverData.menuItems,
            tables: serverData.tables,
            activeOrders: serverData.activeOrders,
            inventory: serverData.inventory
          })

          console.log('✅ All historical data successfully copied to SQLite!')
        } catch (err) {
          console.error('Failed to copy cloud data to SQLite:', err)
          throw err
        }
      },

      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
      setPosState: (updates) => set(s => ({ posState: { ...s.posState, ...updates } })),
    }),
    {
      name: 'pos-store',
      storage: createJSONStorage(() => localOfflineStorage),
      partialize: (state) => ({
        tables: state.tables,
        categories: state.categories,
        menuItems: state.menuItems,
        activeOrders: state.activeOrders,
        inventory: state.inventory,
        syncQueue: state.syncQueue,
        user: state.user,
        lastCheckedDate: state.lastCheckedDate,
        cachedUsers: state.cachedUsers
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.user && !state.user.outlet_id) {
          state.user.outlet_id = 'out_main';
        }
      }
    }
  )
)
