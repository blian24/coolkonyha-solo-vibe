# Module: index.js
**Responsibility:** Configures and bootstraps the Express HTTP server, static asset middleware, and REST API routes.
**Location:** `server/index.js`
**Depends on:** `express`, `cors`, `body-parser`, `url`, `path`, `server/routes.js`
**Consumed by:** None (application runtime entry point started via npm/node)

## Exports
| Name | Type | Description |
|------|------|-------------|
| *(none)* | script | Executes server bootstrap and listens on port 3001 |

## Key Concepts
- Serves static assets from root `public/` and design mockups from `ui_design/`.
- Mounts all application API endpoints under the `/api` route prefix.
- Minimal startup error handler logs connection errors and exits with code 1.

## What is NOT here
- API route definitions and endpoint handlers — see `server/routes.js`.
- Database connection lifecycle — see `server/db.js`.
- AI initialization and email processing — see `server/pista.js` and `server/robots/email-robot.js`.
