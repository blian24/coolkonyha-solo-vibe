/**
 * @file dashboardController.js
 * @description Controller for the Dashboard view. Handles rendering of:
 * - "What's New" feed
 * - Unified "Active Cases" table (Orders + Maintenance combined) — updated v0.6.0
 * - Case detail panel (order or maintenance)
 * - Entry-detail modal
 * - Case Type filter dropdown
 *
 * Depends on global `window.dataService` (dataService.js) and
 * `window.openModal` / `window.closeModal` defined in the shell (index.html).
 *
 * @see ui_design/js/services/dataService.js - Data access layer
 * @see docs/architecture/api-routes.md      - Maintenance endpoints
 * @version 1.1.0
 */

/* ── RENDERING LOGIC ──────────────────────────────────────────────────── */

/**
 * Renders the "What's New" table and the All-Updates modal body.
 */
async function renderWN() {
  const containerMain = document.getElementById('wn-body');
  const containerToday = document.getElementById('modal-all-today');
  const containerYest = document.getElementById('modal-all-yesterday');
  const tpl = document.getElementById('tpl-wn-row');

  const updates = await window.dataService.getUpdates();

  const createRow = (item, idx) => {
    const clone = tpl.content.cloneNode(true);

    const icoCont = clone.querySelector('.wn-ico');
    if (item.logo) {
      icoCont.innerHTML = `<img src="${item.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\'fas ${item.icon}\\'></i>'">`;
    } else {
      icoCont.querySelector('i').className = `fas ${item.icon}`;
    }
    clone.querySelector('.wn-title').textContent = item.title;
    clone.querySelector('.wn-detail').textContent = item.detail;
    clone.querySelector('.wn-suggestion').textContent = item.suggestion;

    if (item.processed) {
      clone.querySelector('.done-badge').classList.remove('hidden');
    } else {
      const actionRow = clone.querySelector('.wn-action-row');
      actionRow.classList.remove('hidden');
      actionRow.querySelector('.btn-edit').onclick = () => openEntryModal(idx);
    }

    return clone;
  };

  containerMain.innerHTML = '';
  containerToday.innerHTML = '';
  containerYest.innerHTML = '';

  updates.forEach((item, i) => {
    containerMain.appendChild(createRow(item, i));
    containerToday.appendChild(createRow(item, i));
    containerYest.appendChild(createRow(item, i));
  });
}

let currentSort = { key: 'updated', dir: -1 };
let selectedId = null;
let selectedCaseType = null;

/**
 * Renders the unified Active Cases table.
 * Accepts a pre-filtered array of cases (Orders + Maintenance mixed).
 *
 * @param {Array} [data] - Optional pre-filtered data; fetches all if omitted
 */
window.renderOrders = async function(data) {
  const container = document.getElementById('orders-body');
  const tpl = document.getElementById('tpl-order-row');
  container.innerHTML = '';

  if (!data) {
    const filterEl = document.getElementById('case-type-filter');
    const filter = filterEl ? filterEl.value : 'all';
    data = await window.dataService.getAllDashboardCases(filter);
  }

  data.forEach(o => {
    const clone = tpl.content.cloneNode(true);
    const tr = clone.querySelector('tr');

    // Namespaced by caseType: order_id and maintenance case_id are separate
    // auto-increment sequences that overlap (both start at 1), so the raw
    // numeric id alone is not a unique DOM id across the unified table.
    tr.id = `order-row-${o.caseType}-${o.id}`;
    tr.onclick = () => selectOrder(o.id, o.caseType);
    if (o.aiInsight) tr.classList.add('ai-row');
    if (selectedId === o.id && selectedCaseType === o.caseType) tr.classList.add('selected');

    // ── Icon / logo ──
    const icoCont = clone.querySelector('.ico-wrap');
    if (o.logo) {
      icoCont.innerHTML = `<img src="${o.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\'fas ${o.icon}\\'></i>'">`;
    } else {
      icoCont.querySelector('i').className = `fas ${o.icon}`;
    }

    clone.querySelector('.client-name').textContent = o.name;
    clone.querySelector('.order-code').textContent = o.caseCode || o.orderCode || '';
    clone.querySelector('.status-text').textContent = o.status;

    // ── Pipeline stepper (domain-aware step function) ──
    const step = o.caseType === 'maintenance'
      ? window.dataService.getMaintenanceWorkflowStep(o.workflow)
      : window.dataService.getWorkflowStep(o.workflow);

    clone.querySelectorAll('.pip-node').forEach(node => {
      const n = parseInt(node.dataset.step);
      if (step > n) node.classList.add('done');
      else if (step === n) node.classList.add('active');
    });
    clone.querySelectorAll('.pip-line').forEach(line => {
      const l = parseInt(line.dataset.line);
      if (step > l) line.classList.add('done');
    });

    // ── Workflow pill ──
    const pill = clone.querySelector('.pill');
    pill.textContent = window.dataService.getStatusLabel(o.workflow);
    pill.classList.add(`p-${o.workflow}`);

    // ── Case type badge (Order = cyan / Maintenance = orange) ──
    const badge = clone.querySelector('.case-type-badge');
    if (o.caseType === 'maintenance') {
      badge.textContent = '🔧 Maintenance';
      badge.classList.add('badge-maintenance');
    } else {
      badge.textContent = '📦 Order';
      badge.classList.add('badge-order');
    }

    container.appendChild(clone);

    // ── Attachment indicator (orders only) ──
    // Fetched and applied after the row is in the DOM so row order always
    // matches `data` order instead of drifting with per-row fetch timing.
    if (o.caseType === 'order') {
      window.dataService.getOrderDetails(o.id).then(details => {
        if (details.files && details.files.length) {
          tr.querySelector('.clip-icon')?.classList.remove('hidden');
        }
      });
    }
  });
};

window.sortOrders = async function(key) {
  if (currentSort.key === key) currentSort.dir *= -1;
  else { currentSort.key = key; currentSort.dir = -1; }
  const filterEl = document.getElementById('case-type-filter');
  const filter = filterEl ? filterEl.value : 'all';
  const data = await window.dataService.getAllDashboardCases(filter);
  const sorted = [...data].sort((a, b) =>
    (a[key] || '') < (b[key] || '') ? -currentSort.dir :
    (a[key] || '') > (b[key] || '') ? currentSort.dir : 0
  );
  window.renderOrders(sorted);
};

/**
 * Filters cases by text query (customer name, code, or status).
 * Called by the search input's oninput handler.
 */
window.filterOrders = async function() {
  const q = document.getElementById('orders-search').value.toLowerCase();
  const filterEl = document.getElementById('case-type-filter');
  const filter = filterEl ? filterEl.value : 'all';
  const cases = await window.dataService.getAllDashboardCases(filter);
  const filtered = cases.filter(o =>
    o.name.toLowerCase().includes(q) ||
    (o.caseCode || o.orderCode || '').toLowerCase().includes(q) ||
    (o.workflow || '').toLowerCase().includes(q)
  );
  window.renderOrders(filtered);
};

/**
 * Filters cases by domain type (all / order / maintenance).
 * Called by the case-type-filter dropdown's onchange handler.
 */
window.filterCasesByType = async function() {
  const filterEl = document.getElementById('case-type-filter');
  const filter = filterEl ? filterEl.value : 'all';
  const cases = await window.dataService.getAllDashboardCases(filter);
  window.renderOrders(cases);
};

/* ── DETAILS PANEL ────────────────────────────────────────────────────── */

/**
 * Selects a case and renders its detail panel.
 * Routes to getOrderDetails or getMaintenanceCaseDetails based on caseType.
 *
 * @param {number} id       - Case ID (order_id or case_id)
 * @param {string} caseType - 'order' | 'maintenance'
 */
window.selectOrder = async function(id, caseType = 'order') {
  selectedId = id;
  selectedCaseType = caseType;
  document.querySelectorAll('.order-row-el').forEach(r => r.classList.remove('selected'));
  document.getElementById(`order-row-${caseType}-${id}`)?.classList.add('selected');

  const fetchFn = caseType === 'maintenance'
    ? () => window.dataService.getMaintenanceCaseDetails(id)
    : () => window.dataService.getOrderDetails(id);

  const { order, history, items, files } = await fetchFn();
  if (!order) return;

  const fmt = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });

  let itemsHtml = '';
  if (items.length) {
    if (caseType === 'maintenance') {
      // Maintenance items: show product name + issue note (no price)
      const rows = items.map(it =>
        `<div class="det-row"><span class="det-row-name">${it.name}</span><span class="det-row-qty">${it.qty}x</span><span class="det-row-price" style="font-size:0.75rem; color:var(--muted);">${it.issueNote || '–'}</span></div>`
      ).join('');
      itemsHtml = `<div class="det-section">Items &amp; Issue Notes</div><div>${rows}</div>`;
    } else {
      let tot = 0;
      const rows = items.map(it => {
        const rt = it.qty * it.price;
        tot += rt;
        return `<div class="det-row"><span class="det-row-name">${it.name}</span><span class="det-row-qty">${it.qty}x</span><span class="det-row-price">${fmt.format(rt)}</span></div>`;
      }).join('');
      itemsHtml = `<div class="det-section">Products</div><div>${rows}<div class="det-row total"><span class="det-row-name">Total:</span><span class="det-row-price">${fmt.format(tot)}</span></div></div>`;
    }
  }

  let filesHtml = '';
  if (files && files.length) {
    filesHtml = `<div class="det-section">Documents</div><div class="flex flex-wrap gap-2">${files.map(f => `<div class="file-chip"><i class="fas ${f.icon}"></i>${f.name}</div>`).join('')}</div>`;
  }

  const domainBadgeHtml = caseType === 'maintenance'
    ? `<span class="case-type-badge badge-maintenance" style="margin-left:0.5rem;">🔧 Maintenance</span>`
    : `<span class="case-type-badge badge-order" style="margin-left:0.5rem;">📦 Order</span>`;

  const tlHtml = `<div class="det-section">History</div><div style="margin-top:0.5rem;">${[...history].reverse().map(h => `
    <div class="timeline-item">
      <p class="tl-date">${h.date}</p>
      <span class="pill p-${h.status}">${window.dataService.getStatusLabel(h.status)}</span>
      <p class="tl-note">${h.note}</p>
    </div>`).join('')}</div>`;

  document.getElementById('details-panel').innerHTML = `
    <div class="flex items-center gap-4 mb-5">
      <div class="det-logo">
        ${order.logo ? `<img src="${order.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\\\'fas ${order.icon}\\\\'\></i>'">` : `<i class="fas ${order.icon}"></i>`}
      </div>
      <div>
        <div class="flex items-center flex-wrap gap-1">
          <span class="order-code">${order.orderCode}</span>
          ${domainBadgeHtml}
        </div>
        <p class="det-name mt-1">${order.name}</p>
        <div class="flex flex-col gap-0.5 mt-1">
          <p class="det-upd">Created: ${order.orderDate || '–'}</p>
          <p class="det-upd">Updated: ${history[0]?.date ?? '–'}</p>
        </div>
      </div>
    </div>
    ${order.description ? `<div class="det-section">Description</div><p style="font-size:0.82rem; color:var(--muted); margin-bottom:1rem;">${order.description}</p>` : ''}
    ${filesHtml}${itemsHtml}${tlHtml}
  `;
};

/* ── ENTRY DETAIL MODAL ───────────────────────────────────────────────── */

window.openEntryModal = async function(idx) {
  const updates = await window.dataService.getUpdates();
  const it = updates[idx];
  if (!it) return;
  document.getElementById('em-logo').innerHTML = `<i class="fas ${it.icon}"></i>`;
  document.getElementById('em-code').textContent = it.orderCode;
  document.getElementById('em-name').textContent = it.name;
  document.getElementById('em-summary').textContent = it.detail;
  document.getElementById('em-suggestion').textContent = it.suggestion;
  document.getElementById('em-desc').innerHTML = `<p class="em-txt">A new event was generated during the automatic system check. PISTA's integrated analysis determined that current metrics deviate from expectations.</p>`;
  openModal('modal-entry');
};

/* ── INIT ─────────────────────────────────────────────────────────────── */

export const initDashboardController = async () => {
  await renderWN();

  // Load all cases (orders + maintenance) sorted newest-first
  const allCases = await window.dataService.getAllDashboardCases('all');
  window.renderOrders(allCases);

  // BUG-05 fix: populate stat boxes from live data instead of hardcoded values
  // Count both orders and maintenance cases in the active stat
  const orders = await window.dataService.getOrders();
  const activeCount = orders.filter(o => o.workflow !== 'CLOSED' && o.workflow !== 'CANCELLED').length;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const closedCount = orders.filter(o =>
    (o.workflow === 'CLOSED' || o.workflow === 'INVOICED') && o.updated >= thirtyDaysAgo
  ).length;

  const activeEl = document.getElementById('stat-active-orders');
  const closedEl = document.getElementById('stat-closed-orders');
  if (activeEl) activeEl.textContent = activeCount;
  if (closedEl) closedEl.textContent = closedCount;
};
