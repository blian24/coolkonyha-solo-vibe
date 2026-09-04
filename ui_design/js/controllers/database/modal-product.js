/**
 * @file modal-product.js
 * @description Product detail/edit modal: open, close, toggle edit mode,
 *              save, and the placeholder PISTA chat panel.
 */

import { currentData, API_BASE, fmtPrice } from './state.js';
import { renderProducts } from './renderers-master-data.js';

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
