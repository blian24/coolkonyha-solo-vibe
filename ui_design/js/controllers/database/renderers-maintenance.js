/**
 * @file renderers-maintenance.js
 * @description Table renderers for the Maintenance domain: Cases, Items,
 *              History, Workflow. Fully isolated from the Orders domain.
 * @see docs/architecture/database-schema.md — full schema reference
 */

import { expandedRows, statusPill, fmtDate, fmtDt, fieldHtml } from './state.js';

export const renderMaintenanceCases = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-wrench text-4xl opacity-20"></i><span>No maintenance cases found</span></div>'; return; }

  const rows = data.map(mc => `
    <tr id="row-mc${mc.case_id}" class="${expandedRows.has('mc'+mc.case_id) ? 'expanded' : ''}" onclick="toggleRow('mc${mc.case_id}')">
      <td><i class="fas fa-chevron-right expand-chevron mr-2"></i></td>
      <td><span class="mono-tag">${mc.case_code}</span></td>
      <td><strong style="font-size:0.83rem;">${mc.cust_name ?? `#${mc.cust_id}`}</strong></td>
      <td>${statusPill(mc.current_status ?? 'NEW')}</td>
      <td style="color:var(--muted); font-size:0.75rem; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${mc.description || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDate(mc.case_date)}</td>
    </tr>
    <tr id="drawer-mc${mc.case_id}" class="detail-drawer ${expandedRows.has('mc'+mc.case_id) ? 'open' : ''}">
      <td colspan="6" class="detail-cell">
        <div class="detail-grid">
          ${fieldHtml('Case ID', mc.case_id)}
          ${fieldHtml('Case Code', mc.case_code)}
          ${fieldHtml('Customer', mc.cust_name)}
          ${fieldHtml('Status', mc.current_status)}
          ${fieldHtml('Opened', fmtDt(mc.case_date))}
          ${fieldHtml('Last Update', fmtDt(mc.current_status_update))}
          ${fieldHtml('Update Event', mc.update_event)}
          ${fieldHtml('Description', mc.description)}
          ${fieldHtml('Notes', mc.notes)}
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;"></th>
        <th>Case Code</th><th>Customer</th><th>Status</th><th>Description</th><th>Date</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderMaintenanceItems = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-tools text-4xl opacity-20"></i><span>No maintenance items found</span></div>'; return; }

  const rows = data.map(mi => `
    <tr>
      <td><span class="mono-tag">${mi.case_code ?? mi.case_id}</span></td>
      <td><strong style="font-size:0.83rem;">${mi.prod_name ?? `#${mi.prod_id}`}</strong></td>
      <td style="text-align:right;">${mi.quantity}</td>
      <td style="color:var(--muted); font-size:0.78rem; max-width:300px;">${mi.issue_note || '–'}</td>
      <td style="color:var(--muted); font-size:0.72rem;">${mi.item_id}</td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Case Code</th>
        <th>Product</th>
        <th style="text-align:right;">Qty</th>
        <th>Issue Note</th>
        <th>Item ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderMaintenanceHistory = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-history text-4xl opacity-20"></i><span>No maintenance history found</span></div>'; return; }

  const rows = data.map(h => `
    <tr>
      <td><span class="mono-tag">${h.case_code ?? h.case_id}</span></td>
      <td>${statusPill(h.status ?? 'NEW')}</td>
      <td style="color:var(--muted); font-size:0.75rem; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${h.update_event || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem;">${h.performed_by || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDt(h.update_date)}</td>
      <td style="color:var(--muted); font-size:0.72rem;">${h.history_id}</td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Case Code</th>
        <th>Status</th>
        <th>Event</th>
        <th>Performed By</th>
        <th>Date</th>
        <th>Entry ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

export const renderMaintenanceWorkflow = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-project-diagram text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map((w, i) => `
    <tr>
      <td style="width:2rem; color:var(--muted); font-size:0.72rem;">${i + 1}</td>
      <td>${statusPill(w.status_key ?? '–')}</td>
      <td style="color:var(--text); font-size:0.82rem;">${w.display_name || '–'}</td>
      <td style="color:var(--muted); font-size:0.78rem; max-width:260px;">${w.description || '–'}</td>
      <td style="text-align:center;">${w.is_skippable ? '<i class="fas fa-check" style="color:#4ade80;"></i>' : '<i class="fas fa-times" style="color:var(--muted);"></i>'}</td>
      <td>
        ${w.status_color
          ? `<span style="display:inline-flex;align-items:center;gap:0.4rem;"><span style="width:0.75rem;height:0.75rem;border-radius:50%;background:${w.status_color};"></span><span class="mono-tag">${w.status_color}</span></span>`
          : '–'}
      </td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;">#</th>
        <th>Status Key</th><th>Display Name</th><th>Description</th>
        <th style="text-align:center;">Skippable</th><th>Color</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};
