/**
 * @file databaseController.js
 * @description Controller for the Database view.
 */

/* ── Constants & State ─────────────────────────── */
const API_BASE = 'http://localhost:3001/api';
const STATIC_BASE = 'http://localhost:3001';
let currentTab = 'customers';
let currentData = [];
let expandedRows = new Set();
let allOrders = [];           // cached for order counts
let orderCountMap = {};       // { cust_id: count }
let modalCustomer = null;     // currently open customer object
let modalEditMode = false;
let customersCache = null;    // all customers, pre-fetched for order enrichment

/* ── Logo URL resolution ───────────────────────── */
const resolveLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath;
  return STATIC_BASE + (logoPath.startsWith('/') ? '' : '/') + logoPath;
};

const logoThumb = (logoPath, size = '2.6rem') => {
  const url = resolveLogoUrl(logoPath);
  if (url) return `<div class="logo-thumb" style="width:${size};height:${size};"><img src="${url}" onerror="setFallbackIcon(this)"></div>`;
  return `<div class="logo-thumb" style="width:${size};height:${size};"><i class="fas fa-building"></i></div>`;
};

/* Global helper — avoids any quote-escaping in onerror attributes */
window.setFallbackIcon = (imgEl) => {
  imgEl.parentElement.innerHTML = '<i class="fas fa-building"></i>';
};

/* ── Theme ─────────────────────────────────────── */
window.toggleTheme = () => {
  const html = document.documentElement;
  const isNowDark = html.classList.toggle('dark');
  document.getElementById('theme-label').textContent = isNowDark ? 'Dark Mode' : 'Light Mode';
};

/* ── Tab switching ─────────────────────────────── */
window.switchTab = async (tab) => {
  if (currentTab === tab) return;
  currentTab = tab;
  expandedRows.clear();
  document.getElementById('db-search').value = '';

  document.querySelectorAll('.db-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');

  await loadTab(tab);
};

/* ── Load data for tab ─────────────────────────── */
const loadTab = async (tab) => {
  showLoading();
  try {
    const resp = await fetch(`${API_BASE}/${tab}`);
    if (!resp.ok) throw new Error(resp.statusText);
    currentData = await resp.json();
    renderTab(tab, currentData);
  } catch (err) {
    showError(err.message);
  }
};

/* ── Render dispatcher ─────────────────────────── */
const renderTab = (tab, data) => {
  switch (tab) {
    case 'customers': renderCustomers(data); break;
    case 'suppliers': renderSuppliers(data); break;
    case 'products':  renderProducts(data); break;
    case 'orders':    renderOrders(data); break;
    case 'workflow':  renderWorkflow(data); break;
  }
  updateRowCount(data.length);
};

/* ── Search ────────────────────────────────────── */
window.applySearch = () => {
  const q = document.getElementById('db-search').value.toLowerCase();
  const filtered = currentData.filter(row =>
    Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
  );
  renderTab(currentTab, filtered);
};

/* ── Helpers ───────────────────────────────────── */
const showLoading = () => {
  document.getElementById('table-area').innerHTML = `
    <div class="empty-state" id="loading-indicator">
      <i class="fas fa-circle-notch fa-spin text-3xl" style="color:var(--accent);"></i>
      <span class="text-sm">Loading...</span>
    </div>`;
};

const showError = (msg) => {
  document.getElementById('table-area').innerHTML = `
    <div class="empty-state">
      <i class="fas fa-exclamation-triangle text-3xl" style="color:#f59e0b;"></i>
      <span class="text-sm">Error: ${msg}</span>
    </div>`;
};

const updateRowCount = (n) => {
  document.getElementById('row-count').textContent = `${n} records`;
};

window.toggleRow = (id) => {
  const drawer = document.getElementById(`drawer-${id}`);
  const rowEl  = document.getElementById(`row-${id}`);
  if (!drawer) return;
  if (expandedRows.has(id)) {
    expandedRows.delete(id);
    drawer.classList.remove('open');
    rowEl.classList.remove('expanded');
  } else {
    expandedRows.add(id);
    drawer.classList.add('open');
    rowEl.classList.add('expanded');
  }
};

const fmt = (v) => v ?? '–';

const statusPill = (s) =>
  `<span class="pill p-${s}">${s.replace(/_/g, ' ')}</span>`;

const fieldHtml = (label, value) =>
  `<div class="detail-field">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${fmt(value)}</span>
  </div>`;

/* ── CUSTOMERS ─────────────────────────────────── */
const renderCustomers = (data) => {
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

/* ── CUSTOMER MODAL ────────────────────────────── */
window.openCustomerModal = (custId) => {
  modalCustomer = currentData.find(c => c.cust_id === custId) || null;
  if (!modalCustomer) return;
  modalEditMode = false;
  renderModalContent();
  document.getElementById('customer-modal').classList.add('open');
  seedModalChat(modalCustomer);
};

window.closeCustomerModal = () => {
  document.getElementById('customer-modal').classList.remove('open');
};

window.handleModalBgClick = (e) => {
  if (e.target === document.getElementById('customer-modal')) closeCustomerModal();
};

window.toggleModalEdit = () => {
  modalEditMode = !modalEditMode;
  document.getElementById('modal-edit-btn').classList.toggle('active', modalEditMode);
  renderModalContent();
};

const renderModalContent = () => {
  const c = modalCustomer;
  if (!c) return;

  // Hero
  const logoUrl = resolveLogoUrl(c.logo_path);
  document.getElementById('m-logo').innerHTML = logoUrl
    ? `<img src="${logoUrl}" onerror="setFallbackIcon(this)">`
    : `<i class="fas fa-building"></i>`;
  document.getElementById('m-name').textContent = c.cust_name;
  document.getElementById('m-id').textContent = `ID: ${c.cust_id}`;
  const count = orderCountMap[c.cust_id] ?? 0;
  document.getElementById('m-order-badge').innerHTML =
    `<span class="order-badge"><i class="fas fa-clipboard-list" style="font-size:0.55rem;"></i> ${count} orders</span>`;

  // Body
  const body = document.getElementById('modal-body-content');
  if (modalEditMode) {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
        <div class="edit-field"><label>Company Name</label><input id="ef-name" value="${c.cust_name ?? ''}"></div>
        <div class="edit-field"><label>Contact</label><input id="ef-contact" value="${c.cust_contact ?? ''}"></div>
        <div class="edit-field"><label>Email 1</label><input id="ef-email" type="email" value="${c.cust_email ?? ''}"></div>
        <div class="edit-field"><label>Email 2</label><input id="ef-email2" type="email" value="${c.cust_email2 ?? ''}"></div>
        <div class="edit-field"><label>Phone</label><input id="ef-phone" value="${c.cust_phone ?? ''}"></div>
        <div class="edit-field"><label>Web</label><input id="ef-web" value="${c.cust_web ?? ''}"></div>
        <div class="edit-field" style="grid-column:1/-1;"><label>Logo Path</label><input id="ef-logo" value="${c.logo_path ?? ''}"></div>
        <div class="edit-field" style="grid-column:1/-1;"><label>Notes</label><textarea id="ef-notes">${c.notes ?? ''}</textarea></div>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button class="modal-save-btn" onclick="saveModalCustomer()">Save</button>
        <button class="modal-cancel-btn" onclick="toggleModalEdit()">Cancel</button>
      </div>`;
  } else {
    const row = (label, val) =>
      `<div class="detail-field"><span class="detail-label">${label}</span><span class="detail-value">${val || '–'}</span></div>`;
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem 1.5rem; min-height:14rem;">
        ${row('Company Name', c.cust_name)}
        ${row('Contact', c.cust_contact)}
        ${row('Email', c.cust_email)}
        ${row('Email 2', c.cust_email2)}
        ${row('Phone', c.cust_phone)}
        ${row('Web', c.cust_web)}
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Logo Path</span>
          <span class="detail-value">${c.logo_path || '–'}</span>
        </div>
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Notes</span>
          <span class="detail-value">${c.notes || '–'}</span>
        </div>
      </div>`;
  }
};

window.saveModalCustomer = async () => {
  const c = modalCustomer;
  const body = {
    cust_name: document.getElementById('ef-name').value,
    cust_contact: document.getElementById('ef-contact').value,
    cust_email: document.getElementById('ef-email').value,
    cust_email2: document.getElementById('ef-email2').value,
    cust_phone: document.getElementById('ef-phone').value,
    cust_web: document.getElementById('ef-web').value,
    logo_path: document.getElementById('ef-logo').value,
    notes: document.getElementById('ef-notes').value
  };
  try {
    const resp = await fetch(`${API_BASE}/customers/${c.cust_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(resp.statusText);
    // Update local cache + re-render
    Object.assign(c, body);
    modalEditMode = false;
    document.getElementById('modal-edit-btn').classList.remove('active');
    renderModalContent();
    renderCustomers(currentData);
  } catch (err) { alert('Save error: ' + err.message); }
};

/* ── Modal Chat (P.I.S.T.A. context-aware) ─────── */
const seedModalChat = (c) => {
  const msgs = document.getElementById('modal-chat-msgs');
  msgs.innerHTML = `
    <div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>
      I loaded the connection for <strong>${c.cust_name}</strong>. They have ${orderCountMap[c.cust_id] ?? 0} recorded orders. How can I assist you?</div>`;
};

window.sendModalChat = () => {
  const input = document.getElementById('modal-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const msgs = document.getElementById('modal-chat-msgs');
  msgs.innerHTML += `<div class="mc-user">${text}</div>`;
  msgs.innerHTML += `<div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>This feature will be available soon.</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
};

/* ── SUPPLIERS ─────────────────────────────────── */
const renderSuppliers = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-truck text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map(s => `
    <tr id="row-s${s.prod_supp_id}" class="${expandedRows.has('s'+s.prod_supp_id) ? 'expanded' : ''}" onclick="toggleRow('s${s.prod_supp_id}')">
      <td><i class="fas fa-chevron-right expand-chevron mr-2"></i></td>
      <td><strong style="font-family:'Montserrat',sans-serif; font-size:0.83rem;">${s.prod_supp_co ?? '–'}</strong></td>
      <td>${s.prod_supp_name ?? '–'}</td>
      <td><a href="mailto:${s.prod_supp_email}" onclick="event.stopPropagation()" style="color:var(--accent);">${s.prod_supp_email ?? '–'}</a></td>
      <td>${s.prod_supp_phone ?? '–'}</td>
      <td>${s.prod_supp_web ? `<a href="${s.prod_supp_web}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent); font-size:0.75rem;">${s.prod_supp_web}</a>` : '–'}</td>
    </tr>
    <tr id="drawer-s${s.prod_supp_id}" class="detail-drawer ${expandedRows.has('s'+s.prod_supp_id) ? 'open' : ''}">
      <td colspan="6" class="detail-cell">
        <div class="detail-grid">
          ${fieldHtml('ID', s.prod_supp_id)}
          ${fieldHtml('Company', s.prod_supp_co)}
          ${fieldHtml('Contact', s.prod_supp_name)}
          ${fieldHtml('Email', s.prod_supp_email)}
          ${fieldHtml('Phone', s.prod_supp_phone)}
          ${fieldHtml('Web', s.prod_supp_web)}
          ${fieldHtml('Notes', s.notes)}
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;"></th>
        <th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Web</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/* ── PRODUCTS ──────────────────────────────────── */
const renderProducts = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-box text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const fmtPrice = (n) => n != null ? new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(n) : '–';

  const rows = data.map(p => `
    <tr id="row-p${p.prod_id}" class="${expandedRows.has('p'+p.prod_id) ? 'expanded' : ''}" onclick="toggleRow('p${p.prod_id}')">
      <td><i class="fas fa-chevron-right expand-chevron mr-2"></i></td>
      <td><strong style="font-family:'Montserrat',sans-serif; font-size:0.83rem;">${p.prod_name}</strong></td>
      <td><span class="mono-tag">${p.prod_type ?? '–'}</span></td>
      <td>${p.prod_size ?? '–'}</td>
      <td style="font-family:'JetBrains Mono',monospace; color:#f59e0b;">${fmtPrice(p.unit_price)}</td>
      <td>${p.prod_supp_id ?? '–'}</td>
    </tr>
    <tr id="drawer-p${p.prod_id}" class="detail-drawer ${expandedRows.has('p'+p.prod_id) ? 'open' : ''}">
      <td colspan="6" class="detail-cell">
        <div class="detail-grid">
          ${fieldHtml('ID', p.prod_id)}
          ${fieldHtml('Product Name', p.prod_name)}
          ${fieldHtml('Type', p.prod_type)}
          ${fieldHtml('Size', p.prod_size)}
          ${fieldHtml('Unit Price', fmtPrice(p.unit_price))}
          ${fieldHtml('Supplier ID', p.prod_supp_id)}
          ${fieldHtml('Image Path', p.image_path)}
          ${fieldHtml('Notes', p.notes)}
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;"></th>
        <th>Product Name</th><th>Type</th><th>Size</th><th>Unit Price</th><th>Supplier ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/* ── ORDERS ────────────────────────────────────── */
const renderOrders = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const fmtDt = (d) => d ? new Date(d).toLocaleDateString('hu-HU') : '–';

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
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDt(o.current_status_update)}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDt(o.order_date)}</td>
    </tr>`;
  }).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th>Order Code</th>
        <th style="width:3.5rem;">Logo</th>
        <th>ID</th>
        <th>Customer</th>
        <th>Status</th>
        <th>Last Event</th>
        <th>Updated</th>
        <th>Created</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/* ── ORDER MODAL ────────────────────────────────── */
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

  const fmtDt = (d) => d ? new Date(d).toLocaleString('hu-HU') : '–';
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
                `<option value="${s}" ${s === o.current_status ? 'selected' : ''}>${s.replace(/_/, ' ')}</option>`).join('')}
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
      ${renderOrderItems(items)}`;
  } else {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem 1.5rem; margin-bottom:1.25rem;">
        ${[['Order ID', o.order_id],['Order Code', o.order_code],['Currency', o.currency],
           ['Created', fmtDt(o.order_date)],['Last Status Update', fmtDt(o.current_status_update)],
           ['Last Event', o.update_event]].map(([l,v]) =>
          `<div class="detail-field"><span class="detail-label">${l}</span><span class="detail-value">${v || '–'}</span></div>`).join('')}
      </div>
      <div style="font-family:'Montserrat',sans-serif; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:var(--muted); margin-bottom:0.75rem;">Items</div>
      ${renderOrderItems(items)}`;
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

const renderOrderItems = (items) => {
  if (!items || !items.length) return '<p style="font-size:0.78rem; color:var(--muted);">No items.</p>';
  const fmtPrice = (n) => n != null ? new Intl.NumberFormat('hu-HU', { style:'currency', currency:'HUF', maximumFractionDigits:0 }).format(n) : '–';
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

/* ── WORKFLOW ──────────────────────────────────── */
const renderWorkflow = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-stream text-4xl opacity-20"></i><span>No data</span></div>'; return; }

  const rows = data.map((w, i) => `
    <tr>
      <td style="width:2rem; color:var(--muted); font-size:0.72rem;">${i + 1}</td>
      <td>${statusPill(w.status_name ?? w.status ?? w.name ?? '–')}</td>
      <td style="color:var(--muted); font-size:0.8rem;">${fmt(w.description ?? w.label)}</td>
      <td><span class="mono-tag">${fmt(w.sort_order ?? i)}</span></td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;">#</th>
        <th>Status</th><th>Description</th><th>Order</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/* ── Pre-fetch all orders for count map ───────── */
const prefetchOrders = async () => {
  try {
    const resp = await fetch(`${API_BASE}/orders`);
    if (!resp.ok) return;
    allOrders = await resp.json();
    orderCountMap = {};
    allOrders.forEach(o => {
      orderCountMap[o.cust_id] = (orderCountMap[o.cust_id] ?? 0) + 1;
    });
  } catch (_) { /* non-fatal */ }
};

/* ── Keyboard: Escape closes any modal ─────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCustomerModal(); closeOrderModal(); }
});

/* ── Bootstrap ─────────────────────────────────── */
export const initDatabaseController = async () => {
  // Pre-fetch customers for order enrichment (logo, name)
  try {
    const cr = await fetch(`${API_BASE}/customers`);
    customersCache = await cr.json();
  } catch (_) { /* non-fatal */ }
  await prefetchOrders();
  await switchTab('customers');
};
