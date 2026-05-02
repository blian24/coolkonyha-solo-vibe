/**
 * @file dashboardController.js
 * @description Controller for the Dashboard view. Handles rendering of the
 * "What's New" feed, the Active Orders table, order detail panel, and
 * the entry-detail modal. Depends on the global `dataService` and
 * `window.openModal` / `window.closeModal` defined in the shell (index.html).
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

  const updates = await dataService.getUpdates();

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

window.renderOrders = async function(data) {
  const container = document.getElementById('orders-body');
  const tpl = document.getElementById('tpl-order-row');
  container.innerHTML = '';

  if (!data) data = await dataService.getOrders();

  data.forEach(async o => {
    const clone = tpl.content.cloneNode(true);
    const tr = clone.querySelector('tr');

    tr.id = `order-row-${o.id}`;
    tr.onclick = () => selectOrder(o.id);
    if (o.aiInsight) tr.classList.add('ai-row');
    if (selectedId === o.id) tr.classList.add('selected');

    const icoCont = clone.querySelector('.ico-wrap');
    if (o.logo) {
      icoCont.innerHTML = `<img src="${o.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\'fas ${o.icon}\\'></i>'">`;
    } else {
      icoCont.querySelector('i').className = `fas ${o.icon}`;
    }

    clone.querySelector('.client-name').textContent = o.name;
    clone.querySelector('.order-code').textContent = o.orderCode;
    clone.querySelector('.status-text').textContent = o.status;

    // Pipeline stepper
    const step = dataService.getWorkflowStep(o.workflow);
    clone.querySelectorAll('.pip-node').forEach(node => {
      const n = parseInt(node.dataset.step);
      if (step > n) node.classList.add('done');
      else if (step === n) node.classList.add('active');
    });
    clone.querySelectorAll('.pip-line').forEach(line => {
      const l = parseInt(line.dataset.line);
      if (step > l) line.classList.add('done');
    });

    // Workflow pill
    const pill = clone.querySelector('.pill');
    pill.textContent = dataService.getStatusLabel(o.workflow);
    pill.classList.add(`p-${o.workflow}`);

    // Attachment indicator
    const details = await dataService.getOrderDetails(o.id);
    if (details.files && details.files.length) {
      clone.querySelector('.clip-icon').classList.remove('hidden');
    }

    container.appendChild(clone);
  });
};

window.sortOrders = async function(key) {
  if (currentSort.key === key) currentSort.dir *= -1;
  else { currentSort.key = key; currentSort.dir = -1; }
  const data = await dataService.getOrders();
  const sorted = [...data].sort((a, b) =>
    (a[key] || '') < (b[key] || '') ? -currentSort.dir :
    (a[key] || '') > (b[key] || '') ? currentSort.dir : 0
  );
  window.renderOrders(sorted);
};

window.filterOrders = async function() {
  const q = document.getElementById('orders-search').value.toLowerCase();
  const orders = await dataService.getOrders();
  const filtered = orders.filter(o =>
    o.name.toLowerCase().includes(q) ||
    o.orderCode.toLowerCase().includes(q) ||
    o.workflow.toLowerCase().includes(q)
  );
  window.renderOrders(filtered);
};

/* ── DETAILS PANEL ────────────────────────────────────────────────────── */

window.selectOrder = async function(id) {
  selectedId = id;
  document.querySelectorAll('.order-row-el').forEach(r => r.classList.remove('selected'));
  document.getElementById(`order-row-${id}`)?.classList.add('selected');

  const { order, history, items, files } = await dataService.getOrderDetails(id);
  if (!order) return;
  const fmt = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });

  let itemsHtml = '';
  if (items.length) {
    let tot = 0;
    const rows = items.map(it => {
      const rt = it.qty * it.price;
      tot += rt;
      return `<div class="det-row"><span class="det-row-name">${it.name}</span><span class="det-row-qty">${it.qty}x</span><span class="det-row-price">${fmt.format(rt)}</span></div>`;
    }).join('');
    itemsHtml = `<div class="det-section">Products</div><div>${rows}<div class="det-row total"><span class="det-row-name">Total:</span><span class="det-row-price">${fmt.format(tot)}</span></div></div>`;
  }

  let filesHtml = '';
  if (files && files.length) {
    filesHtml = `<div class="det-section">Documents</div><div class="flex flex-wrap gap-2">${files.map(f => `<div class="file-chip"><i class="fas ${f.icon}"></i>${f.name}</div>`).join('')}</div>`;
  }

  const tlHtml = `<div class="det-section">History</div><div style="margin-top:0.5rem;">${[...history].reverse().map(h => `
    <div class="timeline-item">
      <p class="tl-date">${h.date}</p>
      <span class="pill p-${h.status}">${dataService.getStatusLabel(h.status)}</span>
      <p class="tl-note">${h.note}</p>
    </div>`).join('')}</div>`;

  document.getElementById('details-panel').innerHTML = `
    <div class="flex items-center gap-4 mb-5">
      <div class="det-logo">
        ${order.logo ? `<img src="${order.logo}" class="w-full h-full object-contain p-1" onerror="this.outerHTML='<i class=\\\\'fas ${order.icon}\\\\'></i>'">` : `<i class="fas ${order.icon}"></i>`}
      </div>
      <div>
        <span class="order-code">${order.orderCode}</span>
        <p class="det-name mt-1">${order.name}</p>
        <div class="flex flex-col gap-0.5 mt-1">
          <p class="det-upd">Created: ${order.orderDate || '–'}</p>
          <p class="det-upd">Updated: ${history[0]?.date ?? '–'}</p>
        </div>
      </div>
    </div>
    ${filesHtml}${itemsHtml}${tlHtml}
  `;
};

/* ── ENTRY DETAIL MODAL ───────────────────────────────────────────────── */

window.openEntryModal = async function(idx) {
  const updates = await dataService.getUpdates();
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
  const orders = await dataService.getOrders();
  window.renderOrders([...orders].sort((a, b) => b.updated.localeCompare(a.updated)));
};
