"""FasterWhisperSTT — implementazione STT via faster-whisper (CTranslate2).

Uso consigliato dalla state machine (asyncio.to_thread NON richiesto: transcribe
e' gia' async e delega internamente il blocco bloccante):

    stt = FasterWhisperSTT(model_size="base", language="it")
    text = await stt.transcribe(audio_bytes, sample_rate=16000)

La dipendenza `faster-whisper` e' opzionale: viene importata lazily al primo
transcribe. Se assente viene sollevata ImportError con istruzioni di installazione.
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

import numpy as np

from voice.stt.base import BaseSTT

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class FasterWhisperSTT(BaseSTT):
    """STT basata su faster-whisper (Whisper quantizzato via CTranslate2).

    Il modello viene caricato in modo lazy al primo ``transcribe`` per rispettare
    il principio no-op quando ``voice_channel.enabled: false`` nella factory config.

    Attributi:
        model_size: Taglia del modello Whisper (tiny | base | small | medium | large).
        language: Codice lingua ISO 639-1 da passare al modello (default "it").

    Model selection:
        Selezionato da ``config.stt.model``, passato come ``model_size=`` al costruttore.
        Il parametro ``model_size`` NON va rinominato: e' interfaccia stabile.

    Performance notes (CPU M1, int8):
        medium: latenza STT ~2s mediana; ~0.8s su GPU float16
        small:  latenza STT ~1s mediana; ~0.3s su GPU float16

    Tradeoff:
        ``medium`` riduce significativamente il WER su vocabolario tecnico factory
        (nomi artefatti, comandi kanban). ``small`` preferibile su hardware CPU-only
        con RAM < 8GB.

    Download on-demand:
        Se il modello non e' in cache locale faster-whisper lo scarica
        automaticamente al primo ``transcribe``. Nessuna azione richiesta.

    Riferimento: ``wiki/runbooks/voice-channel.md`` — sezione "Model selection".
    """

    def __init__(
        self,
        model_size: str = "base",
        language: str = "it",
        no_speech_prob_threshold: float = 0.6,
        compression_ratio_threshold: float = 2.4,
    ) -> None:
        self._model_size = model_size
        self._language = language
        self._no_speech_threshold = no_speech_prob_threshold
        self._compression_ratio_threshold = compression_ratio_threshold
        # _model e' None finche' non viene invocato il primo transcribe (lazy load).
        self._model = None

    # ------------------------------------------------------------------
    # Metodi privati (eseguiti in thread via asyncio.to_thread)
    # ------------------------------------------------------------------

    def _ensure_model_loaded(self) -> None:
        """Carica WhisperModel se non gia' caricato.

        Solleva ImportError esplicita se faster-whisper non e' installato.
        Questo metodo viene chiamato dentro _transcribe_sync, che gira su un
        thread separato, quindi e' safe fare I/O bloccante qui.
        """
        if self._model is not None:
            return
        try:
            from faster_whisper import WhisperModel  # noqa: PLC0415 (lazy import intenzionale)
        except ImportError as exc:
            raise ImportError(
                "faster-whisper non e' installato. "
                "Installa i voice extras con: pip install 'soli-voice[voice]' "
                "oppure: pip install faster-whisper"
            ) from exc

        logger.info(
            "Caricamento modello faster-whisper '%s' (device=cpu, compute_type=int8) ...",
            self._model_size,
        )
        self._model = WhisperModel(
            self._model_size,
            device="cpu",
            compute_type="int8",
        )
        logger.info("Modello faster-whisper '%s' caricato.", self._model_size)

    def _transcribe_sync(self, audio: np.ndarray, sample_rate: int) -> str:  # noqa: ARG002
        """Esegue la trascrizione sincrona (da invocare via asyncio.to_thread).

        Args:
            audio: Array numpy float32 mono, valori in [-1.0, 1.0].
            sample_rate: Frequenza di campionamento (passata per firma; faster-whisper
                         assume 16 kHz internamente, ma il parametro e' tenuto per
                         compatibilita' con chiamate future che potrebbero resamplarle).

        Returns:
            Testo trascritto con i segmenti concatenati e separati da spazio singolo.
        """
        self._ensure_model_loaded()
        segments, _info = self._model.transcribe(
            audio,
            language=self._language,
            beam_size=5,
            condition_on_previous_text=False,  # previene loop di ripetizione su silenzio
            no_speech_threshold=0.6,           # threshold interna Whisper (complementare al gate primario)
        )
        # Gate primario per-segmento: scarta se no_speech_prob >= soglia OR compression_ratio >= soglia (US-169).
        # Log WARNING obbligatorio per ogni segmento — costruisce il campione di calibrazione C6.
        parts = []
        for seg in segments:
            is_speech = (
                getattr(seg, "no_speech_prob", 0.0) < self._no_speech_threshold
                and getattr(seg, "compression_ratio", 0.0) < self._compression_ratio_threshold
            )
            logger.warning(
                "STT segment gate: is_speech=%s no_speech_prob=%.3f compression_ratio=%.3f text=%r",
                is_speech,
                getattr(seg, "no_speech_prob", 0.0),
                getattr(seg, "compression_ratio", 0.0),
                seg.text,
            )
            if not is_speech:
                continue
            if seg.text.strip():
                parts.append(seg.text.strip())
        return " ".join(parts)

    # ------------------------------------------------------------------
    # Interfaccia pubblica (BaseSTT)
    # ------------------------------------------------------------------

    async def transcribe(self, audio_bytes: bytes, sample_rate: int = 16000) -> str:
        """Trascrive l'audio in testo in modo asincrono.

        Converte i byte PCM int16 in numpy float32 normalizzato, poi delega la
        chiamata bloccante a faster-whisper in un thread separato tramite
        ``asyncio.to_thread``, senza bloccare l'event loop principale.

        Args:
            audio_bytes: Audio grezzo in formato PCM int16 little-endian.
                         Se vuoto (b""), restituisce stringa vuota immediatamente.
            sample_rate: Frequenza di campionamento in Hz (default 16000).

        Returns:
            Testo trascritto. Stringa vuota se ``audio_bytes`` e' vuoto.

        Raises:
            ImportError: Se faster-whisper non e' installato (install voice extras).
        """
        if not audio_bytes:
            return ""

        # Converti PCM int16 → numpy float32 normalizzato in [-1.0, 1.0].
        audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        # Gate RMS pre-Whisper: scarta audio silenzioso prima di invocare il modello.
        # Whisper hallucina testo tipo "Sottotitoli a cura di..." su silenzio con
        # alta confidenza (no_speech_prob basso), quindi il gate energetico è essenziale.
        rms = float(np.sqrt(np.mean(audio_float32 ** 2)))
        if rms < 0.008:
            logger.debug("STT: audio scartato — RMS troppo basso (%.4f < 0.008)", rms)
            return ""

        result = await asyncio.to_thread(self._transcribe_sync, audio_float32, sample_rate)

        # Blocklist pattern di hallucination Whisper noti (subtitle-style).
        _hallucination_tokens = ("sottotitoli", "iscriviti al canale", "grazie per l'attenzione", "qtss")
        result_lower = result.lower()
        if any(tok in result_lower for tok in _hallucination_tokens):
            logger.debug("STT: testo scartato — hallucination pattern %r", result[:40])
            return ""

        # Dizionario correzioni post-STT (termini di dominio factory).
        from voice.stt.corrections import apply_corrections  # noqa: PLC0415
        corrected = apply_corrections(result)
        if corrected != result:
            logger.debug("STT: correzione applicata %r → %r", result[:50], corrected[:50])

        return corrected
