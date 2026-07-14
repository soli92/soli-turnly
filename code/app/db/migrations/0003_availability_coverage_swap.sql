-- =============================================================================
-- Migration: 0003_availability_coverage_swap
-- Project:   soli-turnly (Turnly)
-- Created:   2026-07-14
-- TSK:       TSK-013
-- Description: Add 3 missing tables from ADR-001 §Schema:
--                availability, coverage_requirements, swap_operations.
--              Closes gap G-003 (wiki/gaps.md).
--              Requires PostgreSQL 16+.
-- =============================================================================

-- =============================================================================
-- === UP ===
-- =============================================================================

-- ---------------------------------------------------------------------------
-- New enums
-- ---------------------------------------------------------------------------

CREATE TYPE availability_type AS ENUM ('available', 'unavailable', 'preference');

CREATE TYPE availability_scope AS ENUM ('recurring', 'date_range');

CREATE TYPE swap_origin AS ENUM ('admin', 'request');

-- ---------------------------------------------------------------------------
-- Table 11: availability
-- Stores employee availability windows.
--   recurring  → definition: { dayOfWeek: 0-6, startTime: "HH:mm", endTime: "HH:mm" }
--   date_range → definition: { startDate: ISO, endDate: ISO, startTime?: "HH:mm", endTime?: "HH:mm" }
-- ---------------------------------------------------------------------------

CREATE TABLE availability (
  id         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       availability_type  NOT NULL,
  scope      availability_scope NOT NULL,
  definition JSONB              NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX availability_user_idx ON availability (user_id);

-- ---------------------------------------------------------------------------
-- Table 12: coverage_requirements
-- Minimum staffing rules per qualification, shift type, and day of week.
-- shift_type_id NULL  → applies to any shift type
-- day_of_week   NULL  → applies to all days (0 = Sunday … 6 = Saturday)
-- ---------------------------------------------------------------------------

CREATE TABLE coverage_requirements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID        NOT NULL REFERENCES qualifications(id),
  shift_type_id    UUID        REFERENCES shift_types(id),
  day_of_week      INTEGER,
  minimum_count    INTEGER     NOT NULL DEFAULT 1,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT coverage_day_of_week_check
    CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6)
);

CREATE INDEX coverage_qual_idx ON coverage_requirements (qualification_id);

-- ---------------------------------------------------------------------------
-- Table 13: swap_operations
-- Audit trail of every shift-swap execution (admin-initiated or from a request).
-- validation_outcome: { blocking: [], warnings: [] }
-- ---------------------------------------------------------------------------

CREATE TABLE swap_operations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_a_id         UUID        NOT NULL REFERENCES shifts(id),
  shift_b_id         UUID        NOT NULL REFERENCES shifts(id),
  origin             swap_origin NOT NULL,
  request_id         UUID        REFERENCES requests(id),
  admin_id           UUID        REFERENCES users(id),
  validation_outcome JSONB,
  reason             TEXT,
  executed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- === DOWN ===
-- =============================================================================

-- Drop in reverse dependency order to avoid FK violations.
--
-- DROP TABLE IF EXISTS swap_operations;
-- DROP TABLE IF EXISTS coverage_requirements;
-- DROP TABLE IF EXISTS availability;
--
-- DROP TYPE IF EXISTS swap_origin;
-- DROP TYPE IF EXISTS availability_scope;
-- DROP TYPE IF EXISTS availability_type;
