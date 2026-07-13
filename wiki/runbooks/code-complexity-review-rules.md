---
type: runbook
sources: ["raw/code-complexity-metrics.md"]
status: draft
created: 2026-06-15
updated: 2026-06-15
tags: [code-quality, review, complessita, soglie, refactoring, agentici, runbook]
---

# Regole Operative per la Review di Complessità

Guida operativa per l'agente di code review su come rilevare violazioni di complessità ciclomatica e cognitiva, segnalarle con il formato corretto e suggerire il refactoring appropriato. Da usare come riferimento nella Passata 2 (Design & Manutenibilità) del [[code-quality-review-layer]]. [^src: raw/code-complexity-metrics.md §4. Regole Operative per l'Agente di Review]

## Soglie di riferimento

| Metrica | Soglia attenzione | Soglia blocco | Azione |
|---|---|---|---|
| [[cyclomatic-complexity]] | > 10 | > 20 | Segnala / Blocca con motivazione |
| [[cognitive-complexity]] | > 15 | > 30 | Segnala / Blocca con motivazione |
| Nesting depth | > 3 livelli | > 4 livelli | Sempre un segnale, indipendente dalle soglie |

> Le soglie ciclomatiche derivano dalle raccomandazioni originali di McCabe (1976) e dagli standard industriali di SonarQube. Le soglie cognitive sono basate sulle linee guida di SonarSource (2021). [^src: raw/code-complexity-metrics.md §4.1 Soglie di riferimento]

## Pattern da rilevare

### Annidamento eccessivo

**Trigger:** più di 3 livelli di strutture di controllo annidate.

**Segnale:** alta difficoltà cognitiva. La funzione è candidata a refactoring con guard clauses. [^src: raw/code-complexity-metrics.md §4.2 Pattern da rilevare]

### `else` non necessari

**Trigger:** un `if` seguito da `return` o `throw` con un blocco `else` esplicito.

**Segnale:** l'uso di early return elimina il ramo `else` e riduce il nesting, abbassando la complessità cognitiva senza alterare la semantica. [^src: raw/code-complexity-metrics.md §4.2 Pattern da rilevare]

### Condizioni composte lunghe

**Trigger:** sequenze di 4 o più operatori logici in una singola espressione condizionale.

**Segnale:** la condizione dovrebbe essere estratta in una variabile con nome descrittivo (*Introduce Explaining Variable*) o in una funzione predicato autonoma. [^src: raw/code-complexity-metrics.md §4.2 Pattern da rilevare]

### Funzioni con doppia violazione

**Trigger:** la funzione supera sia la soglia ciclomatica che quella cognitiva.

**Segnale:** priorità massima di refactoring. Le due metriche che violano insieme indicano un problema strutturale, non solo di leggibilità superficiale. [^src: raw/code-complexity-metrics.md §4.2 Pattern da rilevare]

### Ricorsione non documentata

**Trigger:** funzione ricorsiva senza commento esplicito sulla condizione di uscita.

**Segnale:** rischio di stack overflow e difficoltà di comprensione. Un commento sulla base case è necessario come documentazione minima. [^src: raw/code-complexity-metrics.md §4.2 Pattern da rilevare]

## Suggerimenti di refactoring per pattern

| Pattern rilevato | Tecnica di refactoring | Riferimento |
|---|---|---|
| Nesting profondo (> 3) | **Guard clauses / Early return** | Fowler, *Refactoring* (2018), cap. "Replace Nested Conditional with Guard Clauses" |
| Switch/case grande | **Lookup table o Strategy pattern** | GoF, *Design Patterns* (1994) |
| Funzione con troppe responsabilità | **Extract Function / Extract Method** | Fowler, *Refactoring* (2018) |
| Condizione composta complessa | **Introduce Explaining Variable** | Fowler, *Refactoring* (2018) |
| Ciclo con logica interna complessa | **Extract Method sul corpo del ciclo** | Martin, *Clean Code* (2008), cap. 3 |

[^src: raw/code-complexity-metrics.md §4.3 Suggerimenti di refactoring associati]

## Formato di output atteso

Quando l'agente rileva una violazione, il messaggio di review deve includere cinque elementi obbligatori: [^src: raw/code-complexity-metrics.md §4.4 Formato di output atteso dall'agente]

1. **Metrica violata** (ciclomatica / cognitiva / entrambe)
2. **Valore calcolato** e soglia superata
3. **Localizzazione** (funzione, riga approssimativa)
4. **Pattern specifico** che contribuisce maggiormente al punteggio
5. **Suggerimento di refactoring** concreto e contestualizzato

**Esempio di output canonico:**

```
[REVIEW] Funzione `process_order` — Complessità cognitiva: 24 (soglia: 15)
Contributo principale: annidamento a 4 livelli tra le righe 42–67.
Suggerimento: applicare guard clauses per i casi di validazione iniziale
(righe 42–48) in modo da ridurre il nesting del blocco principale.
Pattern: Replace Nested Conditional with Guard Clauses.
```

[^src: raw/code-complexity-metrics.md §4.4 Formato di output atteso dall'agente]

## Integrazione con il Code Quality Review Layer

Questo runbook alimenta la **Passata 2 — Design & Manutenibilità** del [[code-quality-review-layer]], che ha come input extra le metriche deterministiche pre-calcolate (complessità ciclomatica, fan-in/fan-out, LOC per funzione). Il calcolo delle metriche dovrebbe essere eseguito da tool deterministici (Lizard, Radon) e iniettato nel context del reviewer — non calcolato euristicamente dall'LLM — per ridurre il rischio di allucinazioni sui valori numerici.

I finding strutturati seguendo questo formato sono compatibili con lo schema di output JSON del Quality Reviewer e con il loop control del Feedback Router (deduplicazione per `(file, lines, rule_id)`, escalation su no-progress).

## Tool di supporto consigliati

| Tool | Linguaggi | Metriche | URL |
|---|---|---|---|
| **Lizard** | multi-linguaggio | ciclomatica | https://github.com/terryyin/lizard |
| **Radon** | Python | ciclomatica, mantenibilità, Halstead | https://radon.readthedocs.io |
| **SonarQube** | multi-linguaggio | ciclomatica + cognitiva integrate | https://rules.sonarsource.com |

[^src: raw/code-complexity-metrics.md §5. Riferimenti e Letture di Approfondimento]

## Concetti correlati

[[cyclomatic-complexity]]
[[cognitive-complexity]]
[[code-quality-review-layer]]
[[stack-aware-ruleset]]

## Pagine collegate

[[2026-06-15-code-complexity-metrics]]

## Storie collegate
<!-- Sezione gestita dal product-manager — non modificare se sei wiki-keeper -->
