---
id: voice-channel
type: runbook
title: "Voice Channel — Operazioni e Model Selection (EP-044)"
status: current
created: 2026-07-09
updated: 2026-07-09
sources:
  - "voice/stt/faster_whisper_stt.py (docstring Performance notes)"
  - "voice/tests/benchmarks/stt_benchmark_report.md"
  - "management/kanban/EP-044-voice-handsfree-improvements/US-157-upgrade-stt-modello-medium/TSK-342.md"
  - "factory.config.yaml (sezione voice_channel:)"
related:
  - voice-channel-installation
  - voice-channel-factory
  - faster-whisper
tags: [voice, runbook, stt, model-selection, benchmark, wer, latenza, ep-044]
pattern_section: "§30"
---

# Voice Channel — Operazioni e Model Selection

> Runbook operativo per il canale vocale della factory (EP-041/EP-044).
> Copre la selezione del modello STT in base all'hardware disponibile,
> con dati di benchmark WER + latenza per `small` vs `medium`.
>
> Per l'installazione iniziale vedere
> [[voice-channel-installation]] (`wiki/runbooks/voice-channel-installation.md`).

## Model Selection

La selezione del modello STT e' controllata dal campo `voice_channel.stt.model`
in `factory.config.yaml`. Il valore default da EP-044 e' `medium`.

### Benchmark WER + latenza (corpus factory)

Benchmark eseguito su 10 frasi con terminologia tecnica factory (ID artefatti,
comandi kanban, versioni). Fonte: `voice/tests/benchmarks/stt_benchmark_report.md`.

**Modalita' di raccolta**: simulata su Apple M1 Max (CPU, int8).
Per rieseguire il benchmark: `python3 -m voice.tests.benchmarks.stt_benchmark --simulate`.

#### WER per modello

| Frase | small WER | medium WER |
|---|---|---|
| mostrami il kanban dello sprint corrente | 0.0% | 0.0% |
| crea una nuova epica per il monitoraggio | 0.0% | 0.0% |
| qual e' lo stato della user story US-155 | 25.0% | 0.0% |
| il TPM deve pianificare le dipendenze | 16.7% | 16.7% |
| aggiorna il task TSK-330 a status done | 28.6% | 0.0% |
| lancia l'orchestratore per il prossimo sprint | 0.0% | 0.0% |
| ottimizza la pipeline di deploy del backend | 0.0% | 0.0% |
| apri la sessione di architettura con il lead | 0.0% | 0.0% |
| genera il seed del meta-prompt v2.30 | 33.3% | 0.0% |
| aggiungi una nota alla wiki sul voice channel | 0.0% | 12.5% |
| **Media** | **10.4%** | **2.9%** |

> Errori tipici di `small` sui termini tecnici: ID artefatti (`TSK-330` → `tsk 330`),
> user story ID (`US-155` → `us 155`), versioni (`v2.30` → `v 2.30`),
> acronimi (`TPM` → `team`).

#### Latenza mediana (CPU, int8)

| Modello | Mediana | P95 |
|---|---|---|
| small  | 0.90s | 1.18s |
| medium | 2.12s | 2.85s |

### Raccomandazione per hardware

Il modello `medium` riduce il WER medio dal 10.4% al 2.9% (72% di miglioramento)
sul vocabolario tecnico factory. La latenza aggiuntiva (~2.1s vs ~0.9s) e'
accettabile per l'interazione push-to-talk dove la correttezza dei termini
tecnici e' critica.

| Scenario hardware | Modello raccomandato | Motivazione |
|---|---|---|
| Mac Apple Silicon (M1/M2/M3), >= 8GB RAM | `medium` | WER 2.9%, latenza 2.1s accettabile |
| Linux/Windows con GPU CUDA | `medium` | Latenza <0.5s con float16, WER ottimale |
| CPU-only, RAM < 8GB | `small` | Latenza 0.9s, evita OOM su sistemi vincolati |
| CI / ambienti senza audio | qualsiasi + `--simulate` | Benchmark sintetico senza dipendenze hardware |

### Procedura: passare a `small`

Modificare `factory.config.yaml`:

```yaml
voice_channel:
  stt:
    model: small   # default: medium (EP-044)
```

Nessun restart del processo richiesto se si usa il flag `--reload` del server
(la classe `FasterWhisperSTT` carica il modello lazy al primo `transcribe`).
Per forzare il reload del modello: riavviare il processo voice con `pkill -fi voice`.

### Procedura: eseguire il benchmark reale

```bash
# Prerequisiti
pip install faster-whisper
# Opzionale: per WER su audio reale (richiede modello piper scaricato)
export PIPER_MODEL_DIR=/path/to/piper/models

# Esegui benchmark (modalita' simulata — CI safe)
python3 -m voice.tests.benchmarks.stt_benchmark --simulate

# Esegui benchmark reale (richiede faster-whisper + PIPER_MODEL_DIR)
python3 -m voice.tests.benchmarks.stt_benchmark
```

Il report viene aggiornato in `voice/tests/benchmarks/stt_benchmark_report.md`.

### Note hardware

- **RAM**: `small` richiede ~1GB RAM, `medium` ~2.5GB RAM (int8, CPU).
- **GPU float16**: su GPU CUDA la latenza di `medium` scende a ~0.3s; su Apple Silicon
  (MPS) l'accelerazione non e' supportata da `faster-whisper` v1.x (usa `device=cpu`).
- **Modello `large`**: non raccomandato per interazione real-time (latenza > 5s su CPU).

## Gestione processo macOS

```bash
# Stop processo voice
pkill -fi voice/__main__

# Verifica processo attivo
ps aux | grep voice/__main__

# Riavvio
python3 -m voice &
```

> Nota macOS: usare `pkill -fi` (case-insensitive) — su macOS `Python` viene
> lanciato come `Python` (maiuscolo) dal framework, non `python`.
> Vedi `wiki/sources/2026-07-09-voice-channel-session-report.md`.

## Troubleshooting

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| Trascrizione sempre vuota | RMS audio troppo basso (gate < 0.008) | Avvicinare microfono, verificare gain |
| Hallucination (testo ripetuto) | No-speech audio passato al modello | Verificare VAD; aumentare `vad.energy_threshold` |
| Latenza > 5s | Modello `large` o CPU molto lenta | Passare a `small`; verificare `compute_type=int8` |
| ImportError faster-whisper | Dipendenza non installata | `pip install faster-whisper` |
| OOM / kill processo | RAM insufficiente per `medium` | Passare a `small` (1GB vs 2.5GB) |
