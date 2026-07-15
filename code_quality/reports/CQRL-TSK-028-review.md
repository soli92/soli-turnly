# CQRL Code Review — TSK-028

**Report machine slug**: `CQRL-TSK-028-review`
**TSK**: TSK-028 — Centro notifiche page + potenziamento `NotificationBell` (RF-N)
**Layer**: fe · **Sprint**: 3 · **Wave**: 2
**Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
**Generated at**: 2026-07-15
**Verdict**: `conditional`

---

## Stack rilevato

| Asse | Descrittore | Confidence |
|---|---|---|
| language | TypeScript (strict) | high |
| framework | Next.js 15 App Router (RSC + Client boundary) | high |
| fe-data | TanStack Query v5 (`useQuery`, `useInfiniteQuery`, `useMutation`) | high |
| realtime | SSE via `EventSource` + broker in-process | high |
| ui | shadcn/ui + `@radix-ui/react-popover`, lucide-react | high |
| auth | next-auth (`useSession`, server `auth()`) | high |

Confidence > `confidence_min` (0.6) → **modalità stack-aware attiva**.
Ruleset attivo: `code_quality/rules/emergent/*` (`status: candidate`) → **finding advisory**.

---

## Contesto loop (fonte §8)

**Re-review esplicito** (`/review`, override una-tantum). Il loop CQRL automatico si era
chiuso a **iter 3/3 → `pass`** (`code_quality/reports/cqrl-r3-batch-6-TSK025-028.md`), dopo
che il vecchio M-1 (magic-string `['notifications']` + mutation duplicate) era stato risolto
con `useNotificationMutations.ts` + `notificationKeys`. R3 aveva lasciato un solo residuo
LOW noto: `notificationKeys.list()` orfano.

Questa passata di profondità conferma il residuo noto e aggiunge finding **nuovi** su
real-time/robustezza (sottoscrizione SSE duplicata, gestione errori mutation) non
tracciati nei batch precedenti. **No-progress detection**: non attivata.

---

## Verdict

```
verdict: conditional
```

Motivazione: feature funzionante, a11y curata, data-fetching già deduplicato. Nessun
problema bloccante o di sicurezza. Ma emerge un finding MEDIUM di design real-time
introdotto proprio da questa TSK (sottoscrizione SSE ridondante nella
`NotificationCenterClient`, con la campanella già sottoscritta nel layout) più alcuni LOW
di robustezza (mutation senza `onError`, codice orfano). Remediation < 80 righe → un giro
di fix mirato. **Non `reject`**: nessun gate di sicurezza né loop-exhausted.

---

## Findings (prioritizzati)

### F-028-01 · MEDIUM · Design/Robustezza (real-time) — Sottoscrizione SSE duplicata sulla pagina centro notifiche

`NotificationCenterClient` chiama `useNotifications()`
[^src5: code/app/app/(employee)/notifications/_components/NotificationCenterClient.tsx:58],
ma `useNotifications()` apre **una propria** connessione `EventSource`
[^src5: code/app/hooks/useNotifications.ts:113] e **non è idempotente/condivisa**. Sulla
stessa pagina la `NotificationBell` è già montata nel layout
[^src5: code/app/app/(employee)/layout.tsx:70] e chiama a sua volta `useNotifications()`
[^src5: code/app/components/notifications/NotificationBell.tsx:56].

Risultato: aprendo `/notifications` si aprono **2 connessioni SSE** verso
`/api/notifications/sse` per lo stesso utente (una dalla campanella nel layout, una dalla
pagina). La stessa `NotificationCenterClient` documenta "SSE subscription via
useNotifications()" come se fosse necessaria, ma l'invalidazione di `notificationKeys.all()`
fatta dalla campanella copre **già** la key `center()` (prefix match) — quindi la seconda
sottoscrizione è **ridondante**. Il broker registra due controller per lo stesso userId
[^src5: code/app/app/api/notifications/sse/route.ts:37]; considerando anche altri consumer
che invocano `useNotifications()` (es. `InboxBadge`, `CoveragePageClient`) si rischia di
avvicinarsi al limite ~6 connessioni SSE per dominio (HTTP/1.1).

**Impatto**: connessioni SSE duplicate, doppio traffico di eventi, pressione sul pool di
connessioni.
**Remediation (scoped a TSK-028)**: rimuovere `useNotifications()` da
`NotificationCenterClient` — la campanella nel layout già garantisce l'invalidazione. Più in
generale (fuori scope TSK-028) centralizzare la sottoscrizione SSE una sola volta a livello
di provider/layout, rendendo `useNotifications()` un consumer no-op se già attiva.
*(no existing rule; candidate: `fe.realtime.duplicate-sse-subscription`)*

---

### F-028-02 · MEDIUM · Robustezza (real-time) — Reconnect SSE senza backoff/cap: loop infinito su 401 permanente

`useNotifications` gestisce `onerror` chiudendo e riconnettendo con **delay fisso 5s**, senza
backoff esponenziale, jitter o numero massimo di tentativi
[^src5: code/app/hooks/useNotifications.ts:116]. Il commento afferma che su sessione scaduta
(401) "lo stream sarà chiuso di nuovo senza dati: comportamento corretto" — ma in realtà si
genera un **busy-loop**: ogni 5s si riapre `EventSource`, il server risponde 401, `onerror`
riparte, all'infinito, finché la tab resta aperta. Nessuna condizione di stop su auth
permanentemente negata.

**Nota di attribuzione**: l'hook è di TSK-008; TSK-028 lo **riusa** (e lo raddoppia — vedi
F-028-01). Peso sul verdict TSK-028 ridotto (codice ereditato), ma segnalato perché la
scelta di riusarlo così com'è amplifica l'impatto.
**Remediation**: backoff esponenziale con cap + jitter; interrompere i tentativi su 401
(o forzare re-auth) invece di ritentare indefinitamente. Correggere anche il commento che
etichetta il loop come "corretto".
[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Detection]
*(componente backoff: no existing rule; candidate: `fe.realtime.sse-reconnect-no-backoff`)*

---

### F-028-03 · LOW-MEDIUM · Robustezza/UX — Mutation mark-read / mark-all-read senza `onError` né update ottimistico

`useMarkRead` e `useMarkAllRead` gestiscono solo `onSuccess` (invalidazione)
[^src5: code/app/hooks/useNotificationMutations.ts:54], senza `onError` e senza update
ottimistico. Conseguenze:

- Se `PATCH /read` o `/read-all` fallisce, l'errore è **silenzioso**: nessun toast, nessun
  rollback; l'utente crede di aver segnato come lette.
- Su `NotificationItem` con link entità, il click segna-come-letta **e** naviga
  contemporaneamente [^src5: code/app/app/(employee)/notifications/_components/NotificationItem.tsx:98];
  senza optimistic update il badge/sfondo resta "non letto" finché non completa
  l'invalidazione, che avviene dopo la navigazione (utente già su un'altra pagina) → il
  feedback visivo è incoerente.

**Remediation**: aggiungere `onError` (toast) e, per il mark-read su click+navigazione,
`onMutate` ottimistico (setQueryData) con rollback su errore.

---

### F-028-04 · LOW · Robustezza/UX — `MarkAllReadButton` sempre abilitato anche con 0 non lette

Nel header pagina il pulsante è renderizzato incondizionatamente
[^src5: code/app/app/(employee)/notifications/page.tsx:39] e disabilitato solo durante
`isPending` [^src5: code/app/app/(employee)/notifications/_components/MarkAllReadButton.tsx:26].
Con zero non lette il click esegue comunque `PATCH /read-all` (ritorna `{updated:0}`) —
richiesta inutile e assenza di feedback. Il componente non ha accesso a `unreadCount`
(a differenza della campanella, che nasconde "Segna tutte" se `unreadCount === 0`
[^src5: code/app/components/notifications/NotificationBell.tsx:102]).
**Remediation**: leggere `unreadCount` (query condivisa `notificationKeys.all()`) e
disabilitare/nascondere il pulsante quando è 0; opzionale toast di conferma.

---

### F-028-05 · LOW · Dead code — `notificationKeys.list()` orfano (residuo noto R3)

`notificationKeys.list()` è definito [^src5: code/app/hooks/useNotificationMutations.ts:26]
ma non ha alcun riferimento nel code path (la campanella usa `all()`, il centro `center()`).
Già segnalato in R3 come micro-debito e ancora presente.
**Remediation**: usarlo come query key della campanella (semanticamente più corretto di
`all()`, che è la key di invalidazione root) **oppure** rimuoverlo.
[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection]

---

### F-028-06 · LOW · Idiomaticità (TS strict) — Cast ripetuto `session.user.id as string`

`session.user.id as string` compare più volte nella route `read-all`
[^src5: code/app/app/api/notifications/read-all/route.ts:30] e in
`/api/notifications` [^src5: code/app/app/api/notifications/route.ts:37]. Il cast ripetuto
indica che il tipo di sessione non espone `id` come `string`. Meglio tipizzare l'augmentation
di next-auth (`Session["user"]["id"]: string`) una volta, eliminando i cast sparsi.
**Remediation**: aggiungere/allineare `types/next-auth.d.ts` e rimuovere i cast.

---

### F-028-07 · LOW · Idiomaticità — `getEntityLink` con `Record<string,string>` non tipizzato sull'unione

`getEntityLink` indicizza una mappa `Record<string,string>` con
`n.relatedEntityType` [^src5: code/app/app/(employee)/notifications/_components/NotificationItem.tsx:26].
Se il modello dati definisce `relatedEntityType` come unione (`'request'|'shift'|'absence'`),
usare `Record<EntityType, string>` renderebbe esaustivo il mapping e catturerebbe a compile
time l'aggiunta di nuovi tipi entità.
**Remediation**: tipizzare la mappa sull'unione del campo; il fallback `?? null` copre già i
valori non mappati a runtime.

---

### F-028-08 · INFO · Robustezza — Broker SSE in-memory single-instance (limite documentato, non nuovo)

Il broker è in-process [^src5: code/app/app/api/notifications/sse/route.ts:13]: su deploy
multi-instance (Vercel) gli eventi emessi da un'istanza non raggiungono i client connessi ad
altre istanze → CA1/CA2 real-time potrebbero fallire in produzione serverless. Limite
**già documentato** nel file e non introdotto da TSK-028 (TSK-008). Nessuna azione richiesta
in questo giro; annotato per consapevolezza (richiede Redis pub-sub o Inngest per il
fan-out cross-instance).

---

## Testing gap (→ `qa-dev`, non code-reviewer)

Nessun test funzionale/e2e per il centro notifiche o per `PATCH /read-all`: la copertura
sprint3 è solo visual (`tests/visual/sprint3/notifications.spec.ts`) + a11y. Mancano:
`MarkAllReadButton` → badge a 0 su pagina e campanella (AC), mark-read su click con
navigazione, IDOR `userId = session.user.id` su `/read-all` (RF-N CA3), empty state,
paginazione "Carica altre". Severity `medium`, `rule_id: qa.testing.*`. **La stesura dei test
spetta a `qa-dev`.** [^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]

---

## Aspetti positivi (non-finding)

- **Data-fetching deduplicato**: `notificationKeys` factory + `useMarkRead`/`useMarkAllRead`
  eliminano la magic-string e le mutation duplicate; tutti i consumer migrati
  [^src5: code/app/hooks/useNotificationMutations.ts:22] (risolve il vecchio M-1).
- **Gerarchia query key corretta**: `all()` → `list()` → `center()`; invalidare
  `['notifications']` copre campanella + centro via prefix match — cross-invalidazione
  coerente [^src5: code/app/app/(employee)/notifications/_components/NotificationCenterClient.tsx:60].
- **Infinite scroll idiomatico**: `useInfiniteQuery` con `getNextPageParam` che ferma su
  pagina parziale [^src5: code/app/app/(employee)/notifications/_components/NotificationCenterClient.tsx:65].
- **A11y RF-N rispettata**: `role="list"`/`role="listitem"`, `<time datetime={ISO}>`, badge
  "Non letta" con `aria-label`, empty state con icona `aria-hidden`
  [^src5: code/app/app/(employee)/notifications/_components/NotificationItem.tsx:82].
- **Sicurezza IDOR corretta**: `/read-all` filtra sempre per `userId = session.user.id`
  [^src5: code/app/app/api/notifications/read-all/route.ts:30] + audit log (RF-N CA3);
  SSE 401 senza sessione [^src5: code/app/app/api/notifications/sse/route.ts:24].
- **Requisiti TSK soddisfatti**: link "Vedi tutte →" nel Popover
  [^src5: code/app/components/notifications/NotificationBell.tsx:171] e link nav admin a
  `/notifications` [^src5: code/app/app/admin/layout.tsx:59].
- **Cleanup SSE**: `clearTimeout` + `es.close()` in unmount
  [^src5: code/app/hooks/useNotifications.ts:127] (nessun leak sul singolo hook — il problema
  è la molteplicità, F-028-01).

---

## Loop status

| Campo | Valore |
|---|---|
| Loop precedente | chiuso a iter 3/3 → `pass` (batch R3) |
| Questa passata | re-review esplicito `/review` (advisory) |
| No-progress | non attivo (finding nuovi) |
| Regression | n/a (non è iterazione di fix su diff dev-agent) |
| Loop-exhausted | no |
| Security incident | nessuno (IDOR coperto) |

---

## Prossimo step

`task_package` suggerito per il dev-agent (modalità `conditional`, scope ristretto):

1. **F-028-01** — rimuovere `useNotifications()` da `NotificationCenterClient` (la campanella
   nel layout copre già l'invalidazione). Fix a 1 riga, impatto alto sul consumo SSE.
2. **F-028-03** — aggiungere `onError` (toast) a `useMarkRead`/`useMarkAllRead` + optimistic
   update per il mark-read su click+navigazione.
3. **F-028-04** — disabilitare/nascondere `MarkAllReadButton` con `unreadCount === 0`.
4. **F-028-05** — rimuovere o usare `notificationKeys.list()`.
5. **F-028-06/07** — LOW idiomatici (augmentation next-auth; mappa entity tipizzata).
6. **F-028-02** — (fuori scope stretto TSK-028, hook TSK-008) backoff+cap sul reconnect SSE.
7. Testing → `qa-dev` (vedi sezione dedicata).

Vincoli: `max_diff_lines: 80`, "fix only the findings below; no opportunistic refactor".

---

*Report generato da code-reviewer (CQRL v2.12, PATTERN §19). Ruleset `emergent` in stato
`candidate` → verdetti advisory. Nessun problema di sicurezza rilevato (IDOR coperto, no
secret in chiaro, no CVE). Il codice non è stato modificato (R.Q2). I test non sono stati
scritti (competenza `qa-dev`).*
