# Turnly — Tech Stack

> Documento di riferimento dello stack tecnologico scelto per **Turnly**.
> Selezionato in base al contesto: app B2B enterprise (ospedali, retail, produzione), griglia
> 50+ dipendenti × 31 giorni, regole DST-safe, RBAC rigoroso, real-time validation, responsive.

---

## Architettura generale

**Full-stack monorepo** su Next.js App Router. Frontend e backend nello stesso repository; DB
PostgreSQL separato. Deploy su Vercel (FE + API Routes) + Railway o Supabase (Postgres).

```
turnly/
├── app/                    # Next.js App Router (pagine + API Routes)
│   ├── (auth)/             # Login, reset password
│   ├── (admin)/            # Dashboard, matrice, anagrafica, ecc.
│   ├── (employee)/         # Calendario, richieste, profilo
│   └── api/                # Route Handlers (REST)
├── components/             # UI components (shadcn/ui + custom)
├── lib/                    # Domain logic, validazioni Zod, date utils
├── db/                     # Drizzle schema + migrations
└── types/                  # TypeScript types condivisi FE+BE
```

---

## Stack Frontend

| Layer | Scelta | Versione | Motivazione |
|---|---|---|---|
| Framework | **Next.js** (App Router) | 15.x | SSR/RSC per la matrice, routing basato su ruolo, streaming |
| Language | **TypeScript** | 5.x | Type-safety sul dominio complesso (17 RB, state machine richieste) |
| Styling | **TailwindCSS** | v4 | Utility-first, ottimo con shadcn/ui |
| Component library | **shadcn/ui** (Radix UI) | latest | Accessibile by-design, headless, WCAG 2.2 AA out-of-the-box |
| Griglia turni | **TanStack Table** | v8 | Virtualizzazione per 50+ righe × 31 colonne; column pinning per header sticky |
| Server state | **TanStack Query** | v5 | Cache, invalidazione ottimistica per aggiornamenti cella, notifiche |
| Client state | **Zustand** | v5 | UI state (selezione cella, filtri matrice, modalità edit) |
| Form + validazione | **React Hook Form + Zod** | latest | Validazione condivisa con il backend (stesso schema Zod) per parità UI↔API (T-INT-01) |
| Date/time | **date-fns v3 + @date-fns/tz** | latest | DST-safe (T-DOM-08, RB-12), Europe/Rome, no moment.js |
| Calendario | **React Big Calendar** o **FullCalendar** | latest | Viste giorno/settimana/mese per il dipendente (RF-J) |
| Icone | **Lucide React** | latest | Tree-shakeable, coerente con shadcn/ui |
| Real-time | **Server-Sent Events** (native Next.js) | — | Notifiche push → dipendente/admin; no WebSocket overhead |

---

## Stack Backend (Next.js API Routes / Route Handlers)

| Layer | Scelta | Versione | Motivazione |
|---|---|---|---|
| API | **Next.js Route Handlers** | 15.x | Co-location con FE, edge-ready, streaming |
| ORM | **Drizzle ORM** | latest | Type-safe, SQL-first, migration CLI, ottimo supporto PostgreSQL |
| Database | **PostgreSQL** | 16 | ACID garantito per T-INT-02 (concurrent write + constraint check), JSON per payload Request |
| Auth | **Auth.js v5 (NextAuth)** | 5.x | Session server-side con JWT rotante, scadenza configurabile (RF-A CA3), provider email/password |
| Validazione API | **Zod** (schema condiviso) | latest | Stessa libreria del FE → UI↔API parity (T-INT-01); validazione campi contrattuali (RB-13) |
| Audit log | Tabella `AuditLog` via Drizzle | — | Trigger a livello applicativo su ogni scrittura rilevante |
| Regole di business | `lib/rules/` (pure functions TypeScript) | — | RB-01..RB-17 come funzioni pure testabili; invocate sia dall'API sia dai form FE |
| Background jobs | **Inngest** (o cron Route Handler) | latest | Generazione ricorrenze (RF-E), calcolo straordinari periodici, pulizia sessioni |

---

## Database — schema principale (Drizzle)

Tabelle mappate 1:1 con il modello dati §4:

```
users · qualifications · shift_types · shifts · recurrence_rules
absences · availability · requests · coverage_requirements
swap_operations · notifications · audit_log
```

Indici critici:
- `shifts(user_id, start_time, end_time)` — per overlap check (RB-01) via constraint `EXCLUDE USING gist`
- `notifications(recipient_id, read)` — per inbox counter (RF-K)
- `requests(user_id, status)` — per coda approvazioni (RF-M)

---

## Testing

| Layer | Tool |
|---|---|
| Unit (RB rules) | **Vitest** — pure functions, nessun mock DB |
| Integration (API) | **Vitest + testcontainers** — PostgreSQL reale (no mock, T-INT-01/02) |
| E2E | **Playwright** — acceptance spec dal §11 (T-DOM-*, T-REQ-*, T-SEC-*) |
| Accessibilità | **axe-playwright** — WCAG 2.2 AA (RNF-Accessibilità) |

---

## Deploy

| Ambiente | Servizio |
|---|---|
| Frontend + API Routes | **Vercel** |
| PostgreSQL | **Supabase** (managed) o **Railway** |
| File statici / export .ics | Vercel Edge Network |
| CI/CD | **GitHub Actions** (lint → test → build → deploy) |

---

## Decisioni chiave e motivazioni

### Perché Next.js 15 App Router?
Server Components per renderizzare la matrice lato server (riduce JS inviato al client),
streaming per mostrare skeleton mentre arrivano le righe, layout nested per admin/employee
senza re-render della shell.

### Perché Drizzle (non Prisma)?
Drizzle è SQL-first: le query complesse per RB-01 (overlap check), RB-07 (under-coverage
aggregation) e i report ore sono esprimibili in SQL diretto senza magia ORM. Migrations
deterministiche.

### Perché date-fns invece di Luxon/Day.js?
`@date-fns/tz` espone `zonedTimeToUtc` / `toZonedTime` che gestiscono esplicitamente i gap
DST (T-DOM-08). L'API funzionale è più testabile delle istanze mutabili.

### Perché Zod condiviso FE+BE?
La specifica richiede parità UI↔API (T-INT-01). Un singolo schema Zod usato sia nel form
React che nel Route Handler garantisce strutturalmente che la stessa regola non diverga tra
i due layer.

### Perché SSE (non WebSocket) per le notifiche?
Le notifiche sono unidirezionali (server → client). SSE funziona su HTTP/2, non richiede
infrastruttura aggiuntiva, è nativo in Next.js Route Handlers. Sufficiente per
`richiesta_ricevuta`, `esito_richiesta`, `scambio_da_accettare`, `turno_modificato`.
