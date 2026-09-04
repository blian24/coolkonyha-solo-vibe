/**
 * @file databaseController.js
 * @description Entry point / orchestrator for the Database view. Handles
 *              tab switching, data loading + render dispatch, search, and
 *              bootstrap. Imports every renderer and modal file under this
 *              folder so their window.* handlers are registered before any
 *              user interaction can reference them.
 *
 *              Split from a single 1,185-line file into this folder — see
 *              docs/.notes/future-ideas.md (i-8, now resolved) and
 *              ~/.claude/CLAUDE.md §2 File Size & Modularity.
 *
 * @see docs/architecture/database-schema.md  — full schema reference
 * @see server/routes.js                      — API endpoints
 */

import { API_BASE, currentData, expandedRows, setCurrentData, setOrderCountMap, setCustomersCache } from './state.js';
import { renderCustomers, renderSuppliers, renderProducts } from './renderers-master-data.js';
import { renderOrders, renderOrderItems, renderOrderHistory, renderWorkflow } from './renderers-orders.js';
import { renderMaintenanceCases, renderMaintenanceItems, renderMaintenanceHistory, renderMaintenanceWorkflow } from './renderers-maintenance.js';
import { renderProcessedEmails, renderSenderRules } from './renderers-email.js';
import './modal-supplier.js';
import './modal-product.js';
import './modal-customer.js';
import './modal-order.js';

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
export const loadTab = async (tab) => {
  showLoading();
  const endpoint = TAB_ENDPOINTS[tab] || tab;
  try {
    const resp = await fetch(`${API_BASE}/${endpoint}`);
    if (!resp.ok) throw new Error(resp.statusText);
    const data = await resp.json();
    setCurrentData(data);
    renderTab(tab, data);
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

/* ── Keyboard: Escape closes any modal ─────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    window.closeCustomerModal();
    window.closeOrderModal();
    window.closeSupplierModal();
    window.closeProductModal();
  }
});

/* ── Bootstrap ─────────────────────────────────── */
export const initDatabaseController = async () => {
  try {
    const cr = await fetch(`${API_BASE}/customers`);
    if (!cr.ok) throw new Error('API Offline');
    setCustomersCache(await cr.json());
  } catch (_) { setCustomersCache([]); }

  // Pre-fetch orders for customer order-count badges
  try {
    const or = await fetch(`${API_BASE}/orders`);
    if (!or.ok) throw new Error('API Offline');
    const allOrders = await or.json();
    const orderCountMap = {};
    allOrders.forEach(o => {
      orderCountMap[o.cust_id] = (orderCountMap[o.cust_id] ?? 0) + 1;
    });
    setOrderCountMap(orderCountMap);
  } catch (_) { setOrderCountMap({}); }

  await window.switchTab('customers');

  // Apply the extended/compact tab visibility from settings
  if (typeof window.applyDbExtendedSetting === 'function') {
    window.applyDbExtendedSetting();
  }
};
