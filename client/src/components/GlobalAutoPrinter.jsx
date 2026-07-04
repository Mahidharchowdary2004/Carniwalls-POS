import React, { useEffect, useState } from 'react';

export default function GlobalAutoPrinter() {
  const [printJob, setPrintJob] = useState(null);

  useEffect(() => {
    const executePrint = (job) => {
      setPrintJob(job);
      setTimeout(async () => {
        if (window.ipcRenderer) {
          const printerName = localStorage.getItem('pos_printer') || '';
          const printScale = localStorage.getItem('pos_print_scale') || 100;
          try {
            await window.ipcRenderer.invoke('print-silent', { printerName, scaleFactor: printScale });
          } catch (err) {
            console.warn('print-silent invoke failed, falling back to send:', err);
            window.ipcRenderer.send('print-silent', { printerName, scaleFactor: printScale });
          }
        }
        setTimeout(() => setPrintJob(null), 1000);
      }, 500);
    };

    const handleAutoPrintKot = (e) => executePrint({ type: 'kot', data: e.detail });
    const handleAutoPrintBill = (e) => executePrint({ type: 'bill', data: e.detail });

    window.addEventListener('auto-print-kot', handleAutoPrintKot);
    window.addEventListener('auto-print-bill', handleAutoPrintBill);
    return () => {
      window.removeEventListener('auto-print-kot', handleAutoPrintKot);
      window.removeEventListener('auto-print-bill', handleAutoPrintBill);
    };
  }, []);

  if (!printJob) return null;

  const fsFontSize = parseInt(localStorage.getItem('pos_print_font_size')) || 16;
  const { type, data } = printJob;
  const items = typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || []);

  return (
    <div className="print-only" style={{ display: 'none' }}>
      <style>{`
        @media print {
          .print-only { display: block !important; }
          body > *:not(.print-only) { display: none !important; }
          @page { margin: 0; }
          body { margin: 0; padding: 4px; font-family: monospace; color: #000; background: #fff; }
        }
      `}</style>
      <div>
        {type === 'kot' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 4, fontSize: `${fsFontSize}px`, fontWeight: 'bold' }}>
              <div>
                {new Date(data.created_at || Date.now()).toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' })}{' '}
                {new Date(data.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
              <div>KOT - {data.token_no}</div>
              <div>{data.order_type === 'dine-in' ? 'dine in' : data.order_type}</div>
              {data.table_id && <div>Table: {data.table_id}</div>}
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />
            <table style={{ width: '100%', fontSize: `${fsFontSize}px`, fontWeight: 'bold', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '75%', textAlign: 'left', padding: '2px 0' }}>Item</th>
                  <th style={{ width: '25%', textAlign: 'right', padding: '2px 0' }}>Qty.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ width: '75%', textAlign: 'left', padding: '2px 0', wordBreak: 'break-word', whiteSpace: 'normal' }}>{item.name}</td>
                    <td style={{ width: '25%', textAlign: 'right', padding: '2px 0' }}>{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: `${fsFontSize * 1.25}px`, marginTop: '10px' }}>
              BABA DAIRY MILK PRODUCTS
            </div>
            <div style={{ textAlign: 'center', fontSize: `${Math.round(fsFontSize * 0.9375)}px`, fontWeight: 'bold', margin: '4px 0' }}>
              D.NO. 2-13-80, Servey No. 411-A,<br />
              411-B, 2nd Ward<br />
              East Side of National Highway Road<br />
              Sri Potti Sriramulu Nellore Andhar<br />
              pradesh -5241437
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            {data.customer_name && (
              <>
                <div style={{ fontSize: `${fsFontSize}px`, fontWeight: 'bold', margin: '2px 0' }}>
                  Name: {data.customer_name}
                </div>
                <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fsFontSize}px`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              <span>Date: {new Date(data.created_at || Date.now()).toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' })}</span>
              <span>{data.order_type === 'dine-in' ? 'dine in' : data.order_type}: {data.table_id || ''}</span>
            </div>
            <div style={{ fontSize: `${fsFontSize}px`, fontWeight: 'bold' }}>
              {new Date(data.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fsFontSize}px`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              <span>Cashier: biller</span>
              <span>Bill No.: {data.bill_no}</span>
            </div>
            <div style={{ fontSize: `${fsFontSize}px`, fontWeight: 'bold' }}>
              Token No.: {data.token_no || ''}
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <table style={{ width: '100%', fontSize: `${fsFontSize}px`, fontWeight: 'bold', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '45%', textAlign: 'left', padding: '2px 0' }}>Item</th>
                  <th style={{ width: '15%', textAlign: 'center', padding: '2px 0' }}>Qty.</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>Price</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ width: '45%', textAlign: 'left', padding: '2px 0', wordBreak: 'break-word', whiteSpace: 'normal' }}>{item.name}</td>
                    <td style={{ width: '15%', textAlign: 'center', padding: '2px 0' }}>{item.qty}</td>
                    <td style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>{Number(item.price || 0).toFixed(2)}</td>
                    <td style={{ width: '20%', textAlign: 'right', padding: '2px 0' }}>{(Number(item.price || 0) * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fsFontSize}px`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              <span>Total Qty: {items.reduce((sum, i) => sum + (i.qty || 1), 0)}</span>
              <span>Sub Total {Number(data.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'right', fontSize: `${Math.round(fsFontSize * 1.125)}px`, fontWeight: 'bold', margin: '4px 0' }}>
              Grand Total &nbsp; ₹ {Number(data.total || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: `${Math.round(fsFontSize * 0.875)}px`, fontWeight: 'bold', margin: '2px 0' }}>
              Paid via {data.payment_method?.toUpperCase()}
            </div>
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontSize: `${fsFontSize}px`, fontWeight: 'bold', marginTop: '6px' }}>
              Thank You | Please Visit Again
            </div>
          </>
        )}
      </div>
    </div>
  );
}
