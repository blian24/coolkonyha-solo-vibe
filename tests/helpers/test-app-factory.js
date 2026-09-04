/**
 * @fileoverview Test App Factory — Creates an isolated Express app for integration/E2E testing.
 *
 * Mounts the real server/routes.js router directly (which itself imports the
 * real server/robots/*.js modules), bound to a random port. Because
 * server/db.js is switched to ':memory:' for the whole test-file process
 * (see tests/run-tests.js and tests/helpers/sandbox-db.js), this exercises
 * the exact same code path production traffic does, without ever touching
 * coolkonyha.db.
 *
 * Previously this factory hand-mirrored every route against an injected
 * test agent instead of importing server/routes.js — see
 * docs/.notes/future-ideas.md i-2 (now resolved) for why that was replaced.
 *
 * @see server/routes.js — Route definitions (the real ones, mounted as-is)
 * @see server/index.js — Production server entry point
 * @see docs/architecture/api-routes.md — API contract
 */

import express from 'express';
import bodyParser from 'body-parser';
import routes from '../../server/routes.js';

/**
 * Creates and starts an isolated Express server bound to a random port,
 * running the real API routes against the in-memory sandbox DB.
 *
 * @returns {Promise<{baseUrl: string, teardown: () => Promise<void>}>}
 */
export const createTestServer = () => new Promise((resolve) => {
    const app = express();
    app.use(bodyParser.json());
    app.use('/api', routes);

    // Port 0 binds to a random available port — avoids port conflicts in CI
    const server = app.listen(0, () => {
        const { port } = server.address();
        const baseUrl = `http://localhost:${port}`;
        const teardown = () => new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
        });
        resolve({ baseUrl, teardown });
    });
});
