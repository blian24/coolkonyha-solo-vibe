/**
 * @fileoverview Maintenance Agent — Maintenance case data access layer for Coolkonyha.
 *
 * Single responsibility: all read and write operations on the maintenance domain:
 * `maintenance_cases`, `maintenance_items`, `maintenance_status_history`,
 * and `maintenance_status_workflow`.
 *
 * Business rules enforced (mirror of the Orders domain):
 * - **Dual-Write Status:** Maintenance status updates atomically write to both
 *   `maintenance_cases` (current state) and `maintenance_status_history` (audit log).
 *
 * Depends on: server/db.js (shared SQLite connection singleton)
 * Consumed by: server/routes.js
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Dual-Write rule
 * @see docs/architecture/database-schema.md — maintenance tables schema
 * @author Coolkonyha Development Team
 * @version 0.8.0
 */

import db from '../db.js';

// ---------------------------------------------------------------------------
// Helpers — promisified wrappers around the sqlite3 callback API
// ---------------------------------------------------------------------------

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

// ---------------------------------------------------------------------------
// Maintenance — Workflow
// ---------------------------------------------------------------------------

/**
 * Returns all valid maintenance workflow statuses.
 * @returns {Promise<Array>}
 */
export const getMaintenanceWorkflowStatuses = () =>
  all('SELECT * FROM maintenance_status_workflow ORDER BY status_id');

// ---------------------------------------------------------------------------
// Maintenance — Read operations
// ---------------------------------------------------------------------------

/**
 * Returns all maintenance cases with customer name for list views.
 * @returns {Promise<Array>}
 */
export const getMaintenanceCases = () =>
  all(
    `SELECT mc.*, c.cust_name, c.logo_path
     FROM maintenance_cases mc
     JOIN customers c ON mc.cust_id = c.cust_id
     ORDER BY mc.case_date DESC`
  );

/**
 * Retrieves full details of a single maintenance case including items and history.
 *
 * @param {number} caseId - Maintenance case ID
 * @returns {Promise<{case: Object, items: Array, history: Array}>}
 */
export const getMaintenanceDetails = async (caseId) => {
  const maintenanceCase = await get(
    `SELECT mc.*, c.cust_name, c.logo_path
     FROM maintenance_cases mc
     JOIN customers c ON mc.cust_id = c.cust_id
     WHERE mc.case_id = ?`,
    [caseId]
  );

  const items = await all(
    `SELECT mi.*, p.prod_name, p.prod_type
     FROM maintenance_items mi
     JOIN products p ON mi.prod_id = p.prod_id
     WHERE mi.case_id = ?`,
    [caseId]
  );

  const history = await all(
    'SELECT * FROM maintenance_status_history WHERE case_id = ? ORDER BY update_date DESC',
    [caseId]
  );

  return { case: maintenanceCase, items, history };
};

// ---------------------------------------------------------------------------
// Maintenance — Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a new maintenance case with initial NEW status.
 *
 * Implements the Dual-Write pattern: inserts a row into maintenance_cases
 * and immediately logs the initial status to maintenance_status_history.
 *
 * @param {number} custId - Customer ID (from customers table)
 * @param {string} [description] - Freetext description of the reported issue
 * @returns {Promise<{caseId: number, caseCode: string}>}
 * @throws {Error} When transaction fails
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Dual-Write rule
 */
export const createMaintenanceCase = async (custId, description = null) => {
  try {
    await run('BEGIN TRANSACTION');

    const result = await run(
      `INSERT INTO maintenance_cases (cust_id, current_status, description, update_event)
       VALUES (?, 'NEW', ?, 'Maintenance case created via API')`,
      [custId, description]
    );

    // Generate case_code (MAINT + 5-digit ID)
    const caseCode = `MAINT-${String(result.lastID).padStart(5, '0')}`;
    await run(
      'UPDATE maintenance_cases SET case_code = ? WHERE case_id = ?',
      [caseCode, result.lastID]
    );

    // Initial status history — Dual-Write rule
    await run(
      `INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by)
       VALUES (?, 'NEW', 'Case Initialized', 'SYSTEM')`,
      [result.lastID]
    );

    await run('COMMIT');
    return { caseId: result.lastID, caseCode };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

/**
 * Adds a product item to a maintenance case.
 *
 * @param {number} caseId - Maintenance case ID
 * @param {number} prodId - Product ID (from products table)
 * @param {number} quantity - Number of units
 * @param {string} [issueNote] - Optional freetext note describing the issue
 * @returns {Promise<{id: number}>} Created item ID
 * @throws {Error} When product not found or transaction fails
 */
export const addMaintenanceItem = async (caseId, prodId, quantity, issueNote = null) => {
  const product = await get('SELECT prod_id FROM products WHERE prod_id = ?', [prodId]);
  if (!product) throw new Error('Product not found');

  try {
    await run('BEGIN TRANSACTION');

    const result = await run(
      `INSERT INTO maintenance_items (case_id, prod_id, quantity, issue_note) VALUES (?, ?, ?, ?)`,
      [caseId, prodId, quantity, issueNote]
    );

    await run('COMMIT');
    return { id: result.lastID };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

// ---------------------------------------------------------
// RULE: Dual-Write for Maintenance Status
// See docs/assistant_team/db_robot_logic_tools.md Section 2
// ---------------------------------------------------------
/**
 * Updates the status of a maintenance case with Dual-Write pattern.
 *
 * Validates the new status against maintenance_status_workflow, then atomically
 * updates maintenance_cases.current_status and appends to maintenance_status_history.
 *
 * @param {number} caseId - Maintenance case ID
 * @param {string} newStatus - Status key from maintenance_status_workflow table
 * @param {string} performedBy - Actor identifier (e.g., 'admin', 'SYSTEM')
 * @param {string} eventDescription - Human-readable event description
 * @returns {Promise<{success: boolean, newStatus: string}>}
 * @throws {Error} When status is invalid or transaction fails
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Dual-Write rule
 */
export const updateMaintenanceStatus = async (caseId, newStatus, performedBy, eventDescription) => {
  // Validate status against the maintenance-specific workflow table
  const statusDef = await get(
    'SELECT * FROM maintenance_status_workflow WHERE status_key = ?',
    [newStatus]
  );
  if (!statusDef) throw new Error(`Invalid maintenance status: ${newStatus}`);

  try {
    await run('BEGIN TRANSACTION');

    // Update current state on the case row
    await run(
      `UPDATE maintenance_cases
       SET current_status = ?,
           current_status_update = CURRENT_TIMESTAMP,
           update_event = ?
       WHERE case_id = ?`,
      [newStatus, eventDescription, caseId]
    );

    // Append to audit history — Dual-Write rule
    await run(
      `INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by)
       VALUES (?, ?, ?, ?)`,
      [caseId, newStatus, eventDescription, performedBy]
    );

    await run('COMMIT');
    return { success: true, newStatus };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Maintenance — Database viewer getters (added v0.7.0)
// ---------------------------------------------------------------------------

/**
 * Returns all maintenance items joined with product name and case code.
 * Used by the database viewer UI.
 *
 * @returns {Promise<Array>}
 */
export const getAllMaintenanceItems = () =>
  all(
    `SELECT mi.*, p.prod_name, mc.case_code
     FROM maintenance_items mi
     JOIN products p ON mi.prod_id = p.prod_id
     JOIN maintenance_cases mc ON mi.case_id = mc.case_id
     ORDER BY mc.case_code, mi.item_id`
  );

/**
 * Returns the full maintenance status history joined with case codes.
 * Used by the database viewer UI.
 *
 * @returns {Promise<Array>}
 */
export const getAllMaintenanceHistory = () =>
  all(
    `SELECT msh.*, mc.case_code
     FROM maintenance_status_history msh
     JOIN maintenance_cases mc ON msh.case_id = mc.case_id
     ORDER BY msh.update_date DESC`
  );
