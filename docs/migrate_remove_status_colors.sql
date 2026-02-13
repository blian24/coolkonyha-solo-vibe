-- Migration: Remove status_color column from business_status_workflow table
-- This migration removes the status_color column as colors are now handled by CSS classes
-- Run this against your existing database to update the schema

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- Step 1: Create new table without status_color column
CREATE TABLE business_status_workflow_new (
    status_id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_skippable BOOLEAN DEFAULT FALSE
);

-- Step 2: Copy data from old table to new table
INSERT INTO business_status_workflow_new (status_id, status_key, display_name, description, is_skippable)
SELECT status_id, status_key, display_name, description, is_skippable
FROM business_status_workflow;

-- Step 3: Drop old table
DROP TABLE business_status_workflow;

-- Step 4: Rename new table to original name
ALTER TABLE business_status_workflow_new RENAME TO business_status_workflow;
