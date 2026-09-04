/**
 * @file renderers-orders.js
 * @description Table renderers for the Orders domain: Orders, Order Items,
 *              Order History, Order Workflow.
 * @see docs/architecture/database-schema.md — full schema reference
 */

import { customersCache, logoThumb, statusPill, fmtDate, fmtPrice, fmtDt, fmt } from './state.js';

export const renderOrders = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map(o => {
    const cust = customersCache ? customersCache.find(c => c.cust_id === o.cust_id) : null;
    const custName = cust ? cust.cust_name : `#${o.cust_id}`;
    const custLogo = logoThumb(cust ? cust.logo_path : null);
    return `
    <tr onclick="openOrderModal(${o.order_id})" style="cursor:pointer;">
      <td style="padding-left:1.25rem;"><span class="mono-tag">${o.order_code ?? o.order_id}</span></td>
      <td>${custLogo}</td>
      <td style="color:var(--muted); font-size:0.75rem;">${o.cust_id}</td>
      <td><strong style="font-family:'Montserrat',sans-serif; font-size:0.82rem;">${custName}</strong></td>
      <td>${statusPill(o.current_status ?? 'NEW')}</td>
      <td style="color:var(--muted); font-size:0.75rem; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${o.update_event || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDate(o.current_status_update)}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDate(o.order_date)}</td>
    </tr>`;
  }).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Order Code</th>
        <th style="width:3.5rem;">Logo</th>
        <th>Cust ID</th>
        <th>Customer</th>
        <th>Status</th>
        <th>Last Event</th>
        <th>Updated</th>
        <th>Created</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderOrderItems = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-list-ul text-4xl opacity-20"></i><span>No order items found</span></div>'; return; }

  const rows = data.map(i => `
    <tr>
      <td><span class="mono-tag">${i.order_code ?? i.order_id}</span></td>
      <td><strong style="font-size:0.83rem;">${i.prod_name ?? `#${i.prod_id}`}</strong></td>
      <td style="text-align:right;">${i.quantity}</td>
      <td style="font-family:'JetBrains Mono',monospace; color:#f59e0b; text-align:right;">${fmtPrice(i.unit_price)}</td>
      <td style="font-family:'JetBrains Mono',monospace; color:var(--accent); text-align:right;">${fmtPrice(i.unit_price * i.quantity)}</td>
      <td style="color:var(--muted); font-size:0.72rem;">${i.order_item_id}</td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Order Code</th>
        <th>Product</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Line Total</th>
        <th>Item ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderOrderHistory = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-history text-4xl opacity-20"></i><span>No order history found</span></div>'; return; }

  const rows = data.map(h => `
    <tr>
      <td><span class="mono-tag">${h.order_code ?? h.order_id}</span></td>
      <td>${statusPill(h.status ?? 'NEW')}</td>
      <td style="color:var(--muted); font-size:0.75rem; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${h.update_event || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem;">${h.performed_by || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDt(h.update_date)}</td>
      <td style="color:var(--muted); font-size:0.72rem;">${h.history_id}</td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Order Code</th>
        <th>Status</th>
        <th>Event</th>
        <th>Performed By</th>
        <th>Date</th>
        <th>Entry ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderWorkflow = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-stream text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map((w, i) => `
    <tr>
      <td style="width:2rem; color:var(--muted); font-size:0.72rem;">${i + 1}</td>
      <td>${statusPill(w.status_key ?? w.status_name ?? w.status ?? '–')}</td>
      <td style="color:var(--muted); font-size:0.8rem;">${fmt(w.display_name ?? w.status_name)}</td>
      <td style="color:var(--muted); font-size:0.8rem;">${fmt(w.description ?? w.label)}</td>
      <td><span class="mono-tag">${fmt(w.status_id)}</span></td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;">#</th>
        <th>Status Key</th><th>Display Name</th><th>Description</th><th>ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};
