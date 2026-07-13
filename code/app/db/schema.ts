/**
 * TSK-002 — Schema Drizzle ORM completo (10 tabelle)
 * Stack: Drizzle ORM + PostgreSQL 16
 *
 * Tabelle:
 *   qualifications, users, shift_types, shifts,
 *   absence_types, absences, requests, recurrences,
 *   notifications, audit_logs
 *
 * Indici critici:
 *   - shifts: EXCLUDE USING gist (userId, tstzrange(startDt, endDt)) — RB-01/T-INT-02
 *             (definito in migration 0002_exclude_gist.sql — richiede btree_gist)
 *   - notifications: (userId, readAt) — inbox counter O(1)
 *   - requests: (userId, status) — coda approvazioni + lista dipendente
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  time,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum('user_role', ['admin', 'employee']);

export const shiftStatusEnum = pgEnum('shift_status', [
  'planned',
  'confirmed',
  'cancelled',
]);

export const shiftOriginEnum = pgEnum('shift_origin', [
  'manual',
  'recurrence',
  'swap',
]);

export const absenceStatusEnum = pgEnum('absence_status', [
  'pending',
  'approved',
  'rejected',
]);

export const requestTypeEnum = pgEnum('request_type', [
  'absence',
  'shift_swap',
  'new_shift',
  'modify_shift',
]);

export const requestStatusEnum = pgEnum('request_status', [
  'draft',
  'sent',
  'awaiting_colleague',
  'approved',
  'rejected',
  'cancelled',
  'applied',
]);

export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
  'weekly',
  'biweekly',
  'monthly',
]);

// ---------------------------------------------------------------------------
// Table 1: qualifications
// ---------------------------------------------------------------------------

export const qualifications = pgTable('qualifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6B7280'),
  description: text('description'),
});

// ---------------------------------------------------------------------------
// Table 2: users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('employee'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    qualificationId: uuid('qualification_id').references(
      () => qualifications.id,
      { onDelete: 'set null' },
    ),
    contractHours: integer('contract_hours').notNull().default(36),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

// ---------------------------------------------------------------------------
// Table 3: shift_types
// ---------------------------------------------------------------------------

export const shiftTypes = pgTable(
  'shift_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    color: text('color').notNull().default('#6B7280'),
    defaultStartTime: time('default_start_time').notNull(),
    defaultEndTime: time('default_end_time').notNull(),
    breakMinutes: integer('break_minutes').notNull().default(0),
    active: boolean('active').notNull().default(true),
  },
  (t) => ({
    codeIdx: uniqueIndex('shift_types_code_idx').on(t.code),
  }),
);

// ---------------------------------------------------------------------------
// Table 4: shifts
// NOTE: EXCLUDE USING gist constraint (RB-01 / T-INT-02) is applied in
//       migration 0002_exclude_gist.sql because Drizzle does not yet
//       support custom EXCLUDE constraints in the schema DSL.
//       Requires extension btree_gist (enabled in 0001_initial_schema.sql).
// ---------------------------------------------------------------------------

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shiftTypeId: uuid('shift_type_id').references(() => shiftTypes.id, {
      onDelete: 'set null',
    }),
    date: date('date').notNull(),
    startDt: timestamp('start_dt', { withTimezone: true }).notNull(),
    endDt: timestamp('end_dt', { withTimezone: true }).notNull(),
    notes: text('notes'),
    origin: shiftOriginEnum('origin').notNull().default('manual'),
    status: shiftStatusEnum('status').notNull().default('planned'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index('shifts_user_date_idx').on(t.userId, t.date),
    userStartEndIdx: index('shifts_user_start_end_idx').on(
      t.userId,
      t.startDt,
      t.endDt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Table 5: absence_types
// ---------------------------------------------------------------------------

export const absenceTypes = pgTable(
  'absence_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    paidLeave: boolean('paid_leave').notNull().default(true),
    requiresApproval: boolean('requires_approval').notNull().default(true),
  },
  (t) => ({
    codeIdx: uniqueIndex('absence_types_code_idx').on(t.code),
  }),
);

// ---------------------------------------------------------------------------
// Table 6: absences
// ---------------------------------------------------------------------------

export const absences = pgTable(
  'absences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    absenceTypeId: uuid('absence_type_id')
      .notNull()
      .references(() => absenceTypes.id),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: absenceStatusEnum('status').notNull().default('pending'),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => ({
    userStatusIdx: index('absences_user_status_idx').on(t.userId, t.status),
  }),
);

// ---------------------------------------------------------------------------
// Table 7: requests
// ---------------------------------------------------------------------------

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: requestTypeEnum('type').notNull(),
    status: requestStatusEnum('status').notNull().default('draft'),
    payload: jsonb('payload'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedNotes: text('resolved_notes'),
  },
  (t) => ({
    userStatusIdx: index('requests_user_status_idx').on(t.userId, t.status),
  }),
);

// ---------------------------------------------------------------------------
// Table 8: recurrences
// ---------------------------------------------------------------------------

export const recurrences = pgTable('recurrences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  shiftTypeId: uuid('shift_type_id')
    .notNull()
    .references(() => shiftTypes.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  frequency: recurrenceFrequencyEnum('frequency').notNull().default('weekly'),
  // PostgreSQL INTEGER[] — days 0=Sunday..6=Saturday (ISO: 1=Monday..7=Sunday)
  daysOfWeek: integer('days_of_week').array().notNull(),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
});

// ---------------------------------------------------------------------------
// Table 9: notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: uuid('related_entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Inbox counter O(1): count WHERE user_id = ? AND read_at IS NULL
    userReadIdx: index('notifications_user_read_idx').on(t.userId, t.readAt),
  }),
);

// ---------------------------------------------------------------------------
// Table 10: audit_logs
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    actorIdx: index('audit_logs_actor_idx').on(t.actorId),
    entityIdx: index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Type exports (inferred from schema)
// ---------------------------------------------------------------------------

export type Qualification = typeof qualifications.$inferSelect;
export type NewQualification = typeof qualifications.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ShiftType = typeof shiftTypes.$inferSelect;
export type NewShiftType = typeof shiftTypes.$inferInsert;

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;

export type AbsenceType = typeof absenceTypes.$inferSelect;
export type NewAbsenceType = typeof absenceTypes.$inferInsert;

export type Absence = typeof absences.$inferSelect;
export type NewAbsence = typeof absences.$inferInsert;

export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;

export type Recurrence = typeof recurrences.$inferSelect;
export type NewRecurrence = typeof recurrences.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
