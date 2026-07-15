# CQRL Code Review — TSK-027

**Report machine slug**: `CQRL-TSK-027-review`
**TSK**: TSK-027 — Report straordinari page + API `GET /api/admin/reports/overtime`
**Layer**: fe+be · **Sprint**: 3 · **Wave**: 2
**Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
**Generated at**: 2026-07-15
**Verdict**: `conditional`

---

## Stack rilevato

| Asse | Descrittore | Confidence |
|---|---|---|
| language | TypeScript (strict, `exactOptionalPropertyTypes`) | high |
| framework | Next.js 15 App Router (RSC + Client boundary) | high |
| data | Drizzle ORM (`db.select().innerJoin().leftJoin()`) | high |
| fe-data | TanStack Query v5 + TanStack Table v8 | high |
| ui | shadcn/ui + Radix (`Select`, `Input`, `Button`) | high |
| date | date-fns + `@date-fns/tz` (via `lib/date`) | high |

Confidence > `confidence_min` (0.6) → **modalità stack-aware attiva** (no degradazione).
Ruleset attivo: `code_quality/rules/emergent/*` con `status: candidate` → **finding advisory**.

---

## Contesto loop (fonte §8)

Questo è un **re-review esplicito** (`/review`, override una-tantum). Il loop automatico
CQRL precedente si era già chiuso a **iter 3/3 → `pass`**
(`code_quality/reports/cqrl-r3-batch-6-TSK025-028.md`). Note di continuità:

- **Decisione umana recepita** (R3, input orchestratore): la duplicazione della logica
  overtime RB-06 nella route è stata **accettata come debito tecnico**. Coerentemente con
  §7 ("l'umano decide") **non è ri-elevata a finding bloccante** in questo giro — resta
  registrata come *debito noto* (F-027-06, informativo).
- La componente di **correttezza** del vecchio M-1 (scarto ±1 min) risulta **risolta**:
  la route usa ora `differenceInMinutes` allineato a `calculateOvertime.ts`
  [^src5: code/app/app/api/admin/reports/overtime/route.ts:86].
- **No-progress detection**: non attivata (i finding sotto sono nuovi, emersi da una
  passata di profondità maggiore; non è ripetizione dello stesso `rule_id` set).

I finding che seguono sono in maggioranza **nuovi** rispetto ai report di batch R1–R3 e
riguardano robustezza/design non ancora indirizzati.

---

## Verdict

```
verdict: conditional
```

Motivazione: il deliverable è funzionante e ha già passato il loop; nessun problema
bloccante, di sicurezza grave o di codice rotto. Tuttavia questa passata di profondità
rileva **due finding MEDIUM di design/robustezza non ancora tracciati** (paginazione DB
non limitata; semantica soglia "mensile" applicata a periodo arbitrario) più una
copertura test assente sul calcolo core RB-06. Diff di remediation stimato < 80 righe
(`router.max_diff_lines`) → un giro di fix mirato è appropriato. **Non `reject`**: nessun
gate umano di sicurezza né loop-exhausted.

---

## Findings (prioritizzati)

### F-027-01 · MEDIUM · Robustezza/Design — Paginazione DB non limitata + metadati assenti + FE che non pagina

La route dichiara "Paginazione: page + limit (default 50)" ma:

1. La query DB recupera **tutti** i turni non-cancelled nel range per **tutti** gli utenti,
   senza `LIMIT`/`OFFSET` [^src5: code/app/app/api/admin/reports/overtime/route.ts:155].
   Aggregazione, sort e `slice()` avvengono **in memoria applicativa**
   [^src5: code/app/app/api/admin/reports/overtime/route.ts:227]. Su organizzazioni grandi
   o range lunghi il costo di memoria/CPU cresce con il numero totale di turni, non con
   `limit`: la paginazione **non riduce il carico DB** (è cosmetica).
2. La response omette qualsiasi metadato di paginazione (`total`, `page`, `hasMore`)
   [^src5: code/app/app/api/admin/reports/overtime/route.ts:232]: il client non può
   renderizzare controlli "pagina successiva".
3. Il client di fatto **non pagina mai**: `useOvertimeReport` invia `page`/`limit` solo se
   passati [^src5: code/app/hooks/useOvertimeReport.ts:74], e `OvertimeReportClient` non li
   passa mai [^src5: code/app/app/admin/reports/overtime/_components/OvertimeReportClient.tsx:84].
   Con >50 dipendenti il report **tronca silenziosamente** i risultati alla prima pagina
   senza avvisare l'utente.

**Impatto**: doc-code mismatch (contratto dichiarato ≠ comportamento) + rischio di
troncamento silenzioso + scalabilità.
**Remediation**: o (a) esporre `total`/`hasMore` e far paginare il client, o (b) dichiarare
esplicitamente il report "single-page fino a N" e alzare/limitare in modo visibile; in ogni
caso allineare docstring e AC. Valutare l'aggregazione lato DB (`GROUP BY userId`) per non
materializzare tutti i turni in memoria.
[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]
*(componente scalabilità: nessuna rule esistente — candidate pattern proposto:
`be.data.unbounded-aggregation-before-pagination`)*

---

### F-027-02 · MEDIUM · Design/Correttezza — Soglia "mensile" (40h) confrontata con overtime di periodo arbitrario

`overtimeExceedsThreshold` confronta `overtimeHours` (somma su **tutte** le settimane ISO
del range from→to) con la costante `MAX_STRAORDINARIO_MENSILE_ORE = 40`
[^src5: code/app/app/api/admin/reports/overtime/route.ts:222]. Ma il range è
**arbitrario**: il default è il mese corrente
[^src5: code/app/app/admin/reports/overtime/_components/OvertimeReportClient.tsx:41], ma
l'admin può selezionare 1 settimana o 6 mesi.

- Range 3 mesi → overtime totale ~3× → badge "Sopra soglia" quasi sempre acceso anche se
  nessun singolo mese supera 40h.
- Range 1 settimana → soglia praticamente irraggiungibile.

La semantica RB-06 ("max straordinario **mensile**") non è preservata: si applica una
soglia mensile a un aggregato di durata variabile. L'AC (CA2) formalizza il confronto
grezzo, quindi il codice è *conforme all'AC scritto*, ma l'AC stesso ignora la lunghezza
del periodo → il badge può fuorviare.
**Remediation**: normalizzare per mese (overtime medio mensile, o soglia scalata sui mesi
del range), oppure vincolare il picker a un mese, oppure rinominare/riqualificare il badge
("straordinario nel periodo") ed etichettare la soglia in modo coerente. Richiede
allineamento con il product owner sull'AC.
*(no existing rule; candidate: `be.domain.threshold-period-mismatch`)*

---

### F-027-03 · MEDIUM · Testing — Nessun test automatico sul calcolo core RB-06 (né canonico né re-implementazione)

Il calcolo straordinari è business-critical (RB-06, AC CA1: 40h contratto + 46h assegnate
→ `overtimeHours = 6.00`) ma:

- `lib/rules/calculateOvertime.ts` (canonico) **non ha test** (assente da
  `lib/rules/__tests__/`).
- `calculateOvertimeForPeriod` nella route (bucketing settimana ISO)
  [^src5: code/app/app/api/admin/reports/overtime/route.ts:74] **non ha test**.
- La copertura TSK-027 è solo visual + a11y (`tests/visual/sprint3/reports-overtime.spec.ts`,
  `tests/a11y/sprint3/a11y-sprint3.spec.ts`): nessun test verifica CA1, il filtro `userId`,
  il 403 non-admin, il 400 `from>to`, il periodo vuoto, l'ordinamento desc.

Doppia superficie di regressione non protetta su una regola di dominio. Segnalato come
`qa.testing.*` (severity `medium`); **il completamento dei test spetta a `qa-dev`**, non al
code-reviewer.
[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]

---

### F-027-04 · LOW-MEDIUM · Robustezza/Doc — `lib/date` non usato: bucketing settimana ISO in timezone del server

La TSK richiede il calcolo "DST-safe con `lib/date`", ma la route importa direttamente da
`date-fns` (`startOfISOWeek`, `differenceInMinutes`)
[^src5: code/app/app/api/admin/reports/overtime/route.ts:29] senza passare per i wrapper
`lib/date` (`getDurationMinutes`, helper timezone-aware) [^src5: code/app/lib/date/index.ts:94].

- La *durata* (`differenceInMinutes` su timestamp UTC) è di per sé DST-safe → nessun bug di
  durata.
- Ma `startOfISOWeek(shift.startDt)` opera in **timezone locale del processo**
  [^src5: code/app/app/api/admin/reports/overtime/route.ts:84]. In deploy UTC (es. Vercel) un
  turno domenica 23:30 Europe/Rome (= 22:30 UTC) può cadere nel bucket-settimana sbagliato
  rispetto al confine ISO week di Europe/Rome, spostando ore tra le settimane e quindi la
  ripartizione ordinario/straordinario ai bordi di settimana.

**Nota**: lo stesso limite è presente nel canonico `calculateOvertime.ts` — quindi almeno
la divergenza è coerente, ma il principio "sempre UTC internamente, TZ-aware ai confini"
di `lib/date` [^src5: code/app/lib/date/index.ts:9] non è rispettato.
**Remediation**: derivare i confini settimana con l'helper timezone-aware di `lib/date`
(Europe/Rome), o documentare l'assunzione "week boundary in server TZ" e pinnare `TZ`.
Aggiornare inoltre le docstring che citano il path route-group `app/(admin)/reports/...`
[^src5: code/app/app/admin/reports/overtime/page.tsx:1] mentre il path reale è
`app/admin/reports/...` (no route group).
[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Detection]

---

### F-027-05 · LOW · Idiomaticità/UX — Messaggio d'errore server non mostrato (shape `ApiResponse` ≠ parsing hook)

`ApiResponse.badRequest(msg)` produce `{ error: 'validation', issues: msg }`
[^src5: code/app/lib/api-response.ts:32], ma la route la usa con messaggi umani
("from deve precedere to", "Formato data non valido")
[^src5: code/app/app/api/admin/reports/overtime/route.ts:139]. L'hook legge però
`body.error` [^src5: code/app/hooks/useOvertimeReport.ts:84] → l'utente vedrebbe la stringa
`"validation"`, non il messaggio. Il messaggio reale finisce in `body.issues`, ignorato.

Percorso in gran parte mascherato dalla validazione client `from >= to`
[^src5: code/app/app/admin/reports/overtime/_components/OvertimeReportClient.tsx:107], ma su
400 server-side genuini (es. formato data) il feedback è opaco.
**Remediation**: leggere `body.issues` quando `body.error === 'validation'`, oppure usare
un helper `badRequest` che metta il messaggio umano in un campo letto dal client.

---

### F-027-06 · LOW · Robustezza — Incoerenza validazione stesso-giorno (client più severo del server)

Il client rifiuta `from == to` (`from >= to` su stringhe)
[^src5: code/app/app/admin/reports/overtime/_components/OvertimeReportClient.tsx:107],
mentre il server **accetta** lo stesso giorno perché confronta `fromDate` (00:00:00Z) con
`toDate` (23:59:59.999Z) [^src5: code/app/app/api/admin/reports/overtime/route.ts:139]. Un
report di **un singolo giorno** è quindi valido lato API ma **irraggiungibile via UI**.
**Remediation**: allineare le due regole (consentire `from == to` anche nel client, o
rifiutarlo esplicitamente nel server) — decidere il contratto e renderlo unico.

---

### F-027-07 · LOW · Robustezza (data hygiene, borderline-security) — CSV formula injection non mitigata

`exportCsv` esegue quoting/escaping dei doppi apici ma non neutralizza i prefissi di
formula (`=`, `+`, `-`, `@`, TAB) [^src5: code/app/app/admin/reports/overtime/_components/OvertimeFilters.tsx:86].
`firstName`/`lastName`/`qualificationName` provengono dal DB (input utente in fase di
anagrafica): un valore tipo `=HYPERLINK(...)` verrebbe interpretato come formula
all'apertura in Excel/Sheets.

Non è un secret in chiaro né una CVE nota → **non** apro incident né forzo `reject` (§19.6
R.Q7). Lo classifico come robustezza/igiene del dato con nota di confine sicurezza.
**Remediation**: prefissare con apice singolo o `\t` i campi testuali che iniziano con un
carattere di formula prima del quoting.
*(no existing rule; candidate: `fe.export.csv-formula-injection`)*

---

### F-027-08 (ex M-1) · INFO / DEBITO ACCETTATO — Logica RB-06 duplicata inline nella route

`calculateOvertimeForPeriod` re-implementa il bucketing settimana ISO + soglia RB-06 nella
route [^src5: code/app/app/api/admin/reports/overtime/route.ts:74] invece di riusare/estendere
`lib/rules/calculateOvertime.ts` [^src5: code/app/lib/rules/calculateOvertime.ts:23], come la
TSK stessa prescriveva ("Usa `calculateOvertime` già esistente"). Pattern corrispondente:
[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale].

**Stato**: **debito tecnico accettato per decisione umana** in R3 (§7). **Non conta come
finding aperto bloccante** e non incide sul verdict. Registrato qui solo per tracciabilità:
la remediation raccomandata resta estrarre una primitiva condivisa
`lib/rules` "overtime su range (somma per settimana ISO)" usata sia dalla validazione sia
dal report, così che la soglia e l'aritmetica non possano divergere.

---

## Aspetti positivi (non-finding)

- **Radix Select conforme**: usa il sentinella `__all__` normalizzato a `undefined`
  [^src5: code/app/app/admin/reports/overtime/_components/OvertimeFilters.tsx:198] —
  esattamente la remediation di
  [^rule: code_quality/rules/emergent/fe.react.radix-select-empty-value.md §Remediation]
  (nessun `SelectItem value=""`).
- **Boundary RSC/Client corretto**: `page.tsx` è RSC con guard `auth()` + `redirect` e
  prefetch utenti; la logica interattiva è isolata nei `_components` client
  [^src5: code/app/app/admin/reports/overtime/page.tsx:28].
- **Auth a doppio livello**: guard sia sulla route API (403)
  [^src5: code/app/app/api/admin/reports/overtime/route.ts:115] sia sulla pagina
  (redirect) — RF-I "admin only" rispettato.
- **A11y solida**: `aria-busy` sullo skeleton senza layout shift, `scope="col"`,
  `<time datetime>`, `role="alert"` sugli errori, badge con `aria-label` esplicito,
  `overflow-x-auto` per lo scroll mobile (AC 375px).
- **TS strict rispettato**: `exactOptionalPropertyTypes` gestito con `| undefined` espliciti
  e commentato [^src5: code/app/app/admin/reports/overtime/_components/OvertimeFilters.tsx:55].
- **Correttezza aritmetica RB-06**: allineamento `differenceInMinutes` chiude lo scarto ±1
  min del vecchio M-1.

---

## Loop status

| Campo | Valore |
|---|---|
| Loop precedente | chiuso a iter 3/3 → `pass` (batch R3) |
| Questa passata | re-review esplicito `/review` (advisory) |
| No-progress | non attivo (finding nuovi, `rule_id` set diverso) |
| Regression | n/a (non è iterazione di fix su diff dev-agent) |
| Loop-exhausted | no |
| Security incident | nessuno |

---

## Prossimo step

`task_package` suggerito per il dev-agent (modalità `conditional`, scope ristretto):

1. **F-027-01** — decidere contratto paginazione: esporre `total`/`hasMore` + far paginare
   il client, oppure dichiarare "single-page fino a N" con avviso di troncamento; valutare
   aggregazione DB.
2. **F-027-02** — riqualificare la semantica soglia rispetto al periodo (allineamento PO
   sull'AC CA2).
3. **F-027-03** — (→ `qa-dev`) unit test su `calculateOvertime`/`calculateOvertimeForPeriod`
   (CA1) + integration test route (403 / 400 from>to / userId / vuoto / sort desc).
4. **F-027-04/05/06/07** — fix LOW mirati (lib/date week-boundary o doc; parsing `issues`;
   coerenza same-day; sanitizzazione CSV).

Vincoli: `max_diff_lines: 80`, "fix only the findings below; no opportunistic refactor".
F-027-08 (DRY) **escluso** dallo scope (debito accettato).

---

*Report generato da code-reviewer (CQRL v2.12, PATTERN §19). Ruleset `emergent` in stato
`candidate` → verdetti advisory. Nessun problema di sicurezza rilevato (no secret in chiaro,
no CVE). Il codice non è stato modificato (R.Q2). I test non sono stati scritti (competenza
`qa-dev`).*
