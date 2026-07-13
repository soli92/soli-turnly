---
id: voice-channel-installation
type: runbook
title: "Installazione Voice Channel (EP-041 — faster-whisper + piper-tts)"
status: current
created: 2026-07-08
updated: 2026-07-08
sources:
  - "wiki/sources/sistema-vocale-factory.md §11 (dipendenze locale-first)"
  - "wiki/sources/sistema-vocale-factory.md §12 (testing)"
  - "factory.config.yaml (sezione voice_channel:)"
  - "pyproject.toml (extras [voice])"
  - "management/kanban/EP-041-voice-channel-factory/US-146-configurazione-runbook/US-146.md"
related:
  - voice-channel-factory
  - faster-whisper
  - piper-tts
tags: [voice, runbook, installazione, stt, tts, faster-whisper, piper-tts, sounddevice, ep-041]
pattern_section: "§29"
---

# Installazione Voice Channel

> Procedura operativa per installare il canale vocale push-to-talk della factory
> (EP-041, [[voice-channel-factory]]). Permette a un nuovo collaboratore di passare
> da zero a prima sessione vocale in meno di 30 minuti su macOS o Linux con
> PortAudio disponibile, senza dover leggere il design spec.
>
> Il canale vocale e' **opt-in**: quando `voice_channel.enabled: false` (default)
> nessuna dipendenza vocale viene importata e la factory funziona esattamente come
> prima dell'epica (US-146 AC2).

## Prerequisiti

### Python e sistema

- **Python 3.10+** (verificare: `python3 --version`)
- **pip 21+** (verificare: `pip3 --version`)
- **~2 GB di disco** per i modelli STT e TTS

### PortAudio (libreria audio di sistema)

`sounddevice` richiede PortAudio installato a livello di sistema prima di qualsiasi
operazione pip.

**macOS (Homebrew):**

```bash
brew install portaudio
```

**Linux (Debian/Ubuntu):**

```bash
sudo apt-get update
sudo apt-get install -y libportaudio2 portaudio19-dev
```

**Linux (Fedora/RHEL):**

```bash
sudo dnf install portaudio portaudio-devel
```

Se PortAudio non e' presente, `pip install sounddevice` o `pyaudio` fallisce con
errori `portaudio.h not found`. Installare PortAudio **prima** di procedere.

## Installazione dipendenze vocali

### Metodo A — extras group pip (raccomandato)

Dal root del repo factory:

```bash
pip install -e ".[voice]"
```

Installa (da `pyproject.toml [project.optional-dependencies] voice`):

| Pacchetto | Versione minima | Uso |
|---|---|---|
| `faster-whisper` | 1.0.3 | STT via CTranslate2 (Fase 1+) |
| `piper-tts` | 1.2.0 | TTS neurale locale (Fase 1+) |
| `sounddevice` | 0.4.6 | Cattura e riproduzione audio |
| `silero-vad` | 5.1 | Voice Activity Detection (Fase 2+) |
| `webrtcvad-wheels` | 2.0.14 | VAD alternativo (Fase 2+) |
| `pyaudio` | 0.2.14 | Backend audio alternativo |
| `numpy` | 1.24 | Elaborazione array audio |

### Metodo B — pip diretto (senza extras group)

Se non hai un `pyproject.toml` con il gruppo `voice` (es. installazione standalone):

```bash
pip install \
  "faster-whisper>=1.0.3" \
  "piper-tts>=1.2.0" \
  "sounddevice>=0.4.6" \
  "silero-vad>=5.1" \
  "webrtcvad-wheels>=2.0.14" \
  "pyaudio>=0.2.14" \
  "numpy>=1.24"
```

### Verifica installazione

```bash
# Verifica faster-whisper
python3 -c "import faster_whisper; print('faster-whisper ok')"

# Verifica sounddevice
python3 -c "import sounddevice; print('sounddevice ok')"

# Verifica piper-tts (binario CLI)
which piper
# Atteso: percorso assoluto, es. /usr/local/bin/piper o ~/.local/bin/piper
piper --version
```

Se `which piper` non trova nulla, il binario puo' essere in `~/.local/bin/`.
Aggiungi al PATH:

```bash
# bash/zsh — aggiungi a ~/.bashrc o ~/.zshrc
export PATH="$(python3 -m site --user-base)/bin:$PATH"
source ~/.bashrc   # oppure: source ~/.zshrc
```

## Download modello STT (faster-whisper)

Il modello Whisper in formato CTranslate2 si scarica **automaticamente al primo
avvio** di `python -m voice.app`. Non e' necessario uno step manuale.

### Pre-download esplicito (opzionale, raccomandato su connessioni lente)

```bash
python3 -c "
from faster_whisper import WhisperModel
print('Download modello base in corso...')
model = WhisperModel('base', device='cpu', compute_type='int8')
print('Modello base scaricato e pronto.')
"
```

I modelli vengono salvati in `~/.cache/huggingface/hub/` (path gestito da
`huggingface_hub`). Non e' necessario specificare manualmente il path.

**Modelli disponibili e trade-off:**

| Modello | Dimensione | Velocita' | Accuratezza | Uso consigliato |
|---|---|---|---|---|
| `tiny` | ~75 MB | Molto rapido | Base | Debug / macchine lente |
| `base` | ~145 MB | Rapido | Buona | **Default (US-146 AC1)** |
| `small` | ~466 MB | Medio | Migliore | Produzione qualita' alta |
| `medium` | ~1.5 GB | Lento | Ottima | Server dedicato |

Per cambiare il modello, imposta `voice_channel.stt.model` in
`factory.config.yaml` (vedi sezione Configurazione).

## Download voce italiana (piper-tts)

La voce di default e' `it_IT-riccardo-medium`. E' necessario scaricarla
manualmente prima della prima sessione vocale.

### Step 1 — Crea la directory dei modelli vocali

```bash
mkdir -p ~/.local/share/piper
```

### Step 2 — Scarica il file ONNX e il file di configurazione JSON

```bash
# File modello ONNX (~63 MB)
curl -L -o ~/.local/share/piper/it_IT-riccardo-medium.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx"

# File di configurazione JSON (indispensabile — contiene phoneme map)
curl -L -o ~/.local/share/piper/it_IT-riccardo-medium.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx.json"
```

Con `wget` in alternativa a `curl`:

```bash
wget -P ~/.local/share/piper \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx"
wget -P ~/.local/share/piper \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx.json"
```

### Step 3 — Verifica

```bash
ls -lh ~/.local/share/piper/
# Atteso:
#   it_IT-riccardo-medium.onnx       (~63 MB)
#   it_IT-riccardo-medium.onnx.json  (piccolo, ~3 KB)

# Test sintetico (genera un file WAV di prova)
echo "Ciao, prova vocale" | piper \
  --model ~/.local/share/piper/it_IT-riccardo-medium.onnx \
  --output_file /tmp/test-piper.wav
# Atteso: nessun errore; il file /tmp/test-piper.wav viene creato
```

### Percorso da impostare in factory.config.yaml

Il campo `voice_channel.tts.voice` accetta il path assoluto al file `.onnx`
(senza estensione) oppure il nome breve della voce:

```yaml
voice_channel:
  tts:
    voice: it_IT-riccardo-medium  # nome breve (voice/config.py cerca in ~/.local/share/piper/)
    # oppure path assoluto esplicito:
    # voice: /home/user/.local/share/piper/it_IT-riccardo-medium.onnx
```

## Configurazione

### Impostazione minima

Apri `factory.config.yaml` e imposta `voice_channel.enabled: true`:

```yaml
voice_channel:
  enabled: true                  # abilita il canale vocale
  phase: 1                       # Fase 1 = Push-to-Talk MVP
  stt:
    provider: faster-whisper
    model: base                  # tiny | base | small
    language: it
  tts:
    provider: piper-tts
    voice: it_IT-riccardo-medium # voce italiana scaricata al passo precedente
  audio:
    input_device: null           # null = dispositivo di default del sistema
    output_device: null
```

Tutti gli altri blocchi (`vad:`, `barge_in:`, `aec:`) possono restare con i
valori di default: sono attivi solo in Fase 2+ e non influenzano la Fase 1.

### Parametri chiave

| Campo | Default | Descrizione |
|---|---|---|
| `voice_channel.enabled` | `false` | Master switch — opt-in esplicito obbligatorio |
| `voice_channel.phase` | `1` | Fase roadmap attiva: 1=PTT, 2=VAD, 3=barge-in, 4=AEC |
| `voice_channel.stt.model` | `base` | Dimensione modello Whisper (trade-off velocita'/accuratezza) |
| `voice_channel.tts.voice` | `it_IT-riccardo-medium` | Nome breve voce piper o path assoluto |
| `voice_channel.audio.input_device` | `null` | Dispositivo microfono (null = default sistema) |
| `voice_channel.audio.output_device` | `null` | Dispositivo altoparlante (null = default sistema) |
| `voice_channel.log_level` | `INFO` | Livello log transizioni FSM: DEBUG|INFO|WARNING |
| `voice_channel.vad.threshold` | `0.5` | Soglia VAD in stato CATTURA (Fase 2+) |

## Prima sessione vocale

Segui questi passi in ordine dopo aver completato l'installazione e la configurazione.

**Step 1.** Assicurati che `voice_channel.enabled: true` sia impostato in
`factory.config.yaml` (vedi sezione precedente).

**Step 2.** Avvia la sessione vocale:

```bash
python -m voice.app
```

All'avvio l'app:
- carica e verifica le dipendenze vocali
- scarica il modello Whisper se non gia' presente in cache
- carica la voce piper dal path configurato
- stampa "Pronto. Premi INVIO per parlare."

**Step 3.** Premi `INVIO` per iniziare la cattura audio.

**Step 4.** Parla chiaramente nel microfono (in italiano, lingua default).

**Step 5.** Rilascia `INVIO` per terminare la cattura e avviare la trascrizione.

**Step 6.** Ascolta la risposta vocale sintetizzata dagli altoparlanti.

La cattura → trascrizione → elaborazione → risposta vocale costituisce un singolo
turno della **state machine** `IDLE → CATTURA → TRASCRIZIONE → ELABORAZIONE →
PARLATO → IDLE` (design spec §5).

## Verifica smoke test

### Smoke test rapido — dry-run

```bash
python -m voice.app --dry-run
```

Deve stampare "Dipendenze caricate" senza errori. Verifica le importazioni di
`faster_whisper`, `sounddevice`, `piper` e la raggiungibilita' dei file modello.

### Lista dispositivi audio

```bash
python -m voice.app --list-devices
```

Stampa tutti i dispositivi audio del sistema con indice numerico.
Se il microfono corretto non e' il default, imposta:

```yaml
voice_channel:
  audio:
    input_device: "Nome Dispositivo"   # oppure indice numerico, es. 2
```

### Smoke test microfono (sounddevice)

```python
# test_mic.py — registra 3 secondi e stampa il livello RMS
import sounddevice as sd
import numpy as np

duration = 3  # secondi
sample_rate = 16000
print("Parla per 3 secondi...")
audio = sd.rec(int(duration * sample_rate),
               samplerate=sample_rate, channels=1, dtype='float32')
sd.wait()
rms = np.sqrt(np.mean(audio**2))
print(f"RMS: {rms:.4f} — {'OK (segnale rilevato)' if rms > 0.001 else 'BASSO (microfono silenzioso?)'}")
```

```bash
python3 test_mic.py
```

### Smoke test STT (trascrizione file WAV)

```bash
# Genera un file WAV di test con piper (richiede voce installata)
echo "Benvenuto nella factory vocale" | piper \
  --model ~/.local/share/piper/it_IT-riccardo-medium.onnx \
  --output_file /tmp/test-stt-input.wav

# Trascrivi con faster-whisper
python3 -c "
from faster_whisper import WhisperModel
model = WhisperModel('base', device='cpu', compute_type='int8')
segments, info = model.transcribe('/tmp/test-stt-input.wav', language='it')
text = ' '.join(s.text for s in segments)
print('Trascrizione:', text)
"
```

Atteso: la trascrizione deve includere le parole "Benvenuto nella factory vocale"
(o simili — il TTS puo' introdurre piccole variazioni fonetiche).

### Config esplicita

```bash
python -m voice.app --config path/to/custom-config.yaml
```

Utile per testare configurazioni alternative senza modificare `factory.config.yaml`.

## Toggling on/off

Il canale vocale si abilita e disabilita modificando un singolo campo in
`factory.config.yaml`, **senza riavviare la factory** (US-146 AC3).

**Per abilitare:**

```yaml
voice_channel:
  enabled: true
```

**Per disabilitare:**

```yaml
voice_channel:
  enabled: false
```

Quando `enabled: false` (default), `voice/config.py` restituisce la configurazione
di default e **nessun** modulo `voice/` importa dipendenze audio/STT/TTS. La
factory funziona esattamente come prima dell'epica: comportamento no-op totale,
zero import audio, zero effetti collaterali (US-146 AC2).

Il toggling e' efficace al prossimo avvio del modulo `voice/` o alla prossima
invocazione di `python -m voice.app`. Non e' necessario modificare il codice ne'
riavviare processi di lunga durata non legati al canale vocale.

## Fase 3: Barge-in (note di attivazione)

La **Fase 3** aggiunge il rilevamento della voce dell'utente durante la sintesi
vocale (barge-in): quando il VAD rileva voce durante lo stato PARLATO, il TTS
viene interrotto e il sistema torna in CATTURA.

**Per attivare il barge-in (richiede phase: 3):**

```yaml
voice_channel:
  phase: 3
  barge_in:
    enabled: true
    vad_threshold: 0.7   # soglia piu' alta in stato PARLATO per ridurre falsi trigger
```

**Rischio falsi trigger su altoparlanti:** con altoparlanti (senza cuffie), il VAD
puo' rilevare la voce del TTS come barge-in, generando un loop di interruzioni.
Il parametro `barge_in.vad_threshold: 0.7` (piu' alto del default `vad.threshold:
0.5` in stato CATTURA) mitiga il problema, ma la mitigazione definitiva e' l'uso
delle cuffie.

**Raccomandazione:** usare le **cuffie** in Fase 3. Le cuffie eliminano il
feedback acustico TTS → microfono e permettono di abbassare la soglia VAD per
una risposta piu' reattiva al barge-in (design spec §8, US-144 AC7).

## Fase 4 (opzionale): AEC per altoparlanti

La **Fase 4** aggiunge l'Acoustic Echo Cancellation (AEC): il sistema filtra il
segnale del TTS in uscita dagli altoparlanti prima che raggiunga il VAD, eliminando
il feedback acustico senza richiedere le cuffie.

> **Con cuffie la Fase 4 non e' necessaria.** Le cuffie eliminano fisicamente il
> percorso acustico altoparlante → microfono. La Fase 4 e' rilevante solo se si
> vuole usare altoparlanti senza rischio di falsi trigger (US-146 AC4, design
> spec §8).

### Prerequisiti AEC

Scegli uno dei provider supportati:

**Opzione A — WebRTC APM (raccomandato, qualita' superiore):**

```bash
# macOS
brew install webrtc-audio-processing

# Linux (Debian/Ubuntu)
sudo apt-get install -y libwebrtc-audio-processing-dev

# Pacchetto Python (wrapper)
pip install webrtcvad-wheels   # gia' incluso in pip install '.[voice]'
```

**Opzione B — speexdsp:**

```bash
# macOS
brew install speex

# Linux (Debian/Ubuntu)
sudo apt-get install -y libspeex-dev libspeexdsp-dev

# Pacchetto Python
pip install speexdsp
```

### Configurazione AEC

```yaml
voice_channel:
  phase: 4
  aec:
    enabled: true
    provider: webrtc-apm   # webrtc-apm | speexdsp | noisereduce
```

Con `aec.enabled: false` (default), il sistema assume che le cuffie siano in uso
e non applica alcun filtro AEC. La factory funziona identicamente in Fase 1, 2
e 3 con cuffie e `aec.enabled: false`.

## Troubleshooting

### `piper not found in PATH`

```bash
# Verifica che il path Python user-base sia nel PATH
python3 -m site --user-base
# Es. output: /Users/user/.local
# Il binario piper e' in: /Users/user/.local/bin/piper

# Aggiungi al PATH (bash/zsh)
export PATH="$(python3 -m site --user-base)/bin:$PATH"

# Verifica
which piper
```

### `ImportError: No module named faster_whisper`

```bash
pip install -e ".[voice]"
# oppure:
pip install "faster-whisper>=1.0.3"
```

Se l'errore persiste, verifica di essere nell'environment Python corretto:

```bash
which python3
which pip3
# Devono puntare allo stesso environment
```

### `No module named sounddevice`

```bash
pip install "sounddevice>=0.4.6"
```

Se l'installazione fallisce con errori `portaudio.h not found`:
- PortAudio non e' installato → vedi sezione **Prerequisiti**
- oppure PortAudio e' installato ma non nel PATH di compilazione → usa
  `brew --prefix portaudio` per trovare il prefix e imposta `CFLAGS` e `LDFLAGS`
  prima di `pip install`.

### Microfono non rilevato / segnale assente

```bash
python -m voice.app --list-devices
# Identifica l'indice del dispositivo microfono corretto
```

Imposta il dispositivo in `factory.config.yaml`:

```yaml
voice_channel:
  audio:
    input_device: "Nome Dispositivo"   # stringa esatta o indice numerico
```

Verifica il segnale con lo smoke test microfono (sezione **Verifica smoke test**).

### Modello Whisper lento / latenza alta

- Usa `stt.model: tiny` per la massima velocita' (minor accuratezza)
- Verifica `compute_type`: `int8` e' piu' rapido di `float32` su CPU
- Whisper non usa GPU con `device: cpu` — se hai una GPU, imposta `device: cuda`
  (richiede `nvidia-smi` + CUDA toolkit installati)

### `FileNotFoundError` per il modello piper

```
ERROR: Model file not found: ~/.local/share/piper/it_IT-riccardo-medium.onnx
```

Il modello non e' stato scaricato. Ripeti la sezione **Download voce italiana
(piper-tts)** e verifica che entrambi i file (`.onnx` e `.onnx.json`) siano
presenti.

### TTS non produce audio (nessun suono)

1. Verifica che il dispositivo di output sia corretto: `python -m voice.app --list-devices`
2. Imposta `voice_channel.audio.output_device` se il default non e' corretto
3. Testa il TTS in isolamento:
   ```bash
   echo "Test audio" | piper \
     --model ~/.local/share/piper/it_IT-riccardo-medium.onnx \
     --output_file /tmp/test-audio.wav && aplay /tmp/test-audio.wav
   ```

## Gestione processo (macOS)

### Avviare manualmente

```bash
cd /percorso/factory
arch -arm64 python3 -m voice
```

Con logging su file:

```bash
arch -arm64 python3 -m voice >> ~/Library/Logs/soli-voice/terminal-voice.log 2>&1 &
```

### Terminare il processo

Su macOS il framework Python installa il binario come:

```
/Library/Frameworks/Python.framework/Versions/3.12/Resources/Python.app/Contents/MacOS/Python -m voice
```

Il nome del processo inizia con lettera **maiuscola** (`Python`). `pkill -f` è
**case-sensitive** su macOS: il pattern `python.*-m voice` non trova il processo e
lascia istanze zombie che competono per il microfono.

**Comando corretto** (flag `-i` = case-insensitive):

```bash
pkill -fi "Python.*-m voice"
```

Verifica che tutti i processi siano terminati:

```bash
ps aux | grep -E "Python.*-m voice" | grep -v grep
```

### Prevenire istanze multiple

Alla base del problema c'è l'assenza di un lock file. Soluzione provvisoria: verificare
sempre prima di avviare:

```bash
ps aux | grep -E "Python.*-m voice" | grep -v grep && echo "ATTENZIONE: voice già attivo" || arch -arm64 python3 -m voice &
```

### LaunchAgent (auto-start)

Il LaunchAgent in `~/Library/LaunchAgents/com.soli.voice-factory.plist` usa
`start-voice.command` — un wrapper bash che esegue `arch -arm64 python3 -m voice`.
Le modifiche ai file Python sorgente e a `factory.config.yaml` sono lette a ogni
avvio: **non è necessario aggiornare il LaunchAgent** per applicare fix al codice.

Per ricaricare il LaunchAgent dopo modifiche al `.plist`:

```bash
launchctl unload ~/Library/LaunchAgents/com.soli.voice-factory.plist
launchctl load ~/Library/LaunchAgents/com.soli.voice-factory.plist
```

## Disattivazione

Per disabilitare il canale vocale senza rimuovere le dipendenze installate:

```yaml
# factory.config.yaml
voice_channel:
  enabled: false   # ripristina il comportamento pre-EP-041 (no-op totale)
```

La factory torna al comportamento pre-EP-041: nessuna dipendenza vocale importata,
nessun processo audio avviato, comportamento identico a v2.27 prima dell'epica.

Per rimuovere completamente le dipendenze Python (raro):

```bash
pip uninstall faster-whisper piper-tts sounddevice silero-vad webrtcvad-wheels pyaudio
```

I modelli scaricati restano in `~/.cache/huggingface/hub/` e
`~/.local/share/piper/` — rimuoverli manualmente se necessario.

## Riferimenti

- Design spec: [[voice-channel-factory]] (concept) + `wiki/sources/sistema-vocale-factory.md`
- Configurazione: `factory.config.yaml` sezione `voice_channel:` (EP-041, US-146 AC1)
- Dipendenze: `pyproject.toml` extras group `[voice]`
- Epica: `management/kanban/EP-041-voice-channel-factory/EP-041.md`
- US correlate: US-143 (PTT MVP), US-144 (barge-in), US-145 (sintesi parlata), US-147 (AEC)
- Pacchetti: [faster-whisper PyPI](https://pypi.org/project/faster-whisper/),
  [piper-tts PyPI](https://pypi.org/project/piper-tts/),
  [sounddevice PyPI](https://pypi.org/project/sounddevice/)
- Modelli piper: [rhasspy/piper-voices su HuggingFace](https://huggingface.co/rhasspy/piper-voices)
- Modelli faster-whisper: [Systran/faster-whisper-* su HuggingFace](https://huggingface.co/Systran)
