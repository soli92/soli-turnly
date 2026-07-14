"""
voice/core/state_machine.py — FSM principale: ciclo push-to-talk Fase 1/3.

5 stati: IDLE → CATTURA → TRASCRIZIONE → ELABORAZIONE → PARLATO → IDLE
         (Fase 3, US-144 AC2d) PARLATO → CATTURA su barge-in confermato.
Ogni transizione viene registrata in log (US-143 AC2).

In Fase 1 la cattura termina al rilascio del tasto INVIO (sequenziale,
nessun endpointing automatico e nessun barge-in — rimandati a US-144).

In Fase 3 (barge_in.enabled = true) lo stato PARLATO lancia due task
asyncio concorrenti: playback_task (TTS) e detector_task (BargeinDetector).
Alla conferma di barge-in: cancel_turn() + transizione PARLATO → CATTURA.

Gerarchia dei tipi:
  VoiceState          — enum dei 5 stati
  VoiceStateMachine   — FSM con iniezione dipendenze nel costruttore
  VoiceFSM            — alias (compatibilita' orchestrator spec)
"""
from __future__ import annotations

import asyncio
import logging
import queue as _queue_module
import time
from enum import Enum
from typing import TYPE_CHECKING

import numpy as np

from voice.core.session import VoiceSessionManager
from voice.core.side_channel import atomic_write_json, STATE_FILE, INBOX, SCHEMA_VERSION
from voice.runtime.factory_runtime import Acknowledgment, Done, Error, SpokenSummary

# levenshtein: importato da voice.vad.wake_word (TSK-336).
# Se il simbolo non e' ancora disponibile (TSK-336 non ancora eseguito),
# si usa l'implementazione inline di fallback.
try:
    from voice.vad.wake_word import levenshtein  # type: ignore[attr-defined]
except ImportError:

    def levenshtein(s1: str, s2: str) -> int:  # type: ignore[misc]
        """Levenshtein distance (fallback inline — sostituita da TSK-336)."""
        if len(s1) < len(s2):
            s1, s2 = s2, s1
        if not s2:
            return len(s1)
        prev = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            curr = [i + 1]
            for j, c2 in enumerate(s2):
                curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
            prev = curr
        return prev[-1]


if TYPE_CHECKING:
    from voice.audio.capture import AudioCapture
    from voice.audio.playback import AudioPlayback
    from voice.config import VoiceConfig
    from voice.core.router import EventRouter
    from voice.runtime.factory_runtime import FactoryRuntime
    from voice.stt.base import BaseSTT
    from voice.tts.base import TTSBase
    from voice.vad.endpointing import Endpointer
    from voice.vad.wake_word import WakeWordDetector

log = logging.getLogger(__name__)

# Intervallo (secondi) del check di liveness durante il loop CATTURA (TSK-396).
# Valore conservativo: garantisce rilevamento entro consumer_alive_ttl_s (10s) + 5s
# nel worst case, senza overhead significativo sul loop VAD.
_CATTURA_LIVENESS_INTERVAL_S: float = 5.0


# ---------------------------------------------------------------------------
# Enum stati FSM (US-143 AC2)
# ---------------------------------------------------------------------------

class VoiceState(Enum):
    """Cinque stati del ciclo push-to-talk (US-143 AC2)."""
    IDLE = "IDLE"
    CATTURA = "CATTURA"
    TRASCRIZIONE = "TRASCRIZIONE"
    ELABORAZIONE = "ELABORAZIONE"
    PARLATO = "PARLATO"


# ---------------------------------------------------------------------------
# Helper: svuota queue frame audio e restituisce PCM int16 bytes
# ---------------------------------------------------------------------------

def _drain_queue(q: "_queue_module.Queue") -> bytes:
    """Drena tutti i frame float32 dalla AudioCapture.queue.

    Ogni frame nella queue e' un numpy array float32 di shape (blocksize, channels).
    Li concatena lungo l'asse 0, prende il primo canale (mono) e converte in
    PCM int16 little-endian — formato atteso da BaseSTT.transcribe.

    Returns:
        Bytes audio PCM int16. Bytes vuoti se la queue e' gia' vuota.
    """
    frames = []
    while True:
        try:
            frame = q.get_nowait()
            frames.append(frame)
        except _queue_module.Empty:
            break

    if not frames:
        return b""

    audio = np.concatenate(frames, axis=0)
    # Flatten to mono: prende il primo canale se multi-canale
    if audio.ndim > 1:
        audio = audio[:, 0]
    # float32 [-1.0, 1.0] → int16 [-32768, 32767]
    audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
    return audio_int16.tobytes()


# ---------------------------------------------------------------------------
# VoiceStateMachine
# ---------------------------------------------------------------------------

class VoiceStateMachine:
    """
    FSM push-to-talk Fase 1: ciclo sequenziale
    IDLE → CATTURA → TRASCRIZIONE → ELABORAZIONE → PARLATO → IDLE.

    Tutte le dipendenze sono iniettate nel costruttore; run_once() esegue
    un turno completo usando i componenti memorizzati. run_loop() chiama
    run_once() in loop fino a KeyboardInterrupt.

    Compatibilita' DoD (US-143 AC2):
      - Attributo ``state`` di tipo str: ritorna il nome stringa dello stato
        corrente ('IDLE', 'CATTURA', 'TRASCRIZIONE', 'ELABORAZIONE', 'PARLATO').
      - run_turn(capture, stt, runtime, router, tts, playback, config) — firma
        DoD; wrapper che sovrascrive temporaneamente le dipendenze e chiama
        run_once().

    Nota barge-in (Fase 3, TSK-300):
      _cancellation_requested e' un asyncio.Event impostabile dall'esterno per
      segnalare un barge-in. In Fase 1 non viene mai impostato (CancelToken no-op).
    """

    def __init__(
        self,
        config: "VoiceConfig",
        capture: "AudioCapture",
        vad: "Endpointer",
        stt: "BaseSTT",
        tts: "TTSBase",
        playback: "AudioPlayback",
        runtime: "FactoryRuntime",
        router: "EventRouter",
        wake_word_detector: "WakeWordDetector | None" = None,
    ) -> None:
        self._config = config
        self._capture = capture
        self._vad = vad
        self._stt = stt
        self._tts = tts
        self._playback = playback
        self._runtime = runtime
        self._router = router
        self._wake_word_detector = wake_word_detector
        self._state: VoiceState = VoiceState.IDLE
        # True dopo la prima attivazione wake word: riascolta automaticamente
        # dopo ogni risposta TTS (conversazione continua), no wake word richiesto.
        self._continuous_mode: bool = False
        # True quando attivata dalla voce ("handsfree"): niente wake word per
        # l'intera sessione; _continuous_mode non viene mai resettato a False.
        self._handsfree_mode: bool = False
        # Lunghezza in caratteri dell'ultimo testo TTS pronunciato.
        # Usato per calcolare il cooldown dinamico post-TTS (echo casse).
        self._last_tts_chars: int = 0
        # Impostato a True nel ramo wake_word_detected: filtra il primo trascritto
        # che somiglia alla wake word (US-156, TSK-335). Sempre False in PTT/continuous
        # senza wake word — il check nel ramo TRASCRIZIONE e' un no-op trasparente (AC6).
        self._skip_next_utterance: bool = False
        # Impostato dall'esterno per barge-in (Fase 3, TSK-300). No-op in Fase 1.
        self._cancellation_requested: asyncio.Event = asyncio.Event()
        # Flag invariante US-166 (TSK-368): True durante riproduzione tts_chunks.
        # Blocca la transizione a CATTURA fino al completamento del TTS (AC3).
        # _speak_feedback() NON è coperta da questo flag (vincolo D4).
        self._tts_playing: bool = False
        self._tts_playing_since: float = 0.0
        # Timestamp di ingresso in CATTURA e flag onset parlato (US-168, TSK-376).
        # _cattura_start: re-inizializzato all'ingresso in CATTURA (anche via barge-in).
        # _speech_onset:  True quando il VAD ha rilevato almeno un frame di parlato;
        #                 disabilita l'onset_timeout check per il resto del turno.
        self._cattura_start: float = 0.0
        self._speech_onset: bool = False
        # Seam session-owner (US-170 EP-046): no-op nell'implementazione corrente.
        self._session_manager = VoiceSessionManager()

    # ------------------------------------------------------------------
    # Feedback vocale TTS (sostituisce beep — US-160 revisione)
    # ------------------------------------------------------------------

    async def _speak_feedback(self, text: str, sr: int = 22050) -> None:
        """Sintetizza e riproduce una frase di stato via TTS + afplay.

        Sostituisce i beep sinusoidali con frasi parlate (es. 'Sono in ascolto',
        'Ok, elaboro') per evitare il problema di startup latency Bluetooth:
        una frase TTS e' abbastanza lunga da sopravvivere al warmup BT (~300ms).
        Usa afplay (CoreAudio) su macOS per compatibilita' headset wireless.
        """
        try:
            synth = await asyncio.to_thread(self._tts.synthesize, text)
            from voice.audio.beep import play_beep as _pb  # noqa: PLC0415
            await _pb(synth, sr)
        except Exception as exc:  # noqa: BLE001
            log.warning("FSM: feedback vocale %r non riprodotto: %s", text, exc)

    # ------------------------------------------------------------------
    # Proprieta' pubblica: state come stringa (DoD US-143 AC2)
    # ------------------------------------------------------------------

    @property
    def state(self) -> str:
        """Stato corrente come stringa ('IDLE', 'CATTURA', ...)."""
        return self._state.value

    # ------------------------------------------------------------------
    # Transizione interna con logging
    # ------------------------------------------------------------------

    def _transition(self, new_state: VoiceState, trigger: str) -> None:
        """Esegue una transizione di stato e logga (US-143 AC2).

        Formato log: ``FSM: {from} → {to} (trigger: {trigger})``
        Scrive anche su voice-state.json per feedback visivo nelle sessioni file-pipe.
        """
        log.info(
            "FSM: %s → %s (trigger: %s)",
            self._state.value,
            new_state.value,
            trigger,
        )
        self._state = new_state
        self._write_state_update(trigger)

    def _write_state_update(self, trigger: str, context: "dict | None" = None) -> None:
        # write-only — voice-state.json è osservabilità esterna. NON viene mai riletto
        # per ripristinare lo stato FSM al restart. L'init forza sempre IDLE (invariante C1).
        import time as _time  # noqa: PLC0415
        payload: dict = {"state": self._state.value, "trigger": trigger, "ts": _time.time()}
        if context:
            payload.update(context)
        try:
            atomic_write_json(STATE_FILE, payload)
        except Exception as exc:  # noqa: BLE001
            log.debug("FSM: voice-state.json write failed: %s", exc)

    def _write_utterance_log(self, text: str) -> None:
        """Scrive l'utterance trascritta su voice-in.json per visibilità in chat."""
        import time as _time  # noqa: PLC0415
        import uuid as _uuid  # noqa: PLC0415
        try:
            atomic_write_json(INBOX, {
                "id": str(_uuid.uuid4())[:8],
                "text": text,
                "ts": _time.time(),
                "schema_version": SCHEMA_VERSION,
            })
        except Exception as exc:  # noqa: BLE001
            log.debug("FSM: voice-in.json write failed: %s", exc)

    # ------------------------------------------------------------------
    # run_once: un ciclo completo IDLE→IDLE
    # ------------------------------------------------------------------

    async def run_once(self) -> None:
        """Esegue UN ciclo completo IDLE→CATTURA→TRASCRIZIONE→ELABORAZIONE→PARLATO→IDLE.

        Fase 1 (push-to-talk sequenziale):
          1. IDLE: attende pressione INVIO da tastiera
          2. CATTURA: avvia capture; attende rilascio INVIO
          3. TRASCRIZIONE: stop capture; drena queue; trascrive via STT
          4. ELABORAZIONE: consuma stream eventi dal runtime; accumula testo TTS
          5. PARLATO: sintetizza e riproduce ogni chunk TTS accumulato
          6. IDLE: turno completato

        Turni vuoti (nessun audio o trascrizione vuota) vengono saltati con log
        di warning e ritorno diretto a IDLE.
        """
        from voice.core.session import new_session  # importazione lazy (evita circolare)

        session = new_session()
        sr: int = 16000                        # samplerate Fase 1 (fixed)
        tts_sr: int = 22050                    # samplerate output piper-tts
        self._last_tts_chars = 0               # reset per questo turno (cooldown corretto)

        # Assicura partenza da IDLE (guardia difensiva)
        if self._state != VoiceState.IDLE:
            log.warning(
                "FSM: run_once invocato in stato %s; reset forzato a IDLE",
                self._state.value,
            )
            self._state = VoiceState.IDLE

        # ---------------------------------------------------------------
        # Watchdog tts_playing (US-166, TSK-368): reset flag se TTS è rimasto
        # bloccato oltre la soglia di sicurezza (config.tts.playing_watchdog_s).
        # Previene starvation permanente del ciclo IDLE→CATTURA in caso di
        # eccezione non gestita nel path PARLATO.
        # ---------------------------------------------------------------
        if (self._tts_playing and
                time.monotonic() - self._tts_playing_since > self._config.tts.playing_watchdog_s):
            log.warning(
                "watchdog tts_playing scattato dopo %ds — reset flag",
                self._config.tts.playing_watchdog_s,
            )
            self._tts_playing = False

        # ---------------------------------------------------------------
        # [1] IDLE — attesa: conversazione continua | wake word | PTT
        # ---------------------------------------------------------------
        if self._continuous_mode:
            # Gate invariante US-166 (TSK-368, AC5): blocca CATTURA se TTS in corso.
            if self._tts_playing:
                log.warning("transizione a CATTURA bloccata: TTS in riproduzione")
                return
            await asyncio.sleep(1.0)              # cooldown fisso post-TTS (rimossa euristica device-name AC5)
            _drain_queue(self._capture.queue)     # flush eco residuo
            await self._speak_feedback("Sono in ascolto.", tts_sr)
            if self._handsfree_mode:
                print("\r🔊 Handsfree — parla pure")
            else:
                print("\r💬 Pronti — parla pure")
            self._transition(
                VoiceState.CATTURA,
                trigger="handsfree" if self._handsfree_mode else "conversazione_continua",
            )

        elif self._config.wake_word.enabled and self._wake_word_detector is not None:
            log.info(
                "FSM: in attesa (pronuncia '%s' per iniziare)...",
                self._config.wake_word.keyword,
            )
            self._capture.start()
            # Drain PortAudio startup buffer and wait 800ms before listening:
            # the first frames after start() often contain click/echo artifacts
            # that exceed the RMS gate and trigger a spurious wake-word match.
            _drain_queue(self._capture.queue)
            await asyncio.sleep(0.8)
            _drain_queue(self._capture.queue)
            try:
                await self._wake_word_detector.wait_for_wake_word(self._capture)
            finally:
                self._capture.stop()
                _drain_queue(self._capture.queue)

            print("\r🎤 Sto ascoltando...")
            await self._speak_feedback("Sono in ascolto.", tts_sr)

            # ---------------------------------------------------------------
            # [2] IDLE → CATTURA (wake word)
            # ---------------------------------------------------------------
            # Gate invariante US-166 (TSK-368): blocca CATTURA se TTS in corso.
            if self._tts_playing:
                log.warning("transizione a CATTURA bloccata: TTS in riproduzione")
                return
            self._transition(VoiceState.CATTURA, trigger="wake_word_detected")
            # Primo turno dopo wake word: filtra la wake word stessa se catturata
            # come utterance (US-156, TSK-335). Reset automatico nel ramo TRASCRIZIONE.
            self._skip_next_utterance = True
            self._continuous_mode = True  # modalità conversazione attiva

        else:
            log.info("FSM: in attesa (premi INVIO per iniziare a parlare)...")
            try:
                await asyncio.to_thread(input, "")
            except EOFError:
                pass
            # ---------------------------------------------------------------
            # [2] IDLE → CATTURA (PTT)
            # ---------------------------------------------------------------
            # Gate invariante US-166 (TSK-368): blocca CATTURA se TTS in corso.
            if self._tts_playing:
                log.warning("transizione a CATTURA bloccata: TTS in riproduzione")
                return
            self._transition(VoiceState.CATTURA, trigger="INVIO_premuto")

        # ---------------------------------------------------------------
        # CATTURA: VAD endpointing automatico
        # ---------------------------------------------------------------
        self._capture.start()
        log.info("FSM: cattura in corso (VAD endpointing)...")
        print("\r🔴 Registro — parla ora...", flush=True)

        captured_frames: list[bytes] = []
        vad_loop = asyncio.get_running_loop()
        self._vad.reset()
        # Inizializzazione timer CATTURA config-driven (US-168, TSK-376).
        # Re-eseguita qui: funziona sia per il percorso nominale sia per barge-in
        # (PARLATO → CATTURA), azzerando i timer a ogni nuovo ingresso nello stato.
        self._cattura_start = time.monotonic()
        self._speech_onset = False

        # ------------------------------------------------------------------
        # Liveness check periodico in CATTURA (TSK-396 — fix FSM pickup post-shutdown)
        #
        # Scenario di failure (root cause documentata):
        #   1. FSM in CATTURA; consumer (file-pipe) termina per crash o SIGTERM.
        #   2. CONSUMER_ALIVE diventa stale dopo consumer_alive_ttl_s (default 10s).
        #   3. Senza questo check, la FSM continua a catturare audio fino al VAD
        #      endpoint (onset_timeout_s=5s) o max_duration_s (30s), poi esegue STT,
        #      e solo in step [4] rileva il consumer morto. Il tempo di recupero
        #      può arrivare a 30s + latenza STT.
        #   4. In modalità continuous/handsfree, il prossimo run_once() rientra
        #      immediatamente in CATTURA (perché _continuous_mode=True e non viene
        #      resettato), creando un busy-loop: cattura → consumer_non_connesso
        #      → IDLE → cattura → ...
        #
        # Fix: verifica liveness ogni _CATTURA_LIVENESS_INTERVAL_S (5s). Se il
        # consumer è morto → stop capture, reset _continuous_mode, torna a IDLE.
        # Per adapter non-file-pipe (mock, anthropic, ollama, ecc.) is_consumer_alive()
        # ritorna sempre True → questa path è un no-op trasparente (AC5 invariato).
        # ------------------------------------------------------------------
        _cattura_liveness_last: float = self._cattura_start

        while True:
            # ------------------------------------------------------------------
            # Timer onset e max-duration (US-168 AC1/AC2) — valutati a ogni frame,
            # indipendentemente dal ramo queue.get/Empty. Sostituiscono il vecchio
            # deadline hardcoded 8s (rimosso, TSK-376).
            # ------------------------------------------------------------------
            _now = time.monotonic()
            _elapsed = _now - self._cattura_start

            # ------------------------------------------------------------------
            # Liveness check periodico (TSK-396): ogni _CATTURA_LIVENESS_INTERVAL_S
            # secondi verifica che il consumer sia ancora connesso.
            # Evita di completare la cattura + STT prima di scoprire il consumer morto.
            # ------------------------------------------------------------------
            if _now - _cattura_liveness_last >= _CATTURA_LIVENESS_INTERVAL_S:
                _cattura_liveness_last = _now
                if not self._runtime.is_consumer_alive():
                    log.warning(
                        "FSM CATTURA: consumer non connesso (liveness check periodico) "
                        "— abort capture, torno a IDLE"
                    )
                    self._capture.stop()
                    # Reset _continuous_mode: previene re-ingresso immediato in CATTURA
                    # nel prossimo run_once() (TSK-396 fix busy-loop post-shutdown).
                    if self._continuous_mode:
                        log.info(
                            "FSM: _continuous_mode reset — consumer morto rilevato in CATTURA"
                        )
                        self._continuous_mode = False
                    self._transition(VoiceState.IDLE, trigger="consumer_morto_in_cattura")
                    return

            if not self._speech_onset and _elapsed > self._config.capture.onset_timeout_s:
                log.info(
                    "FSM: onset_timeout (%ds): nessun onset VAD — torno a IDLE",
                    self._config.capture.onset_timeout_s,
                )
                self._capture.stop()
                if self._continuous_mode and not self._handsfree_mode:
                    self._continuous_mode = False
                self._transition(VoiceState.IDLE, trigger="onset_timeout")
                return

            if _elapsed > self._config.capture.max_duration_s:
                log.warning(
                    "FSM: max_capture_duration (%ds) superato — torno a IDLE senza STT",
                    self._config.capture.max_duration_s,
                )
                self._capture.stop()
                if self._continuous_mode and not self._handsfree_mode:
                    self._continuous_mode = False
                self._transition(VoiceState.IDLE, trigger="max_capture_timeout")
                return

            try:
                frame_float: "np.ndarray" = await vad_loop.run_in_executor(
                    None, lambda: self._capture.queue.get(timeout=0.5)
                )
            except _queue_module.Empty:
                # I timer vengono controllati in cima al loop: nessun check aggiuntivo
                # sul tempo nel ramo Empty (vecchio deadline rimosso, TSK-376).
                continue

            # float32 → PCM int16 bytes per Endpointer/SileroVAD
            _mono = frame_float[:, 0] if frame_float.ndim > 1 else frame_float.ravel()
            _frame_bytes = (
                np.clip(_mono, -1.0, 1.0) * 32767.0
            ).astype(np.int16).tobytes()
            captured_frames.append(_frame_bytes)

            if self._vad.feed_frame(_frame_bytes, sr):
                log.info("FSM: fine-turno VAD rilevato")
                break

            # Aggiorna onset (US-168 AC1): speech_started diventa True dopo che
            # feed_frame ha processato un frame con parlato. Una volta impostato,
            # disabilita il controllo onset_timeout per il resto del turno.
            if not self._speech_onset and self._vad.speech_started:
                self._speech_onset = True

        # Chiudi microfono PRIMA del beep: evita conflitto PortAudio input/output
        # sullo stesso device fisico (PaErrorCode -9986 paInvalidDevice su macOS).
        self._capture.stop()

        # Feedback vocale ricezione messaggio
        await self._speak_feedback("Ok, elaboro.", tts_sr)
        print("\r✍️  Trascrivo...", flush=True)

        # ---------------------------------------------------------------
        # [3] CATTURA → TRASCRIZIONE
        # ---------------------------------------------------------------
        self._transition(VoiceState.TRASCRIZIONE, trigger="VAD_endpoint")
        # capture.stop() già chiamato prima del beep

        audio_bytes = b"".join(captured_frames) if captured_frames else _drain_queue(self._capture.queue)
        if not audio_bytes:
            log.warning("FSM: nessun audio catturato; turno saltato → IDLE")
            self._state = VoiceState.IDLE
            log.info("FSM: IDLE → IDLE (trigger: audio_vuoto)")
            return

        text: str = await self._stt.transcribe(audio_bytes, sr)
        if not text or not text.strip():
            log.warning("FSM: trascrizione vuota; turno saltato → IDLE")
            self._state = VoiceState.IDLE
            log.info("FSM: TRASCRIZIONE → IDLE (trigger: testo_vuoto)")
            return

        # --- Filtro wake-word primo turno (US-156, TSK-335) ---
        # _skip_next_utterance e' True SOLO dopo wake_word_detected (AC6: no-op in PTT).
        # filter_threshold: usa getattr per backward compat con TSK-337 non ancora eseguito.
        if self._skip_next_utterance:
            self._skip_next_utterance = False  # reset: vale solo sul primo turno
            keyword = self._config.wake_word.keyword
            dist = levenshtein(text.lower().strip(), keyword.lower())
            if dist < getattr(self._config.wake_word, "filter_threshold", 3):
                log.debug(
                    "Wake-word utterance scartata: %r (distanza Levenshtein=%d)",
                    text,
                    dist,
                )
                # Transizione a IDLE: replica il comportamento "testo vuoto" (AC4)
                self._state = VoiceState.IDLE
                log.info(
                    "FSM: TRASCRIZIONE → IDLE (trigger: wake_word_utterance_scartata)"
                )
                return
            # altrimenti: il primo turno era gia' un comando reale, prosegui normalmente

        log.info("FSM: testo trascritto → %r", text)
        print(f"\n👤 Tu: {text}", flush=True)
        self._write_utterance_log(text)  # visibilità in chat indipendente dal provider

        # --- Comandi vocali locali (nessuna chiamata LLM) ---
        voice_cmd = self._detect_voice_command(text)
        if voice_cmd:
            await self._handle_voice_command(voice_cmd, tts_sr)
            self._transition(VoiceState.IDLE, trigger="voice_command")
            return

        # ---------------------------------------------------------------
        # [4] TRASCRIZIONE → ELABORAZIONE (con pre-flight liveness US-167)
        # ---------------------------------------------------------------
        # Pre-flight liveness check (US-167 C3 AC1/AC2): se il consumer
        # (file-pipe adapter) non è connesso, emetti feedback TTS e torna a
        # IDLE senza attendere il timeout di 180s. Per tutti gli adapter non
        # file-pipe is_consumer_alive() ritorna sempre True → path nominale
        # invariato (AC5). Il check è one-shot sincrono (TTL file lookup).
        if not self._runtime.is_consumer_alive():
            log.warning(
                "consumer non connesso (liveness check fallito) — feedback + torno a IDLE"
            )
            # TSK-396: reset _continuous_mode per prevenire il busy-loop post-shutdown.
            # Root cause: senza reset, run_loop() chiama subito run_once() che, con
            # _continuous_mode=True, salta l'attesa INVIO/wake-word e rientra in CATTURA,
            # ritrovando il consumer morto e ripetendo all'infinito la sequenza
            # «cattura → liveness fail → "Nessuna sessione" TTS → IDLE → cattura».
            if self._continuous_mode:
                log.info(
                    "FSM: _continuous_mode reset — consumer non connesso pre-ELABORAZIONE"
                )
                self._continuous_mode = False
            await self._speak_feedback(self._config.runtime.not_connected_message)
            self._transition(VoiceState.IDLE, trigger="consumer_non_connesso")
            return

        print(f"\r⚙️  Elaboro...", flush=True)
        self._transition(VoiceState.ELABORAZIONE, trigger="testo_pronto")

        tts_chunks: list[str] = []
        async for event in self._runtime.submit(text, session.session_id):
            continue_turn: bool = await self._router.route(event)
            if isinstance(event, Acknowledgment):
                # Acknowledgment → solo print (no TTS): l'Acknowledgment viene emesso
                # prima che l'LLM inizi, quindi sintetizzarlo crea un silenzio
                # post-ack peggio del non farlo. Il feedback audio è già il ack_beep.
                print(f"  💭 {event.text}", flush=True)
            elif isinstance(event, SpokenSummary):
                tts_chunks.append(event.text)
            if not continue_turn:
                # Done o Error: fine elaborazione
                break

        if tts_chunks:
            print(f"\n🤖 Risposta: {' '.join(tts_chunks)}", flush=True)
            self._last_tts_chars = sum(len(c) for c in tts_chunks)

        # ---------------------------------------------------------------
        # [5] ELABORAZIONE → PARLATO (solo se ci sono chunk da pronunciare)
        # ---------------------------------------------------------------
        if tts_chunks:
            self._transition(VoiceState.PARLATO, trigger="elaborazione_completata")

            if self._config.barge_in.enabled:
                # ----------------------------------------------------------
                # Fase 3: playback TTS con rilevamento barge-in concorrente
                # (US-144 AC2 — TSK-301)
                # ----------------------------------------------------------
                # Flag US-166 (TSK-368): set prima del playback, clear in finally.
                self._tts_playing = True
                self._tts_playing_since = time.monotonic()
                try:
                    barge_in_occurred = await self._run_parlato_barge_in(
                        tts_chunks, session.session_id, tts_sr
                    )
                finally:
                    # Clear PRIMA della potenziale re-entry a CATTURA (vincolo D5).
                    self._tts_playing = False

                if barge_in_occurred:
                    # PARLATO → CATTURA (non IDLE) — US-144 AC2d
                    self._transition(VoiceState.CATTURA, trigger="barge-in")
                    # turno interrotto; il prossimo ciclo di run_loop ripartira' da IDLE
                    return
                # Nessun barge-in: fall-through alla transizione IDLE

            else:
                # ----------------------------------------------------------
                # Fase 1/2: sequential, nessun barge-in (backward compat)
                # ----------------------------------------------------------
                # Flag US-166 (TSK-368): set prima del loop TTS, clear in finally.
                self._tts_playing = True
                self._tts_playing_since = time.monotonic()
                try:
                    for chunk in tts_chunks:
                        if self._cancellation_requested.is_set():
                            log.info("FSM: barge-in rilevato; sintesi interrotta")
                            break
                        try:
                            synth: "np.ndarray" = await asyncio.to_thread(
                                self._tts.synthesize, chunk
                            )
                            await asyncio.to_thread(self._playback.play, synth, tts_sr)
                        except Exception as exc:  # noqa: BLE001
                            log.error("FSM: errore sintesi/playback (%r): %s", chunk[:30], exc)
                            print(f"\r❌ Errore TTS: {exc}", flush=True)
                            try:
                                from voice.audio.beep import generate_error_beep  # noqa: PLC0415
                                _err_beep = generate_error_beep(tts_sr)
                                await asyncio.to_thread(self._playback.play, _err_beep, tts_sr)
                            except Exception:  # noqa: BLE001
                                pass  # se anche il beep fallisce, non fare altro
                finally:
                    self._tts_playing = False
        else:
            # Nessun testo parlato prodotto: transizione diretta a IDLE
            log.info(
                "FSM: %s → IDLE (trigger: nessun_testo_parlato)",
                self._state.value,
            )
            self._state = VoiceState.IDLE
            return

        # ---------------------------------------------------------------
        # [6] PARLATO → IDLE
        # ---------------------------------------------------------------
        _should_reset = self._session_manager.should_reset()
        log.debug("session_manager.should_reset() = %s (no-op)", _should_reset)
        self._transition(VoiceState.IDLE, trigger="turno_completato")

    # ------------------------------------------------------------------
    # _run_parlato_barge_in: Fase 3 — playback + detector concorrenti
    # ------------------------------------------------------------------

    async def _run_parlato_barge_in(
        self,
        tts_chunks: "list[str]",
        session_id: str,
        tts_sr: int,
    ) -> bool:
        """Fase 3: playback TTS con rilevamento barge-in concorrente (US-144 AC2).

        Lancia due task asyncio in parallelo:
          - playback_task: legge chunk dalla coda TTS, sintetizza e riproduce.
          - detector_task: monitora i frame audio in ingresso tramite BargeinDetector
            e cancella playback_task se rileva voce (RMS pre-gate + VAD debounce).

        Alla conferma del barge-in:
          1. BargeinDetector.monitor() ha gia' chiamato playback_task.cancel()
             e playback.abort() per stop immediato (US-144 AC2a).
          2. cancel_turn() svuota la coda TTS e propaga cancel al runtime LLM
             (US-144 AC2b/AC2c).
        Il teardown attende asyncio.gather(..., return_exceptions=True) garantendo
        che entrambi i task siano terminati prima della transizione (US-144 AC2c).

        Args:
            tts_chunks: lista di chunk di testo da sintetizzare e riprodurre.
            session_id: identificatore del turno corrente (passato a cancel_turn).
            tts_sr:     samplerate TTS in Hz (tipicamente 22050 per piper-tts).

        Returns:
            True  — barge-in rilevato e confermato (playback interrotto).
            False — playback terminato naturalmente, nessun barge-in.

        Note:
            Il VAD per barge-in usa la soglia configurata in
            config.barge_in.vad_threshold (default 0.7, piu' alta della soglia
            CATTURA 0.5) per ridurre falsi trigger da rumore o audio TTS captato
            con altoparlanti (US-144 AC5/AC6).

            self._vad e' un Endpointer; il VADBase sottostante (self._vad._vad)
            viene passato direttamente al BargeinDetector (gia' pre-configurato
            dall'Endpointer — cfr. BargeinDetector.__init__ docstring).
            # pending_clarification: se in futuro Endpointer espone il VADBase
            # come proprieta' pubblica, aggiornare questo accesso privato.
        """
        # Import lazy: non importa torch/webrtcvad a livello di modulo (DoD TSK-300)
        from voice.core.cancellation import BargeinDetector, cancel_turn  # noqa: PLC0415

        # Coda TTS: contiene i chunk non ancora pronunciati (flush in cancel_turn)
        tts_queue: asyncio.Queue = asyncio.Queue()
        for chunk in tts_chunks:
            tts_queue.put_nowait(chunk)

        # Task playback: sintetizza e riproduce i chunk dalla coda TTS
        async def _playback_worker() -> None:
            while not tts_queue.empty():
                chunk: str = tts_queue.get_nowait()
                synth: "np.ndarray" = await asyncio.to_thread(
                    self._tts.synthesize, chunk
                )
                await asyncio.to_thread(self._playback.play, synth, tts_sr)

        playback_task: asyncio.Task = asyncio.create_task(_playback_worker())

        # BargeinDetector: VADBase estratto dall'Endpointer (self._vad._vad)
        # La vad_threshold configura la soglia documentata nel detector;
        # il VAD e' gia' pre-istanziato dall'Endpointer con i suoi parametri.
        detector = BargeinDetector(
            vad=self._vad._vad,  # type: ignore[union-attr]  # Endpointer._vad = VADBase
            capture=self._capture,
            vad_threshold=self._config.barge_in.vad_threshold,  # 0.7 PARLATO (AC5)
        )
        detector_task: asyncio.Task = asyncio.create_task(
            detector.monitor(playback_task, self._playback)
        )

        # Teardown: attende la terminazione di entrambi i task (US-144 AC2c)
        results = await asyncio.gather(playback_task, detector_task, return_exceptions=True)

        # results[1]: True (barge-in rilevato) | False | Exception
        barge_in_detected: bool = results[1] is True

        if barge_in_detected:
            log.info(
                "FSM: barge-in confermato in PARLATO; "
                "avvio sequenza cancel_turn (session_id=%s)",
                session_id,
            )
            # Passi 2-3 della sequenza cancel: flush TTS queue + cancel runtime
            # (Passo 1 — stop TTS — gia' eseguito da BargeinDetector.monitor())
            await cancel_turn(
                playback_task,
                tts_queue,
                self._playback,
                self._runtime,
                session_id,
            )

        return barge_in_detected

    # ------------------------------------------------------------------
    # run_turn: firma DoD (US-143 AC2) — wrapper su run_once()
    # ------------------------------------------------------------------

    async def run_turn(
        self,
        capture: "AudioCapture",
        stt: "BaseSTT",
        runtime: "FactoryRuntime",
        router: "EventRouter",
        tts: "TTSBase",
        playback: "AudioPlayback",
        config: "VoiceConfig",
    ) -> None:
        """Esegue un turno completo con dipendenze passate esplicitamente.

        Firma compatibile con il DoD US-143 AC2. Sovrascrive temporaneamente
        le dipendenze dell'istanza e chiama run_once(); le ripristina in finally.

        Args:
            capture:  AudioCapture per acquisire frame audio.
            stt:      BaseSTT per la trascrizione.
            runtime:  FactoryRuntime per l'elaborazione LLM.
            router:   EventRouter per instradare eventi runtime.
            tts:      TTSBase per la sintesi vocale.
            playback: AudioPlayback per la riproduzione.
            config:   VoiceConfig con parametri (samplerate, language, ecc.).
        """
        # Salva dipendenze originali
        _orig = (
            self._capture,
            self._stt,
            self._runtime,
            self._router,
            self._tts,
            self._playback,
            self._config,
        )
        # Sovrascrive per questo turno
        self._capture = capture
        self._stt = stt
        self._runtime = runtime
        self._router = router
        self._tts = tts
        self._playback = playback
        self._config = config
        try:
            await self.run_once()
        finally:
            # Ripristina i dipendenze originali
            (
                self._capture,
                self._stt,
                self._runtime,
                self._router,
                self._tts,
                self._playback,
                self._config,
            ) = _orig

    # ------------------------------------------------------------------
    # run_loop: loop infinito (entry point principale)
    # ------------------------------------------------------------------

    async def run_loop(self) -> None:
        """Loop infinito: chiama run_once() in ciclo fino a Ctrl+C.

        Alla ricezione di KeyboardInterrupt effettua uno shutdown pulito:
        chiama runtime.aclose() e logga la chiusura.

        TSK-396: eccezioni non attese in run_once() (es. OSError audio, errore
        rete, eccezione nel path CATTURA/ELABORAZIONE) vengono intercettate per
        evitare che la FSM si blocchi in uno stato non-IDLE. Lo stato viene
        resettato a IDLE e il loop continua, garantendo la resilienza del canale
        vocale a fronte di errori transitori.
        """
        log.info("FSM: avvio loop push-to-talk (Ctrl+C per uscire)")
        try:
            while True:
                self._cancellation_requested.clear()
                try:
                    await self.run_once()
                except KeyboardInterrupt:
                    raise  # propaga al blocco except esterno
                except Exception as exc:
                    # TSK-396: recovery da eccezione inattesa in run_once.
                    # Root cause: un'eccezione durante CATTURA o ELABORAZIONE può
                    # lasciare la FSM in stato non-IDLE e/o la capture aperta.
                    # Fix: log dell'errore, reset a IDLE, tentativo di stop capture,
                    # continuazione del loop (no crash del processo voice).
                    log.error(
                        "FSM: eccezione non attesa in run_once [stato=%s]: %s "
                        "— reset a IDLE e riprendo il loop",
                        self._state.value,
                        exc,
                        exc_info=True,
                    )
                    self._state = VoiceState.IDLE
                    try:
                        self._capture.stop()
                    except Exception:  # noqa: BLE001
                        pass  # capture già ferma o non disponibile — non bloccare il recovery
        except KeyboardInterrupt:
            log.info("FSM: interruzione richiesta da Ctrl+C")
        finally:
            await self._runtime.aclose()
            log.info("FSM: loop terminato, risorse rilasciate")


    # ------------------------------------------------------------------
    # Comandi vocali locali (handsfree toggle)
    # ------------------------------------------------------------------

    # Keyword rilevate nella trascrizione per attivare/disattivare handsfree.
    # Confronto lowercase, case-insensitive, substring match.
    _HANDSFREE_ON_KEYWORDS = ("handsfree", "hands-free", "hands free", "mani libere")
    _HANDSFREE_OFF_KEYWORDS = ("disattiva handsfree", "disattiva hands-free", "modalità normale")

    def _detect_voice_command(self, text: str) -> "str | None":
        """Ritorna il nome del comando se il testo contiene una keyword, altrimenti None.

        Le OFF-keywords vengono controllate prima perché includono le ON-keywords come
        sottostringa ("disattiva handsfree" contiene "handsfree"): senza questo ordine
        un comando OFF sarebbe riconosciuto erroneamente come ON.
        """
        lower = text.lower().strip()
        for kw in self._HANDSFREE_OFF_KEYWORDS:
            if kw in lower:
                return "handsfree_off"
        for kw in self._HANDSFREE_ON_KEYWORDS:
            if kw in lower:
                return "handsfree_on"
        return None

    async def _handle_voice_command(self, command: str, tts_sr: int) -> None:
        """Esegue il comando vocale: aggiorna stato e risponde con TTS locale (no LLM)."""
        if command == "handsfree_on":
            self._handsfree_mode = True
            self._continuous_mode = True
            msg = "Modalità handsfree attivata, posso ascoltarti senza bisogno di dire Prometeus."
            print("\r🔊 Handsfree ON")
            log.info("FSM: handsfree_mode attivata")
        elif command == "handsfree_off":
            self._handsfree_mode = False
            msg = "Modalità handsfree disattivata, dì Prometeus per ricominciare."
            print("\r🎤 Handsfree OFF")
            log.info("FSM: handsfree_mode disattivata")
        else:
            return

        try:
            synth = await asyncio.to_thread(self._tts.synthesize, msg)
            await asyncio.to_thread(self._playback.play, synth, tts_sr)
        except Exception as exc:  # noqa: BLE001
            log.error("FSM: errore TTS comando vocale (%r): %s", command, exc)


# ---------------------------------------------------------------------------
# Alias di compatibilita' (orchestrator spec usa VoiceFSM)
# ---------------------------------------------------------------------------

VoiceFSM = VoiceStateMachine
