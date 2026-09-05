/**
 * @fileoverview Test Agent Learner — Re-Learn Phase utility.
 *
 * Before any test suite executes, the learner reads the source files
 * and documentation that are **scoped** to the component under test.
 * This ensures the Test Agent always understands the current implementation,
 * not a stale cached version.
 *
 * The returned context object is embedded in every test report so you can
 * see exactly what was read and when.
 *
 * @see docs/tests/README.md — Test Agent overview
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Scope definitions: each scope maps to the files the agent should read
 * before running those tests. Files are relative to the project root.
 *
 * @type {Record<string, string[]>}
 */
export const LEARN_SCOPES = {
    unit: [
        'server/robots/robot-orders.js',
        'server/robots/robot-crm.js',
        'server/robots/robot-catalog.js',
        'server/robots/robot-maintenance.js',
        'server/robots/robot-pista-db.js',
        'docs/assistant_team/db_robot_logic_tools.md',
        'docs/assistant_team/db_robot_code_structure.md',
    ],
    integration: [
        'server/routes.js',
        'server/robots/robot-crm.js',
        'server/robots/robot-catalog.js',
        'server/robots/robot-orders.js',
        'server/robots/robot-maintenance.js',
        'server/robots/robot-pista-db.js',
        'docs/architecture/api-routes.md',
        'docs/assistant_team/db_robot_logic_tools.md',
    ],
    e2e: [
        'server/routes.js',
        'server/robots/robot-crm.js',
        'server/robots/robot-catalog.js',
        'server/robots/robot-orders.js',
        'server/robots/robot-maintenance.js',
        'server/robots/robot-pista-db.js',
        'server/index.js',
        'docs/architecture/api-routes.md',
        'docs/assistant_team/db_robot_logic_tools.md',
        'docs/architecture/database-schema.md',
    ],
};

/**
 * Represents the content and metadata of a single learned file.
 *
 * @typedef {Object} LearnedFile
 * @property {string} path - Relative path from project root
 * @property {string} content - Full text content of the file
 * @property {number} sizeBytes - File size in bytes
 * @property {string} readAt - ISO timestamp when the file was read
 */

/**
 * Represents the full re-learn context returned for a test scope.
 *
 * @typedef {Object} LearnContext
 * @property {string} scope - The test scope ('unit' | 'integration' | 'e2e' | 'all')
 * @property {string} learnedAt - ISO timestamp for the entire learn phase
 * @property {LearnedFile[]} files - All successfully read files
 * @property {string[]} skipped - Files that could not be read (missing / permission error)
 */

/**
 * Runs the re-learn phase for a given test scope.
 *
 * Reads all relevant source and doc files scoped to the test type, returning
 * a structured context object. Files that are missing are logged but do not
 * cause a failure — they are listed in `context.skipped`.
 *
 * @param {string} scope - One of 'unit', 'integration', 'e2e', or 'all'
 * @param {string} projectRoot - Absolute path to the project root directory
 * @returns {Promise<LearnContext>} Structured learn context
 */
export const learn = async (scope, projectRoot) => {
    const learnedAt = new Date().toISOString();
    const filePaths = scope === 'all'
        ? [...new Set(Object.values(LEARN_SCOPES).flat())]
        : LEARN_SCOPES[scope] ?? [];

    const files = [];
    const skipped = [];

    for (const relPath of filePaths) {
        const absPath = resolve(projectRoot, relPath);
        try {
            const [content, stats] = await Promise.all([
                readFile(absPath, 'utf-8'),
                stat(absPath),
            ]);
            files.push({
                path: relPath,
                content,
                sizeBytes: stats.size,
                readAt: new Date().toISOString(),
            });
        } catch {
            skipped.push(relPath);
        }
    }

    return { scope, learnedAt, files, skipped };
};

/**
 * Formats a LearnContext into a human-readable markdown block for embedding
 * in test reports.
 *
 * @param {LearnContext} context
 * @returns {string} Markdown-formatted re-learn report section
 */
export const formatLearnReport = (context) => {
    const fileLines = context.files
        .map((f) => `  - \`${f.path}\` (${f.sizeBytes} bytes, read at ${f.readAt})`)
        .join('\n');
    const skippedLines = context.skipped.length
        ? context.skipped.map((p) => `  - \`${p}\` ⚠️ not found`).join('\n')
        : '  _(none)_';

    return [
        '## [RE-LEARN] Phase Report',
        `**Scope:** \`${context.scope}\`  `,
        `**Executed at:** ${context.learnedAt}`,
        '',
        '### Files Read',
        fileLines || '  _(none)_',
        '',
        '### Files Skipped',
        skippedLines,
    ].join('\n');
};
