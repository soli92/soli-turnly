"""voice/tts/piper_tts.py — wrapper piper-tts (voci neurali italiane locali).

Il modulo e' importabile senza piper-tts installato: il pacchetto viene
importato lazily all'interno di __init__ per evitare ImportError su ambienti
senza extras[voice].

Uso asincrono raccomandato (da state_machine / router):
    audio: np.ndarray = await asyncio.to_thread(tts.synthesize, text)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import numpy as np

from voice.tts.base import TTSBase


_DOWNLOAD_HINT = (
    "Scarica il modello piper-tts italiano da:\n"
    "  https://huggingface.co/rhasspy/piper-voices/tree/main/it/it_IT\n"
    "Esempio (modello riccardo medium):\n"
    "  wget https://huggingface.co/rhasspy/piper-voices/resolve/main/"
    "it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx\n"
    "  wget https://huggingface.co/rhasspy/piper-voices/resolve/main/"
    "it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx.json\n"
    "Poi instanzia:\n"
    "  PiperTTS(voice='it_IT-riccardo-medium', model_dir='<directory>')\n"
    "oppure imposta la variabile d'ambiente PIPER_MODEL_DIR."
)


class PiperTTS(TTSBase):
    """TTS italiano locale via piper-tts (modelli ONNX neurali).

    Implementa TTSBase restituendo audio PCM float32 mono normalizzato.
    piper-tts genera internamente PCM int16; la conversione a float32 avviene
    in synthesize().

    Args:
        voice: Nome del modello vocale (senza estensione '.onnx').
               Default: 'it_IT-riccardo-medium'.
        model_dir: Directory che contiene <voice>.onnx (e <voice>.onnx.json).
                   Se None, usa la variabile d'ambiente PIPER_MODEL_DIR;
                   se nemmeno quella e' impostata, usa la directory corrente.

    Raises:
        ImportError: se il pacchetto piper-tts non e' installato.
        FileNotFoundError: se il file .onnx non e' trovato in model_dir.

    Uso asincrono raccomandato:
        audio: np.ndarray = await asyncio.to_thread(tts.synthesize, text)
    """

    def __init__(
        self,
        voice: str = "it_IT-riccardo-medium",
        model_dir: Optional[str] = None,
    ) -> None:
        # Lazy import — non a livello modulo per evitare ImportError su ambienti
        # senza extras[voice]. Sollevata con messaggio chiaro se mancante.
        try:
            import piper  # noqa: F401 — verifica presenza pacchetto
        except ImportError as exc:
            raise ImportError(
                "Il pacchetto piper-tts non e' installato.\n"
                "Installa con: pip install 'soli-multi-agents-factory[voice]'\n"
                "o direttamente: pip install piper-tts"
            ) from exc

        self._voice_name = voice
        self._model_dir = Path(
            model_dir or os.environ.get("PIPER_MODEL_DIR", ".")
        ).expanduser()
        self._piper_voice = self._load_voice()

    def _load_voice(self):
        """Carica il modello dal disco via piper.PiperVoice.load().

        Raises:
            FileNotFoundError: con hint di download se il file .onnx manca.
        """
        import piper

        model_path = self._model_dir / f"{self._voice_name}.onnx"
        if not model_path.exists():
            raise FileNotFoundError(
                f"Modello piper-tts non trovato: {model_path}\n"
                f"{_DOWNLOAD_HINT}"
            )
        return piper.PiperVoice.load(str(model_path))

    def synthesize(self, text: str) -> np.ndarray:
        """Sintetizza *text* in audio PCM float32 mono normalizzato.

        Metodo sincrono e CPU-bound. Chiamarlo sempre in un thread separato:
            audio = await asyncio.to_thread(tts.synthesize, text)

        Per ridurre la latenza percepita, passare singole frasi estratte con
        voice.tts.sentence_splitter.split_into_sentences(full_text).

        Args:
            text: Testo da sintetizzare (idealmente una singola frase).

        Returns:
            np.ndarray float32 mono normalizzato in [-1.0, 1.0].
            Array vuoto (shape (0,)) se la sintesi non produce output.
        """
        # piper >= 1.4: PiperVoice.synthesize() → Iterable[AudioChunk]
        # AudioChunk.audio_int16_bytes = PCM int16 LE mono
        # AudioChunk.sample_rate = effettivo (tipicamente 22050 Hz)
        raw_chunks: list[bytes] = []
        for chunk in self._piper_voice.synthesize(text):
            raw_chunks.append(chunk.audio_int16_bytes)
            self._sample_rate = chunk.sample_rate  # esposto come attributo

        raw_bytes = b"".join(raw_chunks)
        if not raw_bytes:
            return np.array([], dtype=np.float32)

        audio_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
        return audio_int16.astype(np.float32) / 32768.0

    @property
    def sample_rate(self) -> int:
        """Sample rate effettivo del modello (impostato dopo il primo synthesize)."""
        return getattr(self, "_sample_rate", 22050)
