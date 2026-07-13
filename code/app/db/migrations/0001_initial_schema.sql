-- =============================================================================
-- Migration: 0001_initial_schema
-- Project:   soli-turnly (Turnly)
-- Created:   2026-07-13
-- TSK:       TSK-002
-- Description: Initial schema — 10 tables, enums, indexes.
--              Requires PostgreSQL 16+.
-- =============================================================================

-- =============================================================================
-- === UP ===
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- btree_gist is required by migration 0002_exclude_gist.sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('admin', 'employee');

CREATE TYPE shift_status AS ENUM ('planned', 'confirmed', 'cancelled');

CREATE TYPE shift_origin AS ENUM ('manual', 'recurrence', 'swap');

CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE request_type AS ENUM (
  'absence',
  'shift_swap',
  'new_shift',
  'modify_shift'
);

CREATE TYPE request_status AS ENUM (
  'draft',
  'sent',
  'awaiting_colleague',
  'approved',
  'rejected',
  'cancelled',
  'applied'
);

CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'biweekly', 'monthly');

-- ---------------------------------------------------------------------------
-- Table 1: qualifications
-- ---------------------------------------------------------------------------

CREATE TABLE qualifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT '#6B7280',
  description TEXT
);

-- ---------------------------------------------------------------------------
-- Table 2: users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL,
  password_hash    TEXT        NOT NULL,
  role             user_role   NOT NULL DEFAULT 'employee',
  first_name       TEXT        NOT NULL,
  last_name        TEXT        NOT NULL,
  qualification_id UUID        REFERENCES qualifications(id) ON DELETE SET NULL,
  contract_hours   INTEGER     NOT NULL DEFAULT 36,
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_idx ON users (email);

-- ---------------------------------------------------------------------------
-- Table 3: shift_types
-- ---------------------------------------------------------------------------

CREATE TABLE shift_types (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT    NOT NULL,
  code                TEXT    NOT NULL,
  color               TEXT    NOT NULL DEFAULT '#6B7280',
  default_start_time  TIME    NOT NULL,
  default_end_time    TIME    NOT NULL,
  break_minutes       INTEGER NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX shift_types_code_idx ON shift_types (code);

-- ---------------------------------------------------------------------------
-- Table 4: shifts
-- NOTE: EXCLUDE USING gist constraint for RB-01 / T-INT-02 overlap prevention
--       is added in migration 0002_exclude_gist.sql.
-- ---------------------------------------------------------------------------

CREATE TABLE shifts (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_type_id UUID          REFERENCES shift_types(id) ON DELETE SET NULL,
  date          DATE          NOT NULL,
  start_dt      TIMESTAMPTZ   NOT NULL,
  end_dt        TIMESTAMPTZ   NOT NULL,
  notes         TEXT,
  origin        shift_origin  NOT NULL DEFAULT 'manual',
  status        shift_status  NOT NULL DEFAULT 'planned',
  created_by    UUID          NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT shifts_start_before_end CHECK (start_dt < end_dt)
);

-- Supporting indexes (EXCLUDE gist in 0002 covers overlap; these cover list queries)
CREATE INDEX shifts_user_date_idx     ON shifts (user_id, date);
CREATE INDEX shifts_user_start_end_idx ON shifts (user_id, start_dt, end_dt);

-- ---------------------------------------------------------------------------
-- Table 5: absence_types
-- ---------------------------------------------------------------------------

CREATE TABLE absence_types (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT    NOT NULL,
  code              TEXT    NOT NULL,
  paid_leave        BOOLEAN NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX absence_types_code_idx ON absence_types (code);

-- ---------------------------------------------------------------------------
-- Table 6: absences
-- ---------------------------------------------------------------------------

CREATE TABLE absences (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_type_id UUID           NOT NULL REFERENCES absence_types(id),
  start_date      DATE           NOT NULL,
  end_date        DATE           NOT NULL,
  status          absence_status NOT NULL DEFAULT 'pending',
  requested_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  approved_by     UUID           REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  notes           TEXT,

  CONSTRAINT absences_start_lte_end CHECK (start_date <= end_date)
);

CREATE INDEX absences_user_status_idx ON absences (user_id, status);

-- ---------------------------------------------------------------------------
-- Table 7: requests
-- ---------------------------------------------------------------------------

CREATE TABLE requests (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           request_type   NOT NULL,
  status         request_status NOT NULL DEFAULT 'draft',
  payload        JSONB,
  submitted_at   TIMESTAMPTZ,
  resolved_by    UUID           REFERENCES users(id),
  resolved_at    TIMESTAMPTZ,
  resolved_notes TEXT
);

CREATE INDEX requests_user_status_idx ON requests (user_id, status);

-- ---------------------------------------------------------------------------
-- Table 8: recurrences
-- ---------------------------------------------------------------------------

CREATE TABLE recurrences (
  id            UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_type_id UUID                 NOT NULL REFERENCES shift_types(id),
  start_date    DATE                 NOT NULL,
  end_date      DATE,
  frequency     recurrence_frequency NOT NULL DEFAULT 'weekly',
  -- days_of_week: integer array, values 0 (Sunday) .. 6 (Saturday)
  days_of_week  INTEGER[]            NOT NULL,
  active        BOOLEAN              NOT NULL DEFAULT TRUE,
  created_by    UUID                 NOT NULL REFERENCES users(id),

  CONSTRAINT recurrences_start_lte_end CHECK (
    end_date IS NULL OR start_date <= end_date
  )
);

-- ---------------------------------------------------------------------------
-- Table 9: notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  body                TEXT        NOT NULL,
  read_at             TIMESTAMPTZ,
  related_entity_type TEXT,
  related_entity_id   UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inbox counter query: SELECT COUNT(*) WHERE user_id = ? AND read_at IS NULL
CREATE INDEX notifications_user_read_idx ON notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- Table 10: audit_logs
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT        NOT NULL,
  before      JSONB,
  after       JSONB,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_actor_idx      ON audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx     ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);


-- =============================================================================
-- === DOWN ===
-- =============================================================================

-- Drop in reverse dependency order to avoid FK violations
--
-- DROP TABLE IF EXISTS audit_logs;
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS recurrences;
-- DROP TABLE IF EXISTS requests;
-- DROP TABLE IF EXISTS absences;
-- DROP TABLE IF EXISTS absence_types;
-- DROP TABLE IF EXISTS shifts;
-- DROP TABLE IF EXISTS shift_types;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS qualifications;
--
-- DROP TYPE IF EXISTS recurrence_frequency;
-- DROP TYPE IF EXISTS request_status;
-- DROP TYPE IF EXISTS request_type;
-- DROP TYPE IF EXISTS absence_status;
-- DROP TYPE IF EXISTS shift_origin;
-- DROP TYPE IF EXISTS shift_status;
-- DROP TYPE IF EXISTS user_role;
