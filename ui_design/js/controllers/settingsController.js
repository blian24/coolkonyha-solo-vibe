/**
 * @file settingsController.js
 * @description Controller for the Settings view in the CoolKonyha SPA.
 *
 * Responsibilities:
 * - Tab switching between General and Admin sections
 * - Reflects current theme state in the theme toggle
 * - Fetches and displays the app version from /VERSION
 * - Wires the "Clear Logs" button to a toast notification
 * - Wires "Reset Sidebar Width" to restore the default sidebar width
 * - Manages "Extend Database View" toggle (persisted in localStorage)
 *
 * @see docs/architecture/settings-view.md
 */

// RULE: localStorage key for the extended database view setting
const DB_EXTENDED_KEY = 'ck_db_extended';

// ── Tab Switching ─────────────────────────────────────────────────────────────

/**
 * Switches the active settings tab and shows the matching section panel.
 * Called via onclick attributes in settings.html.
 *
 * @param {'general'|'admin'} tabName - The tab to activate.
 */
window.switchSettingsTab = (tabName) => {
  const tabs = document.querySelectorAll('.settings-tab-btn');
  const panels = document.querySelectorAll('.settings-section');

  tabs.forEach(tab => tab.classList.remove('active'));
  panels.forEach(panel => panel.classList.remove('active'));

  const activeTab = document.getElementById(`settings-tab-${tabName}`);
  const activePanel = document.getElementById(`settings-panel-${tabName}`);

  if (activeTab) activeTab.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
};

// ── Theme Toggle ──────────────────────────────────────────────────────────────

/**
 * Reads the current dark/light state from <html> and syncs the checkbox.
 * Also wires the toggle change event to the global toggleTheme() function.
 */
const initThemeToggle = () => {
  const checkbox = document.getElementById('settings-theme-checkbox');
  if (!checkbox) return;

  // Reflect current state: dark mode = checked
  const isDark = document.documentElement.classList.contains('dark');
  checkbox.checked = isDark;

  checkbox.addEventListener('change', () => {
    // Delegate to the global toggleTheme defined in index.html
    if (typeof window.toggleTheme === 'function') {
      window.toggleTheme();
    }
  });
};

// ── Sidebar Reset ─────────────────────────────────────────────────────────────

/**
 * Restores the sidebar to its default width (18vw).
 * Called via onclick in settings.html.
 */
window.resetSidebarWidth = () => {
  const sidebar = document.getElementById('main-sidebar');
  if (sidebar) {
    sidebar.style.width = '18vw';
  }
  showToast('Sidebar width has been reset to default.');
};

// ── Clear Logs ────────────────────────────────────────────────────────────────

/**
 * Placeholder action for the "Clear Logs" admin button.
 * Clears any console-level session logs and shows a toast confirmation.
 * Server-side logs are not affected.
 * Called via onclick in settings.html.
 */
window.clearAppLogs = () => {
  // Session-level: clear any cached UI state if applicable in the future
  console.clear();
  showToast('Application logs cleared from this session.');
};

// ── Version Display ───────────────────────────────────────────────────────────

/**
 * Fetches the current app version from /VERSION and injects it into
 * the version badge and the Admin system info card.
 */
const loadVersion = async () => {
  try {
    const response = await fetch('/VERSION');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const version = (await response.text()).trim();

    const badge = document.getElementById('settings-version-badge');
    const infoVal = document.getElementById('settings-app-version');

    if (badge) badge.textContent = `v${version}`;
    if (infoVal) infoVal.textContent = `v${version}`;
  } catch (error) {
    console.error('[SettingsController] Failed to load version:', error);
  }
};

// ── Toast Notification ────────────────────────────────────────────────────────

/**
 * Ensures a single toast element exists in the DOM and displays it.
 * The toast auto-hides after 3 seconds.
 *
 * @param {string} message - The message to display in the toast.
 */
const showToast = (message) => {
  let toast = document.getElementById('app-toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fas fa-check-circle"></i><span id="app-toast-msg"></span>`;
    document.body.appendChild(toast);
  }

  const msgEl = document.getElementById('app-toast-msg');
  if (msgEl) msgEl.textContent = message;

  // Show
  toast.classList.add('show');

  // Auto-hide after 3s
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
};

// ── Database View Extension ───────────────────────────────────────────────────

/**
 * Returns whether the extended database view is enabled.
 * Defaults to false if the key has never been set.
 *
 * @returns {boolean}
 */
export const isDbExtended = () => localStorage.getItem(DB_EXTENDED_KEY) === 'true';

/**
 * Applies the extended/compact visibility to the database tab bar.
 * Safe to call even when the database view is not currently loaded —
 * it will simply find no elements and exit gracefully.
 *
 * Extended-only elements must carry the attribute data-extended-only="true".
 * When extended mode is OFF they are hidden; when ON they are shown.
 */
window.applyDbExtendedSetting = () => {
  const extended = isDbExtended();
  document.querySelectorAll('[data-extended-only="true"]').forEach(el => {
    el.style.display = extended ? '' : 'none';
  });
};

/**
 * Reads the stored DB extended preference and syncs the checkbox.
 * Wires the change event to persist the new value and immediately
 * apply it to the database tab bar if that view is currently visible.
 */
const initDbExtendedToggle = () => {
  const checkbox = document.getElementById('settings-db-extended-checkbox');
  if (!checkbox) return;

  // Reflect persisted state
  checkbox.checked = isDbExtended();

  checkbox.addEventListener('change', () => {
    localStorage.setItem(DB_EXTENDED_KEY, String(checkbox.checked));
    // Apply immediately if the database view is open in the background
    window.applyDbExtendedSetting();
    showToast(
      checkbox.checked
        ? 'Database view extended — all tables are now visible.'
        : 'Database view compact — only core tables are shown.'
    );
  });
};

// ── Controller Entry Point ────────────────────────────────────────────────────

/**
 * Initialises the Settings view.
 * Called by router.js when the 'settings' route is loaded.
 */
export const initSettingsController = () => {
  initThemeToggle();
  initDbExtendedToggle();
  loadVersion();

  // Default to General tab on load
  switchSettingsTab('general');
};
