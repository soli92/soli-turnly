-- =============================================================================
-- Migration: 0002_exclude_gist
-- Project:   soli-turnly (Turnly)
-- Created:   2026-07-13
-- TSK:       TSK-002 (T-INT-02, RB-01)
-- Description: EXCLUDE USING gist constraint on shifts to enforce at DB level
--              that the same user cannot have overlapping shifts.
--
-- Prerequisite: extension btree_gist must be enabled (done in 0001).
--
-- The constraint uses tstzrange (timestamptz range) with '[)' semantics:
--   - '[)' = inclusive lower bound, exclusive upper bound
--   - This means a shift ending exactly when another starts is allowed (no gap
--     required between consecutive shifts, which is the correct business rule).
--
-- Violation: PostgreSQL raises SQLSTATE 23P01 (exclusion_violation).
-- The application layer must catch this and surface a RB-01 conflict response.
-- =============================================================================

-- =============================================================================
-- === UP ===
-- =============================================================================

-- Ensure btree_gist is available (idempotent)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(start_dt, end_dt, '[)') WITH &&
  );


-- =============================================================================
-- === DOWN ===
-- =============================================================================

-- ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_no_overlap;
