/**
 * @fileoverview Group 2 Verification Tests — Backend API Integration
 *
 * Starts the Express server as a child process, then makes HTTP calls to verify:
 * - Suite 1: Order regression (renamed workflow table hasn't broken existing endpoints)
 * - Suite 2: GET /api/maintenance/workflow
 * - Suite 3: GET /api/maintenance (list)
 * - Suite 4: GET /api/maintenance/:id (detail)
 * - Suite 5: POST /api/maintenance (create new case with Dual-Write)
 * - Suite 6: POST /api/maintenance/:id/items (add item with Pricing Continuity)
 * - Suite 7: PUT /api/maintenance/:id/status (update status with Dual-Write)
 *
 * @see server/agent.js  - DBRobot maintenance functions
 * @see server/routes.js - Maintenance API endpoints
 */

import { spawn } from 'child_process';
import http from 'http';

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3001/api';
let passed = 0;
let failed = 0;

const pass = (msg) => { console.log(`   ✅ PASS: ${msg}`); passed++; };
const fail = (msg) => { console.log(`   ❌ FAIL: ${msg}`); failed++; };

/**
 * Makes an HTTP request and returns { status, body }.
 *
 * @param {string} method - HTTP method
 * @param {string} path   - Path relative to BASE_URL
 * @param {Object} [body] - Optional JSON body
 * @returns {Promise<{status: number, body: any}>}
 */
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

/**
 * Waits until the server is accepting connections (polls every 200 ms).
 *
 * @param {number} [maxAttempts=25] - Maximum number of polling attempts
 * @returns {Promise<void>}
 */
const waitForServer = (maxAttempts = 25) =>
  new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = () => {
      const req = http.get(`${BASE_URL}/maintenance/workflow`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(poll, 200);
        }
      });
    };
    poll();
  });

// ── Test Suites ───────────────────────────────────────────────────────────────

const runSuite1_OrderRegression = async () => {
  console.log('\n── Suite 1: Order Regression (renamed table must not break orders) ──');

  const { status, body: statuses } = await request('GET', '/workflow');
  if (status === 200 && Array.isArray(statuses) && statuses.length === 10) {
    pass(`GET /api/workflow returns 10 order statuses (order_status_workflow intact)`);
  } else {
    fail(`GET /api/workflow returned status ${status} with ${Array.isArray(statuses) ? statuses.length : 'non-array'} entries`);
  }

  const { status: oStatus, body: orders } = await request('GET', '/orders');
  if (oStatus === 200 && Array.isArray(orders) && orders.length > 0) {
    pass(`GET /api/orders returns ${orders.length} orders — order data intact`);
  } else {
    fail(`GET /api/orders returned status ${oStatus}`);
  }
};

const runSuite2_MaintenanceWorkflow = async () => {
  console.log('\n── Suite 2: GET /api/maintenance/workflow ──');

  const { status, body } = await request('GET', '/maintenance/workflow');
  if (status === 200 && Array.isArray(body)) {
    pass(`Endpoint returns HTTP 200 with an array`);
  } else {
    fail(`Expected 200 array, got status ${status}`);
    return;
  }

  if (body.length === 9) {
    pass(`Returns exactly 9 maintenance workflow statuses`);
  } else {
    fail(`Expected 9 statuses, got ${body.length}`);
  }

  const keys = body.map((s) => s.status_key);
  const expected = ['NEW', 'DIAGNOSED', 'PARTS_ORDERED', 'IN_REPAIR', 'TESTING', 'READY', 'INVOICED', 'CLOSED', 'CANCELLED'];
  const allPresent = expected.every((k) => keys.includes(k));
  if (allPresent) {
    pass(`All 9 expected status keys are present`);
  } else {
    fail(`Missing status keys. Got: ${keys.join(', ')}`);
  }
};

const runSuite3_MaintenanceList = async () => {
  console.log('\n── Suite 3: GET /api/maintenance ──');

  const { status, body } = await request('GET', '/maintenance');
  if (status === 200 && Array.isArray(body)) {
    pass(`Endpoint returns HTTP 200 with an array`);
  } else {
    fail(`Expected 200 array, got status ${status}`);
    return;
  }

  if (body.length === 3) {
    pass(`Returns 3 seeded maintenance cases`);
  } else {
    fail(`Expected 3 cases, got ${body.length}`);
  }

  const hasCustomerName = body.every((c) => c.cust_name);
  if (hasCustomerName) {
    pass(`All cases include cust_name from JOIN`);
  } else {
    fail(`Some cases are missing cust_name`);
  }

  const hasCaseCode = body.every((c) => c.case_code);
  if (hasCaseCode) {
    pass(`All cases have a case_code`);
  } else {
    fail(`Some cases are missing case_code`);
  }
};

// Holds the caseId created in Suite 5 so later suites can reference it
let newCaseId = null;
let newCaseCode = null;

const runSuite4_MaintenanceDetail = async () => {
  console.log('\n── Suite 4: GET /api/maintenance/:id ──');

  // Use seeded case 1
  const { status, body } = await request('GET', '/maintenance/1');
  if (status === 200 && body.case) {
    pass(`GET /api/maintenance/1 returns HTTP 200 with a case object`);
  } else {
    fail(`Expected 200 with case object, got status ${status}`);
    return;
  }

  if (Array.isArray(body.items) && body.items.length > 0) {
    pass(`Response includes ${body.items.length} item(s)`);
  } else {
    fail(`Expected at least 1 item, got: ${JSON.stringify(body.items)}`);
  }

  if (Array.isArray(body.history) && body.history.length > 0) {
    pass(`Response includes ${body.history.length} history entries`);
  } else {
    fail(`Expected at least 1 history entry`);
  }
};

const runSuite5_CreateCase = async () => {
  console.log('\n── Suite 5: POST /api/maintenance (create) ──');

  const { status, body } = await request('POST', '/maintenance', {
    custId: 2,
    description: 'Test case created by Group 2 verification script',
  });

  if (status === 201 && body.caseId && body.caseCode) {
    pass(`POST /api/maintenance returns 201 with caseId=${body.caseId}, caseCode=${body.caseCode}`);
    newCaseId = body.caseId;
    newCaseCode = body.caseCode;
  } else {
    fail(`Expected 201 with caseId/caseCode, got status ${status}: ${JSON.stringify(body)}`);
    return;
  }

  // Verify the case code format (MAINT-#####)
  if (/^MAINT-\d{5}$/.test(newCaseCode)) {
    pass(`Case code format is valid: ${newCaseCode}`);
  } else {
    fail(`Case code format is invalid: ${newCaseCode}`);
  }

  // Verify the new case appears in the list
  const listRes = await request('GET', '/maintenance');
  const found = listRes.body.find((c) => c.case_id === newCaseId);
  if (found) {
    pass(`New case appears in GET /api/maintenance list`);
  } else {
    fail(`New case not found in list`);
  }
};

const runSuite6_AddItem = async () => {
  console.log('\n── Suite 6: POST /api/maintenance/:id/items (add item) ──');
  if (!newCaseId) { fail('No new case ID from Suite 5, skipping'); return; }

  const { status, body } = await request('POST', `/maintenance/${newCaseId}/items`, {
    prodId: 5,
    quantity: 2,
    issueNote: 'Spare part for test case',
  });

  if (status === 200 && body.id) {
    pass(`POST /api/maintenance/${newCaseId}/items returns 200 with id=${body.id}`);
  } else {
    fail(`Expected 200 with item id, got status ${status}: ${JSON.stringify(body)}`);
    return;
  }

  // Verify the item exists in the detail response
  const detailRes = await request('GET', `/maintenance/${newCaseId}`);
  const item = detailRes.body.items && detailRes.body.items.find((i) => i.item_id === body.id);
  if (item && item.prod_id === 5) {
    pass(`Item references correct prod_id=${item.prod_id} (product FK intact)`);
  } else {
    fail(`Item with id=${body.id} not found or has wrong prod_id`);
  }
};

const runSuite7_UpdateStatus = async () => {
  console.log('\n── Suite 7: PUT /api/maintenance/:id/status (update status) ──');
  if (!newCaseId) { fail('No new case ID from Suite 5, skipping'); return; }

  // Test with a valid status
  const { status, body } = await request('PUT', `/maintenance/${newCaseId}/status`, {
    status: 'DIAGNOSED',
    performedBy: 'test-script',
    eventDescription: 'Initial diagnosis completed during Group 2 tests',
  });

  if (status === 200 && body.success && body.newStatus === 'DIAGNOSED') {
    pass(`PUT /api/maintenance/${newCaseId}/status updates to DIAGNOSED`);
  } else {
    fail(`Expected success with newStatus=DIAGNOSED, got: ${JSON.stringify(body)}`);
  }

  // Verify history was appended (Dual-Write)
  const detailRes = await request('GET', `/maintenance/${newCaseId}`);
  const history = detailRes.body.history || [];
  const diagEntry = history.find((h) => h.status === 'DIAGNOSED');
  if (diagEntry) {
    pass(`Dual-Write verified: DIAGNOSED entry found in status history`);
  } else {
    fail(`No DIAGNOSED entry in history — Dual-Write may be broken`);
  }

  // Test with an invalid status (must reject)
  const { status: badStatus, body: badBody } = await request('PUT', `/maintenance/${newCaseId}/status`, {
    status: 'INVALID_STATUS_XYZ',
    performedBy: 'test-script',
    eventDescription: 'This should fail',
  });

  if (badStatus === 400 && badBody.error) {
    pass(`Invalid status correctly rejected with HTTP 400`);
  } else {
    fail(`Expected 400 for invalid status, got ${badStatus}`);
  }
};

// ── Main Entry Point ──────────────────────────────────────────────────────────

const main = async () => {
  console.log('🧪 Running Group 2 verification tests — Backend API Integration...\n');

  // Start the server as a child process
  const server = spawn('node', ['server/index.js'], {
    cwd: process.cwd(),
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

    await runSuite1_OrderRegression();
    await runSuite2_MaintenanceWorkflow();
    await runSuite3_MaintenanceList();
    await runSuite4_MaintenanceDetail();
    await runSuite5_CreateCase();
    await runSuite6_AddItem();
    await runSuite7_UpdateStatus();

  } finally {
    server.kill();
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log(`🏁 Tests complete: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed — Group 2 is verified!');
  } else {
    console.log('⚠️  Some tests failed. Review output above.');
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('❌ Test runner crashed:', err.message);
  process.exit(1);
});
