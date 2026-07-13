---
type: runbook
sources: ["raw/ux-ui-capability.md"]
status: draft
created: 2026-06-03
updated: 2026-06-03
tags: [ux, ui, review, runbook, nielsen, rubric, design-system, screenshot, playwright, a11y, skill]
---

# UX/UI Review — Runbook operativo

> Playbook per eseguire la sotto-capability di review UX/UI in un framework multi-agentico: quando attivarla, come ottenere l'input visivo, come applicare la rubrica passo-passo, come integrare con la capability a11y, e come produrre un report strutturato.

## Contesto

Questo runbook si affianca al concept [[ux-ui-review-design-capability]] e si concentra sulla **sotto-capability Review** (agente `ux-ui-reviewer`). La review UX/UI e' distinta dalla review a11y ([[accessibility-testing-runbook]]): valuta euristiche di usabilita', dimensioni visive e flusso — non solo criteri WCAG. I due runbook sono complementari e si incrociano nel punto in cui il reviewer delega `run_a11y_scan` per la parte di accessibilita'. [^src: raw/ux-ui-capability.md §5.2 Skill — review]

## Quando attivare la review UX/UI

Trigger tipici: [^src: raw/ux-ui-capability.md §5.2 Skill — review]

- Richiesta esplicita ("review UX/UI", "usability feedback", "design feedback").
- Prima di rilasciare una nuova schermata o flusso principale.
- Dopo che un cambiamento significativo tocca un componente visuale.
- Output della sotto-capability Design che richiede validazione (obbligatorio: mai lo stesso agente che progetta e revisiona — vedi [[ux-ui-design-runbook]]).

## Step 1 — Ottieni l'input visivo

La review **non si esegue dal solo codice sorgente**. [^src: raw/ux-ui-capability.md §4. Input e fonte di verità]

Sequenza di risoluzione:

```
if (URL o route disponibile)
  -> capture_screenshot(url, viewport=desktop) + capture_screenshot(url, viewport=mobile)
  -> opzionale: tablet

else if (componente isolato, harness disponibile)
  -> render in Storybook o preview locale
  -> capture_screenshot(harness_url, viewport=desktop)

else if (mockup statico / immagine fornita)
  -> usare direttamente come input visivo (dichiarare che e' un mockup, non il rendering reale)

else
  -> chiedere chiarimento; non procedere con sola analisi del codice sorgente
     (qualita' drasticamente inferiore — dichiararlo nel report)
```

Scheletro Playwright per la cattura (TypeScript): [^src: raw/ux-ui-capability.md §5.1 Tool]

```typescript
export async function captureScreenshot(
  target: string,
  viewport = { width: 1280, height: 800 }
) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  await page.goto(await resolveTarget(target), { waitUntil: "networkidle" });
  const img = await page.screenshot({ fullPage: true });
  await browser.close();
  return img; // passato come input visivo all'agente/skill
}
```

## Step 2 — Estrai i token e confrontali col design system

Invocare `extract_design_tokens(target)` e poi `check_design_system_conformance(target, ref)`. [^src: raw/ux-ui-capability.md §4.2 Design system = fonte di verità]

Cascata di risoluzione della fonte di verita':

1. `<<design_system_del_progetto>>` (design system ufficiale del progetto).
2. Token estratti dal codice (CSS custom properties, Tailwind config, style constants).
3. Default ragionevoli — se si usa questa opzione, **dichiararlo esplicitamente nel report**.

Se il design system non e' disponibile, annotare nel report: *"design system non disponibile; la review si basa su euristiche Nielsen e best practice generali — coerenza interna non verificabile rispetto a un sistema di riferimento."*

## Step 3 — Applica la rubrica (core della review)

Valutare l'input visivo contro tutti e tre gli assi della [[ux-ui-rubric-anti-subjectivity]]:

### 3a — Euristiche Nielsen (10)

Scorrere mentalmente le 10 euristiche. Per ogni problema trovato: [^src: raw/ux-ui-capability.md §3.1 Euristiche di usabilità]

```
problema rilevato → quale euristica viola? (nielsen-N) → severita' → posizione → raccomandazione
```

Severita':
- **Critical**: blocca l'uso (utente non riesce a completare l'azione primaria).
- **Major**: ostacolo serio ma aggirabile (utente si confonde, spreca passi).
- **Minor**: attrito o best practice non rispettata.

### 3b — Dimensioni UI visiva

Verificare: gerarchia, spaziatura/ritmo, tipografia, colore, coerenza, affordance/stati. [^src: raw/ux-ui-capability.md §3.2 Dimensioni di UI visiva]

Per il **contrasto cromatico**: non duplicare il check — delegare a `run_a11y_scan` (Step 4).

### 3c — Dimensioni di flusso UX

Se la review copre un flusso multi-passo (non solo una schermata): verificare numero di passi vs valore, punti di abbandono, chiarezza del prossimo passo, gestione errori/stati vuoti, reversibilita'. [^src: raw/ux-ui-capability.md §3.3 Dimensioni di flusso (UX)]

## Step 4 — Delega a11y per la parte di accessibilita'

L'agente `ux-ui-reviewer` include `run_a11y_scan`. Eseguirlo e incorporare i risultati nel report. [^src: raw/ux-ui-capability.md §5.4 Agenti]

Non duplicare i finding a11y nel `findings[]` UX — inserirli in una sezione separata o rimandare al report a11y completo. Vedi [[accessibility-testing-runbook]] per la procedura dettagliata.

## Step 5 — Compila il report

Output nel formato standard: [^src: raw/ux-ui-capability.md §6. Output standard]

```json
{
  "target": "<schermata o flusso>",
  "type": "ux_ui_review",
  "summary": {
    "critical": 0,
    "major": 2,
    "minor": 4,
    "open_questions": 3
  },
  "findings": [
    {
      "rubric_ref": "nielsen-1 (visibilita' dello stato del sistema)",
      "severity": "major",
      "location": "<elemento specifico + screenshot di riferimento>",
      "description": "<descrizione del problema>",
      "recommendation": "<azione concreta>",
      "evidence": "<screenshot_N.png o mockup>"
    }
  ],
  "positive_findings": ["<elementi che funzionano bene>"],
  "open_questions": ["<domande che richiedono contesto utente/business>"]
}
```

Regole obbligatorie per il report:
- Ogni `finding` cita un `rubric_ref` (euristiche, dimensioni visive, flusso, o regola del design system). **Niente finding senza rubric_ref.**
- Se parte del giudizio e' opinabile, aggiungere il tag `opinion: true` al finding e marcare esplicitamente nel campo `description`.
- Le domande aperte che richiedono contesto utente/business vanno in `open_questions`, non in `findings`.

## Step 6 — Gestisci i finding

| Severity | Azione suggerita |
|---|---|
| `critical` | Aprire issue/TSK bloccante. Segnalare prima del rilascio. |
| `major` | Aprire issue alta priorita'. Discutere con il team di prodotto. |
| `minor` | Issue normale o annotazione nel backlog. |
| `open_questions` | Girare a PM / stakeholder con il contesto utente/business. |

## Vincoli del reviewer

- **Non progettare**: il reviewer produce critica, non alternativa di design. Le raccomandazioni sono descrittive ("aggiungere stato loading"), non prescrittive nel dettaglio implementativo.
- **Non auto-valutare**: se il reviewer ha contribuito al design della schermata in revisione, il task va assegnato a un agente diverso.
- **Non dichiarare conformita' a11y**: la capability UX/UI non sostituisce un audit di accessibilita' completo. Vedi [[wcag-automated-coverage-limit]].

## Fallback: review senza input visivo

Se l'input visivo non e' disponibile e la richiesta e' urgente:

1. Dichiarare esplicitamente nel report: *"Review eseguita su sorgente testuale senza rendering — qualita' significativamente ridotta."*
2. Limitare la review alla struttura logica del flusso (asse 3: dimensioni di flusso) e alla coerenza del codice col design system (token).
3. Non emettere finding sulle dimensioni visive (gerarchia, spaziatura, tipografia) — non verificabili senza rendering.
4. Priorita' assoluta: ottenere screenshot al piu' presto e completare la review.

## Concetti correlati

[[ux-ui-review-design-capability]]
[[ux-ui-rubric-anti-subjectivity]]
[[accessibility-testing-capability]]
[[wcag-automated-coverage-limit]]
[[accessibility-testing-runbook]]
[[correctness-oracle]]
[[design-token]]

## Pagine collegate

[[2026-06-03-ux-ui-capability]]
[[ux-ui-design-runbook]]

## Storie collegate
<!-- Sezione gestita dal product-manager — non modificare se sei wiki-keeper -->

- [EP-008](../../management/kanban/EP-008-ux-ui-review-design-capability/EP-008.md) — UX/UI Review & Design Capability (sotto-capability Review)
- [US-028](../../management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md) — Skill `ux-ui-review-protocol` (5 step ricalcano i §Step 1-5 del runbook)
- [US-030](../../management/kanban/EP-008-ux-ui-review-design-capability/US-030-agenti-distinti-ux-ui-reviewer-ui-designer/US-030.md) — Agente `ux-ui-reviewer` con system prompt + comando `/ux-ui-review`
- [US-031](../../management/kanban/EP-008-ux-ui-review-design-capability/US-031-tool-supporto-screenshot-token-conformance/US-031.md) — Tool capture_screenshot / extract_design_tokens / check_design_system_conformance
