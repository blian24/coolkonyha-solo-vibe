/**
 * @file modal-order.js
 * @description Order detail/edit modal: status update, items table,
 *              history timeline, and the placeholder PISTA chat panel.
 *              More complex than the other three modals — it fetches its
 *              own detail payload (order + items + history) rather than
 *              reading from the table's currentData.
 *
 * NOTE on the circular import with databaseController.js: this file imports
 * `loadTab` from the entry module, which itself imports this file (as a
 * side-effect import, to register the window.* handlers below). This is
 * safe because `loadTab` is only ever called from inside an event handler
 * (saveOrderStatus), never at module-evaluation time — by the time it
 * actually runs, both modules have fully finished loading.
 */

import { API_BASE, customersCache, resolveLogoUrl, statusPill, fmtDt, fmtPrice } from './state.js';
import { loadTab } from './databaseController.js';

let orderModalData = null;
let orderEditMode = false;

window.openOrderModal = async (orderId) => {
  document.getElementById('order-modal').classList.add('open');
  document.getElementById('om-body').innerHTML = '<div class="empty-state" style="padding:2rem;"><i class="fas fa-circle-notch fa-spin" style="color:var(--accent);"></i></div>';
  document.getElementById('om-timeline').innerHTML = '';
  orderEditMode = false;
  document.getElementById('order-edit-btn').classList.remove('active');
  try {
    const resp = await fetch(`${API_BASE}/orders/${orderId}`);
    if (!resp.ok) throw new Error(resp.statusText);
    orderModalData = await resp.json();
    renderOrderModal();
    seedOrderChat(orderModalData);
  } catch (err) {
    document.getElementById('om-body').innerHTML = `<div class="empty-state" style="padding:2rem;"><i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i><span>Error: ${err.message}</span></div>`;
  }
};

window.closeOrderModal = () => { document.getElementById('order-modal').classList.remove('open'); };
window.handleOrderModalBgClick = (e) => { if (e.target === document.getElementById('order-modal')) closeOrderModal(); };

window.toggleOrderEdit = () => {
  orderEditMode = !orderEditMode;
  document.getElementById('order-edit-btn').classList.toggle('active', orderEditMode);
  renderOrderModal();
};

const renderOrderModal = () => {
  if (!orderModalData) return;
  const { order: o, items, history } = orderModalData;

  const cust = customersCache ? customersCache.find(c => c.cust_id === o.cust_id) : null;
  const custLogoUrl = resolveLogoUrl(cust ? cust.logo_path : null);
  document.getElementById('om-logo').innerHTML = custLogoUrl
    ? `<img src="${custLogoUrl}" onerror="setFallbackIcon(this)">`
    : `<i class="fas fa-file-invoice"></i>`;
  document.getElementById('om-code').textContent = o.order_code ?? `#${o.order_id}`;
  document.getElementById('om-customer').textContent = cust
    ? `${cust.cust_name} • ID: ${o.cust_id}` : `Customer ID: ${o.cust_id}`;
  document.getElementById('om-status-badge').innerHTML = statusPill(o.current_status ?? 'NEW');

  const body = document.getElementById('om-body');

  if (orderEditMode) {
    body.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <div style="font-family:'Montserrat',sans-serif; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:var(--muted); margin-bottom:0.75rem;">Update Status</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem; margin-bottom:0.9rem;">
          <div class="edit-field"><label>Performer</label><input id="oe-performer" value="admin" placeholder="Who did this?"></div>
          <div class="edit-field"><label>New Status</label>
            <select id="oe-status" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.8rem;font-size:0.84rem;color:var(--text);outline:none;">
              ${['NEW','OFFER_SENT','ORDER_CONFIRMED','PURCHASE','READY_FOR_DELIVERY','DELIVERY','DELIVERED','INVOICED','CLOSED','CANCELLED'].map(s =>
                `<option value="${s}" ${s === o.current_status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="edit-field" style="margin-bottom:0.9rem;"><label>Event Description</label><textarea id="oe-event" style="min-height:5rem;">${o.update_event ?? ''}</textarea></div>
        <div style="display:flex;gap:0.75rem;">
          <button class="modal-save-btn" onclick="saveOrderStatus()">Save</button>
          <button class="modal-cancel-btn" onclick="toggleOrderEdit()">Cancel</button>
        </div>
      </div>
      <div style="font-family:'Montserrat',sans-serif; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:var(--muted); margin-bottom:0.75rem;">Items</div>
      ${renderOrderItemsModal(items)}`;
  } else {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem 1.5rem; margin-bottom:1.25rem;">
        ${[['Order ID', o.order_id],['Order Code', o.order_code],['Currency', o.currency],
           ['Created', fmtDt(o.order_date)],['Last Status Update', fmtDt(o.current_status_update)],
           ['Last Event', o.update_event]].map(([l,v]) =>
          `<div class="detail-field"><span class="detail-label">${l}</span><span class="detail-value">${v || '–'}</span></div>`).join('')}
      </div>
      <div style="font-family:'Montserrat',sans-serif; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:var(--muted); margin-bottom:0.75rem;">Items</div>
      ${renderOrderItemsModal(items)}`;
  }

  const tl = document.getElementById('om-timeline');
  if (!history || !history.length) {
    tl.innerHTML = '<p style="font-size:0.75rem; color:var(--muted);">No history.</p>';
  } else {
    tl.innerHTML = history.map(h => `
      <div class="tl-item">
        <div class="tl-dot-col"><div class="tl-dot"></div><div class="tl-line"></div></div>
        <div class="tl-content">
          <div class="tl-status">${statusPill(h.status ?? 'NEW')}</div>
          <div class="tl-event">${h.update_event || '–'}</div>
          <div class="tl-meta">${h.performed_by ? `${h.performed_by} • ` : ''}${h.update_date ? new Date(h.update_date).toLocaleString('hu-HU') : '–'}</div>
        </div>
      </div>`).join('');
  }
};

/** Named distinctly from the tab-level renderOrderItems (renderers-orders.js). */
const renderOrderItemsModal = (items) => {
  if (!items || !items.length) return '<p style="font-size:0.78rem; color:var(--muted);">No items.</p>';
  return `<table style="width:100%; border-collapse:collapse; font-size:0.79rem;">
    <thead><tr>
      <th style="text-align:left; padding:0.4rem 0.6rem; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); border-bottom:1px solid var(--border);">Product</th>
      <th style="text-align:right; padding:0.4rem 0.6rem; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); border-bottom:1px solid var(--border);">Qty</th>
      <th style="text-align:right; padding:0.4rem 0.6rem; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); border-bottom:1px solid var(--border);">Unit Price</th>
      <th style="text-align:right; padding:0.4rem 0.6rem; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); border-bottom:1px solid var(--border);">Total</th>
    </tr></thead>
    <tbody>${items.map(i => `
      <tr>
        <td style="padding:0.4rem 0.6rem; border-bottom:1px solid var(--border);">${i.prod_name || i.prod_id}</td>
        <td style="padding:0.4rem 0.6rem; text-align:right; border-bottom:1px solid var(--border);">${i.quantity}</td>
        <td style="padding:0.4rem 0.6rem; text-align:right; font-family:'JetBrains Mono',monospace; color:#f59e0b; border-bottom:1px solid var(--border);">${fmtPrice(i.unit_price)}</td>
        <td style="padding:0.4rem 0.6rem; text-align:right; font-family:'JetBrains Mono',monospace; color:var(--accent); border-bottom:1px solid var(--border);">${fmtPrice(i.unit_price * i.quantity)}</td>
      </tr>`).join('')}
    </tbody></table>`;
};

window.saveOrderStatus = async () => {
  if (!orderModalData) return;
  const { order: o } = orderModalData;
  const status = document.getElementById('oe-status').value;
  const performer = document.getElementById('oe-performer').value || 'admin';
  const event = document.getElementById('oe-event').value;
  try {
    const resp = await fetch(`${API_BASE}/orders/${o.order_id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, performedBy: performer, eventDescription: event })
    });
    if (!resp.ok) throw new Error(resp.statusText);
    const detailResp = await fetch(`${API_BASE}/orders/${o.order_id}`);
    orderModalData = await detailResp.json();
    orderEditMode = false;
    document.getElementById('order-edit-btn').classList.remove('active');
    renderOrderModal();
    await loadTab('orders');
  } catch (err) { alert('Save error: ' + err.message); }
};

const seedOrderChat = ({ order: o }) => {
  const cust = customersCache ? customersCache.find(c => c.cust_id === o.cust_id) : null;
  const msgs = document.getElementById('om-chat-msgs');
  msgs.innerHTML = `
    <div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>
      I opened the <strong>${o.order_code ?? '#'+o.order_id}</strong> order${cust ? ` (${cust.cust_name})` : ''}. Current status: ${o.current_status}. How can I assist you?</div>`;
};

window.sendOrderChat = () => {
  const input = document.getElementById('om-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const msgs = document.getElementById('om-chat-msgs');
  msgs.innerHTML += `<div class="mc-user">${text}</div>`;
  msgs.innerHTML += `<div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>This feature will be available soon.</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
};
