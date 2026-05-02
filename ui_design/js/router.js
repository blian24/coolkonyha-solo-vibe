/**
 * @file router.js
 * @description Client-side router for the CoolKonyha SPA.
 */

import { initDatabaseController } from './controllers/databaseController.js';
import { initDashboardController } from './controllers/dashboardController.js';

const routes = {
  'dashboard': '/ui_design/views/dashboard.html',
  'database': '/ui_design/views/database.html',
  // 'reports': '/ui_design/views/reports.html', // To be added later
  // 'settings': '/ui_design/views/settings.html' // To be added later
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
    } else if (route === 'database') {
      // We explicitly import it here, so we can just call its init function
      initDatabaseController();
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
      } else if (text.includes('database')) {
        loadRoute('database');
      }
    });
  });

  // Load default route
  loadRoute('dashboard');
});
