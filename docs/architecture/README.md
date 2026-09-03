# Architecture Documentation

This folder contains comprehensive architecture documentation for Coolkonyha Solo Vibe's system design.

## Contents

- [Module Map](./module-map/index.md) - Living module map & dependency graph (primary navigation entry point for current code structure)
- [Database Robot](../assistant_team/database-robot.md) - Data access layer and business rules
- [API Routes](./api-routes.md) - REST API endpoints
- [Database Schema](./database-schema.md) - Database design and relationships
- [Database Connection](./database-connection.md) - Connection management

## Documentation Standards

All files in this directory follow the 4-part structure:
1. Purpose
2. Architecture/Flow (with Mermaid diagrams)
3. Input/Output Specifications
4. Security Considerations

## Maintenance

When updating code in `server/`, update corresponding architecture documentation to maintain traceability.
