/**
 * @file router.js
 * @description Client-side router for the CoolKonyha SPA.
 *
 * Routes:
 * - dashboard    → dashboard.html  + initDashboardController
 * - maintenance  → maintenance.html + initMaintenanceController (v0.6.0)
 * - database     → database.html   + initDatabaseController
 * - settings     → settings.html   + initSettingsController (v0.7.1)
 * - reports      → static view (no controller)
 */

import { initDatabaseController } from './controllers/databaseController.js';
import { initDashboardController } from './controllers/dashboardController.js';
import { initMaintenanceController } from './controllers/maintenanceController.js';
import { initSettingsController } from './controllers/settingsController.js';

const routes = {
  'dashboard': '/ui_design/views/dashboard.html',
  'maintenance': '/ui_design/views/maintenance.html',
  'database': '/ui_design/views/database.html',
  'reports': '/ui_design/views/reports.html',
  'settings': '/ui_design/views/settings.html'
};

const appContent = document.getElementById('app-content');

async function loadRoute(route) {
  if (!routes[route]) return;

  try {
    const response = await fetch(routes[route]);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    appContent.innerHTML = html;

    // Load necessary controller logic
    if (route === 'dashboard') {
      initDashboardController();
    } else if (route === 'maintenance') {
      initMaintenanceController();
    } else if (route === 'database') {
      initDatabaseController();
    } else if (route === 'settings') {
      initSettingsController();
    }
  } catch (error) {
    console.error('Error loading route:', error);
    appContent.innerHTML = `<div class="p-5"><div class="empty-state">Error loading view.</div></div>`;
  }
}

// Intercept sidebar navigation clicks
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all
      navItems.forEach(nav => nav.classList.remove('active'));
      // Add active class to clicked
      item.classList.add('active');

      const text = item.querySelector('span').textContent.toLowerCase();
      if (text.includes('dashboard')) {
        loadRoute('dashboard');
      } else if (text.includes('maintenance')) {
        loadRoute('maintenance');
      } else if (text.includes('database')) {
        loadRoute('database');
      } else if (text.includes('reports')) {
        loadRoute('reports');
      } else if (text.includes('settings')) {
        loadRoute('settings');
      }
    });
  });

  // Load default route
  loadRoute('dashboard');
});
