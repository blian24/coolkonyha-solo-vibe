/**
 * @file modal-supplier.js
 * @description Supplier detail/edit modal: open, close, toggle edit mode,
 *              save, and the placeholder PISTA chat panel.
 */

import { currentData, API_BASE } from './state.js';
import { renderSuppliers } from './renderers-master-data.js';

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
