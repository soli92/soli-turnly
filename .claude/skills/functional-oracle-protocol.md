---
name: functional-oracle-protocol
description: Skill 5-fasi per il functional oracle (EP-018). Esercita l'app reale: Serve → Load Fixture → Drive Scenario → Assert Outcomes → Diff+Loop. Riusa interaction-drive-protocol (ADR-066), screenshot-capture-protocol (ADR-017), app-lifecycle serve (ADR-064). Eseguita da qa-dev in modalità functional-oracle (ADR-067).
---
# Protocollo Functional Oracle — verifica funzionale end-to-end dell'app reale

Skill procedurale a 5 fasi per l'oracolo funzionale (EP-018): esercita l'app reale con
input reali, esegue lo scenario dichiarato, asserisce gli esiti funzionali osservabili ed
emette un verdict `pass|conditional|reject` con evidenza. È la risposta al failure mode
«sembra finito ma non lo è» al livello funzionale (comportamento, non aspetto grafico).

Eseguita da **`qa-dev` in modalità functional-oracle** (sub-skill, ADR-067 §A): nessun
nuovo sub-agent; `qa-dev` è la sede naturale dell'accettazione funzionale. Fallback se
`qa-dev` non in topologia: la skill gira via `fe-dev` (precedenza analoga ad ADR-014 per
a11y, ADR-067 §A).

**Scope di questo documento (TSK-141 + TSK-142 + TSK-143)**: tutte e 5 le fasi.
Fase 1 (Serve) + Fase 2 (Load Fixture) + Fase 3 (Drive Scenario) + Fase 4 (Assert Outcomes) +
Fase 5 (Diff+Loop bounded).

Riferimenti ADR:
[`ADR-064`](../../design_&_architecture/decisions/ADR-064.md) (app-lifecycle serve +
tool callability binding),
[`ADR-065`](../../design_&_architecture/decisions/ADR-065.md) (acceptance-spec: schema
framework, contenuto progetto, fail-loud §E),
[`ADR-066`](../../design_&_architecture/decisions/ADR-066.md) (delega interazione a
`interaction-drive-protocol`, runtime condiviso),
[`ADR-067`](../../design_&_architecture/decisions/ADR-067.md) (esecutore = `qa-dev`,
verdict deterministico, critic LLM advisory).

Sub-skill / cross-link: invocata dal comando standalone `/functional-oracle <TSK-id|app>`
(US-018a) e da `dev-protocol` quando `fe_correctness.functional_oracle.enabled: true`.
Ordering nel cascade (ADR-066 §Conseguenze): `develop → visual-oracle → functional-oracle → review`.

[^src: design_&_architecture/decisions/ADR-067.md §A]
[^src: design_&_architecture/decisions/ADR-065.md §E]
[^src: design_&_architecture/decisions/ADR-066.md §B §C]

## Prerequisiti

- `fe_correctness.functional_oracle.enabled: true` (master gate — STOP no-op altrimenti,
  R.P3). A flag spento la skill è un no-op dichiarato (backward compat totale).
- `qa-dev` con `Bash` nel frontmatter (ADR-064 §A): il binding callable è obbligatorio
  per servire l'app ed eseguire Playwright.
- Playwright disponibile nel project host: verificato alla Fase 1 (fail-loud altrimenti).
- `code_path` del TSK risolvibile (frontmatter `code_path:` o `target:` → entry in
  `code_paths`).
- `acceptance-spec` presente e valida se `enabled: true` (ADR-065 §E).

[^src: design_&_architecture/decisions/ADR-064.md §C §D]
[^src: design_&_architecture/decisions/ADR-065.md §E]

## Costanti

```
MAX_ITERATIONS    = fe_correctness.functional_oracle.max_iterations  # default 3 (ADR-067 §C / R.Q4)
REPORTS_DIR       = "code_quality/reports"                           # side-channel riusato (ADR-065 §Storage)
ACCEPTANCE_GLOB   = "code_quality/acceptance/<app|tsk>.acceptance.yaml"  # default path spec (ADR-065 §B)
SCHEMA_PATH       = ".claude/schemas/acceptance-spec.schema.yaml"    # schema authoritative (US-069)
RUNNER_DIR        = ".factory-runners"                               # script Bash, gitignored (ADR-008 §Rationale 2)
```

---

## Fase 1 — Serve

**Input atteso**: `TSK-id` (target del functional oracle), `factory.config.yaml`,
`code_path` risolto.

**Single source**: questa fase **non reimplementa** il serve. Delega interamente ad
**ADR-064 Step 1.0** (app-lifecycle serve) come unico punto di verità per il ciclo di
vita del server (avvio, readiness check, registrazione porta/PID, teardown). Nessuna
logica di serve inline in questa skill.

**Azione**:

1. Read `factory.config.yaml.fe_correctness.functional_oracle`. Se `enabled: false` →
   ABORT pulito, log a chat «Functional oracle disabilitato; abilitare con
   `fe_correctness.functional_oracle.enabled: true`». No-op dichiarato (R.P3).

2. Read TSK target: frontmatter (`id`, `layer`, `code_path`/`target`,
   `functional_status`, `functional_acceptance_spec`) + body markdown.

3. Risolve `code_path` dal frontmatter TSK (legacy `code_path:` singolo, oppure
   `target:` → entry in `code_paths`).

4. Calcola `current_iter`: se `functional_status` è assente/`pending` → `N = 1`; se è
   `conditional` (loop in corso) → `N = <ultimo iter> + 1`.

5. **INVOCA ADR-064 Step 1.0** (app-lifecycle serve) con i parametri:
   ```
   ADR-064 Step 1.0:
     code_path = <path risolto al package target>
     mode      = "preview"       # preferisci build esistente (vite preview / npm run preview)
                                 # fallback: "dev" (npm run dev) se nessun build disponibile
     readiness_check = HTTP 200 su <host>:<port>
     timeout_ms = fe_correctness.functional_oracle.serve_timeout_ms  # default 30000
   Output:
     server_url  : string   # es. http://localhost:5173
     server_pid  : int      # PID del processo server, per teardown garantito
     server_port : int      # porta effettiva su cui il server ascolta
   ```
   La CWD di esecuzione è la directory del package target (dove `package.json` installa
   Playwright e il dev-server) — ADR-064 §D. Eseguire dalla CWD sbagliata produce
   `Cannot find module` o binding-port errati: è un **errore tecnico fail-loud**, mai
   degrado silenzioso.

6. **Fail-loud su timeout readiness** (ADR-064 §C). Se il server non raggiunge HTTP 200
   entro `timeout_ms` → STOP con messaggio azionabile **verbatim**:

   > Functional oracle: il server non ha raggiunto readiness in `<timeout_ms>`ms.
   > Verificare: (1) `npm run build` o `npm run preview` funzionano manualmente nel
   > package `<code_path>`; (2) la porta `<port>` non è occupata; (3) il campo
   > `fe_correctness.functional_oracle.serve_timeout_ms` (default 30000) è sufficiente
   > per il tuo ambiente. Log server: vedi `.factory-runners/<TSK-id>-serve.log`.

   Il teardown del PID registrato è obbligatorio anche in caso di abort (cleanup
   garantito — ADR-064 §Conseguenze «Teardown del server obbligatorio»).

7. Verifica prerequisito **Playwright** via Bash: `npx playwright --version` dalla CWD
   del package target. Se exit code `!= 0` → **STOP fail-loud** con messaggio azionabile
   **verbatim**:

   > Functional oracle richiede Playwright. Eseguire dalla directory `<code_path>`:
   > `npm i -D @playwright/test && npx playwright install --with-deps chromium`.
   > Vedi runbook `wiki/runbooks/visual-oracle-installation.md` se disponibile.

   Nessun degrado silenzioso (ADR-064 §E: `no-visual` è eccezione dichiarata, non default).

8. Crea la cartella side-channel per gli artefatti:
   `code_quality/reports/<TSK-id>-functional-iter-<N>/` (ADR-065 §Storage).

**Teardown garantito**: il `server_pid` registrato al passo 5 DEVE essere terminato al
termine della skill (pass, reject, abort, errore). Il blocco di cleanup deve essere
eseguito anche se le fasi successive falliscono. Procedura teardown:
```
bash: kill <server_pid>  # graceful SIGTERM
# se dopo 5s il processo è ancora vivo: kill -9 <server_pid>
```

**Output prodotto**: `server_url`, `server_pid`, `server_port` registrati per le fasi
successive; cartella `code_quality/reports/<TSK-id>-functional-iter-<N>/` creata;
`code_path` risolto; `current_iter` calcolato.

**Criterio di completamento**: `server_url` raggiungibile HTTP 200 **AND** `npx
playwright --version` exit 0 **AND** cartella artefatti creata.

[^src: design_&_architecture/decisions/ADR-064.md §C «App-lifecycle nel protocollo (serve + CWD + Node)»]
[^src: design_&_architecture/decisions/ADR-064.md §D «Precondizione esplicita e fail-loud diagnostico»]
[^src: design_&_architecture/decisions/ADR-065.md §Storage/frontmatter]
[^src: management/kanban/EP-018-fe-functional-oracle/US-068-skill-functional-oracle-protocol/US-068.md §Fase 1]

---

## Fase 2 — Load Fixture

**Input atteso**: frontmatter TSK (`functional_acceptance_spec:`, `id`), `code_path`
risolto (Fase 1), `server_url` (Fase 1).

**Azione**:

### 2.1 — Risoluzione path spec (2 modalità)

1. **Modalità frontmatter** (prioritaria): se il frontmatter TSK contiene
   `functional_acceptance_spec: <path>` → usa quel path come percorso assoluto o
   relativo al root del repo factory.
2. **Modalità default glob** (fallback): se `functional_acceptance_spec:` è assente o
   vuoto nel frontmatter TSK → cerca `code_quality/acceptance/<TSK-id>.acceptance.yaml`
   (per-TSK), poi `code_quality/acceptance/<app-slug>.acceptance.yaml` (per-app, dove
   `app-slug` è derivato dal `code_path` risolto).

Se nessuno dei due path produce un file leggibile → applicare la logica §2.3 fail-loud.

[^src: design_&_architecture/decisions/ADR-065.md §B]
[^src: management/kanban/EP-018-fe-functional-oracle/US-068-skill-functional-oracle-protocol/US-068.md §Fase 2]

### 2.2 — Gate `enabled`

- **`functional_oracle.enabled: false`** (default, R.P3) → **no-op** dichiarato. Log a
  chat: «Functional oracle disabilitato per questo TSK; abilitare con
  `fe_correctness.functional_oracle.enabled: true`». Non eseguire le fasi successive.
  Backward compat totale: la skill è inerte a flag spento.

[^src: design_&_architecture/decisions/ADR-065.md §E «functional_oracle.enabled: false → no-op»]

### 2.3 — Fail-loud su `enabled: true` + spec assente

Se `enabled: true` **e** la spec non è trovata/leggibile → **fail-loud** (config
incoerente: l'utente ha optato nel functional oracle senza fornire il contratto).
Messaggio canonico **verbatim** (ADR-065 §E):

> Functional oracle abilitato (`enabled: true`) ma acceptance-spec non trovata.
> Path cercati: (1) frontmatter `functional_acceptance_spec: <path>` — assente o
> non risolto; (2) `code_quality/acceptance/<TSK-id>.acceptance.yaml` — non trovato;
> (3) `code_quality/acceptance/<app-slug>.acceptance.yaml` — non trovato.
> Creare il file acceptance-spec seguendo lo schema
> `.claude/schemas/acceptance-spec.schema.yaml`. Non è possibile procedere senza il
> contratto di accettazione (anti-fabbricazione ADR-065 §E).

STOP: non procedere alle fasi successive. MAI un pass silenzioso su spec assente
(ADR-063/ADR-064 anti-fabbricazione).

[^src: design_&_architecture/decisions/ADR-065.md §E «enabled: true + spec assente → fail-loud»]
[^src: design_&_architecture/decisions/ADR-063.md §A «fail-loud su evidenza mancante»]

### 2.4 — Validazione schema (4 sezioni obbligatorie)

Read il file spec trovato al passo §2.1. Valida che contenga le **4 sezioni
obbligatorie** secondo `.claude/schemas/acceptance-spec.schema.yaml` (US-069):

| Sezione | Tipo | Obbligatoria |
|---|---|---|
| `fixtures` | array | SI |
| `scenario` | array | SI (può essere `[]`) |
| `assertions` | array | SI |
| `thresholds` | object con `advisory_max` | SI |

Se una o più sezioni sono assenti o hanno tipo errato → **fail-loud** con messaggio
che elenca le sezioni mancanti/invalide e rimanda allo schema:

> Acceptance-spec `<path>` non valida: sezioni mancanti o mal formate: `<lista>`.
> Schema di riferimento: `.claude/schemas/acceptance-spec.schema.yaml`.
> Correggere il file prima di procedere.

[^src: design_&_architecture/decisions/ADR-065.md §B «schema» §C «primitive»]
[^src: .claude/schemas/acceptance-spec.schema.yaml]

### 2.5 — Verdict `skip` su `scenario: []`

Se la spec è valida ma `scenario` è un array vuoto (`[]`) → **verdict `skip`
dichiarato**, non `pass` silenzioso (ADR-065 §E). Log a chat:

> Acceptance-spec `<path>` presente e valida ma `scenario: []` — nessuno scenario
> da eseguire. Verdict: `skip` (dichiarato). Il functional oracle non può produrre
> un `pass` su scenario vuoto (anti-fabbricazione).

Aggiorna `functional_status: skip` nel frontmatter TSK (single-writer). Non procedere
alle fasi successive.

[^src: design_&_architecture/decisions/ADR-065.md §E «scenario vuoto → skip dichiarato, non pass»]

### 2.6 — Caricamento fixture

Se la spec è valida e `scenario` non è vuoto: per ogni elemento in `fixtures[]` della
spec, il caricamento effettivo dei file (`set_input_files` e le altre action enumerate
nello schema) avviene tramite **`interaction-drive-protocol`** (ADR-066 §B), invocato
nella Fase 3 (Drive Scenario) all'azione `load_fixture`. In questa fase (Fase 2) si
verifica soltanto che i path dei fixture dichiarati esistano sul filesystem del progetto:

```
Per ogni fixture in spec.fixtures:
  Verifica: file esiste al path <fixture.path> (relativo al root del repo/package)
  Se assente → fail-loud:
    "Fixture `<fixture.id>` non trovato al path `<fixture.path>`.
     Il file deve essere presente prima dell'esecuzione del functional oracle."
```

**Output prodotto**: spec letta e validata; `spec_path` risolto; `spec` parsed (oggetto
YAML); `fixture_paths` verificati sul filesystem. Pronto per Fase 3.

**Criterio di completamento**: spec valida (4 sezioni presenti), tutti i fixture
dichiarati esistono sul filesystem, `scenario` non vuoto.

[^src: design_&_architecture/decisions/ADR-065.md §B §E]
[^src: design_&_architecture/decisions/ADR-066.md §B «caricamento fixture via interaction-drive-protocol»]
[^src: management/kanban/EP-018-fe-functional-oracle/US-068-skill-functional-oracle-protocol/US-068.md §Fase 2]

---

## Fase 3 — Drive Scenario

**Input atteso**: `spec` (oggetto YAML parsato in Fase 2), `server_url` (Fase 1),
`current_iter` (Fase 1), `code_path` risolto, cartella artefatti
`code_quality/reports/<TSK-id>-functional-iter-<N>/` (creata in Fase 1).

**Principio**: questa fase **non contiene logica Playwright inline**. Delega l'intera
esecuzione dello scenario a `interaction-drive-protocol` (ADR-066 §B — single source of
truth per l'interazione Playwright scriptata). La cattura di evidenza è delegata a
`screenshot-capture-protocol` (ADR-017). Aggiunge solo le responsabilità orchestrative:
aprire il browser, intercettare i log, chiudere il browser.

### 3.1 — Verifica prerequisito `interaction-drive-protocol`

Verifica che la skill `interaction-drive-protocol` esista al path
`.claude/skills/interaction-drive-protocol.md`. Se assente → **STOP fail-loud** con
messaggio canonico **verbatim**:

> Functional oracle: skill `interaction-drive-protocol` non trovata al path
> `.claude/skills/interaction-drive-protocol.md`. La skill è un prerequisito obbligatorio
> (ADR-066 §B). Eseguire il bootstrap o aggiornare la factory per includere EP-018.

Nessun degrado silenzioso: senza `interaction-drive-protocol` la delega dell'interazione
non è possibile e la skill non può procedere (ADR-066 §B).

### 3.2 — Apertura browser e intercettazione log

1. Apri un contesto browser Playwright headless con CWD = directory del package target
   (ADR-064 §D — il caller è questa skill). Naviga a `server_url`.
2. Inizia l'intercettazione dei log **dalla navigazione iniziale**:
   - **Console log**: registra tutti gli eventi `page.on('console')` di livello `error` e
     `warning`. Per ogni evento: `{ type, text, timestamp_ms }`.
   - **Network log**: registra tutte le richieste `page.on('request')` e risposte
     `page.on('response')`. Per ogni coppia: `{ url, method, status, duration_ms }`.
   L'intercettazione prosegue fino alla fine dello scenario (incluse eventuali azioni
   asincrone post-ultimo step).

### 3.3 — Esecuzione scenario via `interaction-drive-protocol`

Invoca la skill `interaction-drive-protocol` con il contratto seguente:

```
drive_scenario(
  steps        = spec.scenario,        # array ScenarioStep[] dall'acceptance-spec (ADR-065 §B)
  page_context = <handle Page aperto al passo 3.2>
)

returns:
  trace: StepTrace[]   # { step_index, action, status, duration_ms, detail? }
  errors: string[]     # errori non fatali (passi skippati / avvisi)
```

**Nessuna logica di interazione Playwright è inline in questa skill.** Tutta l'esecuzione
dei passi (click, type, set_input_files, wait_for, wait_ms, keyboard) avviene dentro
`interaction-drive-protocol`. Questa skill si limita a passare `spec.scenario` e raccogliere
il `trace` restituito.

Se `interaction-drive-protocol` ritorna con un passo in `status: "error"` → il trace è
comunque salvato (§3.4) e la Fase 4 valuterà le asserzioni sul trace parziale. Il blocco
di asserzioni è eseguito anche su trace incompleto: alcuni `selector_visible` /
`attr_equals` falliscono deterministically, producendo `reject` senza ambiguità.

### 3.4 — Cattura screenshot sequenziali via `screenshot-capture-protocol`

Dopo ogni step che modifica lo stato dell'UI (azioni `click`, `type`, `set_input_files`,
`keyboard` + ogni `wait_for` che risolve con `status: "ok"`) invoca
`screenshot-capture-protocol` (ADR-017):

```
capture_screenshot(
  target      = server_url,
  viewport    = { width: 1280 },        # viewport fisso per evidenza (non matrice multi-viewport)
  output_dir  = "code_quality/reports/<TSK-id>-functional-iter-<N>/",
  naming_pattern = "step-{step_index}-{action}.png"
)
```

Gli screenshot sono **evidenza del trace**, non input per l'asserzione visiva (EP-005):
saranno usati dalla Fase 4 dal critic LLM advisory (§4.4) e inclusi nel report della Fase 5.

Naming convention: `step-00-click.png`, `step-01-wait_for.png`, ecc. (indice 0-padded a 2
cifre per ordinamento alfabetico corretto fino a 99 step).

### 3.5 — Chiusura log e produzione `scenario_evidence`

Al termine dell'esecuzione (ultimo step del `trace` o STOP su errore fatale):

1. Termina l'intercettazione dei log.
2. Salva i log come artefatti nella cartella side-channel:
   - `code_quality/reports/<TSK-id>-functional-iter-<N>/console.log.json` — array di
     `{ type, text, timestamp_ms }` filtrati a `error` e `warning`.
   - `code_quality/reports/<TSK-id>-functional-iter-<N>/network.log.json` — array di
     `{ url, method, status, duration_ms }` per tutte le richieste del ciclo.
3. Chiudi il contesto browser Playwright. Il teardown del browser è responsabilità di questa
   fase (non di `interaction-drive-protocol`, che non gestisce il ciclo di vita del browser).

**Output prodotto** (`scenario_evidence`):

```
scenario_evidence:
  trace:          StepTrace[]    # da interaction-drive-protocol
  screenshots:    string[]       # path PNG ordinati per step_index
  console_log:    ConsoleLine[]  # filtrati a error+warning
  network_log:    NetworkEntry[] # tutte le richieste del ciclo
  console_log_path: string       # path JSON side-channel
  network_log_path: string       # path JSON side-channel
```

**Criterio di completamento**: `trace` disponibile (anche parziale su errore fatale);
`console_log_path` e `network_log_path` scritti sul filesystem; browser chiuso.

[^src: design_&_architecture/decisions/ADR-066.md §B «single source runtime interazione»]
[^src: design_&_architecture/decisions/ADR-017.md §Decisione «screenshot-capture-protocol»]
[^src: design_&_architecture/decisions/ADR-064.md §D «CWD del package target»]
[^src: management/kanban/EP-018-fe-functional-oracle/US-068-skill-functional-oracle-protocol/US-068.md §Fase 3]

---

## Fase 4 — Assert Outcomes

**Input atteso**: `spec` (oggetto YAML, Fase 2), `scenario_evidence` (Fase 3),
`factory.config.yaml` (per leggere `fe_correctness.functional_oracle.critic`).

**Principio**: il verdict nasce **esclusivamente** da asserzioni binarie deterministiche
(ADR-067 §B). Nessun LLM è nel path di `pass`/`fail`. Il critic LLM è invocato dopo la
determinazione del verdict e può solo aggiungere osservazioni advisory — mai alterare
il verdict positivamente (ADR-067 §B).

### 4.1 — Dispatch per `kind` (8 primitive domain-agnostic, ADR-065 §C)

Itera su `spec.assertions[]` nell'**ordine dichiarato** nell'acceptance-spec. Per ogni
asserzione, dispatcha sull'attributo `kind` secondo la tabella seguente:

| `kind` | Input richiesti | Check deterministico | Pass condition |
|---|---|---|---|
| `selector_visible` | `selector` | Playwright: `page.isVisible(selector)` sul `page_context` del trace | elemento visibile nel DOM al termine dello scenario |
| `selector_absent` | `selector` | Playwright: `!page.isVisible(selector)` | elemento non visibile (assente o `display:none`) |
| `attr_equals` | `selector`, `attr`, `value` | Playwright: `page.getAttribute(selector, attr)` == `value` (confronto stringa esatta) | attributo ha il valore atteso |
| `text_matches` | `selector`, `value` (pattern) | Playwright: `page.textContent(selector)` contiene `value` (substring match; se `value` inizia con `/` e finisce con `/` → regex match) | testo contiene il pattern |
| `canvas_pixel_variance` | `selector`, `min_variance`, `frames` | cattura N screenshot del `selector` canvas a intervalli di 500 ms (totale: `frames` catture), calcola varianza media dei pixel tra le catture; vedi §4.1.1 | varianza calcolata `>= min_variance` |
| `storage_key_present` | `store` (`localStorage`\|`idb`\|`fs`), `key_glob` | Playwright evalua `localStorage.getItem(...)` o IndexedDB key match o `fs.existsSync(path)` nella CWD del package | almeno una chiave che matcha `key_glob` esiste nello store |
| `console_no_error` | — | conta le righe `console_log` con `type == "error"` dalla `scenario_evidence` (Fase 3) | nessuna riga con `type == "error"` nel log (count == 0) |
| `network_no_5xx` | — | conta le righe `network_log` con `status >= 500 AND status <= 599` dalla `scenario_evidence` (Fase 3) | nessuna risposta 5xx (count == 0) |

Per ogni asserzione produce un record:

```
AssertionResult:
  id:       string        # dall'acceptance-spec
  kind:     string        # kind dell'asserzione
  severity: "blocking" | "advisory"
  outcome:  "pass" | "fail"
  detail:   string        # diagnostica opzionale (valore trovato vs atteso, count, ecc.)
```

#### 4.1.1 — `canvas_pixel_variance`: procedura di campionamento

1. Riattiva il `page_context` (se chiuso in Fase 3, riaprire la pagina a `server_url`
   nello stesso stato — nota: se il server è già teardown questo è impossibile, quindi
   questa asserzione richiede che il contesto browser rimanga aperto durante Fase 4 o
   venga riaperto prima del teardown finale).
2. Cattura `frames` screenshot del canvas identificato da `selector` a intervalli di 500 ms
   via `screenshot-capture-protocol` (ADR-017), naming `canvas-frame-{i}.png` nella
   cartella artefatti.
3. Calcola la varianza media dei valori dei pixel tra frame consecutivi: `var = media(|px_i
   - px_{i-1}|)` per tutti i pixel, su tutti i frame adiacenti.
4. Pass se `var >= min_variance`; fail altrimenti (con `detail: "varianza calcolata: <N>,
   attesa >= <min_variance>"`).

### 4.2 — Verdict deterministico (ADR-065 §D)

Dopo aver valutato tutte le asserzioni, calcola il verdict secondo la semantica a severità:

| Condizione | Verdict |
|---|---|
| Tutte le asserzioni `blocking` passano E asserzioni `advisory` fallite `<=` `spec.thresholds.advisory_max` | **`pass`** |
| Tutte le asserzioni `blocking` passano MA asserzioni `advisory` fallite `>` `spec.thresholds.advisory_max` | **`conditional`** |
| Almeno una asserzione `blocking` fallisce | **`reject`** |

Calcola e registra il conteggio:

```
verdict_summary:
  blocking_total:   int
  blocking_pass:    int
  blocking_fail:    int
  advisory_total:   int
  advisory_fail:    int
  advisory_max:     int     # da spec.thresholds.advisory_max
  verdict:          "pass" | "conditional" | "reject"
```

**Il verdict è definitivo dopo questo calcolo.** Il critic LLM (§4.4) può aggiungere
osservazioni ma **non modifica** `verdict_summary.verdict`.

### 4.3 — Tabulazione risultati

Produce la tabella assertion results per il report (Fase 5):

```
| id | kind | severity | outcome | detail |
|---|---|---|---|---|
| canvas-advancing | canvas_pixel_variance | blocking | pass | varianza: 0.034, attesa >= 0.02 |
| state-running    | attr_equals           | blocking | pass | data-state="running" ✓ |
| no-console-error | console_no_error      | advisory | fail | 2 errori console trovati |
| save-artifact    | storage_key_present   | blocking | pass | chiave "savestate:slot0" in IDB |

Blocking: 3/3 pass | Advisory: 0/1 pass (1 fallita, soglia 2)
Verdict: pass
```

### 4.4 — Critic LLM advisory (ADR-067 §B)

**Condizionale**: questa sotto-fase si esegue SOLO se
`fe_correctness.functional_oracle.critic == "advisory"` (default `advisory`). Se
`critic: "off"` → salta interamente, nessun costo LLM aggiuntivo.

**Scope**: il critic ispeziona il trace visivo (`scenario_evidence.screenshots`) e i log
(`console_log`, `network_log`) come osservatore qualitativo — **mai** come decisore del
verdict.

**Invarianti (ADR-067 §B)**:
1. Il critic **non modifica** `verdict_summary.verdict`. Il verdict rimane quello calcolato
   in §4.2.
2. Il critic **non può promuovere** a `pass` un verdict che le asserzioni binarie hanno
   determinato `reject` o `conditional`.
3. Il critic **può abbassare** il verdict aggiungendo `open_questions` advisory (che il
   feedback-router in Fase 5 include nel diff per il dev-agent), ma il campo `verdict`
   resta immutato.
4. Ogni osservazione del critic **deve citare un artefatto reale del trace**
   (evidence-provenance ADR-063 §B): path screenshot, indice step, riga log. Nessun
   finding è ammesso senza riferimento a un artefatto esistente nella cartella
   `code_quality/reports/<TSK-id>-functional-iter-<N>/`.

**Invocazione**:

```
critic_input:
  screenshots:    scenario_evidence.screenshots   # path PNG ordinati per step
  console_log:    scenario_evidence.console_log   # filtrati a error+warning
  network_log:    scenario_evidence.network_log   # tutte le richieste
  assertions:     spec.assertions                 # per capire cosa si stava cercando
  verdict_summary: <calcolato in §4.2>            # per orientare le osservazioni

critic_output:
  open_questions: CriticFinding[]

CriticFinding:
  observation:    string    # osservazione qualitativa concisa
  evidence_ref:   string    # OBBLIGATORIO: path artefatto (es. "step-03-wait_for.png",
                            # "console.log.json:line 7", "network.log.json:entry 12")
  severity:       "advisory"   # SEMPRE advisory; mai "blocking" o "pass"
```

**Regola di ammissibilità**: un finding senza `evidence_ref` che punta a un artefatto
reale nella cartella artefatti corrente è **scartato** prima di essere incluso nel report
(anti-fabbricazione ADR-063 §B). Se il critic produce solo finding senza evidenza →
`open_questions: []` (nessun finding ammissibile).

**Output prodotto** (`assertion_results`):

```
assertion_results:
  results:          AssertionResult[]    # §4.1
  verdict_summary:  VerdictSummary       # §4.2
  open_questions:   CriticFinding[]      # §4.4 (vuoto se critic: off o nessun finding ammissibile)
```

**Criterio di completamento**: tutte le 8 primitive dispatchate per ogni asserzione in
`spec.assertions[]`; `verdict_summary.verdict` calcolato; critic LLM invocato (o skippato
se `critic: off`); `open_questions` filtrati per evidence-provenance.

[^src: design_&_architecture/decisions/ADR-065.md §C «primitive domain-agnostic»]
[^src: design_&_architecture/decisions/ADR-065.md §D «semantica a severità blocking/advisory»]
[^src: design_&_architecture/decisions/ADR-067.md §B «verdict deterministico; LLM solo advisory»]
[^src: design_&_architecture/decisions/ADR-063.md §B «evidence-provenance obbligatoria»]
[^src: management/kanban/EP-018-fe-functional-oracle/US-068-skill-functional-oracle-protocol/US-068.md §Fase 4]

---

## Fase 5 — Diff+Loop bounded

**Input atteso**: `assertion_results` (Fase 4: `results`, `verdict_summary`,
`open_questions`), `current_iter` / `MAX_ITERATIONS` (Fase 1), `TSK-id`, `server_pid`
(per teardown garantito — Fase 1).

**Principio**: il diff azionabile è destinato al `feedback-router` (riuso CQRL, ADR-009
§Decisione) che lo consegna al dev-agent (`qa-dev` fallback `fe-dev`). Il loop è bounded
da `functional_oracle.max_iterations` (default 3, ADR-067 §C / R.Q4): stesso meccanismo
di `visual-oracle-protocol` (EP-005) e `code-review-protocol` (CQRL).

### 5.1 — Teardown server (garantito)

**Prima di qualunque scrittura su filesystem**: esegui il teardown del `server_pid`
registrato in Fase 1.

```
bash: kill <server_pid>          # graceful SIGTERM
# se dopo 5s il processo è ancora vivo:
bash: kill -9 <server_pid>
```

Il teardown è **obbligatorio** indipendentemente dal verdict (pass, reject, abort, errore
— ADR-064 §Conseguenze «Teardown del server obbligatorio»). Il mancato teardown è un
errore tecnico, non un warning.

### 5.2 — Scrittura report JSON + MD

Scrive i report nel side-channel `code_quality/reports/`:

**File JSON** (machine-readable): `code_quality/reports/<TSK-id>-functional-iter-<N>.json`

Schema obbligatorio con i 6 campi (ADR-065 §Storage):

```json
{
  "verdict": "pass | conditional | reject | skip",
  "iterations": <N>,
  "assertions_results": [
    {
      "id": "<assertion-id>",
      "kind": "<kind>",
      "severity": "blocking | advisory",
      "outcome": "pass | fail",
      "detail": "<valore trovato vs atteso, count, ecc.>"
    }
  ],
  "critic_findings": [
    {
      "observation": "<osservazione qualitativa>",
      "evidence_ref": "<path artefatto reale: es. step-03-wait_for.png>",
      "severity": "advisory"
    }
  ],
  "trace_path": "code_quality/reports/<TSK-id>-functional-iter-<N>/",
  "timestamp": "<ISO-8601 UTC>"
}
```

I 6 campi `verdict`, `iterations`, `assertions_results`, `critic_findings`,
`trace_path`, `timestamp` sono **tutti obbligatori** in ogni report (ADR-065 §Storage).
`critic_findings` è `[]` se `critic: off` o se nessun finding ha superato il filtro
evidence-provenance (Fase 4 §4.4). `assertions_results` è l'array dei record
`AssertionResult` prodotti in Fase 4 §4.1.

**File MD** (digest umano-leggibile): `code_quality/reports/<TSK-id>-functional-iter-<N>.md`

Struttura minima del digest:

```markdown
# Functional Oracle — <TSK-id> iter <N>

**Verdict**: `<verdict>` | **Timestamp**: <ISO-8601>

## Assertion Results

| id | kind | severity | outcome | detail |
|---|---|---|---|---|
| <id> | <kind> | blocking/advisory | pass/fail | <detail> |

Blocking: <X>/<Y> pass | Advisory: <X>/<Y> pass (fallite <Z>, soglia <advisory_max>)

## Critic Findings (advisory)

<elenco open_questions con evidence_ref; oppure «Nessun finding ammissibile» se vuoto>

## Trace

Artefatti in: `code_quality/reports/<TSK-id>-functional-iter-<N>/`
Screenshot: <elenco step-NN-action.png> | Console log: `console.log.json` | Network log: `network.log.json`

## Loop status

Iterazione <N> / <MAX_ITERATIONS>. Next action: `<next_action>`.
```

### 5.3 — Routing verdict → azione

| `verdict` | `functional_status` scritto | `next_action` | Comportamento |
|---|---|---|---|
| `pass` | `pass` | `done` | Aggiorna frontmatter TSK; pronto per review (ordering ADR-066 §B). |
| `conditional` | `conditional` | `loop` | Finding azionabili → diff per feedback-router; ri-dispatch al dev-agent (`qa-dev` o fallback `fe-dev`); **bounded** da `MAX_ITERATIONS`. |
| `reject` | `reject` | `escalate-human` | **Gate umano** (PATTERN §7 r.16); TSK resta `in-progress`; finding strutturali, non auto-loop. |
| `skip` | `skip` | `done` | Già impostato in Fase 2 §2.5; nessuna ulteriore azione. |

### 5.4 — Diff azionabile per feedback-router (su `conditional` / `reject`)

Su `conditional` o `reject` con finding azionabili (almeno una asserzione `blocking`
`fail` o almeno un `critic_finding` con `evidence_ref` valido), produce il diff
strutturato per `feedback-router` (riuso CQRL, ADR-009):

```json
{
  "tsk_id": "<TSK-id>",
  "iter": <N>,
  "constraint": {
    "scope": "fix only the functional findings below; no opportunistic refactor",
    "source": "functional-oracle-protocol"
  },
  "actions": [
    {
      "finding_id": "<assertion-id o critic-finding-index>",
      "kind": "<kind asserzione o 'critic_advisory'>",
      "severity": "blocking | advisory",
      "description": "<cosa non passa e perché>",
      "evidence_ref": "<path artefatto: step PNG, console.log.json, network.log.json>",
      "expected_fix": "<suggerimento concreto di correzione>",
      "acceptance_criteria": "<asserzione che deve passare alla prossima iterazione>"
    }
  ],
  "report_ref": "code_quality/reports/<TSK-id>-functional-iter-<N>.md"
}
```

Ordinamento delle `actions`: `blocking` prima di `advisory`; all'interno di ogni tier,
le asserzioni `fail` nell'ordine dichiarato dall'`acceptance-spec`.

Le `actions` sono **solo per finding azionabili**: un'asserzione `fail` con `detail`
vuoto non è azionabile — include una nota «finding non azionabile: spec incompleta» e
non la mette nelle `actions` (l'assenza di `acceptance_criteria` verificabile renderebbe
il loop infinito per definizione).

### 5.5 — Loop bound `max_iterations`

```
SE current_iter < MAX_ITERATIONS AND verdict IN {conditional}:
  → next_action = "loop"
  → chiama feedback-router con il diff §5.4
  → functional_status = "conditional"
  → il dev-agent fixa, poi ri-invoca functional-oracle-protocol (iter N+1)

SE current_iter >= MAX_ITERATIONS AND verdict NOT IN {pass, skip}:
  → loop esaurito senza convergenza
  → forza verdict = "reject", next_action = "escalate-human"
  → functional_status = "reject"
  → nota nel report JSON: max_iterations_reached: true
  → segnala in chat (vedi §5.6)

SE verdict == "reject" (indipendentemente da current_iter):
  → next_action = "escalate-human" direttamente (non entra nel loop)
  → functional_status = "reject"
```

La nota `max_iterations_reached` è aggiunta al campo `critic_findings` del report JSON
come elemento distinto:

```json
{
  "observation": "Loop esaurito: max_iterations (<N>) raggiunto senza convergenza a pass.",
  "evidence_ref": "code_quality/reports/<TSK-id>-functional-iter-<N>.json",
  "severity": "advisory"
}
```

### 5.6 — Aggiornamento frontmatter TSK (single-writer)

**Scrive solo** il campo `functional_status:` nel frontmatter del TSK (MAI sovrascrivere
altri campi — R.Q2 / ADR-065 §Storage). Tabella dei valori possibili:

| Valore | Quando scritto |
|---|---|
| `pending` | valore iniziale (scritto al bootstrap del TSK, non da questa skill) |
| `pass` | verdict `pass` in §5.3 |
| `conditional` | verdict `conditional` in §5.3 (loop in corso) |
| `reject` | verdict `reject` in §5.3, oppure loop esaurito §5.5 |
| `skip` | scenario vuoto (Fase 2 §2.5); questa skill non lo ri-scrive se già `skip` |

### 5.7 — Blocco chat su escalation umana

Su `next_action: escalate-human` (reject diretto o loop esaurito), mostra in chat
il blocco di escalation:

```
FUNCTIONAL ORACLE — <TSK-id> iter <N> → ESCALATION UMANA (PATTERN §7 r.16)
============================================================================
Verdict: <reject>  [max_iterations_reached: <true|false>]
Blocking fail: <X> | Advisory fail: <Y>
Critic findings: <Z> (con evidenza)
Report: code_quality/reports/<TSK-id>-functional-iter-<N>.md
Trace:  code_quality/reports/<TSK-id>-functional-iter-<N>/

Possibili next step:
1. Re-Develop manuale con istruzioni dal report → poi /functional-oracle <TSK-id>.
2. Aggiorna l'acceptance-spec se le asserzioni risultano over-specified → /functional-oracle.
3. Accept-as-is con override → apri wiki/incidents/YYYY-MM-DD-tsk-<id>-functional-accepted.md.

CQRL functional loop non auto-procede.
```

### 5.8 — Append `wiki/log.md`

Append a `wiki/log.md` dell'entry di chiusura (marker `functional-oracle`):

```
develop | functional-oracle <TSK-id> iter-<N> → <verdict> [max_iterations_reached: <true|false>] | <ISO-8601>
```

**Output prodotto**:
- `code_quality/reports/<TSK-id>-functional-iter-<N>.json` scritto (6 campi obbligatori).
- `code_quality/reports/<TSK-id>-functional-iter-<N>.md` scritto (digest umano).
- `functional_status:` aggiornato nel frontmatter TSK (single-writer).
- `wiki/log.md` aggiornato.
- Se `conditional`: diff §5.4 prodotto e consegnato a `feedback-router`.
- Se `reject` o loop esaurito: blocco chat §5.7 mostrato.
- Server teardown §5.1 eseguito.

**Criterio di completamento**: report JSON + MD scritti, `functional_status` aggiornato,
server teardown eseguito, `next_action` determinato e azione corrispondente avviata.

[^src: design_&_architecture/decisions/ADR-067.md §C «loop bounded»]
[^src: design_&_architecture/decisions/ADR-065.md §Storage/frontmatter]
[^src: design_&_architecture/decisions/ADR-009.md §Decisione «feedback-router CQRL riuso»]
[^src: design_&_architecture/decisions/ADR-064.md §Conseguenze «Teardown del server obbligatorio»]
[^src: management/kanban/EP-018-fe-functional-oracle/US-068-skill-functional-oracle-protocol/US-068.md §Fase 5]

---

## Nota single-writer su `functional_status` (ADR-065 §Storage)

**SOLO questa skill** (`functional-oracle-protocol`, eseguita da `qa-dev`) scrive il
campo `functional_status:` nel frontmatter del TSK. È il **single-writer** del campo
(analogo a `visual_status` per EP-005, `review_status` per CQRL, R.Q2). Dev-agent, PM,
TPM, orchestrator **NON** lo scrivono a runtime: lo leggono soltanto. Enum del campo:
`pending | pass | conditional | reject | skip`. Questo evita race condition e drift.

[^src: design_&_architecture/decisions/ADR-065.md §Storage/frontmatter]
[^src: design_&_architecture/decisions/ADR-067.md §B]

---

## SSR Context Extension (EP-030, v2.22)

> **Precondizione**: questa sezione è attiva SOLO quando `fe_correctness.ssr_aware.enabled: true`
> AND `ssr_context.framework != 'none'` (framework rilevato da `stack-detector` SSR section,
> TSK-200). A flag spento o con `framework: none` → nessun campo `ssr_context:` aggiunto,
> nessuno scenario SSR generato, comportamento identico a v2.21 (backward compat totale, R.P3).

### Campo opzionale `ssr_context:` nello schema acceptance-spec

L'estensione aggiunge un campo **opzionale** alla sezione 1b dello schema
(`.claude/schemas/acceptance-spec.schema.yaml`). L'estensione è additiva e backward-compatible:
le acceptance-spec esistenti senza `ssr_context:` restano valide (0 ERROR lint).

```yaml
# ssr_context: opzionale — attivato quando fe_correctness.ssr_aware.enabled: true (EP-030, v2.22)
# Campo assente = comportamento invariato (backward compat totale)
ssr_context:
  javascript_enabled: true    # false = assertion su HTML iniziale senza idratazione JS
  revalidate_before_run: false # true = invalida cache ISR prima dell'esecuzione del test
```

**Semantica dei sotto-campi**:

| Campo | Default se assente | Semantica |
|---|---|---|
| `javascript_enabled` | `true` (backward compat) | `false` → l'assertion verifica l'HTML iniziale renduto dal server, senza esecuzione JS (critical path SSR). `true` → comportamento CSR standard (idratazione completa). |
| `revalidate_before_run` | `false` (backward compat) | `true` → la cache ISR deve essere invalidata prima dell'esecuzione (rilevante SOLO quando `revalidation_support: true` in output stack-detector). |

**Esempio completo** (scenario SSR con campo `ssr_context:`):

```yaml
scenario_id: homepage-server-html
description: "Il contenuto critico è presente nell'HTML iniziale senza JS"
ssr_context:
  javascript_enabled: false
  revalidate_before_run: false
steps:
  - action: navigate
    url: "/"
  - action: assert_text_present
    selector: "h1"
    value: "Benvenuto"
```

### Regola di guardia per `qa-dev` — generazione scenari SSR

`qa-dev` genera scenari con `ssr_context:` valorizzato **SOLO** quando:
1. `fe_correctness.ssr_aware.enabled: true` (config flag, `factory.config.yaml`).
2. `ssr_context.framework != 'none'` (output di `stack-detector` SSR section — EP-030 TSK-200).

Se entrambe le condizioni sono soddisfatte, per ogni framework rilevato `qa-dev` genera le
seguenti **categorie minime** di scenari SSR:

| Categoria | Condizione | `javascript_enabled` | `revalidate_before_run` |
|---|---|---|---|
| Critical path SSR | Sempre (framework != none) | `false` — verifica HTML senza idratazione | `false` |
| ISR revalidation | Solo se `revalidation_support: true` (Next.js App Router / Pages Router) | `true` | `true` |
| Hydration check | Sempre (scenario osservativo, accoppiato con US-106 Hydration Drift) | `true` | `false` |

**Invarianti**:
- `qa-dev` NON modifica le acceptance-spec già esistenti. Aggiunge solo nuovi scenari.
- Se `framework: none` → nessuno scenario SSR, nessun campo `ssr_context:` aggiunto.
- Se `framework: unknown-ssr` → solo scenari `javascript_enabled: false` generici; nessuno
  scenario ISR o router-specific.

---

## Pattern / ADR di riferimento

### evaluator-optimizer ([[evaluator-optimizer]])

Questa skill è **un'istanza esplicita del pattern `evaluator-optimizer`**: il producer
(`qa-dev`) esercita l'app reale (fase produttiva: Serve → Drive Scenario), un engine
deterministico valuta gli esiti (fase di asserzione: Assert Outcomes), un critic LLM
aggiunge osservazioni advisory senza alterare il verdict, e il producer itera sul diff
azionabile in un loop bounded (`conditional` → re-Develop → functional-oracle iter N+1,
max `max_iterations`).

È la **stessa famiglia di pattern** già istanziata da:
- [`visual-oracle-protocol`](./visual-oracle-protocol.md) (EP-005): producer = `fe-dev`
  scrive il codice → rendering → screenshot; evaluator = critic visivo LLM; loop bounded
  da `fe_correctness.max_iterations`.
- [`code-review-protocol`](./code-review-protocol.md) (CQRL, PATTERN §19): producer =
  dev-agent sviluppa il codice; evaluator = `code-reviewer` critica su regole; loop
  bounded da `code_quality.max_iterations`.

Differenza chiave rispetto al visual oracle: qui il **verdetto è deterministico** (Fase 4
§4.2 — asserzioni binarie, mai LLM nel path decisionale). Nel visual oracle il critic LLM
*è* il verdetto; qui il critic LLM è solo advisory dopo un verdetto già calcolato
(ADR-067 §B). Massima difesa anti-fabbricazione.

Ordering nel cascade (ADR-066 §Conseguenze): `develop → visual-oracle →
**functional-oracle** → review`. L'oracle funzionale verifica il comportamento reale
dell'app (più downstream del rendering), prima della code review.

### fail-closed (anti-fabbricazione, [[fail-closed]])

Il verdict nasce **esclusivamente** da asserzioni binarie deterministiche (ADR-065 §C).
Nessun LLM nel path di `pass`/`fail`. Il critic LLM multimodale (ADR-067 §B) osserva il
trace e aggiunge osservazioni advisory, mai altera il verdict. Un esito senza evidenza
deterministica non può essere `pass` (ADR-063 §B evidence-provenance obbligatoria per
ogni finding critic). Traiettoria: ADR-063 → ADR-064 → ADR-065 → ADR-067.

### single-source per riga di runtime

Nessuna logica di runtime è inline in questa skill:
- **Serve** dell'app → ADR-064 Step 1.0 (app-lifecycle serve, unico punto di verità
  per il ciclo di vita del server).
- **Interazione Playwright** → `interaction-drive-protocol` (ADR-066 §B, single source of
  truth per il runtime di interazione).
- **Cattura screenshot** → `screenshot-capture-protocol` (ADR-017, single source of truth
  per il runtime di cattura).

Questo evita duplicazione, deriva, e facilita l'aggiornamento indipendente di ciascuna
componente di runtime.

### side-channel report (riuso CQRL + visual-oracle)

I report vivono in `code_quality/reports/<TSK-id>-functional-iter-<N>.{json,md}` —
**stesso side-channel** di CQRL (`<TSK-id>-iter-<N>.{json,md}`) e visual oracle
(`<TSK-id>-visual-iter-<N>.{json,md}`). Lo slug `-functional-` distingue gli artefatti
senza conflitti di naming. Un solo path da configurare, gitignorare, e monitorare
(ADR-065 §Storage).

### ADR di riferimento

| ADR | Decisione vincolante per questa skill |
|---|---|
| [`ADR-065`](../../design_&_architecture/decisions/ADR-065.md) | Schema acceptance-spec (framework vs contenuto progetto); primitive domain-agnostic; semantica a severità blocking/advisory; storage frontmatter `functional_status:`; fail-loud §E |
| [`ADR-066`](../../design_&_architecture/decisions/ADR-066.md) | Runtime condiviso interazione Playwright → `interaction-drive-protocol`; ordering nel cascade; delega caricamento fixture |
| [`ADR-067`](../../design_&_architecture/decisions/ADR-067.md) | Esecutore = `qa-dev` in modalità functional-oracle (no nuovo agent, riuso ADR-009); verdict DETERMINISTICO; critic LLM solo advisory; loop bounded `max_iterations` default 3 |
| [`ADR-017`](../../design_&_architecture/decisions/ADR-017.md) | `screenshot-capture-protocol` — single source of truth per cattura screenshot Playwright; riusato in Fase 3 per evidenza trace |
| [`ADR-008`](../../design_&_architecture/decisions/ADR-008.md) | Playwright via Bash (no MCP custom); runner in `.factory-runners/`; fail-loud su browser non disponibile; stesso runtime già usato da EP-005 |

[^src: design_&_architecture/decisions/ADR-067.md §Rationale «anti-fabbricazione strutturale»]
[^src: design_&_architecture/decisions/ADR-066.md §Rationale «single-source per riga di runtime»]
[^src: design_&_architecture/decisions/ADR-065.md §Storage «side-channel report»]
[^src: design_&_architecture/decisions/ADR-008.md §Decisione «Playwright via Bash»]
[^src: design_&_architecture/decisions/ADR-017.md §Decisione «screenshot-capture-protocol»]
