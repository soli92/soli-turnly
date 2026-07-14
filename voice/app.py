"""
Voice Channel Factory — entry point.

Utilizzo:
    python -m voice.app                    # usa factory.config.yaml in cwd o parent
    python -m voice.app --config path.yaml # config esplicita
    python -m voice.app --dry-run          # verifica dipendenze senza avviare
    python -m voice.app --list-devices     # lista dispositivi audio
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from contextlib import contextmanager
from pathlib import Path


# Percorso di default del PID file (coerente con _PIPE_DIR in voice/runtime/).
DEFAULT_PID_PATH = Path.home() / ".local/share/soli-voice/voice.pid"


@contextmanager
def pid_lock(path: Path):
    """Context manager che serializza l'avvio di voice/app.py tramite PID file.

    Acquisizione (sincrona, prima dell'event loop):
      - Crea la directory se assente (AC6).
      - Se il file esiste, legge il PID e verifica con os.kill(pid, 0):
          * nessuna eccezione → processo vivo → stampa errore su stderr + sys.exit(1) (AC2)
          * ProcessLookupError → stale lock → sovrascrittura silenziosa (AC3)
          * PermissionError → conservativo, trattato come vivo → exit(1)
          * valore non-int / file corrotto → stale → sovrascrittura silenziosa
      - Scrive str(os.getpid()) nel file (AC1).

    Rilascio (finally — garantito anche su SystemExit / KeyboardInterrupt):
      - Rimuove il file solo se il PID nel file coincide col proprio (guard anti-race, AC4).

    Non introduce dipendenze esterne: stdlib only (os, pathlib, contextlib).
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        try:
            pid_text = path.read_text(encoding="utf-8").strip()
            pid = int(pid_text)
            try:
                os.kill(pid, 0)
                # Processo vivo: uscita pulita con messaggio diagnostico.
                print(
                    f"voice/app.py gia' in esecuzione (PID {pid}). "
                    f"Usa `kill {pid}` per terminarlo.",
                    file=sys.stderr,
                )
                sys.exit(1)
            except ProcessLookupError:
                # Stale lock: il processo non esiste piu', sovrascrivere.
                pass
            except PermissionError:
                # Conservativo: trattare come vivo (es. processo di un altro utente).
                print(
                    f"voice/app.py gia' in esecuzione (PID {pid}). "
                    f"Usa `kill {pid}` per terminarlo.",
                    file=sys.stderr,
                )
                sys.exit(1)
        except (ValueError, OSError):
            # Valore non-int o lettura fallita → lock stale, sovrascrivere.
            pass

    own_pid = os.getpid()
    path.write_text(str(own_pid), encoding="utf-8")
    try:
        yield
    finally:
        # Guard anti-race: rimuove il file solo se il PID nel file e' ancora il proprio.
        try:
            if path.exists() and path.read_text(encoding="utf-8").strip() == str(own_pid):
                path.unlink()
        except OSError:
            pass


async def main(
    config_path: str | None = None,
    dry_run: bool = False,
    list_devices: bool = False,
) -> None:
    """
    Entry point asincrono: carica la config, assembla la catena Fase 1,
    avvia il ciclo push-to-talk della state machine.

    Args:
        config_path:  Percorso esplicito a factory.config.yaml. Se None, risale
                      il filesystem dalla cwd (comportamento di default).
        dry_run:      Se True, instanzia i componenti per verificare le dipendenze
                      ma non avvia il ciclo push-to-talk.
        list_devices: Se True, stampa i device audio disponibili e ritorna.
    """
    # 1. Carica config dalla sezione voice_channel: di factory.config.yaml
    from voice.config import load_config

    config = load_config(config_path)

    if not config.enabled:
        print("voice_channel.enabled: false — imposta enabled: true in factory.config.yaml")
        sys.exit(0)

    # 2. --list-devices: elenca i device audio PortAudio e ritorna
    if list_devices:
        from voice.audio.devices import list_devices as _list_devices

        for d in _list_devices():
            print(
                f"  [{d['index']}] {d['name']}"
                f" (in:{d['channels_in']} out:{d['channels_out']})"
            )
        return

    # 3. PID lock — impedisce avvio di istanze multiple (US-159 AC1, AC4, AC6).
    #    Il path viene risolto qui (dopo load_config) ma prima dell'assembly audio.
    pid_path = (
        Path(config.pid_file_path).expanduser()
        if config.pid_file_path
        else DEFAULT_PID_PATH
    )

    with pid_lock(pid_path):
        from voice.core.side_channel import reset_state_file
        reset_state_file()  # AC4: reset atomico — prima operazione dentro pid_lock
        # 4. Configura logging al livello dichiarato in config
        logging.basicConfig(level=config.log_level)

        # Import lazy dei componenti: nessuno viene importato a livello di modulo
        # per rispettare il principio no-op quando voice_channel.enabled: false.
        from voice.audio.aec import NoOpProcessor, create_aec_processor
        from voice.audio.capture import AudioCapture
        from voice.audio.playback import AudioPlayback, PlaybackFarEndSink
        from voice.core.router import EventRouter
        from voice.core.state_machine import VoiceStateMachine
        from voice.runtime.claude_code_adapter import ClaudeCodeAdapter
        from voice.runtime.cursor_adapter import CursorAdapter
        from voice.runtime.custom_loop_adapter import CustomLoopAdapter
        from voice.runtime.mock_adapter import MockAdapter
        from voice.runtime.ollama_adapter import OllamaAdapter
        from voice.stt.faster_whisper_stt import FasterWhisperSTT
        from voice.tts.piper_tts import PiperTTS
        from voice.vad.endpointing import Endpointer
        from voice.vad.silero_vad import SileroVAD
        from voice.vad.wake_word import WakeWordDetector

        # --- Assembla catena Fase 1 ---

        # AudioPlayback: riproduzione sincrona TTS via PortAudio.
        # Creato prima di AudioCapture: il PlaybackFarEndSink (AEC) viene
        # collegato qui e passato al capture come reference far-end.
        playback = AudioPlayback(config)

        # AEC pre-filtro opzionale (US-147 AC3, AC4, AC5): cattura → AEC → VAD.
        # Se aec.enabled=False: NoOpProcessor (nessun import del binding WebRTC APM, AC3).
        # Se aec.enabled=True: cascata di fallback graceful webrtc-apm→speexdsp→
        # noisereduce→NoOp+WARNING (AC4); PlaybackFarEndSink collegato al playback
        # per la reference far-end (segnale TTS in riproduzione).
        if config.aec.enabled:
            aec_processor = create_aec_processor(config.aec)
            far_end_sink: PlaybackFarEndSink | None = PlaybackFarEndSink()
            playback.set_far_end_sink(far_end_sink)
        else:
            # aec.enabled=False: NoOpProcessor esplicito (AC3 — zero overhead, no WebRTC import)
            aec_processor = NoOpProcessor()
            far_end_sink = None

        # AudioCapture: cattura PCM dal microfono via PortAudio (callback real-time).
        # Pipeline: cattura → AEC (pre-filtro, US-147 AC5) → queue → VAD → STT.
        capture = AudioCapture(config, aec_processor=aec_processor, far_end_sink=far_end_sink)

        # VAD + Endpointer (fuori percorso attivo in F1; istanziati per completezza AC1)
        # NOTE: endpoint_silence_ms e' il campo corretto in VADConfig (non min_silence_ms).
        # debounce_ms: usa getattr come rete di sicurezza — TSK-333 aggiunge il campo
        # a VADConfig; in assenza il costruttore di Endpointer usa il default 500 ms.
        vad = Endpointer(
            SileroVAD(threshold=config.vad.threshold),
            silence_threshold_ms=config.vad.endpoint_silence_ms,
            debounce_ms=getattr(config.vad, "debounce_ms", 700),
        )

        # STT: faster-whisper (lazy load del modello al primo transcribe)
        stt = FasterWhisperSTT(
            model_size=config.stt.model,
            language=config.stt.language,
            no_speech_prob_threshold=config.stt.no_speech_prob_threshold,    # US-169
            compression_ratio_threshold=config.stt.compression_ratio_threshold,  # US-169
        )

        # TTS: piper-tts (carica modello .onnx nel costruttore; PiperTTS non ha speed)
        tts = PiperTTS(voice=config.tts.voice, model_dir=config.tts.model_dir)

        # Runtime: dispatch in base a voice_channel.runtime.provider
        _provider = config.runtime.provider
        if _provider == "mock":
            runtime = MockAdapter(config)
            print("[MOCK] Runtime in modalità echo — nessuna API key richiesta.")
        elif _provider == "ollama":
            runtime = OllamaAdapter(config)
            print(f"[OLLAMA] Runtime locale: {config.runtime.ollama_base_url} model={config.runtime.ollama_model}")
        elif _provider == "claude-code":
            runtime = ClaudeCodeAdapter(config)
            _tools = config.runtime.claude_code_allowed_tools
            print(f"[CLAUDE CODE] Runtime factory — tool: {_tools}")
            print("  Comandi vocali: query wiki, stato progetto, git log, diff, etc.")
        elif _provider == "file-pipe":
            from voice.runtime.file_pipe_adapter import FilePipeAdapter
            runtime = FilePipeAdapter(config)
            print("[FILE-PIPE] Runtime in-session — relay alla chat Claude Code attiva.")
            print("  Avvia il monitor nella sessione Claude Code per ricevere i comandi vocali.")
        elif _provider == "cursor":
            runtime = CursorAdapter(config)
            print(f"[CURSOR] Runtime factory Cursor — regole da {config.runtime.cursor_rules_dir}")
            print("  Anthropic API con system prompt costruito dai file .cursor/rules/*.mdc")
        else:
            runtime = CustomLoopAdapter(config)

        # EventRouter: coda asyncio per il TTS (unico choke point, US-143 AC6)
        tts_queue: asyncio.Queue[str] = asyncio.Queue()
        router = EventRouter(tts_queue)

        # Wake word detector (opt-in; no-op se wake_word.enabled=false)
        wake_word_detector = None
        if config.wake_word.enabled:
            wake_word_detector = WakeWordDetector(
                samples_dir=config.wake_word.samples_dir,
                keyword=config.wake_word.keyword,
                sensitivity=config.wake_word.sensitivity,
                min_detections=config.wake_word.min_detections,
            )
            try:
                wake_word_detector.load()
                print(f"[WAKE WORD] Keyword '{config.wake_word.keyword}' caricata — dì la parola per iniziare.")
            except (ImportError, FileNotFoundError) as exc:
                print(f"[WAKE WORD] WARN: {exc}")
                print("[WAKE WORD] Fallback a push-to-talk (INVIO).")
                wake_word_detector = None

        if dry_run:
            print("Dipendenze caricate. --dry-run: nessuna sessione avviata.")
            return

        # 5. Costruisce la state machine con dipendenze iniettate
        fsm = VoiceStateMachine(
            config=config,
            capture=capture,
            vad=vad,
            stt=stt,
            tts=tts,
            playback=playback,
            runtime=runtime,
            router=router,
            wake_word_detector=wake_word_detector,
        )

        print(
            f"Voice Channel Factory avviato"
            f" (modello STT: {config.stt.model}, voce TTS: {config.tts.voice})"
        )
        if config.wake_word.enabled and wake_word_detector is not None:
            print(f"Pronuncia '{config.wake_word.keyword}' per iniziare — poi parla liberamente.")
            print("La conversazione continua automaticamente dopo ogni risposta.")
        else:
            print("Premi INVIO per parlare — VAD rileva automaticamente la fine della frase.")
        print("Ctrl+C per uscire.")

        # 6. Avvia il loop push-to-talk; run_loop() gestisce KeyboardInterrupt
        #    internamente e chiama runtime.aclose().
        #    Il finally interno garantisce capture.stop() in ogni caso;
        #    il pid_lock context manager (esterno) rimuove il PID file al termine (AC4).
        try:
            await fsm.run_loop()
        finally:
            reset_state_file()  # AC5: IDLE rewrite allo shutdown ordinario
            capture.stop()


def cli() -> None:
    """Entry point sincrono: parse degli argomenti CLI + asyncio.run(main(...))."""
    parser = argparse.ArgumentParser(
        description="Voice Channel Factory — canale vocale push-to-talk EP-041."
    )
    parser.add_argument(
        "--config",
        metavar="PATH",
        default=None,
        help="Percorso esplicito a factory.config.yaml"
        " (default: ricerca automatica dalla cwd).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Verifica che le dipendenze siano installate senza avviare il ciclo vocale.",
    )
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="Elenca i device audio PortAudio disponibili e termina.",
    )
    args = parser.parse_args()

    try:
        asyncio.run(
            main(
                config_path=args.config,
                dry_run=args.dry_run,
                list_devices=args.list_devices,
            )
        )
    except KeyboardInterrupt:
        # Ctrl+C fuori dal loop asyncio (es. durante l'avvio): uscita pulita.
        pass


if __name__ == "__main__":
    cli()
