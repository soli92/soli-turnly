/**
 * app/(admin)/matrix/page.tsx — Schermata matrice turni admin (Server Component).
 *
 * Fetcha dipendenti, turni, assenze e tipi turno dal database Drizzle
 * per il periodo richiesto, poi passa i dati serializzati al client
 * component ShiftGrid.
 *
 * Query param:
 *   ?week=YYYY-Www (default: settimana corrente, es. "2024-W28")
 *
 * Security:
 *   - requireAdmin() → redirect /login o /calendar se non admin
 *
 * Note sul passaggio dati Server→Client:
 *   - I campi Date (startDt, endDt) vengono serializzati come ISO string
 *     tramite .toISOString() prima di passarli al client.
 *   - I campi date (YYYY-MM-DD) sono già string in Drizzle.
 */

import type { Metadata } from 'next';
import { db } from '@/db';
import {
  users,
  qualifications,
  shifts as shiftsTable,
  shiftTypes as shiftTypesTable,
  absences as absencesTable,
  absenceTypes as absenceTypesTable,
} from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import {
  startOfISOWeek,
  endOfISOWeek,
  format,
  addDays,
  getISOWeek,
  getISOWeekYear,
} from 'date-fns';

import { requireAdmin } from '@/lib/auth';
import { ShiftGrid } from '@/components/matrix/ShiftGrid';
import type { EmployeeRow, ShiftRow, ShiftTypeRow, AbsenceRow } from '@/types';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Matrice Turni | Turnly Admin',
  description: 'Gestione turni dipendenti per settimana o mese.',
};

// ---------------------------------------------------------------------------
// Parse ISO week string
// ---------------------------------------------------------------------------

/**
 * Parsa "YYYY-Www" (ISO 8601 week) in un oggetto {start, end} Date.
 * Falls back alla settimana corrente se il formato non è valido.
 */
function parseISOWeekRange(weekStr: string): { start: Date; end: Date } {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const now = new Date();
    return {
      start: startOfISOWeek(now),
      end: endOfISOWeek(now),
    };
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Jan 4 è sempre nella settimana ISO 1 dell'anno
  const jan4 = new Date(year, 0, 4);
  const weekMonday = addDays(startOfISOWeek(jan4), (week - 1) * 7);

  return {
    start: weekMonday,
    end: endOfISOWeek(weekMonday),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface MatrixPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MatrixPage({ searchParams }: MatrixPageProps) {
  // Auth gate (RF-A CA2)
  await requireAdmin();

  // Resolve query params
  const params = await searchParams;
  const weekParam = (() => {
    if (typeof params.week === 'string') return params.week;
    const now = new Date();
    const year = getISOWeekYear(now);
    const week = getISOWeek(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  })();

  const { start: periodStart, end: periodEnd } = parseISOWeekRange(weekParam);

  const startDateStr = format(periodStart, 'yyyy-MM-dd');
  const endDateStr = format(periodEnd, 'yyyy-MM-dd');

  // -----------------------------------------------------------------------
  // Parallel DB queries
  // -----------------------------------------------------------------------

  const [employeesResult, shiftsResult, shiftTypesResult, absencesResult] =
    await Promise.all([
      // 1. Dipendenti attivi con qualifica
      db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          qualificationId: users.qualificationId,
          qualificationName: qualifications.name,
          qualificationColor: qualifications.color,
          contractHours: users.contractHours,
          active: users.active,
        })
        .from(users)
        .leftJoin(qualifications, eq(users.qualificationId, qualifications.id))
        .where(eq(users.active, true))
        .orderBy(users.lastName, users.firstName),

      // 2. Turni del periodo con tipo turno joinato
      db
        .select({
          id: shiftsTable.id,
          userId: shiftsTable.userId,
          shiftTypeId: shiftsTable.shiftTypeId,
          date: shiftsTable.date,
          startDt: shiftsTable.startDt,
          endDt: shiftsTable.endDt,
          notes: shiftsTable.notes,
          status: shiftsTable.status,
          shiftTypeName: shiftTypesTable.name,
          shiftTypeCode: shiftTypesTable.code,
          shiftTypeColor: shiftTypesTable.color,
        })
        .from(shiftsTable)
        .leftJoin(
          shiftTypesTable,
          eq(shiftsTable.shiftTypeId, shiftTypesTable.id),
        )
        .where(
          and(
            gte(shiftsTable.date, startDateStr),
            lte(shiftsTable.date, endDateStr),
          ),
        ),

      // 3. Tipi turno attivi per il Select nell'editor
      db
        .select({
          id: shiftTypesTable.id,
          name: shiftTypesTable.name,
          code: shiftTypesTable.code,
          color: shiftTypesTable.color,
          defaultStartTime: shiftTypesTable.defaultStartTime,
          defaultEndTime: shiftTypesTable.defaultEndTime,
          active: shiftTypesTable.active,
        })
        .from(shiftTypesTable)
        .where(eq(shiftTypesTable.active, true))
        .orderBy(shiftTypesTable.name),

      // 4. Assenze del periodo
      db
        .select({
          id: absencesTable.id,
          userId: absencesTable.userId,
          startDate: absencesTable.startDate,
          endDate: absencesTable.endDate,
          absenceTypeName: absenceTypesTable.name,
        })
        .from(absencesTable)
        .innerJoin(
          absenceTypesTable,
          eq(absencesTable.absenceTypeId, absenceTypesTable.id),
        )
        .where(
          and(
            eq(absencesTable.status, 'approved'),
            lte(absencesTable.startDate, endDateStr),
            gte(absencesTable.endDate, startDateStr),
          ),
        ),
    ]);

  // -----------------------------------------------------------------------
  // Serialize Date objects → ISO strings per Client Component
  // (Drizzle: timestamp with timezone → Date object)
  // -----------------------------------------------------------------------

  const employees: EmployeeRow[] = employeesResult;

  const shifts: ShiftRow[] = shiftsResult.map((s) => ({
    id: s.id,
    userId: s.userId,
    shiftTypeId: s.shiftTypeId,
    date: s.date,
    // startDt e endDt sono Date objects — serializza in ISO string
    startDt: s.startDt instanceof Date ? s.startDt.toISOString() : String(s.startDt),
    endDt: s.endDt instanceof Date ? s.endDt.toISOString() : String(s.endDt),
    notes: s.notes,
    status: s.status,
    shiftTypeName: s.shiftTypeName ?? null,
    shiftTypeCode: s.shiftTypeCode ?? null,
    shiftTypeColor: s.shiftTypeColor ?? null,
  }));

  const shiftTypes: ShiftTypeRow[] = shiftTypesResult;

  const absences: AbsenceRow[] = absencesResult.map((a) => ({
    id: a.id,
    userId: a.userId,
    startDate: a.startDate,
    endDate: a.endDate,
    absenceTypeName: a.absenceTypeName,
  }));

  // Qualifiche distinte dai dipendenti per il filtro
  const qualificationsForFilter = Array.from(
    new Map(
      employees
        .filter((e) => e.qualificationId && e.qualificationName)
        .map((e) => [
          e.qualificationId,
          { id: e.qualificationId!, name: e.qualificationName! },
        ]),
    ).values(),
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Matrice Turni</h1>
        <p className="text-sm text-gray-500">
          Gestione turni per il periodo{' '}
          <time dateTime={startDateStr}>{format(periodStart, 'dd/MM/yyyy')}</time>
          {' – '}
          <time dateTime={endDateStr}>{format(periodEnd, 'dd/MM/yyyy')}</time>
        </p>
      </div>

      <ShiftGrid
        employees={employees}
        initialShifts={shifts}
        absences={absences}
        shiftTypes={shiftTypes}
        initialWeek={weekParam}
        qualifications={qualificationsForFilter}
      />
    </div>
  );
}
