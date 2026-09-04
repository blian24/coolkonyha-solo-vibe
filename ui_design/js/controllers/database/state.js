/**
 * @file state.js
 * @description Shared state, constants, and formatting helpers for the
 *              Database view. Deliberately a leaf module — imports nothing
 *              from any other file under controllers/database/ — so every
 *              renderer and modal file can depend on it without creating
 *              circular imports.
 *
 *              Mutable state that needs to be reassigned (not just mutated
 *              in place) exposes a setter instead of a raw exported `let`,
 *              since only the declaring module may reassign an ES module
 *              binding — importers only ever see a live read-only view.
 */

export const API_BASE = 'http://localhost:3001/api';
const STATIC_BASE = 'http://localhost:3001';

/* ── Shared mutable state (read via import, written via setter) ──────── */
export let currentData = [];
export const setCurrentData = (data) => { currentData = data; };

export let orderCountMap = {};
export const setOrderCountMap = (map) => { orderCountMap = map; };

export let customersCache = null;
export const setCustomersCache = (cache) => { customersCache = cache; };

/** Never reassigned, only mutated via .add()/.delete() — safe as a plain export. */
export const expandedRows = new Set();

/* ── Logo URL resolution ───────────────────────── */
export const resolveLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath;
  return STATIC_BASE + (logoPath.startsWith('/') ? '' : '/') + logoPath;
};

export const logoThumb = (logoPath, size = '2.6rem') => {
  const url = resolveLogoUrl(logoPath);
  if (url) return `<div class="logo-thumb" style="width:${size};height:${size};"><img src="${url}" onerror="setFallbackIcon(this)"></div>`;
  return `<div class="logo-thumb" style="width:${size};height:${size};"><i class="fas fa-building"></i></div>`;
};

window.setFallbackIcon = (imgEl) => {
  imgEl.parentElement.innerHTML = '<i class="fas fa-building"></i>';
};

/* ── Formatting helpers ────────────────────────── */
export const fmt = (v) => v ?? '–';

export const statusPill = (s) =>
  `<span class="pill p-${s}">${s.replace(/_/g, ' ')}</span>`;

export const fmtDt = (d) => d ? new Date(d).toLocaleString('hu-HU') : '–';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('hu-HU') : '–';
export const fmtPrice = (n) => n != null
  ? new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(n)
  : '–';

export const fieldHtml = (label, value) =>
  `<div class="detail-field">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${fmt(value)}</span>
  </div>`;
