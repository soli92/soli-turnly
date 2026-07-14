/**
 * TSK-002 — Seed script per development
 * TSK-013 — Aggiunta seed per availability, coverage_requirements
 *
 * Popola il database con dati di riferimento per lo sviluppo locale.
 *
 * Dati inseriti:
 *   - 3 qualifiche (Medico, Infermiere, OSS)
 *   - 3 tipologie turno (Mattino, Pomeriggio, Notte)
 *   - 1 admin (admin@turnly.dev / Admin123!)
 *   - 5 dipendenti (mario.rossi, lucia.verdi, giovanni.bianchi, anna.ferrari, carlo.esposito)
 *   - 3 tipi assenza (Ferie, Malattia, Permesso)
 *   - Turni per la settimana corrente (lun-ven, 1 turno per dipendente per giorno)
 *   - 3 regole di copertura (3 Infermieri notte, 2 OSS pomeriggio, 1 Medico mattina)
 *   - 2 finestre di indisponibilità per mario.rossi (test RB-15)
 *
 * Esecuzione:
 *   npx tsx code/app/db/seed.ts
 *   (oppure aggiungere script npm: "db:seed": "tsx db/seed.ts")
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashSync } from 'bcryptjs';
import {
  addDays,
  startOfWeek,
  format,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from 'date-fns';
import { TZDate } from '@date-fns/tz';

import {
  qualifications,
  users,
  shiftTypes,
  absenceTypes,
  shifts,
  availability,
  coverageRequirements,
} from './schema';

// ---------------------------------------------------------------------------
// DB connection (standalone — not via @/db to avoid Next.js module resolution)
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMEZONE = 'Europe/Rome';

/**
 * Builds a timezone-aware Date from a local date and HH:mm in Europe/Rome.
 * Handles DST automatically via @date-fns/tz TZDate (modern API).
 *
 * TZDate extends Date: date-fns helpers (setHours etc.) operate in the
 * declared timezone, so the returned value already carries the correct UTC
 * timestamp — no fromZonedTime needed.
 */
function localDt(date: Date, hour: number, minute = 0): Date {
  const tzDate = new TZDate(date, TIMEZONE);
  return setMilliseconds(setSeconds(setMinutes(setHours(tzDate, hour), minute), 0), 0);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('Seeding database…');

  // -------------------------------------------------------------------------
  // Qualifiche
  // -------------------------------------------------------------------------

  // noUncheckedIndexedAccess: usiamo ! perché db.insert.returning() garantisce N righe
  const qualRows = await db
    .insert(qualifications)
    .values([
      {
        name: 'Medico',
        color: '#3B82F6',
        description: 'Medico specialista ospedaliero',
      },
      {
        name: 'Infermiere',
        color: '#10B981',
        description: 'Infermiere professionale',
      },
      {
        name: 'OSS',
        color: '#F97316',
        description: 'Operatore Socio Sanitario',
      },
    ])
    .returning();
  const medico = qualRows[0]!;
  const infermiere = qualRows[1]!;
  const oss = qualRows[2]!;

  console.log(`  qualifications: ${[medico, infermiere, oss].map((q) => q.name).join(', ')}`);

  // -------------------------------------------------------------------------
  // Tipologie turno
  // Mattino  07:00 – 15:00
  // Pomeriggio 15:00 – 23:00
  // Notte    23:00 – 07:00 (+1)
  // -------------------------------------------------------------------------

  const shiftTypeRows = await db
    .insert(shiftTypes)
    .values([
      {
        name: 'Mattino',
        code: 'MAT',
        color: '#F59E0B',
        defaultStartTime: '07:00',
        defaultEndTime: '15:00',
        breakMinutes: 30,
        active: true,
      },
      {
        name: 'Pomeriggio',
        code: 'POM',
        color: '#8B5CF6',
        defaultStartTime: '15:00',
        defaultEndTime: '23:00',
        breakMinutes: 30,
        active: true,
      },
      {
        name: 'Notte',
        code: 'NOT',
        color: '#1E3A8A',
        defaultStartTime: '23:00',
        defaultEndTime: '07:00',
        breakMinutes: 30,
        active: true,
      },
    ])
    .returning();
  const turnoMattino = shiftTypeRows[0]!;
  const turnoPomeriggio = shiftTypeRows[1]!;
  const turnoNotte = shiftTypeRows[2]!;

  console.log(
    `  shift_types: ${[turnoMattino, turnoPomeriggio, turnoNotte].map((s) => s.name).join(', ')}`
  );

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  const adminPasswordHash = hashSync('Admin123!', 12);

  const adminUserRows = await db
    .insert(users)
    .values([
      {
        email: 'admin@turnly.dev',
        passwordHash: adminPasswordHash,
        role: 'admin' as const,
        firstName: 'Admin',
        lastName: 'Turnly',
        qualificationId: null,
        contractHours: 40,
        active: true,
      },
    ])
    .returning();
  const adminUser = adminUserRows[0]!;

  console.log(`  admin: ${adminUser.email}`);

  // -------------------------------------------------------------------------
  // Dipendenti
  // -------------------------------------------------------------------------

  const employeePasswordHash = hashSync('Employee123!', 12);

  const employeeData = [
    {
      email: 'mario.rossi@turnly.dev',
      firstName: 'Mario',
      lastName: 'Rossi',
      qualificationId: infermiere.id,
      contractHours: 36,
    },
    {
      email: 'lucia.verdi@turnly.dev',
      firstName: 'Lucia',
      lastName: 'Verdi',
      qualificationId: infermiere.id,
      contractHours: 36,
    },
    {
      email: 'giovanni.bianchi@turnly.dev',
      firstName: 'Giovanni',
      lastName: 'Bianchi',
      qualificationId: medico.id,
      contractHours: 38,
    },
    {
      email: 'anna.ferrari@turnly.dev',
      firstName: 'Anna',
      lastName: 'Ferrari',
      qualificationId: infermiere.id,
      contractHours: 36,
    },
    {
      email: 'carlo.esposito@turnly.dev',
      firstName: 'Carlo',
      lastName: 'Esposito',
      qualificationId: medico.id,
      contractHours: 38,
    },
  ];

  const employeeUsers = await db
    .insert(users)
    .values(
      employeeData.map((e) => ({
        ...e,
        passwordHash: employeePasswordHash,
        role: 'employee' as const,
        active: true,
      }))
    )
    .returning();

  console.log(`  employees: ${employeeUsers.map((u) => u.email).join(', ')}`);

  // -------------------------------------------------------------------------
  // Tipi assenza
  // -------------------------------------------------------------------------

  await db.insert(absenceTypes).values([
    { name: 'Ferie', code: 'FER', paidLeave: true, requiresApproval: true },
    { name: 'Malattia', code: 'MAL', paidLeave: true, requiresApproval: false },
    { name: 'Permesso', code: 'PER', paidLeave: true, requiresApproval: true },
    { name: 'Maternità/Paternità', code: 'MAT', paidLeave: true, requiresApproval: true },
    { name: 'Altro', code: 'ALT', paidLeave: false, requiresApproval: true },
  ]);

  console.log('  absence_types: Ferie, Malattia, Permesso, Maternità/Paternità, Altro');

  // -------------------------------------------------------------------------
  // Turni per la settimana corrente (lun-ven)
  // Ogni dipendente ha un turno per giorno lavorativo (rotazione ciclica MAT/POM/NOT)
  // I turni sono non sovrapposti per costruzione (uno per dipendente per giorno)
  // -------------------------------------------------------------------------

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Lunedì

  const shiftTypesCycle = [turnoMattino, turnoPomeriggio, turnoNotte];

  type ShiftInsert = {
    userId: string;
    shiftTypeId: string;
    date: string;
    startDt: Date;
    endDt: Date;
    origin: 'manual';
    status: 'planned';
    createdBy: string;
  };

  const shiftsToInsert: ShiftInsert[] = [];

  for (let day = 0; day < 5; day++) {
    // Monday .. Friday
    const currentDay = addDays(weekStart, day);
    const dateStr = format(currentDay, 'yyyy-MM-dd');

    employeeUsers.forEach((employee, idx) => {
      // noUncheckedIndexedAccess: shiftTypesCycle ha sempre 3 elementi (idx % 3 è safe)
      const shiftType = shiftTypesCycle[idx % 3]!;

      let startDt: Date;
      let endDt: Date;

      if (shiftType.code === 'MAT') {
        startDt = localDt(currentDay, 7);
        endDt = localDt(currentDay, 15);
      } else if (shiftType.code === 'POM') {
        startDt = localDt(currentDay, 15);
        endDt = localDt(currentDay, 23);
      } else {
        // Notte: 23:00 → 07:00 next day
        startDt = localDt(currentDay, 23);
        endDt = localDt(addDays(currentDay, 1), 7);
      }

      shiftsToInsert.push({
        userId: employee.id,
        shiftTypeId: shiftType.id,
        date: dateStr,
        startDt,
        endDt,
        origin: 'manual',
        status: 'planned',
        createdBy: adminUser.id,
      });
    });
  }

  await db.insert(shifts).values(shiftsToInsert);

  console.log(`  shifts: ${shiftsToInsert.length} turni (lun-ven settimana corrente)`);

  // -------------------------------------------------------------------------
  // TSK-013 — Regole di copertura
  // 3 Infermieri notte, 2 OSS pomeriggio, 1 Medico mattina
  // -------------------------------------------------------------------------

  await db.insert(coverageRequirements).values([
    {
      qualificationId: infermiere.id,
      shiftTypeId: turnoNotte.id,
      dayOfWeek: null, // tutti i giorni
      minimumCount: 3,
      notes: 'Minimo 3 Infermieri per turno notte',
    },
    {
      qualificationId: oss.id,
      shiftTypeId: turnoPomeriggio.id,
      dayOfWeek: null, // tutti i giorni
      minimumCount: 2,
      notes: 'Minimo 2 OSS per turno pomeriggio',
    },
    {
      qualificationId: medico.id,
      shiftTypeId: turnoMattino.id,
      dayOfWeek: null, // tutti i giorni
      minimumCount: 1,
      notes: 'Minimo 1 Medico per turno mattina',
    },
  ]);

  console.log(
    '  coverage_requirements: 3 regole (Infermieri notte, OSS pomeriggio, Medico mattina)'
  );

  // -------------------------------------------------------------------------
  // TSK-013 — Finestre di indisponibilità per mario.rossi (test RB-15)
  // 2 availability entries: 1 date_range + 1 recurring
  // -------------------------------------------------------------------------

  // noUncheckedIndexedAccess: il seed inserisce sempre almeno 1 dipendente
  const marioRossi = employeeUsers[0]!; // mario.rossi@turnly.dev

  await db.insert(availability).values([
    {
      userId: marioRossi.id,
      type: 'unavailable' as const,
      scope: 'date_range' as const,
      definition: {
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      },
      notes: 'Ferie estive agosto 2026 — test RB-15 (date_range unavailability)',
    },
    {
      userId: marioRossi.id,
      type: 'unavailable' as const,
      scope: 'recurring' as const,
      definition: {
        dayOfWeek: 6, // sabato
        startTime: '00:00',
        endTime: '23:59',
      },
      notes: 'Indisponibile ogni sabato — test RB-15 (recurring unavailability)',
    },
  ]);

  console.log('  availability: 2 finestre di indisponibilità per mario.rossi (test RB-15)');

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------

  console.log('\nSeed completato con successo.');
  console.log('  Credenziali admin:     admin@turnly.dev / Admin123!');
  console.log('  Credenziali employee:  mario.rossi@turnly.dev / Employee123!');

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed fallito:', err);
  process.exit(1);
});
