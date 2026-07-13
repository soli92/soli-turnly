---
type: runbook
sources: ["raw/ux-ui-capability.md"]
status: draft
created: 2026-06-03
updated: 2026-06-03
tags: [ux, ui, design, runbook, wireframe, component-spec, user-flow, design-system, a11y, skill]
---

# UX/UI Design — Runbook operativo

> Playbook per eseguire la sotto-capability di design UX/UI in un framework multi-agentico: quando attivarla, come ancorarsi al design system, come produrre deliverable con rationale esplicito, e come passare l'output alla review senza auto-valutarsi.

## Contesto

Questo runbook si affianca al concept [[ux-ui-review-design-capability]] e si concentra sulla **sotto-capability Design** (agente `ui-designer`). Il principio fondamentale e' la **separazione di ruoli**: chi progetta non revisiona il proprio output — lo passa obbligatoriamente alla sotto-capability Review ([[ux-ui-review-runbook]]). [^src: raw/ux-ui-capability.md §1. Le due sotto-capability]

## Quando attivare la sotto-capability Design

Trigger tipici: [^src: raw/ux-ui-capability.md §5.3 Skill — design]

- Richiesta esplicita ("progetta / ridisegna questa schermata / componente / flusso").
- Wireframe, spec di componente, user flow o microcopy non ancora esistenti.
- Iterazione su un artefatto esistente dopo una review con finding `major` o `critical`.
- Prototipazione rapida per validare un'idea con stakeholder.

## Step 1 — Chiarisci obiettivo, contesto e vincoli

Prima di produrre qualsiasi artefatto: [^src: raw/ux-ui-capability.md §5.3 Skill — design]

1. **Obiettivo utente**: cosa deve poter fare l'utente al termine del flusso / componente?
2. **Contesto**: da dove arriva l'utente? Qual e' il suo stato cognitivo (primo accesso vs esperto)?
3. **Vincoli**: piattaforma (web/mobile), viewport, accessibilita', pattern del design system.
4. **Assunzioni**: qualsiasi ipotesi non confermata deve essere esplicitata e marcata come assunzione.

Se il contesto non e' sufficientemente chiaro, chiedere chiarimento prima di procedere. Un design su assunzioni errate crea debito di revisione.

## Step 2 — Ancora le scelte al design system

Il design system e' la fonte di verita'. [^src: raw/ux-ui-capability.md §4.2 Design system = fonte di verità]

Cascata di risoluzione:
1. `<<design_system_del_progetto>>` — usare componenti, token e pattern esistenti.
2. Token estratti dal codice (CSS custom properties, Tailwind config).
3. Default ragionevoli — solo se nessuna delle precedenti e' disponibile; **dichiararlo esplicitamente**.

Preferire pattern noti del design system a invenzioni: la coerenza con il sistema esistente e' una dimensione di qualita' valutabile dalla review (dimensione "Coerenza" della [[ux-ui-rubric-anti-subjectivity]]).

## Step 3 — Produci il deliverable

I tipi di deliverable supportati: [^src: raw/ux-ui-capability.md §5.3 Skill — design]

| Tipo | Quando usarlo | Forma tipica |
|---|---|---|
| **Wireframe lo-fi** | Prototipazione rapida, validazione struttura | Sketch testuale o ASCII, poi immagine |
| **Spec di componente** | Definizione dettagliata di un componente riusabile | JSON/YAML strutturato + annotazioni |
| **User flow** | Mappatura di un flusso multi-passo | Diagramma passo-passo con decision points |
| **Microcopy** | Testi UI (label, errori, empty state, CTA) | Lista per elemento con contesto |

Per ogni **scelta non ovvia**, dare il rationale: perche' questa soluzione e non un'alternativa? Il rationale rende il design difendibile in review e riduce i round di revisione.

### Produrre l'output

Usare `render_component(spec)` se disponibile per generare una preview visiva del componente. Questo chiude parzialmente il loop sulla dimensione percettiva — ma non sostituisce la review. [^src: raw/ux-ui-capability.md §5.1 Tool]

## Step 4 — Accessibilita' by design

Includere la dimensione a11y fin dal wireframe, non come post-processing: [^src: raw/ux-ui-capability.md §5.3 Skill — design]

- **Stato di focus** visibile su ogni elemento interattivo (non solo hover).
- **Label** su ogni input, icona e azione (non solo placeholder).
- **Contrasto** verificato rispetto ai minimi WCAG AA (delegare a `run_a11y_scan` in review se non calcolabile in fase di design).
- **Ordine di navigazione** da tastiera coerente con il flusso logico.
- **Empty state / error state** previsti e comunicati in linguaggio chiaro.

Vedi [[accessibility-testing-capability]] e [[accessibility-testing-runbook]] per i dettagli operativi.

## Step 5 — Marca assunzioni e domande aperte

Ogni deliverable deve includere esplicitamente: [^src: raw/ux-ui-capability.md §5.3 Skill — design]

- **Assumptions**: ipotesi fatte per mancanza di contesto (es. "utente gia' autenticato").
- **Open questions**: domande che richiedono input dal PM / stakeholder / ricerca utente (es. "sono previsti metodi di pagamento multipli?").

Non procedere a iterazioni successive senza avere risposta alle domande bloccanti. Le assunzioni non verificate si accumulano come debito di specifiche.

## Step 6 — Passa l'output alla review (obbligatorio)

**L'agente `ui-designer` NON valuta il proprio output.** Passarlo alla sotto-capability Review: [^src: raw/ux-ui-capability.md §1. Le due sotto-capability]

```
ui-designer produce deliverable
  |
  v
ux-ui-reviewer riceve il deliverable come input visivo
  |
  v
report di review con findings + open_questions
  |
  v
ui-designer itera se necessario (loop bounded)
```

Questo e' il pattern [[evaluator-optimizer]] applicato al dominio UX/UI: il designer e il reviewer sono agenti distinti che si alternano in un ciclo di miglioramento.

## Output standard del deliverable

[^src: raw/ux-ui-capability.md §6. Output standard]

```json
{
  "type": "ux_ui_design",
  "deliverable": "wireframe | component_spec | user_flow | copy",
  "artifacts": ["wireframe_checkout.png", "component_spec.json"],
  "rationale": [
    "Ridotti i passi da 4 a 3 accorpando indirizzo e spedizione (euristica nielsen-8: minimalismo).",
    "CTA primaria allineata a sinistra per coerenza col design system esistente."
  ],
  "assumptions": [
    "Utente gia' autenticato.",
    "Solo metodo di pagamento singolo."
  ],
  "open_questions": [
    "Sono previsti metodi di pagamento multipli?",
    "Il flusso deve supportare utenti guest (non autenticati)?"
  ]
}
```

## Vincoli del designer

- **Non auto-valutare**: l'output va sempre in review prima di essere considerato pronto.
- **Preferire pattern noti**: le invenzioni ex-novo devono avere un rationale esplicito.
- **Accessibilita' by design**: non rimandare a11y alla fase di review; progettarla fin dal wireframe.
- **Assunzioni esplicite**: mai produrre un design su presupposti impliciti.

## Limiti

[^src: raw/ux-ui-capability.md §8. Limiti]

- La sotto-capability Design **non sostituisce la ricerca utente**. Le preferenze di design basate su euristiche e design system non sono equivalenti a dati comportamentali reali. Le `open_questions` sono il canale verso chi ha il contesto utente.
- Senza **design system disponibile** l'output e' piu' generico e meno coerente con il prodotto esistente. Dichiararlo.
- La qualita' del design **dipende dalla qualita' del briefing** (Step 1): un obiettivo utente vago produce un design sotto-determinato.

## Concetti correlati

[[ux-ui-review-design-capability]]
[[ux-ui-rubric-anti-subjectivity]]
[[accessibility-testing-capability]]
[[accessibility-testing-runbook]]
[[evaluator-optimizer]]
[[design-token]]
[[correctness-oracle]]

## Pagine collegate

[[2026-06-03-ux-ui-capability]]
[[ux-ui-review-runbook]]

## Storie collegate
<!-- Sezione gestita dal product-manager — non modificare se sei wiki-keeper -->

- [EP-008](../../management/kanban/EP-008-ux-ui-review-design-capability/EP-008.md) — UX/UI Review & Design Capability (sotto-capability Design)
- [US-029](../../management/kanban/EP-008-ux-ui-review-design-capability/US-029-skill-ux-ui-design-protocol/US-029.md) — Skill `ux-ui-design-protocol` (6 step ricalcano i §Step 1-6 del runbook)
- [US-030](../../management/kanban/EP-008-ux-ui-review-design-capability/US-030-agenti-distinti-ux-ui-reviewer-ui-designer/US-030.md) — Agente `ui-designer` con vincolo no auto-eval + comando `/ux-ui-design`
