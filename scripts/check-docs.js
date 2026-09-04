#!/usr/bin/env node
/**
 * @fileoverview Documentation Consistency Checker.
 *
 * Prevents the class of drift found and fixed on 2026-09-03 (see
 * docs/.impl_plans/0.9.0_20260903-143523_Documentation_Consistency_Fix.md):
 * docs claiming a file is "the current implementation" of something when the
 * file is actually dead code, or docs pointing at a path that no longer exists.
 *
 * Source of truth: docs/architecture/module-map/status.json declares, for every
 * file under server/, whether it is 'live' (wired into the running app),
 * 'not-wired' (implemented but nothing currently imports it), or 'legacy-unused'
 * (superseded, kept for reference, not imported by anything live).
 *
 * Checks performed:
 *   1. Every path in status.json exists on disk.
 *   2. Every server/**\/*.js file has a status.json entry (no undeclared files).
 *   3. Reachability from server/index.js, computed by statically following
 *      relative ES module imports, matches the declared status exactly —
 *      'live' files must be reachable, 'not-wired'/'legacy-unused' files must not be.
 *   4. Every server/... or tests/... file path referenced from a "living" doc
 *      (anything under docs/ or SOLUTION_DESIGN.md, excluding dated/historical
 *      folders: .impl_plans/, .versions/, building-docs/, .notes/, tests/reports/)
 *      resolves to a file that actually exists.
 *
 * Run via `npm run check-docs`. Also runs automatically before `npm test` (pretest).
 * Exits non-zero on any hard failure.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const STATUS_REL_PATH = 'docs/architecture/module-map/status.json';
const ENTRY_POINT = 'server/index.js';
const VALID_STATUSES = new Set(['live', 'not-wired', 'legacy-unused']);

const HISTORICAL_DIR_PATTERNS = [
    /^docs\/\.impl_plans\//,
    /^docs\/\.versions\//,
    /^docs\/building-docs\//,
    /^docs\/\.notes\//,
    /^docs\/tests\/reports\//,
];

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const toPosix = (p) => p.replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// Load manifest
// ---------------------------------------------------------------------------
const statusFile = resolve(ROOT, STATUS_REL_PATH);
if (!existsSync(statusFile)) {
    console.error(`FATAL: manifest not found at ${STATUS_REL_PATH}`);
    process.exit(1);
}
const status = JSON.parse(readFileSync(statusFile, 'utf-8'));
const statusEntries = Object.entries(status).filter(([key]) => !key.startsWith('_'));

for (const [relPath, entry] of statusEntries) {
    if (!VALID_STATUSES.has(entry.status)) {
        fail(`${STATUS_REL_PATH}: "${relPath}" has invalid status "${entry.status}"`);
    }
    if (!existsSync(resolve(ROOT, relPath))) {
        fail(`${STATUS_REL_PATH}: "${relPath}" is listed but does not exist on disk`);
    }
}

// ---------------------------------------------------------------------------
// Check 2: every server/**/*.js file has a manifest entry
// ---------------------------------------------------------------------------
function walkFiles(dir, ext) {
    let out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out = out.concat(walkFiles(full, ext));
        else if (extname(full) === ext) out.push(full);
    }
    return out;
}

const serverFiles = walkFiles(resolve(ROOT, 'server'), '.js')
    .map((f) => toPosix(relative(ROOT, f)));

const statusKeys = new Set(statusEntries.map(([k]) => k));
for (const f of serverFiles) {
    if (!statusKeys.has(f)) {
        fail(`${f} exists under server/ but has no entry in ${STATUS_REL_PATH}`);
    }
}

// ---------------------------------------------------------------------------
// Check 3: reachability from the entry point vs declared status
// ---------------------------------------------------------------------------
const IMPORT_RE =
  /(?:import\s+(?:[^'";]*?\sfrom\s+)?|export\s+[^'";]*?\sfrom\s+)['"](\.[^'"]+)['"]/g;

function resolveImportTarget(fromFile, spec) {
    let target = resolve(dirname(fromFile), spec);
    if (!extname(target)) target += '.js';
    return target;
}

function collectReachable(entryRelPath) {
    const seen = new Set();
    const stack = [resolve(ROOT, entryRelPath)];
    while (stack.length) {
        const file = stack.pop();
        const rel = toPosix(relative(ROOT, file));
        if (seen.has(rel)) continue;
        seen.add(rel);
        if (!existsSync(file)) continue;
        const src = readFileSync(file, 'utf-8');
        let m;
        IMPORT_RE.lastIndex = 0;
        while ((m = IMPORT_RE.exec(src))) {
            stack.push(resolveImportTarget(file, m[1]));
        }
    }
    return seen;
}

const reachable = collectReachable(ENTRY_POINT);

for (const [relPath, entry] of statusEntries) {
    const isReachable = reachable.has(relPath);
    if (entry.status === 'live' && !isReachable) {
        fail(`${relPath} is declared "live" in the manifest but is NOT reachable by static import from ${ENTRY_POINT} — it isn't actually wired in`);
    }
    if ((entry.status === 'not-wired' || entry.status === 'legacy-unused') && isReachable) {
        fail(`${relPath} is declared "${entry.status}" but IS reachable by static import from ${ENTRY_POINT} — the manifest is stale, it's actually wired in now`);
    }
}

// ---------------------------------------------------------------------------
// Check 4: doc-referenced server/tests paths must exist
// ---------------------------------------------------------------------------
function listMarkdownFiles(dir) {
    let out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out = out.concat(listMarkdownFiles(full));
        else if (extname(full) === '.md') out.push(full);
    }
    return out;
}

const docFiles = [
    ...listMarkdownFiles(resolve(ROOT, 'docs')),
    resolve(ROOT, 'SOLUTION_DESIGN.md'),
].filter(existsSync);

// Backtick-quoted code paths, e.g. `server/agent.js` or `../../server/agent.js`
const BACKTICK_PATH_RE = /`((?:\.\.?\/)*(?:server|tests)\/[^`]+\.(?:js|json))`/g;
// Markdown link targets ending in .js/.json, e.g. [x](../../server/agent.js)
const LINK_PATH_RE = /\]\(([^)\s]+\.(?:js|json))\)/g;

function resolveDocPath(docFile, raw) {
    return raw.startsWith('.') ? resolve(dirname(docFile), raw) : resolve(ROOT, raw);
}

for (const docFile of docFiles) {
    const relDoc = toPosix(relative(ROOT, docFile));
    const isHistorical = HISTORICAL_DIR_PATTERNS.some((re) => re.test(relDoc));
    const content = readFileSync(docFile, 'utf-8');
    const seenAbs = new Set();

    for (const re of [BACKTICK_PATH_RE, LINK_PATH_RE]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(content))) {
            const raw = m[1];
            if (raw.startsWith('file:') || /^[a-zA-Z]+:\/\//.test(raw)) continue; // absolute file:// / URL links aren't relative code paths
            if (!/(^|\/)(server|tests)\//.test(raw) && !raw.startsWith('server/') && !raw.startsWith('tests/')) continue;
            const abs = resolveDocPath(docFile, raw);
            if (seenAbs.has(abs)) continue;
            seenAbs.add(abs);
            if (!existsSync(abs)) {
                const msg = `${relDoc} references "${raw}" which does not exist on disk`;
                if (isHistorical) warn(`${msg} (historical doc, not blocking)`);
                else fail(msg);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
}

if (errors.length) {
    console.error(`\n❌ Documentation consistency check FAILED — ${errors.length} error(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error(`\nSource of truth: ${STATUS_REL_PATH}`);
    process.exit(1);
} else {
    console.log(`\n✅ Documentation consistency check passed (${serverFiles.length} server files, ${docFiles.length} docs scanned).`);
}
