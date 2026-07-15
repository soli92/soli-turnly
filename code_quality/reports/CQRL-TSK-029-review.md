# CQRL Code Review — TSK-029

> Email notification templates React Email + dispatch dal layer API (Inngest)
> Layer: **be** · code_path: `code/app/lib/email-templates/` (+ job + 4 route handler dispatch)

| Campo | Valore |
|---|---|
| `tsk_id` | TSK-029 |
| `stack_descriptor` | `typescript` · `react` · `next@15` · `react-email@1/2` · `inngest@3` · `resend` |
| `stack_confidence` | alta (stack_mode: guided; dipendenze verificate in `package.json`) — modalità **stack-aware attiva** (> `confidence_min` 0.6) |
| `iter` | esplicita (`/review` override una-tantum); loop automatico batch già a **3/3** (vedi Loop status) |
| `reviewer_version` | code-review-protocol v2.12 (PATTERN §19) |
| `generated_at` | 2026-07-15 |
| `verdict` | **conditional** |

---

## Passata 1 — Idiomaticità

**Valutazione generale: buona.** I template React Email sono idiomatici: componenti puri,
props tipizzate, stili inline via `React.CSSProperties` (obbligatori per compatibilità
client email), `BaseLayout` come layout condiviso non esportato nel barrel, `render()`
correttamente `await`-ato (v2 restituisce Promise), gestione di `exactOptionalPropertyTypes`
con spread condizionale sui campi opzionali. `after()` di `next/server` è l'API corretta per
il fire-and-forget post-response su Vercel.

Punto debole idiomatico principale: la **perdita di type-safety tra dispatch e render**
(F-029-01).

## Passata 2 — Design

Separazione template/dispatch pulita (template in `lib/email-templates/`, selezione+render
in `buildEmailHtml`, dispatch nei route handler). Retry Inngest = 3 (default), try/catch
fire-and-forget non compromette la Response API. Restano due smell di design (F-029-02,
F-029-04) e una discrepanza dato↔contratto (F-029-03).

## Passata 3 — Robustezza

Il fallback anti-crash è presente ovunque (`?? ''`), ma introduce un rischio PII nel ramo
`default` (F-029-05) e manca la copertura di test dichiarata dagli AC (F-029-06).

---

## Findings (ordinati per severità)

### F-029-01 · medium · idiomaticità/design — payload non tipizzato end-to-end
Il tipo dell'evento è `data: Record<string, unknown>` e `buildEmailHtml` fa cast difensivi
`(payload['x'] as string) ?? ''`. I 4 dispatch site costruiscono l'oggetto `data` come literal
non tipizzato: un refuso/omissione di chiave **non viene intercettato da TypeScript** e
l'email renderizza silenziosamente stringhe vuote. La prova che il drift è già avvenuto è il
doppio-lookup `payload['shiftTypeName'] ?? payload['shiftType']`.
Remediation: discriminated union `type EmailPayload = { template:'shift-assigned'; data: ShiftAssignedEmailProps } | …` così che ogni dispatch site sia type-checked contro il template.
Riferimenti: `code/app/lib/jobs/sendNotificationEmail.ts:53`, `:88`, `:82-131`; `code/app/app/api/shifts/route.ts:166`.
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]` (single-source-of-truth del contratto, applicata cross-layer)

### F-029-02 · medium · design/correttezza — `swap-request` agganciata al lifecycle sbagliato
Il template `SwapRequestEmail` è una proposta "accetta o rifiuta entro 48 ore", ma viene
dispatchata dall'handler **accept-swap** verso `currentUserId`, cioè l'utente che ha **appena
accettato**. Il destinatario riceve un "ti prego di rispondere" dopo aver già risposto.
La proposta dovrebbe partire alla **creazione** dello scambio (verso il collega bersaglio),
non all'accettazione. L'intero flusso swap è ancora stub (`TODO TSK-006`), quindi il fix va
coordinato col dominio; segnalo il wiring come debito di design (confina col funzionale/qa-dev,
ma la scelta di aggancio è dentro questo TSK).
Riferimenti: `code/app/app/api/requests/[id]/accept-swap/route.ts:80-118`; `code/app/lib/email-templates/SwapRequestEmail.tsx:72-75`.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

### F-029-03 · medium · design — il campo `period` mostra `submittedAt`, non il periodo richiesto
La prop `period` è documentata come periodo della richiesta (es. "15 lug – 22 lug"), ma
approve/reject passano `formatDate(existing.submittedAt)` → una **singola data di invio** in
formato `dd/MM/yyyy`. Il destinatario legge un'informazione errata ("Periodo: 14/07/2026" =
quando ha inviato, non le date di ferie/permesso).
Remediation: derivare `period` dal payload della richiesta (date range effettivo).
Riferimenti: `code/app/app/api/requests/[id]/approve/route.ts:110`; `.../reject/route.ts:108`; `code/app/lib/email-templates/RequestApprovedEmail.tsx:16`.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

### F-029-04 · low · design — duplicazione di `humanizeRequestType`
Funzione identica copiata in `approve/route.ts` e `reject/route.ts`. Estrarre in
`lib/` (es. `lib/requests/labels.ts`) e importarla in entrambi.
Riferimenti: `code/app/app/api/requests/[id]/approve/route.ts:26-34`; `.../reject/route.ts:25-33`.
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]` (principio single-source, cross-cutting)

### F-029-05 · medium · robustezza/PII — il fallback `default` fa dump del payload nell'email
Il ramo `default` ritorna `` `<p>${JSON.stringify(payload)}</p>` ``. `template` proviene da
`event.data as …` (valore runtime da Inngest, **non** garantito dai tipi): un template non
riconosciuto (drift produttore/consumatore) inietta l'intero payload — con PII (nomi, dati
richiesta) — nel corpo email inviato. Remediation: ritornare un body generico sicuro **e**
loggare l'errore senza il payload (o lanciare per far scattare il retry Inngest).
Riferimenti: `code/app/lib/jobs/sendNotificationEmail.ts:134-137`, `:153`.
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]` (ramo di fallback disallineato al contratto reale dei tipi)

### F-029-06 · medium · test coverage (delega qa-dev) — nessun test su template e job
Gli AC richiedono comportamenti verificabili (render non vuoto contenente il nome; stub →
`{ provider:'stub' }`; resend chiamato con `html`), ma **nessun file di test** referenzia
`email-templates`, `buildEmailHtml` o il job (verificato via grep; esistono solo test in
`lib/rules/__tests__`). Aggiungere unit test su `buildEmailHtml`/render + un test del branch
stub/resend. Non scrivo test (fuori scope CQRL): finding di severità medium instradato a qa-dev.
Riferimenti: assenza confermata in `code/app/tests/**` e `code/app/lib/**`.
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]` (categoria `qa.testing.*` — completamento a carico di qa-dev)

### F-029-07 · low · robustezza/PII (dev-only) — lo stub logga `to` + intero `data`
Il ramo stub (`RESEND_API_KEY` assente) fa `console.log` di `to` (indirizzo email) e dell'intero
`data` (nomi). È un percorso solo-locale, ma minimizzare la PII nei log è buona pratica.
Riferimenti: `code/app/lib/jobs/sendNotificationEmail.ts:180-186`.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

### F-029-08 · low · robustezza — "email valida" verificata solo come truthiness
Gli AC parlano di "email valida"; il gate è `requester?.email` (truthy), non un check di
formato. Accettabile se l'email è validata a monte (schema utente), ma da annotare.
Riferimenti: `code/app/app/api/requests/[id]/approve/route.ts:100`.

### F-029-09 · low · design — unsubscribe non funzionale
"Gestisci notifiche" e "Disiscrivi" puntano entrambe a `/profile`; nessun one-click
unsubscribe né header `List-Unsubscribe`. Accettabile per email transazionali, da valutare.
Riferimenti: `code/app/lib/email-templates/base-layout.tsx:66-72`.

**Nota positiva:** `after()` + try/catch fire-and-forget, `render()` awaited, gestione
`exactOptionalPropertyTypes` e provider stub/resend sono implementati correttamente.

---

## Loop status

- La review batch precedente (**cqrl-r3-batch-7**, iter **3/3 FINALE**) ha marcato TSK-029
  **PASS**, con i residui **M1 (dedup `humanizeRequestType`)** e **M2 (semantica `period`)**
  deferiti a backlog.
- **No-progress signal:** F-029-04 (= M1) e F-029-03 (= M2) sono gli **stessi** residui mai
  chiusi → stallo sui deferred.
- **No regression** rispetto al fix tz (`@/lib/date`) della iter-3: i tipi restano coerenti col
  DB schema.
- **Bounded loop (R.Q4):** il loop automatico è **esaurito (3/3)**. La remediation di questi
  finding richiede una **decisione umana (gate R.Q3)**, non un'ulteriore auto-iterazione.

## Prossimo step

Verdict **conditional**: nessun finding blocca la build (tsc/lint 0, 31/31 test pass a monte),
ma i medium sono azionabili e materiali (F-029-03 espone info errata all'utente finale;
F-029-05 è un rischio PII; F-029-06 lascia scoperti gli AC). Da instradare al dev-agent con
scope chiuso (`max_diff_lines: 80`): F-029-01, F-029-03, F-029-05 come primari; F-029-02 da
coordinare con TSK-006; F-029-06 a qa-dev; F-029-04/07/08/09 in backlog.

---

`verdict: conditional`

**Findings prioritizzati:**
1. F-029-05 (medium) — dump payload/PII nel fallback `default`
2. F-029-03 (medium) — `period` mostra `submittedAt` invece del periodo richiesto
3. F-029-01 (medium) — payload non tipizzato end-to-end (no discriminated union)
4. F-029-02 (medium) — `swap-request` agganciata all'evento sbagliato (accept-swap)
5. F-029-06 (medium, qa-dev) — nessun test su template/job nonostante gli AC
6. F-029-04 (low) — duplicazione `humanizeRequestType`
7. F-029-07 (low) — stub logga PII (dev-only)
8. F-029-08 (low) — email verificata solo come truthiness
9. F-029-09 (low) — unsubscribe non funzionale
