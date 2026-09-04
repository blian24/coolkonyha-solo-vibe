# Bugs

Informal, running backlog of suspected/confirmed defects — not authoritative, not tracked/committed work. Filled in automatically as issues surface during sessions. Format: `b-<number>-<priority>`. When one is ready to actually be worked on, promote it to a ClickUp ticket (per the usual workflow) and remove it from here.

**Next ID:** 8

**Priority levels** (lowest → highest): Maintenance, Relevant, Critical, Nuclear — full definitions in `~/.claude/CLAUDE.md` §8.6.

## From the 2026-09-04 ESLint pass

- **b-4-maintenance — Minor cosmetic lint findings.** A handful of unused `catch (e)` variables in `dataService.js`/`maintenanceController.js`, a few lines over the 100-char limit, one unnecessary regex escape character in `dashboardController.js`. No functional impact.
