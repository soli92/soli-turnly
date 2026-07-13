/**
 * TSK-002 — Seed script per development
 *
 * Popola il database con dati di riferimento per lo sviluppo locale.
 *
 * Dati inseriti:
 *   - 2 qualifiche (Medico, Infermiere)
 *   - 3 tipologie turno (Mattino, Pomeriggio, Notte)
 *   - 1 admin (admin@turnly.dev / Admin123!)
 *   - 5 dipendenti (mario.rossi, lucia.verdi, giovanni.bianchi, anna.ferrari, carlo.esposito)
 *   - 3 tipi assenza (Ferie, Malattia, Permesso)
 *   - Turni per la settimana corrente (lun-ven, 1 turno per dipendente per giorno)
 *
 * Esecuzione:
 *   npx tsx code/app/db/seed.ts
 *   (oppure aggiungere script npm: "db:seed": "tsx db/seed.ts")
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashSync } from 'bcryptjs';
import { addDays, startOfWeek, format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { toZonedTime, fromZonedTime } from '@date-fns/tz';

import {
  qualifications,
  users,
  shiftTypes,
  absenceTypes,
  shifts,
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
 * Handles DST automatically via @date-fns/tz.
 */
function localDt(date: Date, hour: number, minute = 0): Date {
  const localDate = toZonedTime(date, TIMEZONE);
  const withTime = setMilliseconds(
    setSeconds(setMinutes(setHours(localDate, hour), minute), 0),
    0,
  );
  return fromZonedTime(withTime, TIMEZONE);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('Seeding database…');

  // -------------------------------------------------------------------------
  // Qualifiche
  // -------------------------------------------------------------------------

  const [medico, infermiere] = await db
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
    ])
    .returning();

  console.log(`  qualifications: ${[medico, infermiere].map((q) => q.name).join(', ')}`);

  // -------------------------------------------------------------------------
  // Tipologie turno
  // Mattino  07:00 – 15:00
  // Pomeriggio 15:00 – 23:00
  // Notte    23:00 – 07:00 (+1)
  // -------------------------------------------------------------------------

  const [turnoMattino, turnoPomeriggio, turnoNotte] = await db
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

  console.log(
    `  shift_types: ${[turnoMattino, turnoPomeriggio, turnoNotte].map((s) => s.name).join(', ')}`,
  );

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  const adminPasswordHash = hashSync('Admin123!', 12);

  const [adminUser] = await db
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
      })),
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
  ]);

  console.log('  absence_types: Ferie, Malattia, Permesso');

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
      const shiftType = shiftTypesCycle[idx % 3];

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
