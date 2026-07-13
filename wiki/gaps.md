---
type: gaps
project: soli-turnly
description: "Registro append-only dei gap di conoscenza (PATTERN R.5)"
---

# wiki/gaps.md — Gap di conoscenza

> **Append-only** — non modificare le entry esistenti (PATTERN R.5).
> Aggiornato dal wiki-keeper durante l'ingest.

| ID | Data | Tema | Descrizione | Status |
|---|---|---|---|---|
| G-001 | 2026-07-13 | Tech stack | `raw/tech_stack.md` assente: il documento funzionale non prescrive lo stack tecnologico. Necessario per Arch (design_&_architecture) e per i dev-agent. Suggerito: eseguire `/tech-scout` o aggiungere manualmente `raw/tech_stack.md`. | aperto |
| G-002 | 2026-07-13 | Design Figma | Inventario schermate §10 è funzionale (22 schermate descritte), ma nessun `raw/*.kb.json` Figma è ancora disponibile. Necessario per Visual Oracle, UX/UI Review, Prototype Generation. Suggerito: eseguire `/sync-docs` con fonte Figma quando i mockup saranno disponibili. | aperto |
| G-003 | 2026-07-13 | DB Schema — tabelle mancanti rispetto ad ADR-001 | ADR-001 definisce 12 tabelle: le 10 implementate in TSK-002 più `availability` e `coverage_requirements` (e `swap_operations` come tabella opzionale). TSK-002 scope era 10 tabelle; le 2 tabelle rimanenti (`availability`, `coverage_requirements`) vanno pianificate in un TSK separato (wave 2+) per non introduire drift rispetto ad ADR-001 §Schema. | aperto |
