# CQRL Code Review — TSK-025 (Disponibilità dipendente — page + API GET/POST/DELETE)

- **Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
- **Generato**: 2026-07-15
- **Trigger**: comando esplicito `/review TSK-025` (override una-tantum). I report di batch precedenti
  (`cqrl-r3-batch-6-TSK025-028.md`) avevano chiuso il TSK a **PASS iter 3/3**; questa è una **re-review
  indipendente** con verdict autonomo (non un proseguimento del loop iter counter → nessun `loop-exhausted`).
- **Layer**: fe + be
- **Passate eseguite**: idiomaticità · design · robustezza · accessibility (interna)
- **Modalità**: **stack-aware** (non degradata)

---

## Stack rilevato

- **TypeScript 5.x** (`strict` + `exactOptionalPropertyTypes`, dedotto da pattern `?? null` e default espliciti)
- **Next.js 15 App Router** (RSC page + Route Handlers)
- **Drizzle ORM** (PostgreSQL, `jsonb` per `definition`, enum `availability_type`/`availability_scope`)
- **React Hook Form + Zod** (schema condiviso FE/BE, `zodResolver`)
- **shadcn/ui** (Radix: `Form`, `Select`, `AlertDialog`, `Input`, `Textarea`)
- **TanStack Query v5** (`hooks/useAvailability.ts`, key-factory `availabilityKeys`)
- **Confidence ≈ 0.9** (`raw/tech_stack.md` + `code/app/package.json`) → sopra `confidence_min: 0.6`.

**Nota ruleset**: le `rule_id` in `code_quality/rules/emergent/` sono tutte `status: candidate` (gate umano
§19.5). `canonical/` e `team-specific/` vuoti. → **tutti i verdetti sono advisory**; le severità sono
giudizio ingegneristico stack-aware. I finding senza rule_id corrispondente sono etichettati come
*advisory (nessuna rule esistente — non inventata)*.

---

## Verdetto

> **verdict: conditional**

Il TSK soddisfa i principali AC (CRUD funzionante, ownership guard corretta 403/404, Zod condiviso base,
a11y form solida, `AlertDialog` al posto di `confirm` nativo). Restano però **due finding medium azionabili**
(validazione `id` mancante → 500 su input malformato; mapping degli errori server per il campo `definition`
non atterra su alcun campo del form) e alcuni finding low/design. Nessun problema di sicurezza, nessun codice
non compilabile → **non `reject`**. I medium sono non-bloccanti per la funzionalità ma vanno chiusi → `conditional`.

---

## Finding (prioritizzati)

### [M-1] `DELETE ?id=` non valida il formato UUID → 500 su input malformato — **robustezza**
- **File**: `code/app/app/api/users/me/availability/route.ts` [^src5: code/app/app/api/users/me/availability/route.ts:87] [:97]
- Il parametro `id` letto da `url.searchParams.get('id')` viene passato **verbatim** a
  `eq(availability.id, id)` (colonna `uuid`). Con un `id` non-UUID (es. `?id=abc`), PostgreSQL solleva
  `invalid input syntax for type uuid`; il route **non ha try/catch** e `middleware.ts` gestisce solo RBAC,
  quindi l'errore risale come **500 Internal Server Error** invece di un 400/404 client-error.
- Input controllato dal client → superficie triggerabile banalmente. L'AC richiede 403 per id *altrui* e 404
  per id *inesistente*, ma non copre l'id *sintatticamente invalido*, che oggi produce 500.
- **Remediation**: validare `id` con `z.string().uuid()` (o guard regex) e rispondere
  `ApiResponse.badRequest(...)` prima della query; in alternativa avvolgere l'accesso DB in try/catch.
- **rule_id**: *advisory — nessuna rule emergent esistente*. Pattern candidabile a emergent
  `be.robustness.unvalidated-query-param` (non creata in questo run — gate umano §19.5).

### [M-2] Errori di validazione server sul campo `definition` non mappati su alcun campo del form — **design / error-handling**
- **File**: `code/app/app/(employee)/availability/_components/AvailabilityForm.tsx` [^src5: code/app/app/(employee)/availability/_components/AvailabilityForm.tsx:216] [:219-222]
- `onSubmit` mappa `issue.path[0]` → `form.setError(fieldName, …)`. Ma il contratto BE
  (`availabilityCreateSchema`) nidifica i campi dentro `definition` (union), quindi le issue hanno path
  `['definition', …]`. `path[0] === 'definition'` → `form.setError('definition', …)`, ma **non esiste alcun
  campo `definition` nel form** (i campi sono flat: `dayOfWeek`, `recurringStartTime`, `startDate`, …).
  Risultato: `setError` è un **no-op silenzioso**; l'utente vede solo il banner generico
  `createAvailability.error?.message` = `"validation"` [:478-481].
- Impatto pratico limitato (il FE pre-valida con `zodResolver`, quindi il path 400-BE si attiva solo per
  race/tampering), ma è un ramo di error-handling **rotto**: nessuna mappatura corretta esiste per gli errori
  definition-level.
- **Remediation**: tradurre i path BE (`definition.dayOfWeek` → `dayOfWeek`, `definition.startDate` →
  `startDate`, …) verso i field flat del form; oppure gestire esplicitamente `path[0] === 'definition'`.

### [M-3] `scope` mantenuto in doppio stato (`useState` locale + form) — **design / idiomaticità**
- **File**: `AvailabilityForm.tsx` [^src5: code/app/app/(employee)/availability/_components/AvailabilityForm.tsx:203] [:283-286]
- Il rendering condizionale dei fieldset (`scope === 'recurring'` [:308], `scope === 'date_range'` [:383])
  legge `scope` da uno **useState locale**, mentre `superRefine` valida `d.scope` dai **valori del form**.
  Ogni cambio scrive due volte (`field.onChange(val)` + `setScope(...)`). È una doppia sorgente di verità:
  oggi resta sincronizzata a mano (anche nel `reset` [:215]), ma è fragile — un percorso che aggiorni il form
  senza passare dal `onValueChange` (es. `setValue`/`reset` con scope diverso) desincronizzerebbe UI e
  validazione, mostrando fieldset di uno scope mentre si valida l'altro.
- **Remediation**: sostituire lo `useState` con `const scope = form.watch('scope')` (idioma RHF), eliminando
  la sincronizzazione manuale.
- **rule_id**: *advisory — idiomaticità RHF, nessuna rule esistente.*

### [M-4] Contratto `definition` duplicato/divergente FE↔BE — **design (debito carried)**
- **File FE**: `AvailabilityForm.tsx` [:56-73]; **File BE**: `code/app/lib/zod/index.ts` [^src5: code/app/lib/zod/index.ts:414-472]
- Positivo: `availabilityBaseSchema` (`type`/`scope`/`notes`) è ora **condiviso** [^src5: code/app/lib/zod/index.ts:402-406] — parte del debito M-1 storico è stata ridotta. Ma il cuore
  del contratto (`definition`) resta duplicato: BE = `z.union` nidificato con regex `^\d{2}:\d{2}$`
  (time) e `^\d{4}-\d{2}-\d{2}$` (date); FE = campi flat dove `startDate`/`endDate` sono `z.string().optional()`
  **senza regex** [:69-70]. Divergenza concreta: un valore data fuori formato passerebbe la validazione FE ma
  verrebbe respinto (400) dal BE — esattamente lo scenario che la regola avverte.
- Nota: questo M era stato **accettato come debito tecnico** (decisione umana, `cqrl-r3-batch-6`); lo ri-registro
  per completezza della re-review, **non bloccante**. Remediation ideale: estrarre uno schema `definition`
  per-tipo in `lib/zod/` e derivarne sia la union BE sia i campi FE.
- **rule_id**: [^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale] (candidate).

### [L-1] `page.tsx` non fa prefetch RSC — deviazione dal piano dello spec — **design (advisory)**
- **File**: `code/app/app/(employee)/availability/page.tsx` [^src5: code/app/app/(employee)/availability/page.tsx:15-31]
- Lo spec prevedeva `page.tsx ← RSC: fetch lista disponibilità via API`. L'implementazione verifica solo la
  sessione e delega **tutto** il data-fetching a TanStack Query lato client — nessun `dehydrate`/
  `HydrationBoundary`. Conseguenza: prima render sempre in skeleton, nessun beneficio SSR (che lo stack
  motiva come punto di forza di Next 15). La docstring della page è onesta (dichiara il delegato), quindi **non**
  è un doc-code-mismatch; è una deviazione architetturale consapevole. Non bloccante.

### [L-2] Formattazione date tz-unsafe nella card — **robustezza (advisory, vincolo normativo §11)**
- **File**: `AvailabilityCard.tsx` [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:68-77]
- `new Date(def.startDate).toLocaleDateString('it-IT', …)` interpreta `'YYYY-MM-DD'` come mezzanotte **UTC** poi
  formatta nel fuso del client → off-by-one nei fusi a ovest di UTC. `raw/tech_stack.md` impone gestione date
  **DST-safe via `@/lib/date`** (T-DOM-08/RB-12, Europe/Rome) — stesso pattern già sanato in TSK-029 (H2). Qui è
  display-only e a bassa frequenza → low, ma coerente con la single-source-of-truth date del progetto usare
  `@/lib/date`.

### [L-3] Errore di eliminazione visibile solo a screen-reader; dialog si chiude comunque su errore — **UX/a11y**
- **File**: `AvailabilityCard.tsx` [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:161-165] [:186]
- Su errore del `DELETE`, l'unico feedback è `<p role="alert" className="sr-only">` — invisibile agli utenti
  vedenti. Inoltre `onSettled: () => setConfirmOpen(false)` [:186] chiude il dialog **anche in caso di errore**,
  quindi l'utente vedente non riceve alcun segnale. Remediation: mostrare l'errore anche visivamente e/o
  mantenere aperto il dialog su fallimento.

### [L-4] `session.user.id as string` cast ridondante — **idiomaticità (advisory)**
- **File**: `route.ts` [:29] [:48] [:84]
- `types/next-auth.d.ts` tipizza già `Session.user.id: string` (non-nullable). Dopo `if (!session) return …`
  il cast `as string` è **ridondante** e, peggio, maschererebbe una regressione futura del type augmentation.
  Rimuovere i cast.

### [L-5] Nessuna validazione `startTime < endTime` — **robustezza / edge-case (advisory)**
- **File**: `lib/zod/index.ts` (union recurring/date_range) + `AvailabilityForm.tsx` superRefine
- Né FE né BE verificano che l'orario di fine sia successivo a quello di inizio. `18:00 → 09:00` è accettato.
  Potrebbe essere **intenzionale** per finestre notturne (es. 22:00–06:00) — in tal caso andrebbe documentato;
  altrimenti va aggiunta la validazione. Ambiguo → low, da chiarire con il dominio.

### [QA] Copertura test disponibilità — **delega a `qa-dev`** (fuori scope code-reviewer)
- Gli AC di TSK-025 (POST `dayOfWeek=8` → 400; DELETE altrui → 403; invalidazione lista dopo DELETE; edge
  `endDate < startDate`) richiedono test di integrazione/e2e. Nel code path in review non risultano spec
  dedicate a `availability` (a differenza di `ics-export.spec.ts` per TSK-031). Segnalato come `severity: medium`,
  `rule_id: qa.testing.*` → il completamento è responsabilità di `qa-dev` (§19.6). Il code-reviewer **non scrive test**.

---

## Cosa è corretto (per bilanciare)

- **Ownership guard DELETE**: select-by-id → 404 se assente → 403 se `userId` non combacia → delete scoped
  `AND userId` [:100-111]. Nessun IDOR. Conforme a RB-13/T-SEC-05 e all'AC (403 su id altrui).
- **GET/POST**: `userId` sempre da `session.user.id` (mai da query/body); GET ordinato `createdAt DESC`
  [:35]; POST valida con `availabilityCreateSchema.safeParse` e ritorna 201 con il record [:73].
- **`AlertDialog` (Radix)** al posto di `window.confirm` nativo — finding storico M-2 risolto e stabile.
- **A11y form**: `FormLabel` associati, `aria-required`, `FormMessage` (role=alert via shadcn), `fieldset/legend`,
  `aria-busy` sul submit, skeleton con `aria-busy`. Lista con `role="list"/"listitem"`.
- **Key-factory** `availabilityKeys` + invalidazione con prefix `all` che copre `list()` — coerente col pattern
  notifiche (TSK-028).

---

## Loop status

- **Re-review indipendente** su comando esplicito `/review`. Il loop di batch precedente era chiuso a **PASS
  iter 3/3**; questo run **non** incrementa l'iter counter e **non** attiva `loop-exhausted` (R.Q3).
- **No-progress**: n/a (run isolato). **Regression detection**: nessuna regressione rispetto ai fix del batch 6
  (AlertDialog e base-schema condiviso preservati); i medium M-1/M-2 emergono da un'analisi robustezza/error-path
  più profonda, non da nuove modifiche.
- **Blast radius pre-check**: non eseguito (`compression.context.enabled: false`, nessuno stato Graphify) →
  comportamento v2.14 Fase 1.
- **Sicurezza**: nessun secret, nessuna CVE, nessun IDOR → nessun incident, nessuno STOP `reject`.

## Prossimo step (per orchestratore / feedback-router)

1. `task_package` al dev-agent con scope ristretto ai medium (M-1 validazione UUID, M-2 mapping errori
   `definition`, M-3 `form.watch('scope')`), `max_diff_lines: 80`, **no refactor opportunistici**.
2. M-4 (schema `definition` FE/BE) resta **debito accettato**: tracciare in `wiki/gaps.md`, non forzare in questo giro.
3. Delega a `qa-dev` per i test availability (POST 400, DELETE 403, invalidazione, edge date).
4. Verdetti advisory (ruleset `emergent` = candidate). Nessuna regola creata/promossa in questo run (gate umano §19.5).
5. Nessun file di codice modificato, nessun test scritto (invarianti §19.6 R.Q2).

---

> **verdict: conditional**
> Finding bloccanti-soft: **M-1** (500 su UUID malformato), **M-2** (mapping errori server rotto per `definition`).
> Finding design: M-3 (dual-source scope), M-4 (schema definition duplicato — debito). Low: L-1…L-5. QA delegato a `qa-dev`.
> Nessun problema di sicurezza. Codice compilabile e AC principali soddisfatti.

*Report generato da code-reviewer (CQRL v2.12). Verdetti advisory: ruleset `emergent` interamente `status: candidate`.*
