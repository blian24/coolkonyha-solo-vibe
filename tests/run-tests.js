/**
 * @fileoverview Test Agent Runner — Entry point for the test suite.
 *
 * Orchestrates all three test tiers (unit, integration, E2E) with:
 *   1. Re-Learn Phase per scope (reads source + docs before running)
 *   2. Test execution via Node.js built-in test runner
 *   3. Structured report written to docs/tests/reports/run-<timestamp>.md
 *
 * Usage:
 *   npm test                 — run all tests
 *   npm run test:unit        — run unit tests only
 *   npm run test:integration — run integration tests only
 *   npm run test:e2e         — run E2E tests only
 *
 * Exit codes: 0 = all pass, 1 = any failure
 *
 * @see docs/tests/README.md — full documentation
 */

import { run } from 'node:test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import { learn, formatLearnReport, LEARN_SCOPES } from './helpers/learner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const REPORTS_DIR = resolve(PROJECT_ROOT, 'docs', 'tests', 'reports');

// Determine which test scope to run from CLI argument
const scopeArg = process.argv[2]; // e.g. 'unit', 'integration', 'e2e', or undefined (all)
const scope = (scopeArg && LEARN_SCOPES[scopeArg]) ? scopeArg : 'all';

const TEST_FILES = {
    unit: [
        'tests/unit/agent.unit.test.js',
        'tests/unit/maintenance.unit.test.js',
        'tests/unit/pista-db.unit.test.js',
    ],
    integration: ['tests/integration/routes.integration.test.js'],
    e2e: ['tests/e2e/order-lifecycle.e2e.test.js'],
};

const filesToRun = scope === 'all'
    ? Object.values(TEST_FILES).flat()
    : TEST_FILES[scope];

const absoluteFiles = filesToRun.map((f) => resolve(PROJECT_ROOT, f));

// All test files run against an in-memory DB, never coolkonyha.db - see
// server/db.js and docs/.notes/future-ideas.md i-2. node:test spawns each
// file as its own child process, which inherits this env var.
process.env.DB_PATH = ':memory:';

// ---------------------------------------------------------------
// RE-LEARN PHASE
// ---------------------------------------------------------------
console.log(`\n🔍 [TEST AGENT] Re-Learn Phase — scope: ${scope}\n`);
const learnContext = await learn(scope, PROJECT_ROOT);
const learnReport = formatLearnReport(learnContext);
console.log(learnReport);
console.log('\n─────────────────────────────────────────────────────────\n');

// ---------------------------------------------------------------
// COLLECT RESULTS
// The node:test stream MUST be actively consumed (via on('data') or pipe)
// for the 'close' event to fire. We collect all events and parse them.
// ---------------------------------------------------------------
const results = { pass: 0, fail: 0, skip: 0, total: 0, failures: [] };
const startTime = Date.now();

const testStream = run({
    files: absoluteFiles,
    concurrency: false, // sequential for deterministic output
});

// Must consume the raw stream data to flush the internal buffer and
// allow the 'close' event to eventually fire.
testStream.on('data', () => { /* intentionally empty — just drains the stream */ });

testStream.on('test:pass', (data) => {
    // Skip suite-level wrappers (describe blocks)
    if (data.nesting === undefined || data.nesting > 0) {
        results.pass++;
        results.total++;
        process.stdout.write(`  ✅ ${data.name}\n`);
    }
});

testStream.on('test:fail', (data) => {
    if (data.nesting === undefined || data.nesting > 0) {
        results.fail++;
        results.total++;
        const errMsg = data.details?.error?.message ?? 'Unknown error';
        results.failures.push({ name: data.name, file: data.file ?? '', error: errMsg });
        process.stderr.write(`  ❌ ${data.name}\n     ${errMsg}\n`);
    }
});

testStream.on('test:skip', (data) => {
    if (data.nesting === undefined || data.nesting > 0) {
        results.skip++;
        results.total++;
        process.stdout.write(`  ⏭  ${data.name}\n`);
    }
});

// Wait for the stream to finish
await new Promise((res, rej) => {
    testStream.on('close', res);
    testStream.on('error', rej);
});

const durationMs = Date.now() - startTime;
const passed = results.fail === 0;

// ---------------------------------------------------------------
// CONSOLE SUMMARY
// ---------------------------------------------------------------
console.log('\n─────────────────────────────────────────────────────────');
console.log(`\n🧪 TEST AGENT REPORT — scope: ${scope}`);
console.log(`   Completed in ${durationMs}ms`);
console.log(`   ✅ Passed:  ${results.pass}`);
console.log(`   ❌ Failed:  ${results.fail}`);
console.log(`   ⏭  Skipped: ${results.skip}`);
console.log(`   Total:     ${results.total}`);

if (results.failures.length > 0) {
    console.log('\n   Failed tests:');
    for (const f of results.failures) {
        console.log(`   ❌ ${f.name}\n      → ${f.error}`);
    }
}
console.log('\n─────────────────────────────────────────────────────────\n');

// ---------------------------------------------------------------
// WRITE MARKDOWN REPORT
// ---------------------------------------------------------------
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = resolve(REPORTS_DIR, `run-${timestamp}.md`);

const failureSection = results.failures.length
    ? results.failures.map((f) => `- **${f.name}** — \`${f.error}\``).join('\n')
    : '_No failures._';

const reportContent = [
    '# Test Agent Report',
    '',
    `**Run date:** ${new Date().toISOString()}  `,
    `**Scope:** \`${scope}\`  `,
    `**Duration:** ${durationMs}ms  `,
    `**Result:** ${passed ? '✅ ALL PASSED' : '❌ FAILURES DETECTED'}`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|---|---|',
    `| ✅ Passed | ${results.pass} |`,
    `| ❌ Failed | ${results.fail} |`,
    `| ⏭ Skipped | ${results.skip} |`,
    `| **Total** | **${results.total}** |`,
    '',
    '## Failures',
    '',
    failureSection,
    '',
    '## Files Tested',
    '',
    filesToRun.map((f) => `- \`${f}\``).join('\n'),
    '',
    '---',
    '',
    learnReport,
].join('\n');

await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(reportPath, reportContent, 'utf-8');
console.log(`📄 Report saved: docs/tests/reports/run-${timestamp}.md\n`);

// CI-compatible exit code
process.exit(passed ? 0 : 1);
