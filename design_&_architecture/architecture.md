---
type: adr
id: ADR-001
title: "Turnly — Application Architecture v0.1"
date: 2026-07-13
status: accepted
deciders: [soli92]
---

# ADR-001 — Turnly Application Architecture

## Contesto

Applicazione B2B enterprise per la pianificazione turni del personale (ospedali, retail,
produzione). Requisiti critici:
- Griglia 50+ dipendenti × 31 giorni con validazione in tempo reale (RB-01..RB-17)
- RBAC rigoroso admin/dipendente (RF-A), self-service dipendente con workflow di approvazione (RF-M)
- Calcolo DST-safe (Europe/Rome, RB-12, T-DOM-08)
- Responsive mobile-first; progressive: solo web app (no app nativa)
- Parità UI↔API obbligatoria (T-INT-01): stessa regola non può divergere tra FE e BE

## Decisione

**Full-stack Next.js 15 App Router** — frontend e backend nel medesimo repository.

---

## Stack

| Layer | Scelta | Motivazione chiave |
|---|---|---|
| Framework | **Next.js 15** App Router | RSC per rendering griglia server-side; streaming; layout nested per ruoli |
| Language | **TypeScript 5.x** | Type-safety su domain model complesso (17 RB, state machine richieste) |
| Styling | **TailwindCSS v4** | Utility-first; ottimo con shadcn/ui |
| UI components | **shadcn/ui** (Radix UI) | WCAG 2.2 AA out-of-the-box; headless |
| Grid turni | **TanStack Table v8** | Virtualizzazione 50+ righe × 31 col; column pinning sticky |
| Server state | **TanStack Query v5** | Cache, invalidazione ottimistica celle, real-time badge inbox |
| Client state | **Zustand v5** | UI state (selezione cella, filtri, edit mode) |
| Form + validazione | **React Hook Form + Zod** | Schema condiviso FE+BE → parità T-INT-01 |
| Date/DST | **date-fns v3 + @date-fns/tz** | `zonedTimeToUtc`/`toZonedTime` → T-DOM-08, RB-12 |
| Calendario | **React Big Calendar** | Viste giorno/settimana/mese dipendente (RF-J) |
| ORM | **Drizzle ORM** | SQL-first; query complesse per RB-01 (EXCLUDE gist), RB-07 (aggregation) |
| Database | **PostgreSQL 16** | ACID per T-INT-02 (concurrent write); JSON payload per Request.payload |
| Auth | **Auth.js v5** | Session server-side; JWT rotante; scadenza configurabile (RF-A CA3) |
| Validazione API | **Zod** (schema condiviso) | Stessa libreria FE → strutturalmente impossibile divergere (T-INT-01) |
| Background jobs | **Inngest** | Generazione ricorrenze (RF-E), straordinari periodici, cleanup sessioni |
| Real-time | **Server-Sent Events** | Notifiche unidirezionali server→client; nativo Next.js; no WebSocket overhead |
| Icons | **Lucide React** | Tree-shakeable; coerente shadcn/ui |

---

## Struttura repository

```
code/app/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Login, reset password
│   │   └── login/page.tsx
│   ├── (admin)/                 # Area admin (layout.tsx verifica ruolo)
│   │   ├── dashboard/page.tsx
│   │   ├── matrix/page.tsx      # Matrice turni (week/month)
│   │   ├── requests/page.tsx    # Coda approvazioni
│   │   ├── staff/page.tsx       # Anagrafica
│   │   ├── coverage/page.tsx    # Fabbisogni/coperture
│   │   └── reports/page.tsx
│   ├── (employee)/              # Area dipendente
│   │   ├── calendar/page.tsx
│   │   ├── requests/page.tsx
│   │   └── profile/page.tsx
│   └── api/                     # Route Handlers
│       ├── auth/[...nextauth]/route.ts
│       ├── shifts/route.ts       # GET list, POST create
│       ├── shifts/[id]/route.ts  # PATCH, DELETE
│       ├── requests/route.ts
│       ├── requests/[id]/route.ts
│       ├── admin/users/route.ts
│       ├── admin/coverage/route.ts
│       └── notifications/sse/route.ts
├── components/
│   ├── matrix/                  # ShiftGrid, ShiftCell, ViolationBadge
│   ├── requests/                # RequestForm, RequestDetail, ApprovalPanel
│   ├── notifications/           # NotificationBell, NotificationList
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── rules/                   # Pure TS functions per RB-01..RB-17
│   │   ├── validateNoOverlap.ts
│   │   ├── validateMinRest.ts
│   │   ├── validateCoverage.ts
│   │   ├── validateShiftBalance.ts
│   │   └── index.ts
│   ├── date/                    # DST-safe helpers (date-fns/tz)
│   ├── auth/                    # Session helpers, RBAC middleware
│   └── zod/                     # Shared Zod schemas FE+BE
├── db/
│   ├── schema.ts                # Drizzle schema (10 tables)
│   ├── migrations/              # SQL migrations
│   └── seed.ts
└── types/                       # TypeScript types condivisi
```

---

## Schema database (Drizzle)

```typescript
// 10 tabelle principali (semplificato)

users             — id, email, passwordHash, role, qualificationId,
                    contractHoursWeekly, contractType, active, timestamps
qualifications    — id, name, description
shift_types       — id, name, startTime, endTime, durationMinutes,
                    throughMidnight, color, pauseMinutes, active
shifts            — id, userId, shiftTypeId, date, startDt, endDt,
                    status, origin, recurrenceId, requestId, isOvertime, notes
                    INDEX (userId, startDt, endDt)
                    EXCLUDE USING gist (userId WITH =, tsrange(startDt,endDt) WITH &&)
recurrence_rules  — id, name, type, definition(JSON), startDate, endDate, targetUserIds
absences          — id, userId, type, startDate, endDate, status, requestId
availability      — id, userId, type, scope(JSON)
requests          — id, userId, type, status, payload(JSON),
                    colleagueId, colleagueAcceptance,
                    adminDecisionId, decisionReason, timestamps
coverage_requirements — id, dayOrSlot, qualificationId, minimumCount
swap_operations   — id, shiftAId, shiftBId, origin, requestId, adminId,
                    validationOutcome, reason
notifications     — id, recipientId, type, payload(JSON), read, timestamp
audit_log         — id, actorId, action, entity, entityId,
                    dataBefore(JSON), dataAfter(JSON), timestamp
```

**Indici critici:**
- `shifts`: `EXCLUDE USING gist` su `(userId, tsrange(startDt, endDt))` → enforcement RB-01 a livello DB (T-INT-02)
- `notifications`: `(recipientId, read)` → inbox counter O(1)
- `requests`: `(userId, status)` → coda approvazioni e lista dipendente

---

## Flusso di validazione (T-INT-01)

```
┌──────────────────────────────┐
│  React form (Client)         │  ← Zod schema  →  feedback ottimistico
│  lib/zod/shiftSchema.ts      │
└───────────┬──────────────────┘
            │ fetch POST /api/shifts
            ▼
┌──────────────────────────────────────────────────────┐
│  Route Handler (Server)                              │
│  1. Auth check (session.user.role === 'admin')       │
│  2. Zod.parse(body, shiftSchema)    ← same schema    │
│  3. lib/rules/validateNoOverlap()  RB-01             │
│  4. lib/rules/validateMinRest()    RB-02             │
│  5. lib/rules/validateCoverage()   RB-07             │
│  6. drizzle.insert(shifts)         + EXCLUDE gist    │
│  7. audit_log.insert(...)                            │
│  8. notifications.insert(...)  SSE push              │
└───────────┬──────────────────────────────────────────┘
            │
            ▼
     200 OK + shift | 400 RuleViolation | 409 DBConstraint
            │
            ▼
  TanStack Query → invalidate(['shifts', week])
```

---

## Modello di sicurezza

| Requisito | Implementazione |
|---|---|
| Autenticazione (RF-A) | Auth.js v5 — JWT rotante, scadenza configurabile |
| Autorizzazione (RF-A CA2) | Middleware Next.js — verifica `session.user.role` su ogni route |
| IDOR (RNF-Sicurezza) | Query Drizzle filtrano sempre `WHERE user_id = session.user.id` (dipendente) |
| Campi contrattuali (RB-13) | Zod schema: campo `contractType` etc. `z.never()` nei form dipendente |
| Stato richieste (RB-16) | Route Handler verifica `request.status` prima di ogni write |
| Audit log | Middleware applicativo su ogni write → `audit_log.insert` |
| Password | `bcryptjs` hash; errori login non distinguono email/password (RF-A CA1) |
| Session scaduta (RF-A CA3) | Auth.js `maxAge` → API restituisce 401; client redirect `/login` |

---

## Real-time: Server-Sent Events

```typescript
// app/api/notifications/sse/route.ts
export async function GET(req: Request) {
  const session = await auth();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);

      // Subscribe to notification events for this user
      notificationBus.on(`user:${session.user.id}`, send);
      req.signal.addEventListener('abort', () => {
        notificationBus.off(`user:${session.user.id}`, send);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

---

## Deploy

| Servizio | Ambiente |
|---|---|
| Vercel | Frontend + API Routes (Next.js native, edge-ready) |
| Supabase | PostgreSQL 16 managed (o Railway) |
| Inngest | Background jobs (recurrences, overtime calc) |
| GitHub Actions | CI/CD: lint → vitest → playwright → build → deploy |

---

## Decisioni alternative scartate

| Alternativa | Motivo scarto |
|---|---|
| Prisma (ORM) | SQL opaco per query complesse (overlap EXCLUDE gist, coverage aggregation) |
| Moment.js | Deprecato; bundle pesante; DST handling non esplicito |
| WebSocket (vs SSE) | Notifiche unidirezionali → SSE sufficiente; no infrastruttura aggiuntiva |
| REST separato (Hono/Fastify) | Co-location FE+BE preferita per prototipazione rapida; separabile in futuro |
| React Query v4 | v5 ha API più stabile e migliore support per RSC/Suspense |
