/**
 * lib/zod/index.ts — Schema Zod condivisi FE + BE (TSK-004).
 *
 * Tutti i messaggi di errore sono in italiano per coerenza con la UI.
 * Gli stessi schemi sono importati dai Route Handlers e dai form React Hook Form.
 *
 * Indice:
 *  - shiftCreateSchema / shiftPatchSchema
 *  - shiftTypeCreateSchema / shiftTypePatchSchema
 *  - requestCreateSchema / requestPatchSchema / resolveRequestSchema
 *  - acceptSwapSchema
 *  - userPatchSchema (solo campi consentiti — RB-13, T-SEC-04)
 *  - absenceCreateSchema
 *  - swapCreateSchema (admin direct swap)
 *  - coverageSchema
 *  - adminUserCreateSchema / adminUserPatchSchema
 */

import { z } from 'zod';

// =============================================================
// Helpers riusabili
// =============================================================

const uuidField = (label: string) =>
  z.string().uuid(`${label}: UUID non valido`);

const dateField = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Formato data non valido — atteso YYYY-MM-DD',
);

const isoDatetimeField = (label: string) =>
  z
    .string()
    .datetime({ offset: true, message: `${label}: formato ISO 8601 non valido` });

// =============================================================
// Shift schemas
// =============================================================

/**
 * shiftCreateSchema — POST /api/shifts (admin only).
 * Il campo `createdBy` è impostato dal server (session.user.id).
 */
export const shiftCreateSchema = z
  .object({
    userId: uuidField('userId'),
    shiftTypeId: uuidField('shiftTypeId').optional().nullable(),
    date: dateField,
    startDt: isoDatetimeField('startDt'),
    endDt: isoDatetimeField('endDt'),
    notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional().nullable(),
    status: z.enum(['planned', 'confirmed', 'cancelled']).default('planned'),
  })
  .refine((d) => new Date(d.startDt) < new Date(d.endDt), {
    message: 'startDt deve essere precedente a endDt',
    path: ['endDt'],
  });

export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;

/**
 * shiftPatchSchema — PATCH /api/shifts/[id] (admin only).
 * Tutti i campi opzionali; la validazione startDt < endDt si applica
 * solo se entrambi i campi sono presenti nel body.
 */
export const shiftPatchSchema = z
  .object({
    shiftTypeId: uuidField('shiftTypeId').optional().nullable(),
    date: dateField.optional(),
    startDt: isoDatetimeField('startDt').optional(),
    endDt: isoDatetimeField('endDt').optional(),
    notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional().nullable(),
    status: z.enum(['planned', 'confirmed', 'cancelled']).optional(),
  })
  .refine(
    (d) => {
      if (d.startDt && d.endDt) return new Date(d.startDt) < new Date(d.endDt);
      return true;
    },
    { message: 'startDt deve essere precedente a endDt', path: ['endDt'] },
  );

export type ShiftPatchInput = z.infer<typeof shiftPatchSchema>;

// =============================================================
// ShiftType schemas (admin)
// =============================================================

export const shiftTypeCreateSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio').max(100, 'Nome troppo lungo'),
  code: z
    .string()
    .min(1, 'Il codice è obbligatorio')
    .max(20, 'Codice troppo lungo')
    .toUpperCase(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Colore non valido — atteso #RRGGBB')
    .default('#6B7280'),
  defaultStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato orario non valido — atteso HH:MM'),
  defaultEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato orario non valido — atteso HH:MM'),
  breakMinutes: z
    .number()
    .int('I minuti di pausa devono essere un intero')
    .min(0, 'I minuti di pausa non possono essere negativi')
    .default(0),
  active: z.boolean().default(true),
});

export type ShiftTypeCreateInput = z.infer<typeof shiftTypeCreateSchema>;

export const shiftTypePatchSchema = shiftTypeCreateSchema.partial();
export type ShiftTypePatchInput = z.infer<typeof shiftTypePatchSchema>;

// =============================================================
// Request schemas
// =============================================================

/**
 * requestCreateSchema — POST /api/requests.
 * Il `payload` è jsonb libero; la struttura interna è validata in TSK-006.
 */
export const requestCreateSchema = z.object({
  type: z.enum(['absence', 'shift_swap', 'new_shift', 'modify_shift'], {
    errorMap: () => ({ message: 'Tipo richiesta non valido' }),
  }),
  payload: z.record(z.unknown()).optional().nullable(),
});

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;

/**
 * requestPatchSchema — PATCH /api/requests/[id].
 * Usato per aggiornamenti parziali (es. aggiornare payload in bozza).
 */
export const requestPatchSchema = z.object({
  payload: z.record(z.unknown()).optional().nullable(),
  resolvedNotes: z
    .string()
    .max(1000, 'Note risoluzione troppo lunghe (max 1000 caratteri)')
    .optional()
    .nullable(),
});

export type RequestPatchInput = z.infer<typeof requestPatchSchema>;

/**
 * resolveRequestSchema — body per approve/reject.
 */
export const resolveRequestSchema = z.object({
  notes: z
    .string()
    .max(1000, 'Note troppo lunghe (max 1000 caratteri)')
    .optional()
    .nullable(),
});

export type ResolveRequestInput = z.infer<typeof resolveRequestSchema>;

/**
 * acceptSwapSchema — POST /api/requests/[id]/accept-swap.
 */
export const acceptSwapSchema = z.object({
  notes: z
    .string()
    .max(500, 'Note troppo lunghe (max 500 caratteri)')
    .optional()
    .nullable(),
});

export type AcceptSwapInput = z.infer<typeof acceptSwapSchema>;

// =============================================================
// User schemas
// =============================================================

/**
 * userPatchSchema — PATCH /api/users/me.
 *
 * Solo i campi consentiti al dipendente (RB-13, T-SEC-04).
 * Campi vietati (qualificationId, role, contractHours, active, email, passwordHash)
 * vengono bloccati a livello di Route Handler con 403 prima della parse.
 */
export const userPatchSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'Il nome è obbligatorio')
      .max(100, 'Nome troppo lungo (max 100 caratteri)')
      .optional(),
    lastName: z
      .string()
      .min(1, 'Il cognome è obbligatorio')
      .max(100, 'Cognome troppo lungo (max 100 caratteri)')
      .optional(),
  })
  .strict();

export type UserPatchInput = z.infer<typeof userPatchSchema>;

// =============================================================
// Admin user schemas
// =============================================================

export const adminUserCreateSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'La password deve essere di almeno 8 caratteri'),
  role: z.enum(['admin', 'employee']).default('employee'),
  firstName: z.string().min(1, 'Il nome è obbligatorio').max(100, 'Nome troppo lungo'),
  lastName: z.string().min(1, 'Il cognome è obbligatorio').max(100, 'Cognome troppo lungo'),
  qualificationId: uuidField('qualificationId').optional().nullable(),
  contractHours: z.number().int().min(1).max(60).default(36),
  active: z.boolean().default(true),
});

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;

export const adminUserPatchSchema = adminUserCreateSchema
  .omit({ password: true })
  .partial();

export type AdminUserPatchInput = z.infer<typeof adminUserPatchSchema>;

// =============================================================
// Absence schemas (admin)
// =============================================================

/**
 * absenceCreateSchema — POST /api/admin/absences.
 */
export const absenceCreateSchema = z
  .object({
    userId: uuidField('userId'),
    absenceTypeId: uuidField('absenceTypeId'),
    startDate: dateField,
    endDate: dateField,
    notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional().nullable(),
  })
  .refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
    message: 'startDate deve essere precedente o uguale a endDate',
    path: ['endDate'],
  });

export type AbsenceCreateInput = z.infer<typeof absenceCreateSchema>;

// =============================================================
// Swap schemas (admin direct swap)
// =============================================================

/**
 * swapCreateSchema — POST /api/admin/swap (scambio diretto admin).
 */
export const swapCreateSchema = z
  .object({
    shiftIdA: uuidField('shiftIdA'),
    shiftIdB: uuidField('shiftIdB'),
    notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional().nullable(),
  })
  .refine((d) => d.shiftIdA !== d.shiftIdB, {
    message: 'I due turni da scambiare devono essere diversi',
    path: ['shiftIdB'],
  });

export type SwapCreateInput = z.infer<typeof swapCreateSchema>;

// =============================================================
// Coverage schema (admin)
// =============================================================

/**
 * coverageSchema — POST /api/admin/coverage.
 */
export const coverageSchema = z.object({
  userId: uuidField('userId'),
  shiftId: uuidField('shiftId'),
  notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional().nullable(),
});

export type CoverageInput = z.infer<typeof coverageSchema>;
