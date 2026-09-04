/**
 * @file modal-customer.js
 * @description Customer detail/edit modal: open, close, toggle edit mode,
 *              save, and the placeholder PISTA chat panel.
 */

import { currentData, API_BASE, orderCountMap, resolveLogoUrl } from './state.js';
import { renderCustomers } from './renderers-master-data.js';

let modalCustomer = null;
let modalEditMode = false;

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
