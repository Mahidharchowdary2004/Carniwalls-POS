import React, { useEffect, useState } from 'react'
import { api } from '../store'

export default function SalesSummary() {
  const fsSize = parseInt(localStorage.getItem('pos_print_font_size')) || 16;
  const [period, setPeriod] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [daily, setDaily] = useState([])
  const [itemSales, setItemSales] = useState([])
  const [viewType, setViewType] = useState('total')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)

  useEffect(() => {
    async function load() {
      if (period === 'custom' && (!fromDate || !toDate)) return;
      setLoading(true)
      try {
        let url = viewType === 'total' ? `/reports/daily?period=${period}` : `/reports/item-sales-daily?period=${period}`
        if (period === 'custom') url += `&from=${fromDate}&to=${toDate}`
        const d = await api.get(url)
        if (viewType === 'total') {
          setDaily(Array.isArray(d.data) ? d.data : [])
        } else {
          setItemSales(Array.isArray(d.data) ? d.data : [])
        }
      } finally { setLoading(false) }
    }
    load()
  }, [period, fromDate, toDate, viewType])

  const formatDate = (dateStr) => {
    if (period === 'year') return new Date(dateStr + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (period === 'all-time') return dateStr;
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const totalRevenue = daily.reduce((sum, d) => sum + Number(d.revenue || 0), 0)
  const totalOrders = daily.reduce((sum, d) => sum + Number(d.orders || 0), 0)

  const itemAggregates = {}
  itemSales.forEach(d => {
    if (!itemAggregates[d.item_name]) {
      itemAggregates[d.item_name] = { item_name: d.item_name, total_qty: 0, dates: [] }
    }
    itemAggregates[d.item_name].total_qty += Number(d.qty)
    itemAggregates[d.item_name].dates.push({ date: d.date, qty: d.qty })
  })

  const itemAggregatesArray = Object.values(itemAggregates).sort((a, b) => b.total_qty - a.total_qty)
  const filteredItemSales = itemAggregatesArray.filter(item => item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div>
      <div className="no-print">
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <div className={`tab ${viewType === 'total' ? 'active' : ''}`} onClick={() => setViewType('total')}>Total Sales</div>
          <div className={`tab ${viewType === 'item' ? 'active' : ''}`} onClick={() => setViewType('item')}>Item Sales</div>
        </div>
        <div style={{ width: '1px', height: 24, background: 'var(--border)' }}></div>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['today','week','month','year','all-time','custom'].map(p => (
            <div key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)} style={{ textTransform: 'capitalize' }}>{p.replace('-', ' ')}</div>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="input" style={{ width: 130, padding: '4px 8px', fontSize: 13, minHeight: 'auto' }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>to</span>
            <input type="date" className="input" style={{ width: 130, padding: '4px 8px', fontSize: 13, minHeight: 'auto' }} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}
        <div className="spacer" />
        <button className="btn btn-sm" onClick={() => { 
          if (window.ipcRenderer) {
            const printerName = localStorage.getItem('pos_printer') || '';
            const printScale = localStorage.getItem('pos_print_scale') || 100;
            window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale });
          } else {
            window.print(); 
          }
        }}>🖨️ Print</button>
        <button className="btn btn-sm">📄 Export PDF</button>
        <button className="btn btn-sm">📊 Export Excel</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : (
        <>
          <div className="grid-2 mb-6">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--orange-bg)' }}>💰</div>
              <div className="stat-label">Total Sales ({period})</div>
              <div className="stat-value" style={{ color: 'var(--orange)' }}>₹{totalRevenue.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--blue-bg)' }}>🧾</div>
              <div className="stat-label">Total Orders ({period})</div>
              <div className="stat-value" style={{ color: 'var(--blue)' }}>{totalOrders.toLocaleString()}</div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="card-title">{viewType === 'total' ? 'Sales Summary' : 'Item Sales Breakdown'}</div>
                <div className="card-sub">{viewType === 'total' ? 'Sales performance over time' : 'Quantities sold over time'}</div>
              </div>
              {viewType === 'item' && (
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Search items..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  style={{ padding: '6px 12px', fontSize: 13, width: 220, minHeight: 'auto' }} 
                />
              )}
            </div>
            <div className="table-wrap">
              {viewType === 'total' ? (
                <table>
                  <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th><th>Discount</th></tr></thead>
                  <tbody>
                    {(daily || []).map(d => (
                      <tr key={d.date}>
                        <td style={{ fontWeight: 500 }}>{formatDate(d.date)}</td>
                        <td>{d.orders}</td>
                        <td style={{ fontWeight: 600, color: 'var(--orange)' }}>₹{Number(d.revenue).toLocaleString()}</td>
                        <td style={{ color: 'var(--green)' }}>{d.discount > 0 ? `−₹${Number(d.discount).toLocaleString()}` : '—'}</td>
                      </tr>
                    ))}
                    {(!daily || daily.length === 0) && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>No sales data for this period</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Item Name</th><th style={{ textAlign: 'right' }}>Total Quantity Sold</th></tr></thead>
                  <tbody>
                    {(filteredItemSales || []).map((agg) => (
                      <React.Fragment key={agg.item_name}>
                        <tr 
                          onClick={() => setExpandedItem(expandedItem === agg.item_name ? null : agg.item_name)}
                          style={{ cursor: 'pointer', background: expandedItem === agg.item_name ? 'var(--bg2)' : 'transparent' }}
                        >
                          <td style={{ fontWeight: 500 }}>
                            <span style={{ display: 'inline-block', width: 16, fontSize: 10, color: 'var(--text3)' }}>
                              {expandedItem === agg.item_name ? '▼' : '▶'}
                            </span>
                            {agg.item_name}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--blue)', textAlign: 'right' }}>{agg.total_qty}</td>
                        </tr>
                        {expandedItem === agg.item_name && (
                          <tr>
                            <td colSpan="2" style={{ padding: 0, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ padding: '8px 24px 16px 40px' }}>
                                <table style={{ background: 'var(--bg1)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                  <thead>
                                    <tr><th style={{ padding: '6px 12px', fontSize: 12 }}>Date</th><th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 12 }}>Quantity</th></tr>
                                  </thead>
                                  <tbody>
                                    {agg.dates.map((d, j) => (
                                      <tr key={j} style={{ borderBottom: j === agg.dates.length - 1 ? 'none' : '1px solid var(--border)' }}>
                                        <td style={{ padding: '6px 12px', color: 'var(--text2)', fontSize: 13 }}>{formatDate(d.date)}</td>
                                        <td style={{ padding: '6px 12px', color: 'var(--text2)', textAlign: 'right', fontSize: 13 }}>{d.qty}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {(!filteredItemSales || filteredItemSales.length === 0) && (
                      <tr><td colSpan="2" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>No item sales data for this period or search</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
      </div>

      {/* THERMAL PRINTER SUMMARY FORMAT (Hidden on screen, visible only when printing) */}
      <div className="print-only receipt-content">
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: `${fsSize}px`, marginTop: '10px' }}>
          SALES SUMMARY
        </div>
        <div style={{ textAlign: 'center', fontSize: `${Math.round(fsSize * 0.875)}px`, margin: '4px 0' }}>
          Period: {period.toUpperCase()}
          {period === 'custom' && ` (${fromDate} to ${toDate})`}
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${Math.round(fsSize * 0.875)}px` }}>
          <span>Total Sales</span>
          <span>₹{totalRevenue.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${Math.round(fsSize * 0.875)}px` }}>
          <span>Total Orders</span>
          <span>{totalOrders.toLocaleString()}</span>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <table style={{ width: '100%', fontSize: `${Math.round(fsSize * 0.875)}px` }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontWeight: 'normal', padding: '2px 0' }}>Date</th>
              <th style={{ textAlign: 'center', fontWeight: 'normal', padding: '2px 0' }}>Ord</th>
              <th style={{ textAlign: 'right', fontWeight: 'normal', padding: '2px 0' }}>Rev</th>
            </tr>
          </thead>
          <tbody>
            {(daily || []).map(d => (
              <tr key={d.date}>
                <td style={{ textAlign: 'left', paddingRight: '2px', padding: '2px 0' }}>
                  {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                </td>
                <td style={{ textAlign: 'center', padding: '2px 0' }}>{d.orders}</td>
                <td style={{ textAlign: 'right', padding: '2px 0' }}>{Number(d.revenue).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ textAlign: 'center', fontSize: `${Math.round(fsSize * 0.75)}px`, marginTop: '6px' }}>
          Printed on {new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  )
}
