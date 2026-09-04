/**
 * @file renderers-email.js
 * @description Table renderers for the Email & AI domain: Processed
 *              Emails, Sender Rules. `directionBadge`, `actionBadge`, and
 *              `emailStatusPill` are single-purpose to this domain, so they
 *              live here rather than in the shared state.js formatters.
 * @see docs/architecture/database-schema.md — full schema reference
 */

import { expandedRows, fieldHtml, fmtDate, fmtDt } from './state.js';

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

export const renderProcessedEmails = (data) => {
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

export const renderSenderRules = (data) => {
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
