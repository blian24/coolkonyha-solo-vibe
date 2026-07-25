/**
 * @file databaseController.js
 * @description Controller for the Database view.
 *              Handles all 13 table tabs across 4 groups:
 *              Master Data, Orders, Maintenance, Email & AI.
 *
 * @see docs/architecture/database-schema.md  — full schema reference
 * @see server/routes.js                      — API endpoints
 * @version 1.1.0 → 1.2.0 (v0.7.0 — added 8 new table tabs)
 */

/* ── Constants & State ─────────────────────────── */
const API_BASE = 'http://localhost:3001/api';
const STATIC_BASE = 'http://localhost:3001';

/** Maps tab key → API endpoint path */
const TAB_ENDPOINTS = {
  customers:            'customers',
  suppliers:            'suppliers',
  products:             'products',
  orders:               'orders',
  'order-items':        'order-items',
  'order-history':      'order-history',
  workflow:             'workflow',
  'maintenance-cases':  'maintenance',
  'maintenance-items':  'maintenance-items',
  'maintenance-history':'maintenance-history',
  'maintenance-workflow':'maintenance/workflow',
  'processed-emails':   'processed-emails',
  'sender-rules':       'sender-rules',
};

let currentTab = null;
let currentData = [];
let expandedRows = new Set();
let allOrders = [];
let orderCountMap = {};
let modalCustomer = null;
let modalEditMode = false;
let customersCache = null;

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

window.setFallbackIcon = (imgEl) => {
  imgEl.parentElement.innerHTML = '<i class="fas fa-building"></i>';
};

/* ── Theme ─────────────────────────────────────── */
window.toggleTheme = () => {
  const html = document.documentElement;
  const isNowDark = html.classList.toggle('dark');
  document.getElementById('theme-label').textContent = isNowDark ? 'Dark Mode' : 'Light Mode';
};

/* ── Refresh current tab (manual) ──────────────── */
window.refreshCurrentTab = async () => {
  if (!currentTab) return;
  const btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }
  await loadTab(currentTab);
  if (btn) {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
};

/* ── Tab switching ─────────────────────────────── */
window.switchTab = async (tab) => {
  if (currentTab === tab) return;
  currentTab = tab;
  expandedRows.clear();
  document.getElementById('db-search').value = '';

  document.querySelectorAll('.db-tab').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add('active');

  await loadTab(tab);
};

/* ── Load data for tab ─────────────────────────── */
const loadTab = async (tab) => {
  showLoading();
  const endpoint = TAB_ENDPOINTS[tab] || tab;
  try {
    const resp = await fetch(`${API_BASE}/${endpoint}`);
    if (!resp.ok) throw new Error(resp.statusText);
    currentData = await resp.json();
    renderTab(tab, currentData);
  } catch (err) {
    console.warn(`API unavailable for tab "${tab}":`, err.message);
    showError(`Could not load data (${err.message}). Is the server running?`);
  }
};

/* ── Render dispatcher ─────────────────────────── */
const renderTab = (tab, data) => {
  switch (tab) {
    case 'customers':             renderCustomers(data); break;
    case 'suppliers':             renderSuppliers(data); break;
    case 'products':              renderProducts(data); break;
    case 'orders':                renderOrders(data); break;
    case 'order-items':           renderOrderItems(data); break;
    case 'order-history':         renderOrderHistory(data); break;
    case 'workflow':              renderWorkflow(data); break;
    case 'maintenance-cases':     renderMaintenanceCases(data); break;
    case 'maintenance-items':     renderMaintenanceItems(data); break;
    case 'maintenance-history':   renderMaintenanceHistory(data); break;
    case 'maintenance-workflow':  renderMaintenanceWorkflow(data); break;
    case 'processed-emails':      renderProcessedEmails(data); break;
    case 'sender-rules':          renderSenderRules(data); break;
    default: showError(`Unknown tab: ${tab}`);
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
      <span class="text-sm">${msg}</span>
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

const fmtDt = (d) => d ? new Date(d).toLocaleString('hu-HU') : '–';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('hu-HU') : '–';
const fmtPrice = (n) => n != null
  ? new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(n)
  : '–';

const fieldHtml = (label, value) =>
  `<div class="detail-field">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${fmt(value)}</span>
  </div>`;

const directionBadge = (dir) => {
  const isIn = dir === 'received';
  return `<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.15rem 0.5rem;border-radius:20px;font-size:0.62rem;font-weight:700;letter-spacing:0.04em;
    background:${isIn ? 'rgba(74,222,128,0.12)' : 'rgba(96,165,250,0.12)'};
    color:${isIn ? '#4ade80' : '#60a5fa'};">
    <i class="fas fa-${isIn ? 'inbox' : 'paper-plane'}" style="font-size:0.55rem;"></i>
    ${isIn ? 'IN' : 'OUT'}
  </span>`;
};

const actionBadge = (action) => {
  const map = {
    skip:          { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', icon: 'ban' },
    notify:        { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', icon: 'bell' },
    auto_customer: { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', icon: 'user-plus' },
  };
  const s = map[action] || { bg: 'rgba(148,163,184,0.12)', color: 'var(--muted)', icon: 'question' };
  return `<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.15rem 0.5rem;border-radius:20px;font-size:0.62rem;font-weight:700;letter-spacing:0.04em;background:${s.bg};color:${s.color};">
    <i class="fas fa-${s.icon}" style="font-size:0.55rem;"></i> ${(action || '–').replace(/_/g,' ')}
  </span>`;
};

const emailStatusPill = (s) => {
  const map = {
    pending:   { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
    processed: { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    failed:    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    skipped:   { bg: 'rgba(148,163,184,0.12)', color: 'var(--muted)' },
  };
  const style = map[s] || map.skipped;
  return `<span style="display:inline-block;padding:0.15rem 0.55rem;border-radius:20px;font-size:0.62rem;font-weight:700;background:${style.bg};color:${style.color};">${s || '–'}</span>`;
};

/* ─────────────────────────────────────────────────
   MASTER DATA RENDERERS
───────────────────────────────────────────────── */

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

/* ── SUPPLIERS ─────────────────────────────────── */
const renderSuppliers = (data) => {
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


/* ── PRODUCTS ──────────────────────────────────── */
const renderProducts = (data) => {
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


/* ─────────────────────────────────────────────────
   ORDER DOMAIN RENDERERS
───────────────────────────────────────────────── */

/* ── ORDERS ────────────────────────────────────── */
const renderOrders = (data) => {
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

/* ── ORDER ITEMS ───────────────────────────────── */
const renderOrderItems = (data) => {
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

/* ── ORDER HISTORY ─────────────────────────────── */
const renderOrderHistory = (data) => {
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

/* ── ORDER WORKFLOW ────────────────────────────── */
const renderWorkflow = (data) => {
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

/* ─────────────────────────────────────────────────
   MAINTENANCE DOMAIN RENDERERS
───────────────────────────────────────────────── */

/* ── MAINTENANCE CASES ─────────────────────────── */
const renderMaintenanceCases = (data) => {
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

/* ── MAINTENANCE ITEMS ─────────────────────────── */
const renderMaintenanceItems = (data) => {
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

/* ── MAINTENANCE HISTORY ───────────────────────── */
const renderMaintenanceHistory = (data) => {
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

/* ── MAINTENANCE WORKFLOW ──────────────────────── */
const renderMaintenanceWorkflow = (data) => {
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

/* ─────────────────────────────────────────────────
   EMAIL & AI RENDERERS
───────────────────────────────────────────────── */

/* ── PROCESSED EMAILS ──────────────────────────── */
const renderProcessedEmails = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-envelope-open-text text-4xl opacity-20"></i><span>No processed emails found</span></div>'; return; }

  const rows = data.map(e => `
    <tr id="row-pe${e.email_id}" class="${expandedRows.has('pe'+e.email_id) ? 'expanded' : ''}" onclick="toggleRow('pe${e.email_id}')">
      <td><i class="fas fa-chevron-right expand-chevron mr-2"></i></td>
      <td>${directionBadge(e.direction)}</td>
      <td style="font-size:0.78rem; color:var(--muted);">${e.from_address || '–'}</td>
      <td style="font-size:0.8rem; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.subject || '–'}</td>
      <td>${emailStatusPill(e.status)}</td>
      <td>${e.linked_order_code ? `<span class="mono-tag">${e.linked_order_code}</span>` : '<span style="color:var(--muted);font-size:0.75rem;">–</span>'}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDate(e.email_date)}</td>
    </tr>
    <tr id="drawer-pe${e.email_id}" class="detail-drawer ${expandedRows.has('pe'+e.email_id) ? 'open' : ''}">
      <td colspan="7" class="detail-cell">
        <div class="detail-grid">
          ${fieldHtml('Email ID', e.email_id)}
          ${fieldHtml('Gmail Message ID', e.gmail_message_id)}
          ${fieldHtml('Thread ID', e.thread_id)}
          ${fieldHtml('Direction', e.direction)}
          ${fieldHtml('From', e.from_address)}
          ${fieldHtml('To', e.to_address)}
          ${fieldHtml('Subject', e.subject)}
          ${fieldHtml('Status', e.status)}
          ${fieldHtml('Linked Order', e.linked_order_code ?? e.linked_order_id ?? '–')}
          ${fieldHtml('Email Date', fmtDt(e.email_date))}
          ${fieldHtml('Processed At', fmtDt(e.processed_at))}
          ${fieldHtml('AI Summary', e.ai_summary)}
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;"></th>
        <th>Dir</th><th>From</th><th>Subject</th><th>Status</th>
        <th>Linked Order</th><th>Date</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/* ── SENDER RULES ──────────────────────────────── */
const renderSenderRules = (data) => {
  if (!data.length) { document.getElementById('table-area').innerHTML = '<div class="empty-state"><i class="fas fa-filter text-4xl opacity-20"></i><span>No sender rules found</span></div>'; return; }

  const rows = data.map(r => `
    <tr id="row-sr${r.rule_id}" class="${expandedRows.has('sr'+r.rule_id) ? 'expanded' : ''}" onclick="toggleRow('sr${r.rule_id}')">
      <td><i class="fas fa-chevron-right expand-chevron mr-2"></i></td>
      <td style="font-family:'JetBrains Mono',monospace; font-size:0.78rem;">${r.email_address}</td>
      <td>${actionBadge(r.action)}</td>
      <td style="color:var(--muted); font-size:0.78rem; max-width:260px;">${r.reason || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem;">${r.created_by || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem;">${r.approved_by || '–'}</td>
      <td style="color:var(--muted); font-size:0.75rem; white-space:nowrap;">${fmtDate(r.created_at)}</td>
    </tr>
    <tr id="drawer-sr${r.rule_id}" class="detail-drawer ${expandedRows.has('sr'+r.rule_id) ? 'open' : ''}">
      <td colspan="7" class="detail-cell">
        <div class="detail-grid">
          ${fieldHtml('Rule ID', r.rule_id)}
          ${fieldHtml('Email Address', r.email_address)}
          ${fieldHtml('Action', r.action)}
          ${fieldHtml('Reason', r.reason)}
          ${fieldHtml('Created By', r.created_by)}
          ${fieldHtml('Approved By', r.approved_by)}
          ${fieldHtml('Created At', fmtDt(r.created_at))}
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('table-area').innerHTML = `
    <table class="db-table">
      <thead><tr>
        <th style="width:2rem;"></th>
        <th>Email Address</th><th>Action</th><th>Reason</th>
        <th>Created By</th><th>Approved By</th><th>Created At</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/* ─────────────────────────────────────────────────
   SUPPLIER MODAL
───────────────────────────────────────────────── */
let modalSupplier = null;
let supplierEditMode = false;

window.openSupplierModal = (suppId) => {
  modalSupplier = currentData.find(s => s.prod_supp_id === suppId) || null;
  if (!modalSupplier) return;
  supplierEditMode = false;
  document.getElementById('supplier-edit-btn').classList.remove('active');
  renderSupplierModal();
  document.getElementById('supplier-modal').classList.add('open');
  seedSupplierChat(modalSupplier);
};

window.closeSupplierModal = () => {
  document.getElementById('supplier-modal').classList.remove('open');
};

window.handleSupplierModalBgClick = (e) => {
  if (e.target === document.getElementById('supplier-modal')) closeSupplierModal();
};

window.toggleSupplierEdit = () => {
  supplierEditMode = !supplierEditMode;
  document.getElementById('supplier-edit-btn').classList.toggle('active', supplierEditMode);
  renderSupplierModal();
};

const renderSupplierModal = () => {
  const s = modalSupplier;
  if (!s) return;

  document.getElementById('sm-logo').innerHTML = `<i class="fas fa-truck"></i>`;
  document.getElementById('sm-name').textContent = s.prod_supp_co ?? '–';
  document.getElementById('sm-id').textContent = `ID: ${s.prod_supp_id}`;

  const body = document.getElementById('supplier-modal-body');
  if (supplierEditMode) {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
        <div class="edit-field"><label>Company Name</label><input id="ef-s-co" value="${s.prod_supp_co ?? ''}"></div>
        <div class="edit-field"><label>Contact Person</label><input id="ef-s-name" value="${s.prod_supp_name ?? ''}"></div>
        <div class="edit-field"><label>Email</label><input id="ef-s-email" type="email" value="${s.prod_supp_email ?? ''}"></div>
        <div class="edit-field"><label>Phone</label><input id="ef-s-phone" value="${s.prod_supp_phone ?? ''}"></div>
        <div class="edit-field" style="grid-column:1/-1;"><label>Website</label><input id="ef-s-web" value="${s.prod_supp_web ?? ''}"></div>
        <div class="edit-field" style="grid-column:1/-1;"><label>Notes</label><textarea id="ef-s-notes">${s.notes ?? ''}</textarea></div>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button class="modal-save-btn" onclick="saveSupplierModal()">Save</button>
        <button class="modal-cancel-btn" onclick="toggleSupplierEdit()">Cancel</button>
      </div>`;
  } else {
    const row = (label, val) =>
      `<div class="detail-field"><span class="detail-label">${label}</span><span class="detail-value">${val || '–'}</span></div>`;
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem 1.5rem; min-height:14rem;">
        ${row('Company Name', s.prod_supp_co)}
        ${row('Contact Person', s.prod_supp_name)}
        ${row('Email', s.prod_supp_email)}
        ${row('Phone', s.prod_supp_phone)}
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Website</span>
          <span class="detail-value">${s.prod_supp_web
            ? `<a href="${s.prod_supp_web}" target="_blank" style="color:var(--accent);">${s.prod_supp_web}</a>`
            : '–'}</span>
        </div>
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Notes</span>
          <span class="detail-value">${s.notes || '–'}</span>
        </div>
      </div>`;
  }
};

window.saveSupplierModal = async () => {
  const s = modalSupplier;
  const body = {
    prod_supp_co:    document.getElementById('ef-s-co').value,
    prod_supp_name:  document.getElementById('ef-s-name').value,
    prod_supp_email: document.getElementById('ef-s-email').value,
    prod_supp_phone: document.getElementById('ef-s-phone').value,
    prod_supp_web:   document.getElementById('ef-s-web').value,
    notes:           document.getElementById('ef-s-notes').value,
  };
  try {
    const resp = await fetch(`${API_BASE}/suppliers/${s.prod_supp_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(resp.statusText);
    Object.assign(s, body);
    supplierEditMode = false;
    document.getElementById('supplier-edit-btn').classList.remove('active');
    renderSupplierModal();
    renderSuppliers(currentData);
  } catch (err) { alert('Save error: ' + err.message); }
};

const seedSupplierChat = (s) => {
  const msgs = document.getElementById('sm-chat-msgs');
  msgs.innerHTML = `
    <div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>
      I loaded the record for <strong>${s.prod_supp_co}</strong>. How can I assist you?</div>`;
};

window.sendSupplierChat = () => {
  const input = document.getElementById('sm-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const msgs = document.getElementById('sm-chat-msgs');
  msgs.innerHTML += `<div class="mc-user">${text}</div>`;
  msgs.innerHTML += `<div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>This feature will be available soon.</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
};

/* ─────────────────────────────────────────────────
   PRODUCT MODAL
───────────────────────────────────────────────── */
let modalProduct = null;
let productEditMode = false;

window.openProductModal = (prodId) => {
  modalProduct = currentData.find(p => p.prod_id === prodId) || null;
  if (!modalProduct) return;
  productEditMode = false;
  document.getElementById('product-edit-btn').classList.remove('active');
  renderProductModal();
  document.getElementById('product-modal').classList.add('open');
  seedProductChat(modalProduct);
};

window.closeProductModal = () => {
  document.getElementById('product-modal').classList.remove('open');
};

window.handleProductModalBgClick = (e) => {
  if (e.target === document.getElementById('product-modal')) closeProductModal();
};

window.toggleProductEdit = () => {
  productEditMode = !productEditMode;
  document.getElementById('product-edit-btn').classList.toggle('active', productEditMode);
  renderProductModal();
};

const renderProductModal = () => {
  const p = modalProduct;
  if (!p) return;

  document.getElementById('pm-logo').innerHTML = `<i class="fas fa-box"></i>`;
  document.getElementById('pm-name').textContent = p.prod_name ?? '–';
  document.getElementById('pm-id').textContent = `ID: ${p.prod_id}`;
  document.getElementById('pm-type-badge').innerHTML = p.prod_type
    ? `<span class="mono-tag">${p.prod_type}</span>`
    : '';

  const body = document.getElementById('product-modal-body');
  if (productEditMode) {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
        <div class="edit-field" style="grid-column:1/-1;"><label>Product Name</label><input id="ef-p-name" value="${p.prod_name ?? ''}"></div>
        <div class="edit-field"><label>Type / Category</label><input id="ef-p-type" value="${p.prod_type ?? ''}"></div>
        <div class="edit-field"><label>Size / Dimensions</label><input id="ef-p-size" value="${p.prod_size ?? ''}"></div>
        <div class="edit-field"><label>Unit Price (HUF)</label><input id="ef-p-price" type="number" value="${p.unit_price ?? ''}"></div>
        <div class="edit-field"><label>Supplier ID</label><input id="ef-p-supp" type="number" value="${p.prod_supp_id ?? ''}"></div>
        <div class="edit-field" style="grid-column:1/-1;"><label>Image Path</label><input id="ef-p-img" value="${p.image_path ?? ''}"></div>
        <div class="edit-field" style="grid-column:1/-1;"><label>Notes</label><textarea id="ef-p-notes">${p.notes ?? ''}</textarea></div>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button class="modal-save-btn" onclick="saveProductModal()">Save</button>
        <button class="modal-cancel-btn" onclick="toggleProductEdit()">Cancel</button>
      </div>`;
  } else {
    const row = (label, val) =>
      `<div class="detail-field"><span class="detail-label">${label}</span><span class="detail-value">${val || '–'}</span></div>`;
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem 1.5rem; min-height:14rem;">
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Product Name</span>
          <span class="detail-value">${p.prod_name || '–'}</span>
        </div>
        ${row('Type / Category', p.prod_type)}
        ${row('Size / Dimensions', p.prod_size)}
        ${row('Unit Price', fmtPrice(p.unit_price))}
        ${row('Supplier ID', p.prod_supp_id)}
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Image Path</span>
          <span class="detail-value">${p.image_path || '–'}</span>
        </div>
        <div class="detail-field" style="grid-column:1/-1;">
          <span class="detail-label">Notes</span>
          <span class="detail-value">${p.notes || '–'}</span>
        </div>
      </div>`;
  }
};

window.saveProductModal = async () => {
  const p = modalProduct;
  const body = {
    prod_name:    document.getElementById('ef-p-name').value,
    prod_type:    document.getElementById('ef-p-type').value,
    prod_size:    document.getElementById('ef-p-size').value,
    unit_price:   parseFloat(document.getElementById('ef-p-price').value),
    prod_supp_id: parseInt(document.getElementById('ef-p-supp').value, 10),
    image_path:   document.getElementById('ef-p-img').value,
    notes:        document.getElementById('ef-p-notes').value,
  };
  try {
    const resp = await fetch(`${API_BASE}/products/${p.prod_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(resp.statusText);
    Object.assign(p, body);
    productEditMode = false;
    document.getElementById('product-edit-btn').classList.remove('active');
    renderProductModal();
    renderProducts(currentData);
  } catch (err) { alert('Save error: ' + err.message); }
};

const seedProductChat = (p) => {
  const msgs = document.getElementById('pm-chat-msgs');
  msgs.innerHTML = `
    <div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>
      I loaded the product record for <strong>${p.prod_name}</strong>. How can I assist you?</div>`;
};

window.sendProductChat = () => {
  const input = document.getElementById('pm-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const msgs = document.getElementById('pm-chat-msgs');
  msgs.innerHTML += `<div class="mc-user">${text}</div>`;
  msgs.innerHTML += `<div class="mc-ai"><span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;font-weight:700;color:var(--accent);display:block;margin-bottom:0.2rem;">PISTA</span>This feature will be available soon.</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
};

/* ─────────────────────────────────────────────────
   CUSTOMER MODAL
───────────────────────────────────────────────── */
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

  const logoUrl = resolveLogoUrl(c.logo_path);
  document.getElementById('m-logo').innerHTML = logoUrl
    ? `<img src="${logoUrl}" onerror="setFallbackIcon(this)">`
    : `<i class="fas fa-building"></i>`;
  document.getElementById('m-name').textContent = c.cust_name;
  document.getElementById('m-id').textContent = `ID: ${c.cust_id}`;
  const count = orderCountMap[c.cust_id] ?? 0;
  document.getElementById('m-order-badge').innerHTML =
    `<span class="order-badge"><i class="fas fa-clipboard-list" style="font-size:0.55rem;"></i> ${count} orders</span>`;

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
    Object.assign(c, body);
    modalEditMode = false;
    document.getElementById('modal-edit-btn').classList.remove('active');
    renderModalContent();
    renderCustomers(currentData);
  } catch (err) { alert('Save error: ' + err.message); }
};

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

/* ─────────────────────────────────────────────────
   ORDER MODAL
───────────────────────────────────────────────── */
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
      ${renderOrderItems_modal(items)}`;
  } else {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem 1.5rem; margin-bottom:1.25rem;">
        ${[['Order ID', o.order_id],['Order Code', o.order_code],['Currency', o.currency],
           ['Created', fmtDt(o.order_date)],['Last Status Update', fmtDt(o.current_status_update)],
           ['Last Event', o.update_event]].map(([l,v]) =>
          `<div class="detail-field"><span class="detail-label">${l}</span><span class="detail-value">${v || '–'}</span></div>`).join('')}
      </div>
      <div style="font-family:'Montserrat',sans-serif; font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:var(--muted); margin-bottom:0.75rem;">Items</div>
      ${renderOrderItems_modal(items)}`;
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

/** Renamed to avoid collision with the tab-level renderOrderItems */
const renderOrderItems_modal = (items) => {
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

/* ── Keyboard: Escape closes any modal ─────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCustomerModal();
    closeOrderModal();
    closeSupplierModal();
    closeProductModal();
  }
});

/* ── Bootstrap ─────────────────────────────────── */
export const initDatabaseController = async () => {
  try {
    const cr = await fetch(`${API_BASE}/customers`);
    if (!cr.ok) throw new Error('API Offline');
    customersCache = await cr.json();
  } catch (_) { customersCache = []; }

  // Pre-fetch orders for customer order-count badges
  try {
    const or = await fetch(`${API_BASE}/orders`);
    if (!or.ok) throw new Error('API Offline');
    allOrders = await or.json();
    orderCountMap = {};
    allOrders.forEach(o => {
      orderCountMap[o.cust_id] = (orderCountMap[o.cust_id] ?? 0) + 1;
    });
  } catch (_) { allOrders = []; orderCountMap = {}; }

  await switchTab('customers');

  // Apply the extended/compact tab visibility from settings
  if (typeof window.applyDbExtendedSetting === 'function') {
    window.applyDbExtendedSetting();
  }
};
