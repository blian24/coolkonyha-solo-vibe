/**
 * @file maintenanceController.js
 * @description Controller for the dedicated Maintenance view.
 *
 * Handles:
 * - Rendering the workflow status pill reference strip
 * - Rendering and sorting the maintenance cases table
 * - Displaying the case detail panel (items, history)
 * - Stat boxes (open / closed count)
 *
 * Depends on `window.dataService` (dataService.js) exposed globally.
 *
 * @see ui_design/js/services/dataService.js - getMaintenanceCases, getMaintenanceCaseDetails
 * @see server/routes.js                     - /api/maintenance endpoints
 * @version 1.0.0
 */

let maintCurrentSort = { key: 'updated', dir: -1 };
let maintSelectedId = null;

/* ── WORKFLOW PILLS REFERENCE STRIP ──────────────────────────────────── */

/**
 * Renders the workflow status pill strip at the top of the Maintenance view.
 * Fetches the live maintenance_status_workflow from the API.
 */
async function renderMaintenanceWorkflowPills() {
  const container = document.getElementById('maint-workflow-pills');
  if (!container) return;

  try {
    const resp = await fetch('http://localhost:3001/api/maintenance/workflow');
    const statuses = await resp.json();
    container.innerHTML = statuses.map(s =>
      `<span class="pill p-${s.status_key}" title="${s.description || ''}">${s.display_name}</span>`
    ).join('');
  } catch (e) {
    container.innerHTML = `<span style="font-size:0.78rem; color:var(--muted);">Workflow statuses unavailable (server offline?)</span>`;
  }
}

/* ── CASES TABLE ─────────────────────────────────────────────────────── */

/**
 * Renders the maintenance cases table from the provided data array.
 *
 * @param {Array} [data] - Pre-filtered case array; fetches all if omitted
 */
window.renderMaintenanceCases = async function(data) {
  const container = document.getElementById('maint-cases-body');
  const tpl = document.getElementById('tpl-order-row');
  if (!container || !tpl) return;
  container.innerHTML = '';

  if (!data) {
    data = await window.dataService.getMaintenanceCases();
  }

  data.forEach(o => {
    const clone = tpl.content.cloneNode(true);
    const tr = clone.querySelector('tr');

    tr.id = `order-row-${o.id}`;
    tr.onclick = () => selectMaintenanceCase(o.id);
    if (maintSelectedId === o.id) tr.classList.add('selected');

    // ── Icon / logo ──
    const icoCont = clone.querySelector('.ico-wrap');
    if (o.logo) {
      icoCont.innerHTML = `<img src="${o.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\'fas fa-wrench\\'></i>'">`;
    } else {
      icoCont.querySelector('i').className = 'fas fa-wrench';
    }

    clone.querySelector('.client-name').textContent = o.name;
    clone.querySelector('.order-code').textContent = o.caseCode || '';
    clone.querySelector('.status-text').textContent = o.status || o.workflow;

    // ── Pipeline stepper ──
    const step = window.dataService.getMaintenanceWorkflowStep(o.workflow);
    clone.querySelectorAll('.pip-node').forEach(node => {
      const n = parseInt(node.dataset.step);
      if (step > n) node.classList.add('done');
      else if (step === n) node.classList.add('active');
    });
    clone.querySelectorAll('.pip-line').forEach(line => {
      const l = parseInt(line.dataset.line);
      if (step > l) line.classList.add('done');
    });

    // ── Status pill ──
    const pill = clone.querySelector('.pill');
    pill.textContent = window.dataService.getStatusLabel(o.workflow);
    pill.classList.add(`p-${o.workflow}`);

    // ── Case type badge (always Maintenance here) ──
    const badge = clone.querySelector('.case-type-badge');
    if (badge) {
      badge.textContent = '🔧 Maintenance';
      badge.classList.add('badge-maintenance');
    }

    container.appendChild(clone);
  });
};

window.sortMaintenanceCases = async function(key) {
  if (maintCurrentSort.key === key) maintCurrentSort.dir *= -1;
  else { maintCurrentSort.key = key; maintCurrentSort.dir = -1; }
  const data = await window.dataService.getMaintenanceCases();
  const sorted = [...data].sort((a, b) =>
    (a[key] || '') < (b[key] || '') ? -maintCurrentSort.dir :
    (a[key] || '') > (b[key] || '') ? maintCurrentSort.dir : 0
  );
  window.renderMaintenanceCases(sorted);
};

/**
 * Filters maintenance cases by text query.
 * Called by the search input's oninput handler.
 */
window.filterMaintenanceCases = async function() {
  const q = document.getElementById('maint-search').value.toLowerCase();
  const cases = await window.dataService.getMaintenanceCases();
  const filtered = cases.filter(o =>
    o.name.toLowerCase().includes(q) ||
    (o.caseCode || '').toLowerCase().includes(q) ||
    (o.workflow || '').toLowerCase().includes(q)
  );
  window.renderMaintenanceCases(filtered);
};

/* ── DETAILS PANEL ────────────────────────────────────────────────────── */

/**
 * Selects a maintenance case and renders its detail panel.
 *
 * @param {number} id - Maintenance case ID
 */
window.selectMaintenanceCase = async function(id) {
  maintSelectedId = id;
  document.querySelectorAll('#maint-cases-body .order-row-el').forEach(r => r.classList.remove('selected'));
  document.getElementById(`order-row-${id}`)?.classList.add('selected');

  const { order, history, items } = await window.dataService.getMaintenanceCaseDetails(id);
  if (!order) return;

  // ── Items (maintenance: show issue note, not price) ──
  let itemsHtml = '';
  if (items.length) {
    const rows = items.map(it =>
      `<div class="det-row">
        <span class="det-row-name">${it.name}</span>
        <span class="det-row-qty">${it.qty}x</span>
        <span class="det-row-price" style="font-size:0.75rem; color:var(--muted);">${it.issueNote || '–'}</span>
      </div>`
    ).join('');
    itemsHtml = `<div class="det-section">Items &amp; Issue Notes</div><div>${rows}</div>`;
  }

  // ── History timeline ──
  const tlHtml = `<div class="det-section">History</div><div style="margin-top:0.5rem;">${
    [...history].reverse().map(h => `
    <div class="timeline-item">
      <p class="tl-date">${h.date}</p>
      <span class="pill p-${h.status}">${window.dataService.getStatusLabel(h.status)}</span>
      <p class="tl-note">${h.note}</p>
    </div>`).join('')
  }</div>`;

  document.getElementById('maint-details-panel').innerHTML = `
    <div class="flex items-center gap-4 mb-5">
      <div class="det-logo">
        ${order.logo
          ? `<img src="${order.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\'fas fa-wrench\\'></i>'">`
          : `<i class="fas fa-wrench"></i>`}
      </div>
      <div>
        <div class="flex items-center flex-wrap gap-1">
          <span class="order-code">${order.orderCode}</span>
          <span class="case-type-badge badge-maintenance" style="margin-left:0.5rem;">🔧 Maintenance</span>
        </div>
        <p class="det-name mt-1">${order.name}</p>
        <div class="flex flex-col gap-0.5 mt-1">
          <p class="det-upd">Created: ${order.orderDate || '–'}</p>
          <p class="det-upd">Updated: ${history[0]?.date ?? '–'}</p>
        </div>
      </div>
    </div>
    ${order.description
      ? `<div class="det-section">Issue Description</div><p style="font-size:0.82rem; color:var(--muted); margin-bottom:1rem;">${order.description}</p>`
      : ''}
    ${itemsHtml}${tlHtml}
  `;
};

/* ── STAT BOXES ──────────────────────────────────────────────────────── */

/**
 * Populates the stat boxes with counts from live maintenance case data.
 *
 * @param {Array} cases - Array of normalized maintenance cases
 */
function updateMaintenanceStats(cases) {
  const CLOSED_STATUSES = ['CLOSED', 'CANCELLED', 'INVOICED'];
  const openCount = cases.filter(c => !CLOSED_STATUSES.includes(c.workflow)).length;
  const closedCount = cases.filter(c => CLOSED_STATUSES.includes(c.workflow)).length;

  const openEl = document.getElementById('stat-maint-open');
  const closedEl = document.getElementById('stat-maint-closed');
  if (openEl) openEl.textContent = openCount;
  if (closedEl) closedEl.textContent = closedCount;

  const countEl = document.getElementById('maint-count');
  if (countEl) countEl.textContent = `${cases.length} CASES`;
}

/* ── INIT ─────────────────────────────────────────────────────────────── */

export const initMaintenanceController = async () => {
  await renderMaintenanceWorkflowPills();

  const cases = await window.dataService.getMaintenanceCases();
  const sorted = [...cases].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  window.renderMaintenanceCases(sorted);
  updateMaintenanceStats(cases);
};
