---
id: visual-oracle-installation
type: runbook
title: "Installazione Playwright per Visual Oracle (EP-005 / skill visual-oracle-protocol)"
status: stable
created: 2026-06-03
updated: 2026-06-03
sources:
  - "design_&_architecture/decisions/ADR-008.md §Decisione"
  - "design_&_architecture/decisions/ADR-008.md §Rationale"
  - "management/kanban/EP-005-fe-visual-oracle/US-017-skill-visual-oracle-protocol/US-017.md"
  - "wiki/syntheses/fe-agent-correctness-strategy.md §Leva 1"
related:
  - visual-oracle-protocol
  - fe-agent-correctness-strategy
  - correctness-oracle
  - graphify-installation
tags: [runbook, installazione, playwright, visual-oracle, ep-005, fe, setup]
---

# Installazione Playwright per Visual Oracle

> Procedura operativa per installare [Playwright](https://playwright.dev) nel progetto FE prima di
> attivare la skill [[visual-oracle-protocol]] (EP-005 / [[fe-agent-correctness-strategy]] Leva 1).
>
> La skill `visual-oracle-protocol` Fase 1 (Bootstrap) verifica `npx playwright --version`
> come pre-condizione: exit code != 0 produce un fail-loud con link a questo runbook.
> Vedi ADR-008 §Decisione per la deliberazione architetturale completa.

[^src: design_&_architecture/decisions/ADR-008.md §Decisione]

## Prerequisiti

Prima di procedere assicurati di avere:

- **Node.js >= 16** — verifica con `node --version`. Versioni 18.x e 20.x LTS sono
  le più testate con Playwright. Se il tuo progetto FE ha già un `package.json`
  con engine constraints, rispettali.
- **npm** — incluso nel package Node.js standard; verifica con `npm --version`.
  npm 8+ è sufficiente. Alternativa: yarn o pnpm sono compatibili (il comando
  `npx` non dipende dal package manager).
- **Il progetto FE deve avere un `package.json`** — Playwright va installato come
  dev-dependency locale al progetto, non globalmente. La skill `visual-oracle-protocol`
  invoca `npx playwright` dalla root del `code_path` FE configurato in
  `factory.config.yaml`. [^src: design_&_architecture/decisions/ADR-008.md §Rationale]
- **Connessione internet** (la prima volta) — `npx playwright install --with-deps chromium`
  scarica il binario Chromium (~170 MB). Per ambienti air-gapped vedi la sezione
  [Ambienti corporate ristretti](#ambienti-corporate-ristretti).

## Installazione

### Step 1 — Aggiungi Playwright come dev-dependency

Dalla root del progetto FE (dove si trova il `package.json`):

```bash
npm i -D @playwright/test
```

Cosa installa:
- `@playwright/test` — test runner Playwright + API browser
- Dependency chain: `playwright-core`, type definitions, CLI wrapper `npx playwright`
- Footprint in `node_modules/@playwright`: ~50 MB senza binari browser
- Tempo: ~10-20s su connessione 10 MB/s

### Step 2 — Scarica il browser Chromium

```bash
npx playwright install --with-deps chromium
```

Cosa scarica:
- Binario Chromium headless pre-compilato (~170 MB, path gestito da Playwright)
- Con `--with-deps`: installa le librerie di sistema richieste (Linux: `libnss3`,
  `libatk1.0`, etc.). Su macOS e Windows le dipendenze sono già incluse nel bundle.
- I binari vengono salvati in `~/.cache/ms-playwright/` (non in `node_modules`),
  condivisi tra progetti che usano la stessa versione Playwright.

**Nota**: la skill `visual-oracle-protocol` usa esclusivamente Chromium in v2.17.
Firefox e WebKit sono supportati da Playwright ma non richiesti da EP-005.
[^src: design_&_architecture/decisions/ADR-008.md §Rationale]

## Verifica

Dopo l'installazione, verifica che Playwright sia correttamente disponibile:

```bash
npx playwright --version
# Atteso: Version 1.x.y (o superiore, exit code 0)
```

Exit code 0 = installazione operativa. La skill `visual-oracle-protocol` Fase 1
(Bootstrap) esegue esattamente questo controllo. Se l'output mostra un numero di
versione e il comando termina senza errore, sei pronto.

Verifica opzionale più estesa:

```bash
npx playwright --help
# Atteso: lista completa sub-comandi (test, install, show-report, ...)

# Smoke test rapido (crea e rimuove screenshot al volo)
npx playwright screenshot --browser chromium https://example.com /tmp/pw-test.png
ls -la /tmp/pw-test.png
# Atteso: file PNG presente, ~50-150 KB
rm /tmp/pw-test.png
```

## Struttura `.factory-runners/`

La skill `visual-oracle-protocol` Fase 2 (Render Headless) genera uno **script
runner Bash** template-izzato e lo deposita in una cartella `.factory-runners/`
nella root del code_path FE. Questa cartella è **gitignored** per non inquinare
il codebase del progetto. [^src: design_&_architecture/decisions/ADR-008.md §Rationale]

Pattern atteso nel `.gitignore` del progetto FE:

```
# Visual oracle runner (generato da visual-oracle-protocol)
.factory-runners/
```

Se la tua factory non ha ancora questa voce nel `.gitignore` del codice FE,
aggiungila manualmente o la skill la aggiungerà nella Fase 2.

Contenuto tipo di `.factory-runners/`:

```
.factory-runners/
└── visual-oracle-runner.sh   # generato dalla skill, sovrascritto ad ogni run
```

Lo script runner è effimero: non contiene stato, viene rigenerato dalla skill
a ogni invocazione con i parametri del TSK corrente (viewport, theme, path
componente). Non committarlo: è un artefatto di esecuzione, non un sorgente.

## Ambienti corporate ristretti

Ambienti con proxy/firewall o policy di download restrittive possono bloccare
`npx playwright install --with-deps chromium` in due punti:

### Problema 1 — Proxy blocca il download del binario Chromium

```bash
# Imposta variabili proxy prima di eseguire playwright install
export HTTPS_PROXY=http://proxy.azienda.it:8080
export HTTP_PROXY=http://proxy.azienda.it:8080
npx playwright install --with-deps chromium
```

Se il proxy richiede autenticazione:

```bash
export HTTPS_PROXY=http://utente:password@proxy.azienda.it:8080
```

### Problema 2 — Ambienti air-gapped (nessuna connessione internet)

Pre-scarica il binario Chromium su una macchina con accesso internet, poi
trasferisci la cache:

```bash
# Su macchina CON internet:
npx playwright install chromium
# Il binario è in ~/.cache/ms-playwright/chromium-<versione>/

# Copia la cartella ms-playwright sul server air-gapped (via USB, artifactory, etc.)
tar czf playwright-chromium-cache.tar.gz ~/.cache/ms-playwright/

# Sul server air-gapped:
mkdir -p ~/.cache/ms-playwright/
tar xzf playwright-chromium-cache.tar.gz -C ~/
# Ora npx playwright install chromium troverà il binario in cache e non lo riscaricherà
```

Variabile d'ambiente alternativa per path cache custom:

```bash
export PLAYWRIGHT_BROWSERS_PATH=/percorso/cache/playwright
npx playwright install chromium
```

### Problema 3 — Policy IT blocca esecuzione binari scaricati da internet

In alcuni ambienti Windows con policy CrowdStrike/Defender, i binari di
Playwright vengono bloccati. Opzioni:

- Richiedi eccezione IT per `~/.cache/ms-playwright/` (path fisso, ben documentato)
- Usa una immagine Docker con Playwright pre-installato per il runner della skill
  (rivalutabile in v2.18+, vedi ADR-008 §Alternative considerate — Container ephemeral)
- Contatta il maintainer del meta-framework per il workaround specifico

## Aggiornamento e Disinstallazione

### Aggiornare Playwright

Per aggiornare all'ultima versione:

```bash
# Aggiorna il pacchetto npm
npm update @playwright/test

# Ri-scarica il binario Chromium compatibile con la nuova versione
npx playwright install chromium --with-deps
```

**Nota**: versione `@playwright/test` e binario Chromium devono essere compatibili.
Playwright gestisce questa compatibilità automaticamente: `npx playwright install`
scarica sempre il binario corretto per la versione del pacchetto installata.

### Disinstallare Playwright

```bash
# Rimuovi il binario Chromium dalla cache
npx playwright uninstall chromium

# Rimuovi la dev-dependency dal progetto
npm uninstall @playwright/test

# Rimuovi i file generati dalla skill (runner + artefatti)
rm -rf .factory-runners/
rm -rf code_quality/reports/*-visual-iter-*/   # artefatti PNG/JSON del visual oracle

# Pulizia opzionale della cache globale (se non usata da altri progetti)
rm -rf ~/.cache/ms-playwright/
```

Verifica rimozione:

```bash
npx playwright --version
# Atteso: errore «command not found» o «Cannot find module '@playwright/test'»
```

## Troubleshooting

### `Error: browserType.launch: Executable doesn't exist at ...`

**Messaggio completo**: `browserType.launch: Executable doesn't exist at /Users/.../ms-playwright/chromium-XXXX/...`

**Causa**: il pacchetto `@playwright/test` è installato ma il binario Chromium non è stato scaricato (step 2 non eseguito o eseguito per una versione diversa).

**Soluzione**:
```bash
npx playwright install --with-deps chromium
```

Se il problema persiste dopo un aggiornamento di versione, forza il re-download:
```bash
npx playwright install --force --with-deps chromium
```

---

### `npx: command not found` o `npx playwright --version` non trovato

**Causa**: Node.js non è installato, o la versione installata è < 16, o il PATH non include la directory npm/npx.

**Soluzione**:
```bash
# Verifica Node.js
node --version   # deve essere >= 16.x

# Se assente, installa via nvm (raccomandato):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20   # LTS corrente
nvm use 20

# Poi ri-esegui l'installazione (Step 1 + Step 2)
```

---

### `Error: Failed to install browsers` con proxy/firewall

**Messaggio tipo**: `Failed to download Playwright browsers. Check your network connection or proxy settings.`

**Causa**: il download del binario Chromium è bloccato da un proxy o firewall aziendale.

**Soluzione**:
```bash
export HTTPS_PROXY=http://proxy.azienda.it:8080
npx playwright install --with-deps chromium
```

Vedi sezione [Ambienti corporate ristretti](#ambienti-corporate-ristretti) per le opzioni air-gapped.

---

### `Error: Cannot find module '@playwright/test'` durante la skill

**Causa**: la skill `visual-oracle-protocol` viene invocata dalla root del `code_path`
FE ma il `node_modules/@playwright` non è presente lì (installazione eseguita in
una directory diversa, o `npm install` non ancora eseguito).

**Soluzione**: esegui l'installazione dalla **root del progetto FE** (non dalla root del meta-framework):

```bash
cd <code_path_fe>
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

---

### La skill produce `STOP — Visual oracle richiede Playwright` al Bootstrap

**Causa**: la skill `visual-oracle-protocol` Fase 1 ha eseguito `npx playwright --version` e ha ricevuto exit code != 0. Messaggio azionabile: «Visual oracle richiede Playwright. Esegui: `npm i -D @playwright/test && npx playwright install --with-deps chromium`. Vedi runbook `wiki/runbooks/visual-oracle-installation.md`».

**Soluzione**: segui la procedura di [Installazione](#installazione) nella directory corretta, poi rilancia la skill.

## Riferimenti

- Decisione architetturale: ADR-008 — Browser headless per visual oracle: Playwright via Bash, no MCP, runtime nel dev-agent
- Epica: EP-005 — FE Visual Oracle
- User story: US-017 — Skill visual-oracle-protocol con 5 fasi
- Skill: `.claude/skills/visual-oracle-protocol.md` (skill che consuma questo runbook)
- Pacchetto npm: [`@playwright/test`](https://www.npmjs.com/package/@playwright/test)
- Documentazione ufficiale: [playwright.dev/docs/intro](https://playwright.dev/docs/intro)
- Runbook correlato: [[graphify-installation]] (modello strutturale, stesso pattern install → verifica → troubleshooting)
- Concept: [[correctness-oracle]] (motivazione dell'oracolo di correttezza FE), [[fe-agent-correctness-strategy]] §Leva 1
