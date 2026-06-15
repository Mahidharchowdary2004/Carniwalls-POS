import { api } from './api'

// Helper to check if running in Electron
export const isElectron = !!window.ipcRenderer

// Helper to convert objects to/from JSON/string for SQLite
const serialize = (val) => (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val
const deserialize = (val) => {
  if (typeof val !== 'string') return val
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

// Relational database interface wrapper
const db = {
  run: async (sql, params = []) => {
    if (!isElectron) throw new Error('Relational database only available in Electron')
    return await window.ipcRenderer.invoke('sqlite-run', sql, params)
  },
  all: async (sql, params = []) => {
    if (!isElectron) throw new Error('Relational database only available in Electron')
    const rows = await window.ipcRenderer.invoke('sqlite-all', sql, params)
    return rows || []
  },
  row: async (sql, params = []) => {
    if (!isElectron) throw new Error('Relational database only available in Electron')
    return await window.ipcRenderer.invoke('sqlite-row', sql, params)
  },
  transaction: async (queries) => {
    if (!isElectron) throw new Error('Relational database only available in Electron')
    return await window.ipcRenderer.invoke('sqlite-transaction', queries)
  }
}

export const dbAdapter = {
  // --- SYNC QUEUE HELPER ---
  addToSyncQueue: async (action, tableName, recordId, data) => {
    if (!isElectron) return
    const sql = `INSERT INTO sync_queue (action, table_name, record_id, data, created_at) VALUES (?, ?, ?, ?, ?)`
    await db.run(sql, [action, tableName, recordId, JSON.stringify(serialize(data)), new Date().toISOString()])
  },

  getSyncQueue: async () => {
    if (!isElectron) return []
    const rows = await db.all(`SELECT * FROM sync_queue ORDER BY id ASC`)
    return rows.map(r => ({
      ...r,
      data: deserialize(r.data)
    }))
  },

  deleteFromSyncQueue: async (id) => {
    if (!isElectron) return
    await db.run(`DELETE FROM sync_queue WHERE id = ?`, [id])
  },

  // --- CATEGORIES ---
  getCategories: async (outletId) => {
    if (isElectron) {
      const rows = await db.all(`SELECT * FROM categories WHERE outlet_id = ? ORDER BY sort_order ASC`, [outletId])
      return rows.map(r => ({ ...r, is_active: !!r.is_active }))
    } else {
      const { data } = await api.get('/categories')
      return data
    }
  },

  saveCategory: async (category, outletId) => {
    const id = category.id || `c${Date.now()}`
    const record = {
      id,
      name: category.name,
      icon: category.icon,
      sort_order: parseInt(category.sort_order) || 0,
      is_active: category.is_active !== false ? 1 : 0,
      outlet_id: outletId
    }

    if (isElectron) {
      const sql = `INSERT OR REPLACE INTO categories (id, name, icon, sort_order, is_active, outlet_id) VALUES (?, ?, ?, ?, ?, ?)`
      await db.run(sql, [record.id, record.name, record.icon, record.sort_order, record.is_active, record.outlet_id])
      await dbAdapter.addToSyncQueue(category.id ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY', 'categories', record.id, record)
      return { ...record, is_active: !!record.is_active }
    } else {
      const { data } = category.id 
        ? await api.put(`/categories/${category.id}`, category) 
        : await api.post('/categories', category)
      return data
    }
  },

  deleteCategory: async (id) => {
    if (isElectron) {
      await db.run(`DELETE FROM categories WHERE id = ?`, [id])
      await dbAdapter.addToSyncQueue('DELETE_CATEGORY', 'categories', id, { id })
      return { success: true }
    } else {
      const { data } = await api.delete(`/categories/${id}`)
      return data
    }
  },

  // --- MENU ITEMS ---
  getMenuItems: async (outletId) => {
    if (isElectron) {
      const rows = await db.all(`SELECT * FROM menu_items WHERE outlet_id = ?`, [outletId])
      return rows.map(r => ({
        ...r,
        active: !!r.active,
        available_dine: !!r.available_dine,
        available_takeaway: !!r.available_takeaway,
        available_delivery: !!r.available_delivery,
        is_favorite: !!r.is_favorite
      }))
    } else {
      const { data } = await api.get('/menu')
      return data
    }
  },

  saveMenuItem: async (item, outletId) => {
    const id = item.id || `m${Date.now()}`
    const record = {
      id,
      name: item.name,
      price: parseFloat(item.price) || 0,
      cost: parseFloat(item.cost) || 0,
      type: item.type || 'veg',
      description: item.description || '',
      emoji: item.emoji || '',
      active: item.active !== false ? 1 : 0,
      gst_percent: parseFloat(item.gst_percent) || 0,
      available_dine: item.available_dine !== false ? 1 : 0,
      available_takeaway: item.available_takeaway !== false ? 1 : 0,
      available_delivery: item.available_delivery !== false ? 1 : 0,
      category_id: item.category_id || null,
      stock: parseFloat(item.stock) || 0,
      min_stock: parseFloat(item.min_stock) || 0,
      outlet_id: outletId,
      is_favorite: item.is_favorite ? 1 : 0
    }

    if (isElectron) {
      const sql = `
        INSERT OR REPLACE INTO menu_items (
          id, name, price, cost, type, description, emoji, active, gst_percent, 
          available_dine, available_takeaway, available_delivery, category_id, stock, min_stock, outlet_id, is_favorite
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      await db.run(sql, [
        record.id, record.name, record.price, record.cost, record.type, record.description, record.emoji, record.active,
        record.gst_percent, record.available_dine, record.available_takeaway, record.available_delivery, record.category_id,
        record.stock, record.min_stock, record.outlet_id, record.is_favorite
      ])
      await dbAdapter.addToSyncQueue(item.id ? 'UPDATE_MENU_ITEM' : 'CREATE_MENU_ITEM', 'menu_items', record.id, record)
      return {
        ...record,
        active: !!record.active,
        available_dine: !!record.available_dine,
        available_takeaway: !!record.available_takeaway,
        available_delivery: !!record.available_delivery,
        is_favorite: !!record.is_favorite
      }
    } else {
      const { data } = item.id 
        ? await api.put(`/menu/${item.id}`, item) 
        : await api.post('/menu', item)
      return data
    }
  },

  deleteMenuItem: async (id) => {
    if (isElectron) {
      await db.run(`DELETE FROM menu_items WHERE id = ?`, [id])
      await dbAdapter.addToSyncQueue('DELETE_MENU_ITEM', 'menu_items', id, { id })
      return { success: true }
    } else {
      const { data } = await api.delete(`/menu/${id}`)
      return data
    }
  },

  toggleFavorite: async (id, isFavorite) => {
    if (isElectron) {
      const val = isFavorite ? 1 : 0
      await db.run(`UPDATE menu_items SET is_favorite = ? WHERE id = ?`, [val, id])
      await dbAdapter.addToSyncQueue('TOGGLE_FAVORITE', 'menu_items', id, { id, is_favorite: !!isFavorite })
      return { success: true }
    } else {
      const { data } = await api.put(`/menu/${id}`, { is_favorite: isFavorite })
      return data
    }
  },

  // --- TABLES ---
  getTables: async (outletId) => {
    if (isElectron) {
      const rows = await db.all(`SELECT * FROM tables WHERE outlet_id = ? ORDER BY number`, [outletId])
      return rows
    } else {
      const { data } = await api.get('/tables')
      return data
    }
  },

  updateTable: async (id, updates, outletId) => {
    if (isElectron) {
      const fields = Object.keys(updates).filter(f => ['number', 'status', 'section', 'capacity', 'x', 'y', 'width', 'height', 'shape'].includes(f))
      if (fields.length === 0) return null

      const setClause = fields.map(f => `${f} = ?`).join(', ')
      const params = fields.map(f => updates[f])
      
      const sql = `UPDATE tables SET ${setClause} WHERE id = ? AND outlet_id = ?`
      await db.run(sql, [...params, id, outletId])
      
      const row = await db.row(`SELECT * FROM tables WHERE id = ?`, [id])
      await dbAdapter.addToSyncQueue('UPDATE_TABLE', 'tables', id, { id, updates })
      return row
    } else {
      const { data } = await api.put(`/tables/${id}`, updates)
      return data
    }
  },

  saveTableLayout: async (tables, outletId) => {
    if (isElectron) {
      const queries = tables.map(t => ({
        sql: `UPDATE tables SET x = ?, y = ?, width = ?, height = ?, shape = ? WHERE id = ? AND outlet_id = ?`,
        params: [t.x, t.y, t.width, t.height, t.shape, t.id, outletId]
      }))
      await db.transaction(queries)
      await dbAdapter.addToSyncQueue('SAVE_TABLE_LAYOUT', 'tables', 'bulk', { tables })
      return { success: true }
    } else {
      const { data } = await api.post('/tables/bulk-update', { tables })
      return data
    }
  },

  transferTable: async (fromId, toId, outletId) => {
    if (isElectron) {
      // Find open order on fromTable
      const order = await db.row(`SELECT id FROM orders WHERE table_id = ? AND status = 'open' AND outlet_id = ?`, [fromId, outletId])
      if (!order) throw new Error('No active order on source table')

      // Check if target table is free
      const targetTable = await db.row(`SELECT status FROM tables WHERE id = ?`, [toId])
      if (!targetTable || targetTable.status !== 'free') throw new Error('Target table is not free')

      const queries = [
        { sql: `UPDATE orders SET table_id = ? WHERE id = ?`, params: [toId, order.id] },
        { sql: `UPDATE tables SET status = 'free' WHERE id = ?`, params: [fromId] },
        { sql: `UPDATE tables SET status = 'occupied' WHERE id = ?`, params: [toId] }
      ]
      await db.transaction(queries)
      await dbAdapter.addToSyncQueue('TRANSFER_TABLE', 'tables', order.id, { fromId, toId })
      return { success: true }
    } else {
      const { data } = await api.post('/tables/transfer', { from_table_id: fromId, to_table_id: toId })
      return data
    }
  },

  // --- ORDERS ---
  getOrders: async (outletId) => {
    if (isElectron) {
      const rows = await db.all(`SELECT * FROM orders WHERE status = 'open' AND outlet_id = ?`, [outletId])
      return rows.map(r => ({
        ...r,
        items: deserialize(r.items),
        kot_printed: !!r.kot_printed
      }))
    } else {
      const { data } = await api.get('/orders')
      return data
    }
  },

  createOrder: async (order, outletId) => {
    const id = order.id || `ord_${Date.now()}`
    
    // SQLite Specific - Daily token no
    let token_no = order.token_no
    const datePrefix = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // YYYY-MM-DD
    
    if (isElectron && !token_no) {
      const tRow = await db.row(
        `SELECT COALESCE(MAX(token_no), 0) as max_token FROM orders WHERE outlet_id = ? AND created_at LIKE ?`,
        [outletId, `${datePrefix}%`]
      )
      token_no = (tRow ? parseInt(tRow.max_token) : 0) + 1
    }

    const subtotal = order.items.reduce((s, i) => s + (parseFloat(i.price) * parseInt(i.qty)), 0)
    const record = {
      id,
      table_id: order.table_id || null,
      items: order.items,
      order_type: order.order_type || 'dine-in',
      customer_name: order.customer_name || '',
      subtotal,
      cgst: 0,
      sgst: 0,
      discount: 0,
      total: subtotal,
      status: 'open',
      kot_status: 'preparing',
      kot_printed: 0,
      notes: order.notes || '',
      outlet_id: outletId,
      token_no: token_no || 1,
      created_at: order.created_at || new Date().toISOString()
    }

    if (isElectron) {
      const queries = [
        {
          sql: `
            INSERT INTO orders (
              id, table_id, items, order_type, customer_name, subtotal, cgst, sgst, discount, total, status, kot_status, kot_printed, notes, outlet_id, token_no, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            record.id, record.table_id, serialize(record.items), record.order_type, record.customer_name, record.subtotal,
            record.cgst, record.sgst, record.discount, record.total, record.status, record.kot_status, record.kot_printed,
            record.notes, record.outlet_id, record.token_no, record.created_at
          ]
        }
      ]

      if (record.table_id) {
        queries.push({
          sql: `UPDATE tables SET status = 'occupied' WHERE id = ?`,
          params: [record.table_id]
        })
      }

      await db.transaction(queries)
      await dbAdapter.addToSyncQueue('CREATE_ORDER', 'orders', record.id, record)
      return {
        ...record,
        kot_printed: !!record.kot_printed
      }
    } else {
      const { data } = await api.post('/orders', order)
      return data
    }
  },

  updateOrder: async (id, updates, outletId) => {
    if (isElectron) {
      const allowedFields = ['table_id', 'items', 'status', 'order_type', 'customer_name', 'kot_printed', 'notes', 'subtotal', 'cgst', 'sgst', 'total', 'kot_status']
      
      const recordUpdates = { ...updates }
      if (recordUpdates.items) {
        recordUpdates.subtotal = recordUpdates.items.reduce((s, i) => s + (parseFloat(i.price) * parseInt(i.qty)), 0)
        recordUpdates.total = recordUpdates.subtotal
        recordUpdates.items = serialize(recordUpdates.items)
      }

      const fields = Object.keys(recordUpdates).filter(f => allowedFields.includes(f))
      if (fields.length === 0) return null

      const setClause = fields.map(f => `${f} = ?`).join(', ')
      const params = fields.map(f => recordUpdates[f])

      const sql = `UPDATE orders SET ${setClause} WHERE id = ? AND outlet_id = ?`
      await db.run(sql, [...params, id, outletId])

      const row = await db.row(`SELECT * FROM orders WHERE id = ?`, [id])
      await dbAdapter.addToSyncQueue('UPDATE_ORDER', 'orders', id, { id, updates })
      
      return {
        ...row,
        items: deserialize(row.items),
        kot_printed: !!row.kot_printed
      }
    } else {
      const { data } = await api.put(`/orders/${id}`, updates)
      return data
    }
  },

  cancelOrder: async (id, outletId) => {
    if (isElectron) {
      const order = await db.row(`SELECT table_id FROM orders WHERE id = ? AND outlet_id = ?`, [id, outletId])
      if (!order) throw new Error('Order not found')

      const queries = [
        { sql: `UPDATE orders SET status = 'cancelled' WHERE id = ?`, params: [id] }
      ]

      if (order.table_id) {
        queries.push({
          sql: `UPDATE tables SET status = 'free' WHERE id = ?`,
          params: [order.table_id]
        })
      }

      await db.transaction(queries)
      await dbAdapter.addToSyncQueue('CANCEL_ORDER', 'orders', id, { id })
      return { success: true }
    } else {
      const { data } = await api.delete(`/orders/${id}`)
      return data
    }
  },

  // --- BILLING ---
  createBill: async (orderId, paymentMethod, discount, outletId) => {
    const billId = `bill_${Date.now()}`
    const datePrefix = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // YYYY-MM-DD

    if (isElectron) {
      // Get order details
      const order = await db.row(`SELECT * FROM orders WHERE id = ? AND outlet_id = ?`, [orderId, outletId])
      if (!order) throw new Error('Order not found')

      // Get daily bill no
      const bRow = await db.row(
        `SELECT COALESCE(MAX(bill_no), 0) as max_bill FROM bills WHERE outlet_id = ? AND created_at LIKE ?`,
        [outletId, `${datePrefix}%`]
      )
      const bill_no = (bRow ? parseInt(bRow.max_bill) : 0) + 1

      const discVal = parseFloat(discount) || 0
      const record = {
        id: billId,
        order_id: orderId,
        table_id: order.table_id || null,
        order_type: order.order_type,
        items: order.items, // Already serialized string in SQLite orders table
        subtotal: order.subtotal,
        cgst: 0,
        sgst: 0,
        discount: discVal,
        total: order.subtotal - discVal,
        payment_method: serialize(paymentMethod),
        status: 'paid',
        outlet_id: outletId,
        bill_no,
        created_at: new Date().toISOString()
      }

      const queries = [
        {
          sql: `
            INSERT INTO bills (
              id, order_id, table_id, order_type, items, subtotal, cgst, sgst, discount, total, payment_method, status, outlet_id, bill_no, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            record.id, record.order_id, record.table_id, record.order_type, record.items, record.subtotal,
            record.cgst, record.sgst, record.discount, record.total, record.payment_method, record.status,
            record.outlet_id, record.bill_no, record.created_at
          ]
        },
        {
          sql: `UPDATE orders SET status = 'billed' WHERE id = ?`,
          params: [orderId]
        }
      ]

      if (order.table_id) {
        queries.push({
          sql: `UPDATE tables SET status = 'free' WHERE id = ?`,
          params: [order.table_id]
        })
      }

      await db.transaction(queries)
      await dbAdapter.addToSyncQueue('CREATE_BILL', 'bills', record.id, {
        ...record,
        items: deserialize(record.items),
        payment_method: paymentMethod
      })

      return {
        ...record,
        items: deserialize(record.items),
        payment_method: paymentMethod
      }
    } else {
      const { data } = await api.post('/bills', { order_id: orderId, payment_method: paymentMethod, discount })
      return data
    }
  },

  getBills: async (params, outletId) => {
    if (isElectron) {
      let sql = `SELECT * FROM bills WHERE outlet_id = ?`
      const sqlParams = [outletId]

      if (params.from) {
        sql += ` AND created_at >= ?`
        sqlParams.push(params.from)
      }
      if (params.to) {
        sql += ` AND created_at <= ?`
        sqlParams.push(params.to)
      }
      if (params.date) {
        sql += ` AND created_at LIKE ?`
        sqlParams.push(`${params.date}%`)
      }

      sql += ` ORDER BY created_at DESC`
      if (params.limit) {
        sql += ` LIMIT ?`
        sqlParams.push(parseInt(params.limit) || 100)
      }

      const rows = await db.all(sql, sqlParams)
      return rows.map(r => ({
        ...r,
        items: deserialize(r.items),
        payment_method: deserialize(r.payment_method)
      }))
    } else {
      const { data } = await api.get('/bills', { params })
      return data
    }
  },

  updateBill: async (id, updates, outletId) => {
    if (isElectron) {
      const { items, discount, payment_method } = updates
      let subtotal = 0
      if (items && items.length) {
        subtotal = items.reduce((s, i) => s + (parseFloat(i.price) * parseFloat(i.qty)), 0)
      }
      const finalDiscount = parseFloat(discount) || 0
      const total = subtotal - finalDiscount

      const serializedItems = serialize(items || [])
      const serializedPayMethod = serialize(payment_method)

      const sql = `
        UPDATE bills 
        SET items = ?, subtotal = ?, discount = ?, total = ?, payment_method = ?
        WHERE id = ? AND outlet_id = ?
      `
      await db.run(sql, [serializedItems, subtotal, finalDiscount, total, serializedPayMethod, id, outletId])

      const row = await db.row(`SELECT * FROM bills WHERE id = ?`, [id])
      await dbAdapter.addToSyncQueue('UPDATE_BILL', 'bills', id, { id, updates })

      return {
        ...row,
        items: deserialize(row.items),
        payment_method: deserialize(row.payment_method)
      }
    } else {
      const { data } = await api.put(`/bills/${id}`, updates)
      return data
    }
  },

  // --- INVENTORY ---
  getInventory: async (outletId) => {
    if (isElectron) {
      const rows = await db.all(`SELECT * FROM inventory WHERE outlet_id = ? ORDER BY name`, [outletId])
      return rows
    } else {
      const { data } = await api.get('/inventory')
      return data
    }
  },

  saveInventoryItem: async (item, outletId) => {
    const id = item.id || `inv_${Date.now()}`
    const record = {
      id,
      name: item.name,
      category: item.category || '',
      stock: parseFloat(item.stock) || 0,
      unit: item.unit || 'pcs',
      min_stock: parseFloat(item.min_stock) || 0,
      outlet_id: outletId
    }

    if (isElectron) {
      const sql = `INSERT OR REPLACE INTO inventory (id, name, category, stock, unit, min_stock, outlet_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
      await db.run(sql, [record.id, record.name, record.category, record.stock, record.unit, record.min_stock, record.outlet_id])
      await dbAdapter.addToSyncQueue(item.id ? 'UPDATE_INVENTORY_ITEM' : 'CREATE_INVENTORY_ITEM', 'inventory', record.id, record)
      return record
    } else {
      const { data } = item.id 
        ? await api.put(`/inventory/${item.id}`, item) 
        : await api.post('/inventory', item)
      return data
    }
  },

  // --- BULK HYDRATION (PULLING FROM CLOUD TO SQLite ON LOGIN/ONLINE STARTUP) ---
  hydrateSQLite: async (data, outletId) => {
    if (!isElectron) return
    const { categories, menuItems, tables, activeOrders, inventory, bills } = data
    
    const queries = []

    if (categories && categories.length) {
      for (const c of categories) {
        queries.push({
          sql: `INSERT OR REPLACE INTO categories (id, name, icon, sort_order, is_active, outlet_id) VALUES (?, ?, ?, ?, ?, ?)`,
          params: [c.id, c.name, c.icon, c.sort_order, c.is_active ? 1 : 0, outletId]
        })
      }
    }

    if (menuItems && menuItems.length) {
      for (const m of menuItems) {
        queries.push({
          sql: `
            INSERT OR REPLACE INTO menu_items (
              id, name, price, cost, type, description, emoji, active, gst_percent, 
              available_dine, available_takeaway, available_delivery, category_id, stock, min_stock, outlet_id, is_favorite
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            m.id, m.name, parseFloat(m.price) || 0, parseFloat(m.cost) || 0, m.type, m.description, m.emoji, m.active ? 1 : 0,
            parseFloat(m.gst_percent) || 0, m.available_dine ? 1 : 0, m.available_takeaway ? 1 : 0, m.available_delivery ? 1 : 0,
            m.category_id, parseFloat(m.stock) || 0, parseFloat(m.min_stock) || 0, outletId, m.is_favorite ? 1 : 0
          ]
        })
      }
    }

    if (tables && tables.length) {
      for (const t of tables) {
        queries.push({
          sql: `INSERT OR REPLACE INTO tables (id, number, status, section, capacity, x, y, width, height, shape, outlet_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [t.id, t.number, t.status, t.section, t.capacity, t.x, t.y, t.width, t.height, t.shape, outletId]
        })
      }
    }

    if (activeOrders && activeOrders.length) {
      for (const o of activeOrders) {
        queries.push({
          sql: `
            INSERT OR REPLACE INTO orders (
              id, table_id, items, order_type, customer_name, subtotal, cgst, sgst, discount, total, status, kot_status, kot_printed, notes, outlet_id, token_no, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            o.id, o.table_id, serialize(o.items), o.order_type, o.customer_name, parseFloat(o.subtotal) || 0,
            parseFloat(o.cgst) || 0, parseFloat(o.sgst) || 0, parseFloat(o.discount) || 0, parseFloat(o.total) || 0,
            o.status, o.kot_status, o.kot_printed ? 1 : 0, o.notes, outletId, o.token_no, o.created_at
          ]
        })
      }
    }

    if (inventory && inventory.length) {
      for (const i of inventory) {
        queries.push({
          sql: `INSERT OR REPLACE INTO inventory (id, name, category, stock, unit, min_stock, outlet_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [i.id, i.name, i.category, parseFloat(i.stock) || 0, i.unit, parseFloat(i.min_stock) || 0, outletId]
        })
      }
    }

    if (bills && bills.length) {
      for (const b of bills) {
        queries.push({
          sql: `
            INSERT OR REPLACE INTO bills (
              id, order_id, table_id, order_type, items, subtotal, cgst, sgst, discount, total, payment_method, status, outlet_id, bill_no, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            b.id, b.order_id, b.table_id, b.order_type, serialize(b.items), parseFloat(b.subtotal) || 0,
            parseFloat(b.cgst) || 0, parseFloat(b.sgst) || 0, parseFloat(b.discount) || 0, parseFloat(b.total) || 0,
            serialize(b.payment_method), b.status, outletId, b.bill_no, b.created_at
          ]
        })
      }
    }

    if (queries.length > 0) {
      console.log(`Hydrating SQLite with ${queries.length} records...`)
      await db.transaction(queries)
      console.log('Hydration complete!')
    }
  }
}
