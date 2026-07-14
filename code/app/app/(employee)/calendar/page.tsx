import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { and, eq, gte, lte } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, shiftTypes } from '@/db/schema';
import { EmployeeCalendar } from '@/components/employee/calendar/EmployeeCalendar';
import type { ShiftRow } from '@/types';

export const metadata: Metadata = {
  title: 'Calendario Turni',
  description: 'Visualizza e gestisci i tuoi turni in calendario',
};

/**
 * app/(employee)/calendar/page.tsx — RSC: fetch turni dipendente autenticato.
 *
 * Sicurezza (T-SEC-01/02):
 *   - Verifica sessione: utente non autenticato → redirect /login
 *   - Query Drizzle filtra SEMPRE per userId = session.user.id
 *   - L'ID utente viene dal token JWT, NON dai parametri URL (nessun IDOR)
 *
 * Pattern RSC → Client:
 *   - L'RSC esegue il fetch iniziale del mese corrente con join shiftTypes
 *   - Passa i dati come initialData al componente client EmployeeCalendar
 *   - Il client usa TanStack Query per i refetch successivi (navigazione tra mesi)
 */
export default async function EmployeeCalendarPage() {
  const session = await auth();
  if (!session) redirect('/login');

  // Range mese corrente (+ padding per celle a cavallo mese)
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const from = format(addDays(startOfWeek(monthStart, { weekStartsOn: 1 }), 0), 'yyyy-MM-dd');
  const to = format(addDays(endOfWeek(monthEnd, { weekStartsOn: 1 }), 0), 'yyyy-MM-dd');

  // Fetch turni con join shiftTypes (per colore e nome tipologia)
  const rows = await db
    .select({
      id: shifts.id,
      userId: shifts.userId,
      shiftTypeId: shifts.shiftTypeId,
      date: shifts.date,
      startDt: shifts.startDt,
      endDt: shifts.endDt,
      notes: shifts.notes,
      status: shifts.status,
      shiftTypeName: shiftTypes.name,
      shiftTypeCode: shiftTypes.code,
      shiftTypeColor: shiftTypes.color,
    })
    .from(shifts)
    .leftJoin(shiftTypes, eq(shifts.shiftTypeId, shiftTypes.id))
    .where(
      and(
        eq(shifts.userId, session.user.id as string),
        gte(shifts.date, from),
        lte(shifts.date, to)
      )
    )
    .limit(200);

  // Serializza per Client Component (Date → ISO string)
  const initialShifts: ShiftRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    shiftTypeId: r.shiftTypeId,
    date: r.date,
    startDt: r.startDt instanceof Date ? r.startDt.toISOString() : String(r.startDt),
    endDt: r.endDt instanceof Date ? r.endDt.toISOString() : String(r.endDt),
    notes: r.notes,
    status: r.status,
    shiftTypeName: r.shiftTypeName ?? null,
    shiftTypeCode: r.shiftTypeCode ?? null,
    shiftTypeColor: r.shiftTypeColor ?? null,
  }));

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">I miei turni</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visualizza i tuoi turni pianificati — clicca su un turno per i dettagli
        </p>
      </div>

      {/* Calendario */}
      <EmployeeCalendar initialShifts={initialShifts} />
    </div>
  );
}
