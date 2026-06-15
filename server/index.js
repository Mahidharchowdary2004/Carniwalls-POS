const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'restauraq_secret_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);

  socket.on('join-outlet', (outletId) => {
    socket.join(`outlet_${outletId}`);
    console.log(`🏢 Socket ${socket.id} joined outlet: ${outletId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// Helper to emit to outlet
const emitToOutlet = (outletId, event, data) => {
  io.to(`outlet_${outletId}`).emit(event, data);
};

// In-memory database removed. Using PostgreSQL instead.

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, phone, password } = req.body;
  try {
    let query = 'SELECT * FROM users WHERE ';
    let params = [];

    if (email) {
      query += 'email = $1';
      params.push(email);
    } else if (phone) {
      query += 'phone = $1';
      params.push(phone);
    } else {
      return res.status(400).json({ error: 'Identifier required' });
    }

    const { rows } = await db.query(query, params);
    const user = rows[0];

    // For admin phone login, if no password is provided, we can allow it for demo or check fixed password
    // However, keeping standard password check for now unless specified otherwise.
    if (!user || (password && !bcrypt.compareSync(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role, outlet_id: user.outlet_id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard/stats', auth, async (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;

    let currentFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date";

    let previousFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 1";
    let params = [req.user.outlet_id];
    let pIdx = 2;

    if (period === 'yesterday') {
      currentFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 1";
      previousFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 2";

    } else if (period === 'month') {
      currentFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      previousFilter = "created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'custom' && from && to) {
      currentFilter = `created_at >= $${pIdx} AND created_at <= $${pIdx + 1}`;
      previousFilter = `1=0`; // Simplify by skipping change calc for custom dates
      params.push(from, to + ' 23:59:59');
      pIdx += 2;
    }

    // Revenue Stats
    const revRes = await db.query(`
      SELECT 
        COALESCE(SUM(total) FILTER (WHERE ${currentFilter}), 0) as today,
        COALESCE(SUM(total) FILTER (WHERE ${previousFilter}), 0) as yesterday
      FROM bills 
      WHERE outlet_id = $1
    `, params);

    const stats = revRes.rows[0];
    const change = stats.yesterday > 0 ? ((stats.today - stats.yesterday) / stats.yesterday * 100).toFixed(1) : 0;

    // Tables & Online Pending
    const tableRes = await db.query('SELECT count(*) FILTER (WHERE status = \'occupied\') as occupied, count(*) as total FROM tables WHERE outlet_id = $1', [req.user.outlet_id]);
    const onlineRes = await db.query('SELECT count(*) as pending FROM online_orders WHERE status = \'new\' AND outlet_id = $1', [req.user.outlet_id]);
    const orderCountRes = await db.query(`SELECT count(*) as count FROM bills WHERE outlet_id = $1 AND ${currentFilter}`, params);

    // Channel Split (Demo/Simplified)
    const channelRes = await db.query(`
      SELECT order_type, count(*) as count 
      FROM bills 
      WHERE outlet_id = $1 AND ${currentFilter} 
      GROUP BY order_type
    `, params);

    const channel_split = {};
    channelRes.rows.forEach(r => { channel_split[r.order_type] = parseInt(r.count); });
    // Ensure default channels exist for UI
    if (!channel_split['dine-in']) channel_split['dine-in'] = 0;
    if (!channel_split['takeaway']) channel_split['takeaway'] = 0;
    if (!channel_split['delivery']) channel_split['delivery'] = 0;

    res.json({
      revenue: { today: parseFloat(stats.today), yesterday: parseFloat(stats.yesterday), change },
      orders: { today: parseInt(orderCountRes.rows[0].count), online_pending: parseInt(onlineRes.rows[0].pending) },
      tables: { occupied: parseInt(tableRes.rows[0].occupied), total: parseInt(tableRes.rows[0].total) },
      avg_order_value: orderCountRes.rows[0].count > 0 ? Math.round(stats.today / orderCountRes.rows[0].count) : 0,
      channel_split
    });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard/recent-orders', auth, async (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;
    let currentFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date";
    let params = [req.user.outlet_id];
    let pIdx = 2;

    if (period === 'yesterday') {
      currentFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 1";

    } else if (period === 'month') {
      currentFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'custom' && from && to) {
      currentFilter = `created_at >= $${pIdx} AND created_at <= $${pIdx + 1}`;
      params.push(from, to + ' 23:59:59');
    }

    const { rows } = await db.query(`SELECT * FROM bills WHERE outlet_id = $1 AND ${currentFilter} ORDER BY created_at DESC LIMIT 15`, params);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── TABLES ───────────────────────────────────────────────────────────────────
app.get('/api/tables', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM tables WHERE outlet_id = $1 ORDER BY number', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/tables/:id', auth, async (req, res) => {
  try {
    const fields = Object.keys(req.body).filter(f => ['number', 'status', 'section', 'capacity', 'x', 'y', 'width', 'height', 'shape'].includes(f));
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => req.body[f]);

    const { rows } = await db.query(`UPDATE tables SET ${setClause} WHERE id = $${fields.length + 1} AND outlet_id = $${fields.length + 2} RETURNING *`,
      [...values, req.params.id, req.user.outlet_id]);

    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    emitToOutlet(req.user.outlet_id, 'table-update', rows[0]);
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// Update multiple tables at once (for layout saving)
app.post('/api/tables/bulk-update', auth, async (req, res) => {
  try {
    const { tables } = req.body; // Array of {id, x, y, ...}
    for (const t of tables) {
      await db.query('UPDATE tables SET x = $1, y = $2, width = $3, height = $4, shape = $5 WHERE id = $6 AND outlet_id = $7',
        [t.x, t.y, t.width, t.height, t.shape, t.id, req.user.outlet_id]);
    }
    res.json({ success: true });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── MENU ─────────────────────────────────────────────────────────────────────
app.get('/api/categories', auth, async (req, res) => {
  try {
    if (!req.user.outlet_id) return res.status(400).json({ error: 'No outlet assigned to user' });
    const { rows } = await db.query('SELECT * FROM categories WHERE outlet_id = $1 ORDER BY sort_order ASC', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) {
    console.error('Category fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', auth, async (req, res) => {
  try {
    const { name, icon, sort_order } = req.body;
    const { rows } = await db.query('INSERT INTO categories (id, name, icon, sort_order, outlet_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [`c${Date.now()}`, name, icon, sort_order || 0, req.user.outlet_id]);
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/categories/:id', auth, async (req, res) => {
  try {
    const { name, icon, sort_order, is_active } = req.body;
    const { rows } = await db.query(
      'UPDATE categories SET name = $1, icon = $2, sort_order = $3, is_active = $4 WHERE id = $5 AND outlet_id = $6 RETURNING *',
      [name, icon, sort_order, is_active, req.params.id, req.user.outlet_id]
    );
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = $1 AND outlet_id = $2', [req.params.id, req.user.outlet_id]);
    res.json({ success: true });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/menu', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM menu_items WHERE outlet_id = $1', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/menu', auth, async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;

    // Clean data: Convert empty strings to null for references
    if (data.category_id === '') data.category_id = null;

    // Ensure numbers are numbers
    if (data.price) data.price = parseFloat(data.price) || 0;
    if (data.cost) data.cost = parseFloat(data.cost) || 0;
    if (data.gst_percent) data.gst_percent = parseFloat(data.gst_percent) || 0;
    if (data.stock) data.stock = parseFloat(data.stock) || 0;
    if (data.min_stock) data.min_stock = parseFloat(data.min_stock) || 0;

    const fields = Object.keys(data);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO menu_items (id, ${fields.join(', ')}, outlet_id) VALUES ($1, ${placeholders}, $${fields.length + 2}) RETURNING *`;
    const { rows } = await db.query(query, [`m${Date.now()}`, ...values, req.user.outlet_id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Menu create error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', auth, async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;

    // Clean data
    if (data.category_id === '') data.category_id = null;
    if (data.price) data.price = parseFloat(data.price) || 0;
    if (data.cost) data.cost = parseFloat(data.cost) || 0;
    if (data.gst_percent) data.gst_percent = parseFloat(data.gst_percent) || 0;
    if (data.stock) data.stock = parseFloat(data.stock) || 0;
    if (data.min_stock) data.min_stock = parseFloat(data.min_stock) || 0;

    const allowedFields = ['name', 'price', 'cost', 'type', 'description', 'emoji', 'active', 'gst_percent', 'available_dine', 'available_takeaway', 'available_delivery', 'category_id', 'stock', 'min_stock'];
    const updateData = {};
    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) updateData[key] = data[key];
    }

    if (Object.keys(updateData).length === 0) return res.json({ success: true });

    const fields = Object.keys(updateData);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = Object.values(updateData);
    const { rows } = await db.query(`UPDATE menu_items SET ${setClause} WHERE id = $${fields.length + 1} AND outlet_id = $${fields.length + 2} RETURNING *`,
      [...values, req.params.id, req.user.outlet_id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Menu update error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM menu_items WHERE id = $1 AND outlet_id = $2', [req.params.id, req.user.outlet_id]);
    res.json({ success: true });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/menu', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM menu_items WHERE outlet_id = $1', [req.user.outlet_id]);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /api/menu error:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories', auth, async (req, res) => {
  try {
    // Delete menu items first to avoid foreign key constraints
    await db.query('DELETE FROM menu_items WHERE outlet_id = $1', [req.user.outlet_id]);
    await db.query('DELETE FROM categories WHERE outlet_id = $1', [req.user.outlet_id]);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /api/categories error:', err); res.status(500).json({ error: err.message }); }
});

// ─── ORDERS (POS) ────────────────────────────────────────────────────────────
app.get('/api/orders', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM orders WHERE status = \'open\' AND outlet_id = $1', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', auth, async (req, res) => {
  try {
    const { id: clientId, table_id, items, order_type = 'dine-in', customer_name, notes, token_no: clientTokenNo, created_at: clientCreatedAt } = req.body;

    // Fetch outlet for tax rates
    const outRes = await db.query('SELECT * FROM outlets WHERE id = $1', [req.user.outlet_id]);
    const outlet = outRes.rows[0];

    const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);

    const id = clientId || `ord_${Date.now()}`;

    // Get daily token number or use client provided one
    let token_no = clientTokenNo;
    if (!token_no) {
      const tRes = await db.query(
        "SELECT COALESCE(MAX(token_no), 0) as max_token FROM orders WHERE outlet_id = $1 AND (created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date",
        [req.user.outlet_id]
      );
      token_no = parseInt(tRes.rows[0].max_token) + 1;
    }

    const created_at = clientCreatedAt || new Date().toISOString();

    const { rows } = await db.query(`
      INSERT INTO orders (id, table_id, items, order_type, customer_name, subtotal, cgst, sgst, discount, total, status, kot_status, notes, outlet_id, token_no, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, 'open', 'preparing', $10, $11, $12, $13) RETURNING *
    `, [id, table_id, JSON.stringify(items), order_type, customer_name, subtotal, 0, 0, subtotal, notes, req.user.outlet_id, token_no, created_at]);

    const order = rows[0];

    if (table_id) {
      await db.query('UPDATE tables SET status = \'occupied\' WHERE id = $1', [table_id]);
      emitToOutlet(req.user.outlet_id, 'table-update', { id: table_id, status: 'occupied' });
    }

    emitToOutlet(req.user.outlet_id, 'new-order', order);
    res.json(order);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// Update Order (Add items/Change status)
app.put('/api/orders/:id', auth, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.items) {
      data.subtotal = data.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      data.total = data.subtotal;
      data.items = JSON.stringify(data.items);
    }

    const allowedFields = ['table_id', 'items', 'status', 'order_type', 'customer_name', 'kot_printed', 'notes', 'subtotal', 'cgst', 'sgst', 'total', 'kot_status'];
    const updateData = {};
    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) updateData[key] = data[key];
    }

    if (Object.keys(updateData).length === 0) return res.json({ success: true });

    const fields = Object.keys(updateData);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = Object.values(updateData);

    const { rows } = await db.query(`UPDATE orders SET ${setClause} WHERE id = $${fields.length + 1} AND outlet_id = $${fields.length + 2} RETURNING *`,
      [...values, req.params.id, req.user.outlet_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

    emitToOutlet(req.user.outlet_id, 'order-update', rows[0]);
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// Cancel Order
app.delete('/api/orders/:id', auth, async (req, res) => {
  try {
    const ordRes = await db.query('SELECT table_id FROM orders WHERE id = $1 AND outlet_id = $2', [req.params.id, req.user.outlet_id]);
    const order = ordRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await db.query('UPDATE orders SET status = \'cancelled\' WHERE id = $1', [req.params.id]);
    if (order.table_id) {
      await db.query('UPDATE tables SET status = \'free\' WHERE id = $1', [order.table_id]);
      emitToOutlet(req.user.outlet_id, 'table-update', { id: order.table_id, status: 'free' });
    }
    emitToOutlet(req.user.outlet_id, 'order-update', { id: req.params.id, status: 'cancelled' });
    res.json({ success: true });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// Transfer Table
app.post('/api/tables/transfer', auth, async (req, res) => {
  try {
    const { from_table_id, to_table_id } = req.body;

    // 1. Get active order on from_table
    const { rows: orders } = await db.query('SELECT * FROM orders WHERE table_id = $1 AND status = \'open\' AND outlet_id = $2', [from_table_id, req.user.outlet_id]);
    if (!orders[0]) return res.status(404).json({ error: 'No active order on this table' });

    // 2. Check if to_table is free
    const { rows: tables } = await db.query('SELECT * FROM tables WHERE id = $1', [to_table_id]);
    if (tables[0].status !== 'free') return res.status(400).json({ error: 'Target table is not free' });

    // 3. Update Order and Tables
    await db.query('UPDATE orders SET table_id = $1 WHERE id = $2', [to_table_id, orders[0].id]);
    await db.query('UPDATE tables SET status = \'free\' WHERE id = $1', [from_table_id]);
    await db.query('UPDATE tables SET status = \'occupied\' WHERE id = $1', [to_table_id]);

    emitToOutlet(req.user.outlet_id, 'table-update', { id: from_table_id, status: 'free' });
    emitToOutlet(req.user.outlet_id, 'table-update', { id: to_table_id, status: 'occupied' });
    emitToOutlet(req.user.outlet_id, 'order-update', { id: orders[0].id, table_id: to_table_id });

    res.json({ success: true });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── BILLING ─────────────────────────────────────────────────────────────────
app.post('/api/bills', auth, async (req, res) => {
  try {
    const { id: clientId, bill_no: clientBillNo, created_at: clientCreatedAt, order_id, payment_method, discount = 0 } = req.body;
    const ordRes = await db.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    const order = ordRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const billId = clientId || `bill_${Date.now()}`;

    // Get daily bill number or use client provided one
    let bill_no = clientBillNo;
    if (!bill_no) {
      const bRes = await db.query(
        "SELECT COALESCE(MAX(bill_no), 0) as max_bill FROM bills WHERE outlet_id = $1 AND (created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date",
        [req.user.outlet_id]
      );
      bill_no = parseInt(bRes.rows[0].max_bill) + 1;
    }

    const created_at = clientCreatedAt || new Date().toISOString();

    const { rows } = await db.query(`
      INSERT INTO bills (id, order_id, table_id, order_type, items, subtotal, cgst, sgst, discount, total, payment_method, status, outlet_id, bill_no, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'paid', $12, $13, $14) RETURNING *
    `, [billId, order_id, order.table_id, order.order_type, JSON.stringify(order.items), order.subtotal, 0, 0, discount, order.subtotal - discount, payment_method, req.user.outlet_id, bill_no, created_at]);

    await db.query('UPDATE orders SET status = \'billed\' WHERE id = $1', [order_id]);
    if (order.table_id) {
      await db.query('UPDATE tables SET status = \'free\' WHERE id = $1', [order.table_id]);
    }
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/bills', auth, async (req, res) => {
  try {
    console.log('GET /api/bills query:', req.query);
    const { date, from, to, limit = 50 } = req.query;
    let sql = 'SELECT * FROM bills WHERE outlet_id = $1';
    const params = [req.user.outlet_id];
    let pIdx = 2;
    if (date) { sql += ` AND created_at::date = $${pIdx++}`; params.push(date); }
    if (from) { sql += ` AND created_at >= $${pIdx++}`; params.push(from); }
    if (to) { sql += ` AND created_at <= $${pIdx++}`; params.push(to); }
    sql += ` ORDER BY created_at DESC LIMIT $${pIdx}`;
    params.push(limit);
    console.log('SQL:', sql, params);
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /api/bills error:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/bills/:id', auth, async (req, res) => {
  try {
    const { items, discount, payment_method } = req.body;
    let subtotal = 0;
    if (items && items.length) {
      subtotal = items.reduce((s, i) => s + (parseFloat(i.price) * parseFloat(i.qty)), 0);
    }
    const finalDiscount = parseFloat(discount) || 0;
    const total = subtotal - finalDiscount;

    const { rows } = await db.query(
      'UPDATE bills SET items = $1, subtotal = $2, discount = $3, total = $4, payment_method = $5 WHERE id = $6 AND outlet_id = $7 RETURNING *',
      [JSON.stringify(items || []), subtotal, finalDiscount, total, payment_method, req.params.id, req.user.outlet_id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });
    res.json(rows[0]);
  } catch (err) { console.error('PUT /api/bills error:', err); res.status(500).json({ error: err.message }); }
});

// ─── ONLINE ORDERS ────────────────────────────────────────────────────────────
app.get('/api/online-orders', auth, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM online_orders WHERE outlet_id = $1';
    const params = [req.user.outlet_id];
    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────
app.get('/api/inventory', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM inventory WHERE outlet_id = $1 ORDER BY name', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory', auth, async (req, res) => {
  try {
    const { name, category, stock, unit, min_stock } = req.body;
    const { rows } = await db.query(
      'INSERT INTO inventory (name, category, stock, unit, min_stock, outlet_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, category, stock, unit, min_stock, req.user.outlet_id]
    );
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/inventory/:id', auth, async (req, res) => {
  try {
    const { name, category, stock, unit, min_stock } = req.body;
    const { rows } = await db.query(
      'UPDATE inventory SET name = $1, category = $2, stock = $3, unit = $4, min_stock = $5 WHERE id = $6 AND outlet_id = $7 RETURNING *',
      [name, category, stock, unit, min_stock, req.params.id, req.user.outlet_id]
    );
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── VENDORS ──────────────────────────────────────────────────────────────────
app.get('/api/vendors', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vendors WHERE outlet_id = $1', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/vendors', auth, async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(req.body);
    const { rows } = await db.query(`INSERT INTO vendors (${fields.join(', ')}, outlet_id) VALUES (${placeholders}, $${fields.length + 1}) RETURNING *`,
      [...values, req.user.outlet_id]);
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── PURCHASES ────────────────────────────────────────────────────────────────
app.get('/api/purchases', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, i.name as item_name, v.name as vendor_name 
      FROM purchase_entries p
      JOIN inventory i ON p.inventory_id = i.id
      JOIN vendors v ON p.vendor_id = v.id
      WHERE p.outlet_id = $1 ORDER BY p.purchase_date DESC
    `, [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/purchases', auth, async (req, res) => {
  try {
    const { inventory_id, vendor_id, quantity, cost_per_unit, total_cost, purchase_date } = req.body;
    const { rows } = await db.query(
      'INSERT INTO purchase_entries (inventory_id, vendor_id, quantity, cost_per_unit, total_cost, purchase_date, outlet_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [inventory_id, vendor_id, quantity, cost_per_unit, total_cost, purchase_date || new Date(), req.user.outlet_id]
    );
    // Update inventory stock
    await db.query('UPDATE inventory SET stock = stock + $1, last_restock = CURRENT_TIMESTAMP WHERE id = $2', [quantity, inventory_id]);
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
app.get('/api/reports/sales', auth, async (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;
    let sql = 'SELECT * FROM bills WHERE outlet_id = $1 AND status = \'paid\'';
    const params = [req.user.outlet_id];
    let pIdx = 2;

    if (period === 'today') { sql += ` AND (created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date`; }
    else if (period === 'week') { sql += ` AND created_at >= CURRENT_DATE - INTERVAL '7 days'`; }
    else if (period === 'month') { sql += ` AND created_at >= date_trunc('month', CURRENT_DATE)`; }

    if (from) { sql += ` AND created_at >= $${pIdx++}`; params.push(from); }
    if (to) { sql += ` AND created_at <= $${pIdx++}`; params.push(to); }

    const { rows: bills } = await db.query(sql, params);

    const totalRevenue = bills.reduce((s, b) => s + parseFloat(b.total), 0);
    const totalDiscount = bills.reduce((s, b) => s + parseFloat(b.discount || 0), 0);

    const byPayment = {};
    const byType = {};
    bills.forEach(b => {
      let method = 'other';
      if (typeof b.payment_method === 'object' && b.payment_method !== null) {
        const keys = Object.keys(b.payment_method);
        if (keys.length > 1) {
          method = 'split';
        } else if (keys.length === 1) {
          method = keys[0];
        }
      } else if (typeof b.payment_method === 'string') {
        method = b.payment_method.toLowerCase();
      }
      byPayment[method] = (byPayment[method] || 0) + parseFloat(b.total);

      const type = b.order_type || 'other';
      byType[type] = (byType[type] || 0) + parseFloat(b.total);
    });

    res.json({
      total_revenue: totalRevenue, total_orders: bills.length, total_tax: 0,
      total_discount: totalDiscount, avg_order_value: bills.length ? Math.round(totalRevenue / bills.length) : 0,
      by_payment: byPayment, by_type: byType, bills: bills.slice(0, 20)
    });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/weekly', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT TO_CHAR(created_at + INTERVAL '5.5 hours', 'Dy') as day, SUM(total) as revenue, count(*) as orders
      FROM bills 
      WHERE outlet_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY 1, date_trunc('day', created_at + INTERVAL '5.5 hours')
      ORDER BY date_trunc('day', created_at + INTERVAL '5.5 hours')
    `, [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/daily', auth, async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    let dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    const params = [req.user.outlet_id];
    let pIdx = 2;

    if (period === 'today') {
      dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '1 day'";
    } else if (period === 'week') {
      dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'custom' && from && to) {
      dateFilter = `AND created_at >= $${pIdx++} AND created_at <= $${pIdx++}`;
      params.push(from, to + ' 23:59:59');
    }

    const { rows } = await db.query(`
      SELECT 
        TO_CHAR(created_at + INTERVAL '5.5 hours', 'YYYY-MM-DD') as date, 
        SUM(total) as revenue, 
        count(*) as orders,
        SUM(discount) as discount
      FROM bills 
      WHERE outlet_id = $1 ${dateFilter}
      GROUP BY 1
      ORDER BY 1 DESC
    `, params);
    res.json(rows);
  } catch (err) { console.error('GET /api/reports/daily error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/top-items', auth, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    let filter = "";
    let params = [req.user.outlet_id];
    if (period === 'today') {
      filter = "AND (created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date";
    } else if (period === 'yesterday') {
      filter = "AND (created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 1";
    } else if (period === 'month') {
      filter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'custom' && from && to) {
      filter = "AND created_at >= $2 AND created_at <= $3";
      params.push(from, to + ' 23:59:59');
    }

    // This is a bit complex as items are stored as JSONB
    const { rows } = await db.query(`
      SELECT item->>'name' as name, SUM((item->>'qty')::int) as count
      FROM bills, jsonb_array_elements(items) as item
      WHERE outlet_id = $1 ${filter}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    `, params);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── STAFF ────────────────────────────────────────────────────────────────────
app.get('/api/staff', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM staff WHERE outlet_id = $1', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
app.get('/api/customers', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers WHERE outlet_id = $1', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── DASHBOARD SUMMARIES ─────────────────────────────────────────────────────
app.get('/api/dashboard/order-summary', auth, async (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;

    let currentFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date";
    let params = [req.user.outlet_id];
    let pIdx = 2;
    let isDaily = false;

    if (period === 'yesterday') {
      currentFilter = "(created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 1";

    } else if (period === 'month') {
      currentFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      isDaily = true;
    } else if (period === 'custom' && from && to) {
      currentFilter = `created_at >= $${pIdx} AND created_at <= $${pIdx + 1}`;
      params.push(from, to + ' 23:59:59');
      isDaily = true;
    }

    const { rows: stats } = await db.query(`
      SELECT 
        count(*) as total_count,
        COALESCE(SUM(total), 0) as total_revenue
      FROM bills 
      WHERE outlet_id = $1 AND ${currentFilter}
    `, params);

    let hourly;
    if (isDaily) {
      const { rows } = await db.query(`
        SELECT TO_CHAR(created_at + INTERVAL '5.5 hours', 'YYYY-MM-DD') as day, count(*) as count, SUM(total) as revenue
        FROM bills 
        WHERE outlet_id = $1 AND ${currentFilter}
        GROUP BY 1 ORDER BY 1
      `, params);
      hourly = rows.map(h => ({ hour: h.day, label: new Date(h.day).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), count: parseInt(h.count), revenue: parseFloat(h.revenue) }));
    } else {
      const { rows } = await db.query(`
        SELECT EXTRACT(HOUR FROM created_at + INTERVAL '5.5 hours') as hour, count(*) as count, SUM(total) as revenue
        FROM bills 
        WHERE outlet_id = $1 AND ${currentFilter}
        GROUP BY 1 ORDER BY 1
      `, params);
      hourly = rows.map(h => ({ hour: parseInt(h.hour), label: `${h.hour}:00`, count: parseInt(h.count), revenue: parseFloat(h.revenue) }));
    }

    const { rows: tables } = await db.query('SELECT count(*) FILTER (WHERE status = \'occupied\') as occupied, count(*) as total FROM tables WHERE outlet_id = $1', [req.user.outlet_id]);
    const { rows: online } = await db.query('SELECT count(*) FILTER (WHERE status = \'new\') as pending, count(*) FILTER (WHERE status = \'preparing\') as preparing FROM online_orders WHERE outlet_id = $1', [req.user.outlet_id]);

    res.json({
      today: { count: parseInt(stats[0].total_count), revenue: parseFloat(stats[0].total_revenue) },
      hourly: hourly,
      online_pending: parseInt(online[0].pending),
      online_preparing: parseInt(online[0].preparing),
      tables_occupied: parseInt(tables[0].occupied),
      tables_total: parseInt(tables[0].total)
    });
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard/menu-summary', auth, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    
    if (period) {
      // Return sales summary for the period
      let filter = "";
      let params = [req.user.outlet_id];
      if (period === 'today') {
        filter = "AND (b.created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date";
      } else if (period === 'yesterday') {
        filter = "AND (b.created_at + INTERVAL '5.5 hours')::date = (NOW() + INTERVAL '5.5 hours')::date - 1";
      } else if (period === 'month') {
        filter = "AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'";
      } else if (period === 'custom' && from && to) {
        filter = "AND b.created_at >= $2 AND b.created_at <= $3";
        params.push(from, to + ' 23:59:59');
      }

      const salesRes = await db.query(`
        SELECT 
          COALESCE(SUM((item->>'qty')::int), 0) as total,
          COUNT(DISTINCT item->>'name') as active,
          COALESCE(SUM(CASE WHEN mi.type = 'veg' THEN (item->>'qty')::int ELSE 0 END), 0) as veg,
          COALESCE(SUM(CASE WHEN mi.type != 'veg' THEN (item->>'qty')::int ELSE 0 END), 0) as non_veg,
          COALESCE(ROUND(AVG((item->>'price')::numeric)), 0) as avg_price
        FROM bills b
        CROSS JOIN jsonb_array_elements(b.items) as item
        LEFT JOIN menu_items mi ON mi.name = item->>'name' AND mi.outlet_id = b.outlet_id
        WHERE b.outlet_id = $1 ${filter}
      `, params);

      const catsRes = await db.query(`
        SELECT c.name, COALESCE(SUM((item->>'qty')::int), 0) as count
        FROM bills b
        CROSS JOIN jsonb_array_elements(b.items) as item
        LEFT JOIN menu_items mi ON mi.name = item->>'name' AND mi.outlet_id = b.outlet_id
        LEFT JOIN categories c ON c.id = mi.category_id
        WHERE b.outlet_id = $1 ${filter} AND c.name IS NOT NULL
        GROUP BY c.name
        ORDER BY count DESC
      `, params);

      const priceRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN (item->>'price')::numeric <= 100 THEN (item->>'qty')::int ELSE 0 END), 0) as "0-100",
          COALESCE(SUM(CASE WHEN (item->>'price')::numeric > 100 AND (item->>'price')::numeric <= 300 THEN (item->>'qty')::int ELSE 0 END), 0) as "101-300",
          COALESCE(SUM(CASE WHEN (item->>'price')::numeric > 300 AND (item->>'price')::numeric <= 500 THEN (item->>'qty')::int ELSE 0 END), 0) as "301-500",
          COALESCE(SUM(CASE WHEN (item->>'price')::numeric > 500 THEN (item->>'qty')::int ELSE 0 END), 0) as "500+"
        FROM bills b
        CROSS JOIN jsonb_array_elements(b.items) as item
        WHERE b.outlet_id = $1 ${filter}
      `, params);

      const stats = salesRes.rows[0];
      const price_ranges = priceRes.rows[0] || { "0-100": 0, "101-300": 0, "301-500": 0, "500+": 0 };

      return res.json({
        total: parseInt(stats.total),
        active: parseInt(stats.active),
        veg: parseInt(stats.veg),
        non_veg: parseInt(stats.non_veg),
        avg_price: parseInt(stats.avg_price),
        by_category: catsRes.rows.map(r => ({ name: r.name, count: parseInt(r.count) })),
        price_ranges: {
          '0-100': parseInt(price_ranges['0-100']),
          '101-300': parseInt(price_ranges['101-300']),
          '301-500': parseInt(price_ranges['301-500']),
          '500+': parseInt(price_ranges['500+'])
        }
      });
    }

    const { rows: items } = await db.query('SELECT * FROM menu_items WHERE outlet_id = $1', [req.user.outlet_id]);
    const { rows: cats } = await db.query('SELECT * FROM categories WHERE outlet_id = $1', [req.user.outlet_id]);

    const summary = {
      total: items.length,
      active: items.filter(i => i.active !== false).length,
      veg: items.filter(i => i.type === 'veg').length,
      non_veg: items.filter(i => i.type !== 'veg').length,
      avg_price: Math.round(items.reduce((s, i) => s + parseFloat(i.price), 0) / (items.length || 1)),
      by_category: cats.map(c => ({
        name: c.name,
        count: items.filter(i => String(i.category_id) === String(c.id)).length
      })),
      price_ranges: {
        '0-100': items.filter(i => i.price <= 100).length,
        '101-300': items.filter(i => i.price > 100 && i.price <= 300).length,
        '301-500': items.filter(i => i.price > 300 && i.price <= 500).length,
        '500+': items.filter(i => i.price > 500).length
      }
    };
    res.json(summary);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard/inventory-alerts', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM inventory WHERE outlet_id = $1 AND stock <= min_stock', [req.user.outlet_id]);
    res.json(rows);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── OUTLETS / SETTINGS ──────────────────────────────────────────────────────
app.get('/api/outlets/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM outlets WHERE id = $1', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { console.error('GET /api/orders error:', err); res.status(500).json({ error: err.message }); }
});

// ─── CATCH ALL ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  server.listen(PORT, async () => {
    console.log(`🍽️  RestauraQ Server running on port ${PORT}`);

    // Auto-migration on startup
    try {
      console.log('🔄 Verifying Database Schema...');

      // Create Outlets
      await db.query(`CREATE TABLE IF NOT EXISTS outlets (
      id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, gst_number VARCHAR(50), 
      phone VARCHAR(20), address TEXT, email VARCHAR(100), cgst DECIMAL(5,2) DEFAULT 2.5, 
      sgst DECIMAL(5,2) DEFAULT 2.5, printer_settings JSONB DEFAULT '{}', invoice_footer TEXT, 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Create Users
      await db.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE, 
      phone VARCHAR(20) UNIQUE, password VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'cashier', 
      outlet_id VARCHAR(50) REFERENCES outlets(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Add phone column if missing (for cases where users existed)
      await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT');

      // Create Tables
      await db.query(`CREATE TABLE IF NOT EXISTS tables (
      id VARCHAR(50) PRIMARY KEY, number VARCHAR(20) NOT NULL, status VARCHAR(20) DEFAULT 'free', 
      section VARCHAR(50), capacity INTEGER DEFAULT 4, x INTEGER DEFAULT 0, y INTEGER DEFAULT 0, 
      width INTEGER DEFAULT 100, height INTEGER DEFAULT 100, shape VARCHAR(20) DEFAULT 'square', 
      outlet_id VARCHAR(50) REFERENCES outlets(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Create Categories
      await db.query(`CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, icon VARCHAR(20), 
      sort_order INTEGER DEFAULT 0, outlet_id VARCHAR(50) REFERENCES outlets(id), 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Create Menu Items
      await db.query(`CREATE TABLE IF NOT EXISTS menu_items (
      id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, price DECIMAL(10,2) NOT NULL, 
      cost DECIMAL(10,2), type VARCHAR(20) DEFAULT 'veg', description TEXT, emoji VARCHAR(20), 
      active BOOLEAN DEFAULT TRUE, gst_percent DECIMAL(5,2) DEFAULT 5, 
      available_dine BOOLEAN DEFAULT TRUE, available_takeaway BOOLEAN DEFAULT TRUE, 
      available_delivery BOOLEAN DEFAULT TRUE, category_id VARCHAR(50) REFERENCES categories(id), 
      stock DECIMAL(10,2) DEFAULT 0, min_stock DECIMAL(10,2) DEFAULT 0,
      outlet_id VARCHAR(50) REFERENCES outlets(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Create Orders
      await db.query(`CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY, table_id VARCHAR(50) REFERENCES tables(id), 
      items JSONB DEFAULT '[]', subtotal DECIMAL(10,2) DEFAULT 0, 
      cgst DECIMAL(10,2) DEFAULT 0, sgst DECIMAL(10,2) DEFAULT 0, 
      total DECIMAL(10,2) DEFAULT 0, status VARCHAR(20) DEFAULT 'pending', 
      order_type VARCHAR(20) DEFAULT 'dine-in', customer_name VARCHAR(100), 
      kot_printed BOOLEAN DEFAULT FALSE, outlet_id VARCHAR(50) REFERENCES outlets(id), 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Create Bills
      await db.query(`CREATE TABLE IF NOT EXISTS bills (
      id VARCHAR(50) PRIMARY KEY, order_id VARCHAR(50) REFERENCES orders(id), 
      subtotal DECIMAL(10,2) DEFAULT 0, cgst DECIMAL(10,2) DEFAULT 0, 
      sgst DECIMAL(10,2) DEFAULT 0, total DECIMAL(10,2) DEFAULT 0, 
      discount DECIMAL(10,2) DEFAULT 0, payment_method JSONB DEFAULT '{"method": "cash", "amount": 0}', 
      outlet_id VARCHAR(50) REFERENCES outlets(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Create Inventory
      await db.query(`CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, stock DECIMAL(10,2) DEFAULT 0, 
      min_stock DECIMAL(10,2) DEFAULT 0, unit VARCHAR(20), price DECIMAL(10,2) DEFAULT 0,
      outlet_id VARCHAR(50) REFERENCES outlets(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

      // Ensure all columns exist (Migration safety)
      await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
      await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0');

      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE');
      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT \'veg\'');
      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category_id VARCHAR(50)');
      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS emoji VARCHAR(20)');
      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS gst_percent DECIMAL(5,2) DEFAULT 5');
      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE tables ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE bills ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      // Change payment_method type to JSONB if it was VARCHAR
      try {
        await db.query('ALTER TABLE bills ALTER COLUMN payment_method TYPE JSONB USING CASE WHEN payment_method LIKE \'{%\' THEN payment_method::jsonb ELSE jsonb_build_object(\'method\', payment_method, \'amount\', total) END');
      } catch (e) { console.error('Could not alter payment_method:', e.message); }

      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock DECIMAL(10,2) DEFAULT 0');
      await db.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS min_stock DECIMAL(10,2) DEFAULT 0');
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS kot_printed BOOLEAN DEFAULT FALSE');
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_no INTEGER');
      await db.query('ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_no INTEGER');
      await db.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');
      await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50)');

      // Backfill outlet_id for existing records
      await db.query("UPDATE tables SET outlet_id = 'out_main' WHERE outlet_id IS NULL");
      await db.query("UPDATE categories SET outlet_id = 'out_main' WHERE outlet_id IS NULL");
      await db.query("UPDATE menu_items SET outlet_id = 'out_main' WHERE outlet_id IS NULL");
      await db.query("UPDATE orders SET outlet_id = 'out_main' WHERE outlet_id IS NULL");
      await db.query("UPDATE inventory SET outlet_id = 'out_main' WHERE outlet_id IS NULL");

      // Seed Admin/Cashier
      const adminPass = bcrypt.hashSync('123456', 10);
      const cashierPass = bcrypt.hashSync('cash123', 10);

      await db.query("INSERT INTO outlets (id, name) VALUES ('out_main', 'Main Outlet') ON CONFLICT DO NOTHING");
      await db.query("INSERT INTO users (name, email, phone, password, role, outlet_id) VALUES ('Admin', 'admin@restauraq.com', '9876543210', $1, 'admin', 'out_main') ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone, password = EXCLUDED.password", [adminPass]);
      await db.query("INSERT INTO users (name, email, phone, password, role, outlet_id) VALUES ('Cashier', 'cashier@restauraq.com', '8888888888', $1, 'cashier', 'out_main') ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone, password = EXCLUDED.password", [cashierPass]);

      console.log('✅ Database schema verified and seeded.');
    } catch (err) {
      console.error('⚠️ Startup migration failed:', err.message);
    }
  });
}

module.exports = app;
