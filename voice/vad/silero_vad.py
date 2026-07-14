"""voice/vad/silero_vad.py — Wrapper Silero VAD (PyTorch-based).

Importabile senza torch installato: l'import di torch e del modello
e' lazy (avviene al primo utilizzo tramite load_model / is_speech).

Per installare le dipendenze:
    pip install -e ".[voice]"

Dipendenza: torch, torchaudio (inclusi in silero-vad)
Modello:    snakers4/silero-vad (Torch Hub)
"""

from __future__ import annotations

import struct
from typing import TYPE_CHECKING

from voice.vad.base import VADBase

if TYPE_CHECKING:
    # Import solo per type checking — non eseguito a runtime se torch assente.
    import torch


class SileroVAD(VADBase):
    """VAD basato su Silero (snakers4/silero-vad) via PyTorch.

    Il modello viene caricato una volta sola al primo utilizzo (lazy init).
    Su ambienti senza torch / silero-vad installati il costruttore non fallisce;
    il fallimento avviene solo alla prima chiamata a is_speech() o load_model().

    Args:
        threshold:   Soglia di confidenza VAD (0.0-1.0, default 0.5).
        sample_rate: Frequenza di campionamento attesa (default 16000 Hz).
                     Silero supporta 8000 e 16000 Hz.
    """

    SUPPORTED_SAMPLE_RATES = (8000, 16000)

    def __init__(
        self,
        threshold: float = 0.5,
        sample_rate: int = 16000,
    ) -> None:
        if sample_rate not in self.SUPPORTED_SAMPLE_RATES:
            raise ValueError(
                f"SileroVAD supporta solo sample_rate in {self.SUPPORTED_SAMPLE_RATES}, "
                f"ricevuto: {sample_rate}"
            )
        self.threshold = threshold
        self.sample_rate = sample_rate

        # Lazy init — valorizzati da load_model()
        self._model = None
        self._get_speech_ts = None
        self._torch = None

    # ------------------------------------------------------------------
    # Metodo di caricamento esplicito (usabile anche prima di is_speech)
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Resetta lo stato interno del modello Silero tra un turno e l'altro."""
        if self._model is not None:
            try:
                self._model.reset_states()
            except Exception:  # noqa: BLE001
                pass

    def load_model(self, repo: str = "snakers4/silero-vad") -> None:
        """Carica il modello Silero VAD da Torch Hub.

        Chiamato automaticamente da is_speech() al primo utilizzo.
        Puo' essere invocato esplicitamente per anticipare il warm-up.

        Args:
            repo: Identificatore Torch Hub del modello (default 'snakers4/silero-vad').

        Raises:
            ImportError: Se torch non e' installato.
        """
        if self._model is not None:
            return  # gia' caricato

        try:
            import torch  # noqa: PLC0415
        except ImportError as exc:
            raise ImportError(
                "torch non e' installato. Per abilitare SileroVAD esegui:\n"
                "    pip install -e '.[voice]'\n"
                "oppure installa torch separatamente: pip install torch"
            ) from exc

        self._torch = torch

        # Percorso 1: cache locale (git clone in torch hub dir) — nessuna rete.
        # Percorso 2: torch.hub remoto con SSL bypass (macOS Python 3.12).
        import os as _os, ssl as _ssl  # noqa: PLC0415
        _hub_dir = torch.hub.get_dir()
        _local_candidates = [
            _os.path.join(_hub_dir, "snakers4_silero-vad_main"),
            _os.path.join(_hub_dir, "snakers4_silero-vad_master"),
        ]
        _local_path = next((p for p in _local_candidates if _os.path.isdir(p)), None)

        try:
            if _local_path:
                model, utils = torch.hub.load(
                    repo_or_dir=_local_path,
                    model="silero_vad",
                    source="local",
                    force_reload=False,
                    onnx=False,
                )
            else:
                # Fallback rete con SSL bypass
                _orig_ctx = _ssl._create_default_https_context
                _ssl._create_default_https_context = _ssl._create_unverified_context
                try:
                    model, utils = torch.hub.load(
                        repo_or_dir=repo,
                        model="silero_vad",
                        force_reload=False,
                        onnx=False,
                        trust_repo=True,
                    )
                finally:
                    _ssl._create_default_https_context = _orig_ctx
        except Exception as exc:
            raise RuntimeError(
                f"Impossibile caricare il modello Silero VAD da '{repo}'. "
                "Verifica la connessione a internet o usa il path locale. "
                f"Errore originale: {exc}"
            ) from exc

        self._model = model
        # utils[0] = get_speech_timestamps, utils[2] = VADIterator, ecc.
        self._get_speech_ts = utils[0]

    # ------------------------------------------------------------------
    # Interfaccia VADBase
    # ------------------------------------------------------------------

    def is_speech(self, frame: bytes, samplerate: int) -> bool:
        """Classifica il frame audio tramite Silero VAD.

        Args:
            frame:      Chunk di audio grezzo PCM a 16-bit little-endian.
            samplerate: Frequenza di campionamento in Hz (deve corrispondere a
                        quella configurata nel costruttore).

        Returns:
            True se la confidenza VAD supera la soglia configurata.

        Raises:
            ImportError: Se torch non e' installato (al primo utilizzo).
            ValueError:  Se samplerate non corrisponde al valore configurato.
        """
        if samplerate != self.sample_rate:
            raise ValueError(
                f"SileroVAD configurato per {self.sample_rate} Hz, "
                f"ricevuto frame a {samplerate} Hz."
            )

        # Lazy load del modello al primo utilizzo
        if self._model is None:
            self.load_model()

        torch = self._torch  # gia' importato da load_model()

        # Converti bytes PCM 16-bit → tensore float32 in [-1.0, 1.0]
        num_samples = len(frame) // 2
        samples_i16 = struct.unpack(f"<{num_samples}h", frame)
        audio_tensor = torch.tensor(samples_i16, dtype=torch.float32) / 32768.0

        # Silero richiede ESATTAMENTE sr/31.25 campioni (512 @ 16kHz, 256 @ 8kHz).
        # Pad o tronca se il frame non ha la dimensione esatta.
        exact_samples = int(samplerate / 31.25)
        n = audio_tensor.shape[0]
        if n < exact_samples:
            audio_tensor = torch.cat([audio_tensor, torch.zeros(exact_samples - n)])
        elif n > exact_samples:
            audio_tensor = audio_tensor[:exact_samples]

        # Inferenza: confidenza per il frame singolo
        with torch.no_grad():
            confidence = self._model(audio_tensor, self.sample_rate).item()

        return confidence >= self.threshold
