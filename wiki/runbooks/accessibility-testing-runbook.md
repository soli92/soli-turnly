---
type: runbook
sources: ["raw/accessibility-testing-capability.md"]
status: draft
created: 2026-06-03
updated: 2026-06-03
tags: [accessibility, wcag, a11y, runbook, setup, ci, playwright, axe-core, adapter, fallback]
---

# Accessibility Testing — Runbook operativo

> Playbook per integrare e operare la capability di accessibility testing in un framework multi-agentico: setup dipendenze, rilevamento stack, integrazione CI, checklist di adattamento al framework ospite, procedura di fallback per stack non coperti.

## Contesto

Questo runbook si affianca al concept [[accessibility-testing-capability]]. Copre la dimensione operativa: come installare le dipendenze, come l'adapter detection funziona passo-passo, come configurare il CI, e come adattare la capability al framework ospite sostituendo i marcatori `<<...>>`. [^src: raw/accessibility-testing-capability.md §7. Setup tecnico]

## Setup dipendenze

### Dipendenze base (Node.js)

```bash
# Librerie core
npm i -D playwright axe-playwright
npx playwright install chromium
```

### Dipendenze opzionali

```bash
# Lighthouse (score sintetico + performance/SEO collaterali)
npm i -D lighthouse

# pa11y (CLI rapida per batch CI senza browser headed)
npm i -D pa11y
```

Verificare che `playwright` sia ≥ 1.40 per la compatibilità con axe-playwright.

## Procedura di rilevamento stack e adapter

Prima di eseguire `run_a11y_scan`, l'agente/skill deve risolvere il target seguendo questa sequenza: [^src: raw/accessibility-testing-capability.md §2. Motore di test]

### Step 1 — Identifica il tipo di input

```
if (input è URL http/https)
  -> target = URL, adapter = "live"
else if (esiste una build/preview avviabile)
  -> avvia server, target = http://localhost:PORT, adapter = "local-server"
else if (input è file componente .tsx/.jsx/.vue/.svelte)
  -> adapter = "component-harness" (Storybook/jsdom)
     oppure degradare a "static-review" se harness non disponibile
else
  -> chiedi chiarimento o degrada a "static-review"
```

### Step 2 — Scegli il profilo di scansione

| Adapter | `include_interactive` | Note |
|---|---|---|
| `live` (URL) | true | Pagina già servita, interazione completa disponibile |
| `local-server` (SPA/SSR) | true | Avvia il server prima, attendi `networkidle` |
| `component-harness` | false | Il componente è isolato, manca il contesto di navigazione |
| `static-review` | false (N/A) | Review del markup sorgente, nessun browser |

### Step 3 — Esegui la scansione

Invocare `run_a11y_scan` con il target risolto. Parametri minimi:

```json
{
  "target": "<url o percorso>",
  "standard": "wcag22aa",
  "include_interactive": true
}
```

### Step 4 — Interpreta il report

Seguire la tassonomia severity del [[accessibility-testing-capability]]:

- **Critical**: aprire issue bloccante. Non procedere al merge senza fix o eccezione documentata.
- **Major**: aprire issue alta priorità. Segnalare nel PR.
- **Minor**: aprire issue normale o annotare nel backlog.
- **manual_checks**: elencare nel report senza inferire lo stato. Status sempre `to_verify`.

Ricordare la [[wcag-automated-coverage-limit]]: mai omettere i manual_checks anche se l'automated_findings è vuoto.

## Integrazione CI

Aggiungere lo step di scansione a11y sulle pagine/route rappresentative: [^src: raw/accessibility-testing-capability.md §7. Setup tecnico]

```yaml
# Esempio GitHub Actions (adattare alla CI del progetto)
- name: Run a11y scan
  run: node scripts/run-a11y.js
  env:
    A11Y_TARGET: https://staging.example.com
    A11Y_FAIL_ON: critical  # oppure "critical,major"
```

Strategia di fallimento consigliata:

| Severity | Comportamento CI |
|---|---|
| `critical` | Fail pipeline (blocca merge) |
| `major` | Warning (non blocca, ma visibile) |
| `minor` | Info (solo nel report) |
| `manual_checks` | Warning (listati come reminder) |

## Checklist di adattamento al framework ospite

Prima di considerare la capability integrata, eseguire i seguenti controlli. [^src: raw/accessibility-testing-capability.md §9. Checklist di adattamento]

- [ ] Sostituire tutti i marcatori `<<...>>` nel documento sorgente con i riferimenti reali del framework:
  - `<<come_si_registra_un_tool>>` → convenzione locale (es. `.claude/tools/`, `mcp_tools:`, entry in `AGENTS.md`)
  - `<<percorso_skill>>` → cartella delle skill (es. `.claude/skills/`)
  - `<<come_si_registra_un_agente>>` → file in `.claude/agents/` o equivalente
  - `<<output_schema_standard>>` → verificare se il framework ha già uno schema di output condiviso; allineare o estendere
- [ ] Registrare `run_a11y_scan` nel sistema di tool del framework.
- [ ] Decidere e implementare la/e forma/e scelte (§albero decisionale in [[accessibility-testing-capability]]).
- [ ] Verificare la presenza delle dipendenze npm o aggiungerle al setup del progetto.
- [ ] Confermare la gestione del fallback mobile/non-web (sezione seguente).
- [ ] Verificare che lo schema di output sia consumabile dagli agenti downstream (es. `qa-dev`, `fe-dev`).

## Procedura fallback mobile / non-web

Quando il target è un'app mobile, React Native, o un sistema non-web: [^src: raw/accessibility-testing-capability.md §6. Limiti e fallback]

1. Dichiarare esplicitamente nel report che il motore web non si applica.
2. Eseguire **review statica del codice** sui seguenti elementi:
   - Label e descrizioni accessibili su componenti interattivi.
   - Ruoli semantici (per React Native: `accessibilityRole`).
   - Ordine di focus (proprietà `accessibilityViewIsModal`, `importantForAccessibility`).
   - Contrasto da design token (se disponibile).
3. Raccomandare strumenti nativi:
   - Android: Accessibility Scanner (Google Play)
   - iOS: Accessibility Inspector (incluso in Xcode)
4. Riportare la copertura ridotta nel `summary.coverage_note` del report.

## Fallback contenuto dietro autenticazione

Se il target richiede login: [^src: raw/accessibility-testing-capability.md §6. Limiti e fallback]

1. Preferire ambienti di staging con bypass autenticazione o utente di test dedicato.
2. Se non disponibile, configurare uno step di login nell'adapter prima di eseguire la scansione (Playwright supporta `page.fill()` + `page.click()` per form login).
3. Documentare nel report che la scansione è avvenuta su sessione autenticata (influisce sulla riproducibilità).

## Concetti correlati

[[accessibility-testing-capability]]
[[wcag-automated-coverage-limit]]
[[axe-core]]
[[code-quality-review-layer]]
[[parallel-scheduler]]
[[ux-ui-review-design-capability]]
[[ux-ui-review-runbook]]

## Pagine collegate

[[2026-06-03-accessibility-testing-capability]]

## Storie collegate
<!-- Sezione gestita dal product-manager — non modificare se sei wiki-keeper -->

- [EP-007](../../management/kanban/EP-007-accessibility-testing-capability/EP-007.md) — Accessibility Testing Capability (riusa marcatori `<<...>>` del runbook)
- [US-024](../../management/kanban/EP-007-accessibility-testing-capability/US-024-skill-accessibility-testing-protocol/US-024.md) — Skill protocol (Step 1 = §Procedura adapter detection del runbook)
- [US-027](../../management/kanban/EP-007-accessibility-testing-capability/US-027-regola-neutralita-fallback-ci-lint/US-027.md) — Integrazione CI + fallback mobile/auth dal runbook §Procedura fallback
