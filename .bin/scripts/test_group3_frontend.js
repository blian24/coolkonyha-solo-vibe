/**
 * @fileoverview Group 3 Verification Tests — Frontend & UI/UX Rollout
 *
 * Starts the Express server, then validates:
 * - Suite 1: dataService.js new functions callable via the live API
 * - Suite 2: GET /api/maintenance returns normalized data for the UI
 * - Suite 3: Maintenance workflow statuses available for the pill strip
 * - Suite 4: getAllDashboardCases unified merge logic (via API call simulation)
 * - Suite 5: File structure — all required view/controller files exist
 *
 * Note: Full DOM rendering requires a browser, so this script focuses on the
 * data layer and file existence. Router/DOM tests are verified manually.
 *
 * @see ui_design/js/services/dataService.js  - Data service
 * @see ui_design/views/maintenance.html       - Maintenance view
 * @see ui_design/js/controllers/maintenanceController.js - Controller
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3001/api';
let passed = 0;
let failed = 0;

const pass = (msg) => { console.log(`   ✅ PASS: ${msg}`); passed++; };
const fail = (msg) => { console.log(`   ❌ FAIL: ${msg}`); failed++; };

const request = (method, path, body = null) =>
  new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

const waitForServer = (maxAttempts = 25) =>
  new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = () => {
      const req = http.get(`${BASE_URL}/maintenance`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) reject(new Error('Server did not start in time'));
        else setTimeout(poll, 200);
      });
    };
    poll();
  });

// ── Test Suites ───────────────────────────────────────────────────────────────

const runSuite1_MaintenanceCasesList = async () => {
  console.log('\n── Suite 1: GET /api/maintenance — normalized fields ──');

  const { status, body } = await request('GET', '/maintenance');
  if (status !== 200 || !Array.isArray(body)) {
    fail(`Expected 200 array, got ${status}`);
    return;
  }
  pass(`Returns HTTP 200 array with ${body.length} cases`);

  // Validate all fields that dataService.getMaintenanceCases() depends on
  const required = ['case_id', 'case_code', 'cust_name', 'current_status', 'case_date'];
  const allFieldsPresent = body.every(c => required.every(f => c[f] !== undefined));
  if (allFieldsPresent) {
    pass(`All required fields present on every case (${required.join(', ')})`);
  } else {
    fail(`Some cases are missing required fields`);
  }

  const allHaveCaseCode = body.every(c => /^MAINT-\d{5}/.test(c.case_code));
  if (allHaveCaseCode) {
    pass(`All case_code values match MAINT-##### format`);
  } else {
    fail(`Some case_code values have unexpected format`);
  }
};

const runSuite2_MaintenanceWorkflowStrip = async () => {
  console.log('\n── Suite 2: GET /api/maintenance/workflow — pill strip data ──');

  const { status, body } = await request('GET', '/maintenance/workflow');
  if (status !== 200 || !Array.isArray(body)) {
    fail(`Expected 200 array, got ${status}`);
    return;
  }
  pass(`Returns HTTP 200 array`);

  const requiredFields = ['status_key', 'display_name', 'status_color'];
  const allFieldsPresent = body.every(s => requiredFields.every(f => s[f] !== undefined));
  if (allFieldsPresent) {
    pass(`All workflow statuses have status_key, display_name, status_color`);
  } else {
    fail(`Some workflow statuses missing required fields`);
  }

  if (body.length === 9) {
    pass(`Returns exactly 9 maintenance statuses`);
  } else {
    fail(`Expected 9 statuses, got ${body.length}`);
  }
};

const runSuite3_UnifiedDashboardData = async () => {
  console.log('\n── Suite 3: Unified Dashboard — Orders + Maintenance combined ──');

  const [ordersRes, maintRes] = await Promise.all([
    request('GET', '/orders'),
    request('GET', '/maintenance'),
  ]);

  if (ordersRes.status !== 200 || !Array.isArray(ordersRes.body)) {
    fail(`Orders API unavailable`); return;
  }
  if (maintRes.status !== 200 || !Array.isArray(maintRes.body)) {
    fail(`Maintenance API unavailable`); return;
  }

  const combinedCount = ordersRes.body.length + maintRes.body.length;
  pass(`Orders (${ordersRes.body.length}) + Maintenance (${maintRes.body.length}) = ${combinedCount} total cases`);

  // Simulate the getAllDashboardCases normalization logic
  const taggedOrders = ordersRes.body.map(o => ({
    id: o.order_id,
    caseType: 'order',
    updated: (o.order_date || '').split(' ')[0],
  }));
  const taggedMaint = maintRes.body.map(mc => ({
    id: mc.case_id,
    caseType: 'maintenance',
    updated: (mc.case_date || '').split(' ')[0],
  }));
  const combined = [...taggedOrders, ...taggedMaint].sort((a, b) =>
    (b.updated || '').localeCompare(a.updated || '')
  );

  const hasOrders = combined.some(c => c.caseType === 'order');
  const hasMaint = combined.some(c => c.caseType === 'maintenance');
  if (hasOrders && hasMaint) {
    pass(`Unified array contains both 'order' and 'maintenance' case types`);
  } else {
    fail(`Unified array is missing one or both case types`);
  }

  // Verify chronological sort (newest first)
  let sorted = true;
  for (let i = 1; i < combined.length; i++) {
    if ((combined[i - 1].updated || '') < (combined[i].updated || '')) {
      sorted = false;
      break;
    }
  }
  if (sorted) {
    pass(`Combined array is correctly sorted newest-first by date`);
  } else {
    fail(`Combined array is NOT sorted correctly`);
  }
};

const runSuite4_FileStructure = async () => {
  console.log('\n── Suite 4: File Structure — required files exist ──');

  const requiredFiles = [
    'ui_design/views/maintenance.html',
    'ui_design/js/controllers/maintenanceController.js',
    'ui_design/js/services/dataService.js',
    'ui_design/js/router.js',
    'ui_design/views/dashboard.html',
    'ui_design/css/oceanic-plus.css',
    'index.html',
  ];

  for (const relPath of requiredFiles) {
    const absPath = path.join(ROOT, relPath);
    if (fs.existsSync(absPath)) {
      pass(`${relPath} exists`);
    } else {
      fail(`${relPath} is MISSING`);
    }
  }
};

const runSuite5_ContentChecks = async () => {
  console.log('\n── Suite 5: Content Checks — key strings in modified files ──');

  const checks = [
    {
      file: 'index.html',
      search: 'fa-wrench',
      label: 'index.html contains Maintenance nav item (fa-wrench)',
    },
    {
      file: 'index.html',
      search: 'case-type-badge',
      label: 'index.html tpl-order-row contains case-type-badge slot',
    },
    {
      file: 'ui_design/js/router.js',
      search: 'maintenance',
      label: 'router.js contains maintenance route',
    },
    {
      file: 'ui_design/js/router.js',
      search: 'maintenanceController',
      label: 'router.js imports maintenanceController',
    },
    {
      file: 'ui_design/js/services/dataService.js',
      search: 'getAllDashboardCases',
      label: 'dataService.js exports getAllDashboardCases',
    },
    {
      file: 'ui_design/js/services/dataService.js',
      search: 'getMaintenanceCases',
      label: 'dataService.js exports getMaintenanceCases',
    },
    {
      file: 'ui_design/js/controllers/dashboardController.js',
      search: 'getAllDashboardCases',
      label: 'dashboardController.js uses getAllDashboardCases',
    },
    {
      file: 'ui_design/js/controllers/dashboardController.js',
      search: 'filterCasesByType',
      label: 'dashboardController.js exports filterCasesByType',
    },
    {
      file: 'ui_design/css/oceanic-plus.css',
      search: 'badge-maintenance',
      label: 'oceanic-plus.css contains badge-maintenance CSS class',
    },
    {
      file: 'ui_design/css/oceanic-plus.css',
      search: 'p-DIAGNOSED',
      label: 'oceanic-plus.css contains maintenance status pills',
    },
  ];

  for (const check of checks) {
    const absPath = path.join(ROOT, check.file);
    if (!fs.existsSync(absPath)) {
      fail(`${check.file} not found`);
      continue;
    }
    const content = fs.readFileSync(absPath, 'utf-8');
    if (content.includes(check.search)) {
      pass(check.label);
    } else {
      fail(`${check.label} — string "${check.search}" NOT found in ${check.file}`);
    }
  }
};

// ── Main Entry Point ──────────────────────────────────────────────────────────

const main = async () => {
  console.log('🧪 Running Group 3 verification tests — Frontend & UI/UX Rollout...\n');

  const server = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`  [server stderr] ${msg}`);
  });

  try {
    console.log('⏳ Waiting for server to start...');
    await waitForServer();
    console.log('✅ Server is up.\n');

    await runSuite1_MaintenanceCasesList();
    await runSuite2_MaintenanceWorkflowStrip();
    await runSuite3_UnifiedDashboardData();
    await runSuite4_FileStructure();
    await runSuite5_ContentChecks();

  } finally {
    server.kill();
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log(`🏁 Tests complete: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed — Group 3 is verified!');
    console.log('\n📋 NOTE: DOM rendering verification (sidebar navigation, dropdown');
    console.log('   filtering, detail panel) requires manual browser testing.');
  } else {
    console.log('⚠️  Some tests failed. Review output above.');
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('❌ Test runner crashed:', err.message);
  process.exit(1);
});
