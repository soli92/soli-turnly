# CQRL Code Review — Batch 1 (TSK-001 → TSK-004)

- **reviewer_version**: CQRL v2.12 (3 passate: idiomaticità → design → robustezza)
- **generated_at**: 2026-07-14
- **iter**: 1 (nessun report precedente)
- **scope**: infrastruttura wave-1 — scaffolding, schema DB, auth/RBAC, API skeleton

## Stack rilevato

| Asse | Valore | Confidence |
|---|---|---|
| language | TypeScript 5.x (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | alta |
| framework | Next.js 15 App Router (RSC + Route Handlers) | alta |
| orm/db | Drizzle ORM + PostgreSQL 16 (postgres-js driver) | alta |
| auth | Auth.js v5 (next-auth `^5.0.0-beta.25`), strategia JWT | alta |
| validation | Zod (schema condiviso FE/BE) | alta |

`stack_descriptor = ts/next15-app/drizzle-pg/authjs5` — confidence > `confidence_min (0.6)` → **modalità stack-aware attiva**.

> ⚠️ **Bootstrap ruleset**: `code_quality/rules/{canonical,team-specific,emergent}/` contengono solo `.gitkeep`.
> Non esistono `rule_id` materializzate. Per la regola «Mai inventare» (§19.5) i finding sotto
> citano `rule_id` secondo la convenzione canonica ma vanno considerati **candidati emergent** da
> promuovere a gate umano. Nessuna regola è stata applicata come auto-fix.

---

## Verdetti per TSK

| TSK | Titolo | Verdict | High | Medium | Low |
|---|---|---|---|---|---|
| TSK-001 | Scaffolding Next.js + Drizzle + shadcn/ui | **PASS** | 0 | 0 | 3 |
| TSK-002 | Schema DB + migrations | **PASS** | 0 | 1 | 2 |
| TSK-003 | Auth.js v5 + RBAC middleware | **CONDITIONAL** | 3 | 2 | 1 |
| TSK-004 | API skeleton route handlers | **CONDITIONAL** | 1 | 3 | 2 |

Nessun verdict `reject` (nessun problema di sicurezza, nessun loop-exhausted). I due `conditional`
sono correggibili entro `max_iterations: 3` → re-Develop iter-2.

---

## TSK-001 — Scaffolding · PASS

**Positivi.** `tsconfig.json` eccellente (strict + `noUncheckedIndexedAccess` +
`exactOptionalPropertyTypes` + `noImplicitOverride`). `next.config.ts` con
`ignoreBuildErrors: false` / `ignoreDuringBuilds: false` — nessun bypass dei gate. `package.json`
con script completi (typecheck, format:check, test:coverage, db:*).

- **[LOW] `.env.example` incompleto** — mancano `SESSION_MAX_AGE` (richiesto esplicitamente
  dall'AC di TSK-003) e `NEXT_PUBLIC_APP_URL` (usato in 5 file: shifts, requests approve/reject/accept-swap,
  jobs). L'AC di TSK-001 chiede «`.env.example` documentato con tutte le variabili necessarie».
  `[^rule: canonical/config.env.documented-vars §Rationale]`
- **[LOW] ESLint type-aware senza `parserOptions.project`** — `eslint.config.mjs` abilita
  `@typescript-eslint/no-floating-promises` e `no-misused-promises`, che **richiedono type
  information**. Non è impostato `languageOptions.parserOptions.project`/`projectService`: le regole
  possono no-oppare o far fallire `next lint` con «requires type information», mettendo a rischio
  l'AC «`npm run lint` passa». Verificare. `[^rule: canonical/lint.type-aware-rules-need-project §Rationale]`
- **[LOW] Env var Auth.js v5** — `.env.example` documenta `NEXTAUTH_SECRET`; la variabile canonica
  in Auth.js v5 è `AUTH_SECRET` (retro-compatibile). Informativo.
  `[^rule: canonical/idiomaticity.framework-env-naming §Rationale]`

---

## TSK-002 — Schema DB · PASS

**Positivi (rilievo alto).** Il constraint anti-overlap è implementato correttamente e in modo
DST-safe: `EXCLUDE USING gist (user_id WITH =, tstzrange(start_dt, end_dt, '[)') WITH &&)` su colonne
`timestamptz`, con rationale `[)` documentata (turno che finisce all'inizio di un altro = consentito).
Copre RB-01 / T-INT-02 a livello DB (23P01). `btree_gist` abilitato in 0001. Indici critici presenti
(`notifications(user_id, read_at)`, `requests(user_id, status)`). Type exports `$inferSelect`/`$inferInsert`
completi per tutte le 13 tabelle.

- **[MEDIUM] Divergenza schema vs spec TSK non documentata** — la spec TSK-002 elencava
  `absenceTypeEnum(['vacation','sick','leave'])`; l'implementazione normalizza in tabella
  `absence_types` + `absence_status`. La scelta è un **miglioramento** (normalizzazione), ma è una
  divergenza dal contratto TSK non tracciata in ADR/wiki. Annotare in `wiki/gaps.md` o ADR per non
  perdere il razionale. `[^rule: canonical/design.schema-spec-divergence-doc §Rationale]`
- **[LOW] Convenzione giorno-settimana ambigua** — `recurrences.daysOfWeek` commenta
  «0=Sunday..6=Saturday (ISO: 1=Monday..7=Sunday)» mescolando due convenzioni nella stessa riga;
  `coverage_requirements.dayOfWeek` e gli schema Zod usano 0-6. Rischio off-by-one a valle.
  Fissare una sola convenzione documentata. `[^rule: canonical/design.magic-number-convention §Rationale]`
- **[LOW] EXCLUDE constraint fuori dal DSL Drizzle** — vive solo nella migration 0002 hand-written
  (limite noto di Drizzle, ben documentato). `drizzle-kit generate` non lo gestisce → rischio drift
  se in futuro si rigenerano le migration dallo schema. Caveat di manutenibilità.
  `[^rule: canonical/robustness.orm-schema-migration-drift §Rationale]`

---

## TSK-003 — Auth + RBAC · CONDITIONAL

**Positivi.** RF-A CA1 corretto (`authorize` → `null` sia per utente inesistente sia per password
errata, preceduto da validazione Zod). Middleware RBAC con ordinamento corretto (pubbliche → non-auth
→ admin) e differenziazione web/API (redirect vs 401/403 JSON). Cambio password verifica la vecchia
prima (bcrypt rounds 12). `DrizzleAdapter` correttamente omesso (incompatibile con Credentials+JWT).

### Finding critici

- **[HIGH · robustezza] Middleware trascina il driver DB + bcrypt nel bundle Edge**
  `middleware.ts` importa `auth` da `@/auth`, che importa `@/db` (driver **postgres-js**, non
  Edge-compatibile: usa `net`/`tls` di Node) e `bcryptjs`. Inoltre `db/index.ts` **throwa a import-time**
  se `DATABASE_URL` è assente. Il middleware Next.js gira su Edge runtime → il bundler include l'intero
  grafo → rischio concreto di errore build/runtime del middleware. Il pattern documentato di Auth.js v5
  è lo **split config**: `auth.config.ts` edge-safe (solo provider, callbacks, pages) usato da
  `middleware.ts`, e `auth.ts` con DB/bcrypt per il runtime Node.
  `[^rule: canonical/robustness.nextauth-edge-split-config §Rationale]`
  `[^src5: code/app/middleware.ts:17]` `[^src5: code/app/auth.ts:20]` `[^src5: code/app/db/index.ts:14]`

- **[HIGH · robustezza/correttezza] `session.user.id` mai propagato nel callback `session`**
  Il callback `session` imposta solo `role/firstName/lastName`; **non** imposta `session.user.id`
  (né mappa `token.sub`). Il type augmentation (`types/next-auth.d.ts`) **omette `id`** — motivo per
  cui compaiono **52** cast `session.user.id as string` nei route handler. Se Auth.js non popola `id`
  di default (comportamento dipendente dalla beta), l'intero modello attore/ownership/audit si rompe a
  runtime: insert con `userId`/`createdBy`/`actorId` NULL, e ownership check T-SEC-01
  (`shift.userId !== session.user.id`) sempre vero. Impostare esplicitamente
  `session.user.id = token.sub` e dichiarare `id: string` nell'augmentation.
  `[^rule: canonical/robustness.session-id-propagation §Rationale]`
  `[^src5: code/app/auth.ts:100]` `[^src5: code/app/types/next-auth.d.ts:28]`

- **[HIGH · correttezza] `users/me/password` scrive su colonna inesistente `updated_at`**
  `db.update(users).set({ passwordHash, updatedAt: new Date() })` ma la tabella `users` **non ha**
  colonna `updated_at` (confermato in `db/schema.ts` e migration 0001 — presente solo su `shifts` e
  `availability`). → errore di compilazione TS (`.set()` tipizzato Drizzle) oppure errore SQL runtime
  «column "updated_at" does not exist». Viola l'AC TSK-003 «nuova password salvata → 200». Rimuovere
  `updatedAt` o aggiungere la colonna allo schema.
  `[^rule: canonical/robustness.orm-nonexistent-column §Rationale]`
  `[^src5: code/app/app/api/users/me/password/route.ts:104]` `[^src5: code/app/db/schema.ts:111]`

### Finding minori

- **[MEDIUM · idiomaticità] Ruolo "stringly-typed"** — `role/firstName/lastName` tipizzati `string`
  nell'augmentation e assegnati con `as string` nel callback `session`, in contraddizione col commento
  del file stesso («senza typecast»). Si perde l'unione `'admin' | 'employee'` → niente exhaustiveness
  sui check RBAC. Tipizzare `role` con l'unione del `pgEnum`.
  `[^rule: canonical/idiomaticity.stringly-typed-enum §Rationale]` `[^src5: code/app/auth.ts:101]`
- **[MEDIUM · design/DRY] Helper di guardia sotto-utilizzati** — `requireAuthOrUnauthorized` /
  `requireAdminOrForbidden` (in `lib/auth`) sono usati da **1 sola** route; 33 handler re-implementano
  inline `await auth()` + check manuali. Astrazione quasi-morta → incoerenza e rischio drift.
  `[^rule: canonical/design.dry-auth-guard §Rationale]` `[^src5: code/app/lib/auth/index.ts:88]`
- **[LOW] `SESSION_MAX_AGE`** usato in `auth.ts` ma non documentato in `.env.example` (AC TSK-003).
  `[^rule: canonical/config.env.documented-vars §Rationale]` `[^src5: code/app/auth.ts:43]`

---

## TSK-004 — API skeleton · CONDITIONAL

**Positivi.** T-SEC-01 (scoping GET turni al dipendente), T-SEC-02 (POST admin-only), T-SEC-04
(pre-check campi vietati → 403 con schema `.strict()`) implementati correttamente. Audit log
fire-and-forget non bloccante (buon pattern robustezza, T-OPS-01). Schemi Zod condivisi FE/BE ben
strutturati, messaggi IT coerenti, refine cross-field. Paginazione con clamp `Math.min/max`. Parse del
body sempre in try/catch. Base solida.

### Finding critici

- **[HIGH · robustezza/correttezza] T-SEC-05 non applicato in `accept-swap`**
  L'AC di TSK-004 richiede «`accept-swap` con session non-destinatario → 403 (T-SEC-05)», ma
  l'autorizzazione è lasciata come `// TODO TSK-006`. **Allo stato attuale qualsiasi utente autenticato
  può accettare qualsiasi scambio.** Rinviare un AC esplicito a un TSK successivo è un gap di
  accettazione. In più l'handler imposta lo status a `awaiting_colleague` sull'accettazione
  (semanticamente all'indietro) e invia l'email a chi accetta. Enforce del target
  (`payload.targetUserId === session.user.id`) da fare in questo TSK.
  `[^rule: canonical/robustness.authz-acceptance-gap §Rationale]`
  `[^src5: code/app/app/api/requests/[id]/accept-swap/route.ts:37]`
  *(Overlap con qa-dev: aggiungere test T-SEC-05 — `[^rule: canonical/qa.testing.authz-coverage §Rationale]`.)*

### Finding minori

- **[MEDIUM · idiomaticità/type-safety] Cast di input utente non validato** — in `requests/route.ts`
  GET i query param sono forzati con `statusParam as 'draft'` e `typeParam as 'absence'` per soddisfare
  il tipo della colonna enum: si «mente» al compilatore. Valori invalidi passano silenziosamente
  (result set vuoto, nessun 400). Validare con allowlist/Zod dell'enum.
  `[^rule: canonical/idiomaticity.unsafe-type-assertion-user-input §Rationale]`
  `[^src5: code/app/app/api/requests/route.ts:54]`
- **[MEDIUM · consistenza] Doppia convenzione di risposta/errore** — la maggior parte usa
  `ApiResponse.*`; `users/me/password` usa `NextResponse.json` grezzo con envelope diverso
  (`{error:'dati non validi', details: error.flatten()}`) vs lo standard
  (`{error:'validation', issues: error.issues}`). Uniformare shape errore + serializzazione Zod.
  `[^rule: canonical/idiomaticity.consistent-api-envelope §Rationale]`
  `[^src5: code/app/app/api/users/me/password/route.ts:68]`
- **[MEDIUM · design/DRY] Boilerplate auth duplicato** — lo stesso guard
  (`await auth(); if(!session)…; if(role!=='admin')…`) è ripetuto in ~33 handler invece degli helper
  esistenti (stesso tema del finding DRY di TSK-003).
  `[^rule: canonical/design.dry-auth-guard §Rationale]`
- **[LOW · design] `submittedAt` su richiesta `draft`** — `requests` POST imposta
  `submittedAt: new Date()` mentre `status: 'draft'`: una bozza non è inviata. `submittedAt` andrebbe
  valorizzato alla transizione di submit. `[^rule: canonical/design.state-field-consistency §Rationale]`
  `[^src5: code/app/app/api/requests/route.ts:104]`
- **[LOW] `NEXT_PUBLIC_APP_URL`** usato in 5 file ma non documentato in `.env.example`.
  `[^rule: canonical/config.env.documented-vars §Rationale]`

---

## Loop status

- iter-1, nessun report precedente → nessun segnale no-progress / regression.
- `review_iter (1) < max_iterations (3)`.
- Nessun secret in chiaro reale (`.env.example` contiene solo placeholder) → nessun incidente sicurezza.

## Prossimo step

1. **TSK-003 → re-Develop iter-2** (task_package `conditional`, `max_diff_lines: 80`): (a) split
   config edge-safe per Auth.js; (b) propagare `session.user.id = token.sub` + augment type;
   (c) rimuovere/aggiungere colonna `updated_at` su `users`.
2. **TSK-004 → re-Develop iter-2**: applicare enforcement T-SEC-05 in `accept-swap`; sostituire i cast
   `as '<enum>'` con validazione; uniformare envelope errore.
3. **TSK-001 / TSK-002 → PASS**: azioni LOW/MEDIUM opzionali (env docs, eslint `project`, ADR divergenza
   schema) — non bloccanti per il merge.
4. **Governance ruleset**: materializzare le `rule_id` citate come bozze in
   `code_quality/rules/emergent/` con `status: candidate` (promozione a gate umano).
