/**
 * @file renderers-master-data.js
 * @description Table renderers for the Master Data domain: Customers,
 *              Suppliers, Products.
 * @see docs/architecture/database-schema.md — full schema reference
 */

import { orderCountMap, logoThumb, fmtPrice } from './state.js';

export const renderCustomers = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-users text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map(c => {
    const count = orderCountMap[c.cust_id] ?? 0;
    return `
    <tr onclick="openCustomerModal(${c.cust_id})" style="cursor:pointer;">
      <td style="padding-left:1.25rem;">${logoThumb(c.logo_path)}</td>
      <td><strong style="font-family:'Montserrat',sans-serif; font-size:0.83rem;">${c.cust_name}</strong></td>
      <td style="color:var(--muted);">${c.cust_contact ?? '–'}</td>
      <td><a href="mailto:${c.cust_email}" onclick="event.stopPropagation()" style="color:var(--accent);">${c.cust_email ?? '–'}</a></td>
      <td>${c.cust_phone ?? '–'}</td>
      <td><span class="order-badge"><i class="fas fa-clipboard-list" style="font-size:0.55rem;"></i> ${count} orders</span></td>
    </tr>`;
  }).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:3.5rem;">Logo</th>
        <th>Company Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Orders</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderSuppliers = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-truck text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map(s => `
    <tr onclick="openSupplierModal(${s.prod_supp_id})" style="cursor:pointer;">
      <td><strong style="font-family:'Montserrat',sans-serif; font-size:0.83rem;">${s.prod_supp_co ?? '–'}</strong></td>
      <td>${s.prod_supp_name ?? '–'}</td>
      <td><a href="mailto:${s.prod_supp_email}" onclick="event.stopPropagation()" style="color:var(--accent);">${s.prod_supp_email ?? '–'}</a></td>
      <td>${s.prod_supp_phone ?? '–'}</td>
      <td>${s.prod_supp_web ? `<a href="${s.prod_supp_web}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent); font-size:0.75rem;">${s.prod_supp_web}</a>` : '–'}</td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Web</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderProducts = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-box text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map(p => `
    <tr onclick="openProductModal(${p.prod_id})" style="cursor:pointer;">
      <td><strong style="font-family:'Montserrat',sans-serif; font-size:0.83rem;">${p.prod_name}</strong></td>
      <td><span class="mono-tag">${p.prod_type ?? '–'}</span></td>
      <td>${p.prod_size ?? '–'}</td>
      <td style="font-family:'JetBrains Mono',monospace; color:#f59e0b;">${fmtPrice(p.unit_price)}</td>
      <td>${p.prod_supp_id ?? '–'}</td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Product Name</th><th>Type</th><th>Size</th><th>Unit Price</th><th>Supplier ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};
