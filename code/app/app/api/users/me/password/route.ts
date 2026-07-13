/**
 * app/api/users/me/password/route.ts — Cambio password utente autenticato.
 *
 * PATCH /api/users/me/password
 *
 * Body: { oldPassword: string, newPassword: string (min 8) }
 *
 * Risposte:
 * - 200: password aggiornata
 * - 400: body non valido (Zod)
 * - 401: non autenticato
 * - 422: vecchia password errata
 *
 * Sicurezza:
 * - Verifica prima la vecchia password (bcrypt.compare) — impedisce
 *   cambio password non autorizzato se il token è stato compromesso
 *   ma la password originale non è nota.
 * - La nuova password è hashata con bcrypt (rounds = 12).
 *
 * Note TSK-002: db.query.users e l'aggiornamento della tabella
 * richiedono lo schema completo. I tipi TS saranno risolti al merge
 * di TSK-002.
 */

import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
// TSK-002: users sarà esportata dallo schema completo — errori TS temporanei attesi.
import { users } from '@/db/schema';
import { requireAuthOrUnauthorized } from '@/lib/auth';

// ----------------------------------------------------------------
// Schema Zod per la validazione del body
// ----------------------------------------------------------------

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'La vecchia password è obbligatoria'),
  newPassword: z
    .string()
    .min(8, 'La nuova password deve essere di almeno 8 caratteri'),
});

// ----------------------------------------------------------------
// PATCH handler
// ----------------------------------------------------------------

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  // Verifica autenticazione
  const authCheck = await requireAuthOrUnauthorized();
  if ('response' in authCheck) return authCheck.response;
  const { session } = authCheck;

  // Parsing e validazione body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'body JSON non valido' },
      { status: 400 },
    );
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'dati non validi', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { oldPassword, newPassword } = parsed.data;

  // Recupera utente corrente dal DB (TSK-002 popola la tabella users)
  const userId = session.user.id;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId as string),
  });

  if (!user) {
    // Non dovrebbe accadere se la sessione è valida
    return NextResponse.json({ error: 'utente non trovato' }, { status: 404 });
  }

  // Verifica vecchia password
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isOldPasswordValid) {
    return NextResponse.json(
      { error: 'la vecchia password non è corretta' },
      { status: 422 },
    );
  }

  // Hash nuova password (rounds = 12 — bilanciamento sicurezza/performance)
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Aggiornamento DB
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId as string));

  return NextResponse.json({ message: 'password aggiornata' }, { status: 200 });
}
