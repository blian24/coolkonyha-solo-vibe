# Test Agent — Documentation

**Location:** `tests/`  
**Version:** 1.0.0

## 1. Purpose

The Test Agent provides automated unit, integration, and E2E testing for the Coolkonyha system. It runs in complete isolation using an in-memory SQLite sandbox — the production `coolkonyha.db` is never opened during tests.

Before each test run, the agent performs a **Re-Learn Phase**: it reads the current source code and documentation for the components under test, ensuring tests always reflect the actual implementation.

## 2. Architecture / Flow

```mermaid
flowchart TD
    CLI([npm test / npm run test:unit]) --> Runner[tests/run-tests.js]
    Runner --> EnvVar[Sets DB_PATH=':memory:']
    Runner --> Learn[Re-Learn Phase\nlearner.js]
    Learn --> SrcFiles[Reads: server/robots/*.js\ndocs/assistant_team/*.md\ndocs/architecture/*.md]
    Runner --> Suites{Test Scope\none child process per file}
    Suites --> Unit[Unit Tests\ntests/unit/]
    Suites --> Integration[Integration Tests\ntests/integration/]
    Suites --> E2E[E2E Tests\ntests/e2e/]
    Unit & Integration & E2E --> RealRobots[Real server/robots/*.js\n+ server/routes.js]
    RealRobots --> SharedDb[server/db.js\nin-memory, seeded from\ndocs/setup_complete_db.sql]
    SandboxDb[tests/helpers/sandbox-db.js\npromise wrapper + reset] --> SharedDb
    SharedDb -.->|Never touches| ProdDb[(coolkonyha.db)]
    Runner --> Report[docs/tests/reports/run-*.md]
```

## 3. How to Run

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e
```

Each run prints a summary table to stdout and saves a timestamped report to `docs/tests/reports/`.

## 4. Folder Structure

```
tests/
├── helpers/
│   ├── learner.js          # Re-Learn Phase — reads scoped source + docs
│   ├── sandbox-db.js       # Promise wrapper + reset around the real,
│   │                       # in-memory server/db.js connection
│   ├── fixtures.js         # Deterministic seed data factories
│   └── test-app-factory.js # Mounts the real server/routes.js for HTTP tests
├── unit/
│   ├── agent.unit.test.js       # Orders/CRM/Catalog robot business logic tests
│   ├── maintenance.unit.test.js # Maintenance robot business logic tests
│   └── pista-db.unit.test.js    # PISTA DB robot tests (excludes chat-log
│                                 # functions — see docs/.notes/bugs.md b-8)
├── integration/
│   └── routes.integration.test.js  # REST API HTTP contract tests
├── e2e/
│   └── order-lifecycle.e2e.test.js # Full order lifecycle test
└── run-tests.js            # Test Agent orchestrator / reporter — sets
                             # DB_PATH=':memory:' before spawning test files
```

## 5. Re-Learn Scopes

| Scope | Files Read Before Test |
|---|---|
| `unit` | `server/robots/robot-orders.js`, `robot-crm.js`, `robot-catalog.js`, `robot-maintenance.js`, `robot-pista-db.js`, `docs/assistant_team/db_robot_logic_tools.md`, `docs/assistant_team/db_robot_code_structure.md` |
| `integration` | `server/routes.js`, all files under `server/robots/`, `docs/architecture/api-routes.md`, `docs/assistant_team/db_robot_logic_tools.md` |
| `e2e` | All of the above + `server/index.js`, `docs/architecture/database-schema.md` |
| `all` | Union of all scopes |

All three scopes now exercise the real functions in `server/robots/` (and, for integration/E2E, the real `server/routes.js`) directly — there is no hand-maintained mirror anymore. See `docs/assistant_team/db_robot_code_structure.md` for how this was resolved (previously `docs/.notes/future-ideas.md` i-2).

## 6. Test Reports

Every run generates `docs/tests/reports/run-<ISO-timestamp>.md` containing:
- Pass/fail/skip counts
- A list of failed test names and their errors
- The full **Re-Learn Phase manifest** (which files were read and when)

## 7. Security Considerations

- **Sandbox isolation:** `tests/run-tests.js` sets `DB_PATH=':memory:'` before spawning any test file (each runs as its own child process, inheriting that env var), and `tests/helpers/sandbox-db.js` sets it defensively too, so `server/db.js` — the same connection production code uses — is switched to an in-memory database seeded from `docs/setup_complete_db.sql`. The production `coolkonyha.db` file is never opened during a test run.
- **Random ports:** Integration and E2E tests bind Express to port `0` (OS-assigned random port) so they never conflict with the production server on port 3001.
- **Read-only re-learn:** The learner only reads files; it never writes outside of `docs/tests/reports/`.

---

*See also:*
- [unit-tests.md](./unit-tests.md) (Orders/CRM/Catalog)
- [maintenance-unit-tests.md](./maintenance-unit-tests.md)
- [pista-db-unit-tests.md](./pista-db-unit-tests.md)
- [integration-tests.md](./integration-tests.md)
- [e2e-tests.md](./e2e-tests.md)
