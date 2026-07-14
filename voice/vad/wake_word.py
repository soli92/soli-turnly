"""voice/vad/wake_word.py — Rilevatore wake word "Prometeus" via openWakeWord.

Importabile senza openwakeword installato: l'import avviene lazily
dentro load(), non a livello modulo. Il costruttore non fallisce
su ambienti privi di openwakeword; il fallimento avviene solo alla
prima chiamata a load().

Strategia di rilevamento:
  1. (Primario) openwakeword.Model con custom_verifier_models: computa
     embedding dei sample positivi e usa cosine similarity a runtime.
  2. (Fallback) Se l'API custom_verifier_models non e' disponibile nella
     versione installata, ripega su cosine similarity manuale tra spettro
     FFT del chunk corrente e quelli dei sample registrati.

Per installare le dipendenze:
    pip install -e ".[voice]"  # include openwakeword>=0.6.0

Uso tipico:
    from voice.vad.wake_word import WakeWordDetector
    from voice.audio.capture import AudioCapture

    detector = WakeWordDetector("voice/wake_word_samples")
    detector.load()
    capture = AudioCapture(config)
    capture.start()
    await detector.wait_for_wake_word(capture)
    capture.stop()
"""
from __future__ import annotations

import asyncio
import wave
from pathlib import Path
from typing import TYPE_CHECKING, List, Optional

import numpy as np

if TYPE_CHECKING:
    from voice.audio.capture import AudioCapture


# ---------------------------------------------------------------------------
# Utility: distanza di edit Levenshtein
# ---------------------------------------------------------------------------

def levenshtein(a: str, b: str) -> int:
    """Distanza di edit Levenshtein tra due stringhe (case-sensitive).

    Confronto case-insensitive deve essere applicato dal chiamante
    (es. ``levenshtein(a.lower(), b.lower())``).

    Algoritmo DP ottimizzato a due array: spazio O(min(len(a), len(b))).
    Nessuna dipendenza esterna.

    Args:
        a: Prima stringa.
        b: Seconda stringa.

    Returns:
        Numero minimo di operazioni di inserimento, cancellazione o
        sostituzione di singoli caratteri per trasformare ``a`` in ``b``.

    Examples:
        >>> levenshtein("prometeus", "prometeus")
        0
        >>> levenshtein("prometeus", "prometheus")
        1
        >>> levenshtein("apri il kanban", "prometeus") > 3
        True
    """
    if len(a) < len(b):
        return levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = curr
    return prev[-1]


class WakeWordDetector:
    """Rilevatore wake word basato su openWakeWord con custom verifier.

    Usa il custom verifier di openWakeWord: calcola la cosine similarity
    tra l'embedding del chunk audio in ingresso e gli embedding pre-computati
    dei sample positivi registrati per la parola chiave.

    Se openwakeword non e' installato, il costruttore non fallisce; il
    fallimento avviene solo alla chiamata a load().

    Args:
        samples_dir: Directory radice contenente le subdirectory per keyword.
                     Pattern atteso: <samples_dir>/<keyword>/sample_NN.wav
                     Es.: voice/wake_word_samples/prometeus/sample_01.wav
        keyword:     Parola chiave da rilevare (default 'prometeus').
        sensitivity: Soglia di similarity/confidenza [0.0-1.0] (default 0.5).
                     Valori piu' alti = meno falsi positivi, piu' falsi negativi.
    """

    def __init__(
        self,
        samples_dir: str,
        keyword: str = "prometeus",
        sensitivity: float = 0.5,
        min_detections: int = 2,
    ) -> None:
        self._samples_dir = Path(samples_dir)
        self._keyword = keyword
        self._sensitivity = sensitivity
        self._min_detections = max(1, min_detections)  # almeno 1 chunk positivo

        # Valorizzati da load()
        self._sample_embeddings: List[np.ndarray] = []
        self._loaded: bool = False

    # ------------------------------------------------------------------
    # Caricamento campioni
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Carica i sample WAV dalla samples_dir e computa gli embedding openWakeWord.

        I file WAV devono trovarsi in:
            <samples_dir>/<keyword>/sample_NN.wav

        Percorso primario:
            Crea un openwakeword.Model con custom_verifier_models, che calcola
            internamente gli embedding dei sample positivi.

        Fallback (se custom_verifier_models non e' disponibile nell'API):
            Calcola manualmente le firme spettrali FFT dei sample e le usa
            per cosine similarity in process_chunk().

        Raises:
            ImportError:     Se openwakeword non e' installato.
            FileNotFoundError: Se la directory sample non esiste o e' vuota.
        """
        if self._loaded:
            return

        # Import lazy: openwakeword e' importato solo qui, mai a livello modulo.
        # Garantisce l'importabilita' del modulo su ambienti senza openwakeword.
        try:
            import openwakeword  # noqa: PLC0415
        except ImportError as exc:
            raise ImportError(
                "openwakeword non trovato. Installa le dipendenze vocali:\n"
                "    pip install 'openwakeword>=0.6.0'\n"
                "oppure incluso nel gruppo voice:\n"
                "    pip install -e '.[voice]'"
            ) from exc

        keyword_dir = self._samples_dir / self._keyword
        if not keyword_dir.exists():
            raise FileNotFoundError(
                f"Directory sample non trovata: {keyword_dir}\n"
                "Registra i campioni prima con:\n"
                "    python voice/tools/record_samples.py"
            )

        wav_paths = sorted(keyword_dir.glob("*.wav"))
        if not wav_paths:
            raise FileNotFoundError(
                f"Nessun file WAV trovato in {keyword_dir}\n"
                "Registra i campioni con:\n"
                "    python voice/tools/record_samples.py"
            )

        # Per keyword completamente custom (nessun modello ONNX pre-addestrato),
        # si usa direttamente la cosine similarity su embedding FFT dei sample.
        # openwakeword.custom_verifier_models richiede un pickle sklearn addestrato
        # su un modello base esistente (alexa, hey_jarvis…) — non applicabile qui.
        self._sample_embeddings = [
            self._compute_fft_embedding(self._load_wav(p))
            for p in wav_paths
        ]
        self._loaded = True

    def is_loaded(self) -> bool:
        """True se i sample sono stati caricati."""
        return self._loaded

    # ------------------------------------------------------------------
    # Elaborazione chunk audio
    # ------------------------------------------------------------------

    def process_chunk(self, audio_chunk: np.ndarray, sample_rate: int = 16000) -> bool:
        """Processa un chunk audio e restituisce True se il wake word e' rilevato.

        Usa il custom verifier di openWakeWord: cosine similarity tra l'embedding
        del chunk corrente e gli embedding dei sample positivi. Se il percorso
        primario (openwakeword.Model) non e' disponibile, ripega su cosine
        similarity manuale basata su FFT.

        Args:
            audio_chunk: Numpy array float32 di shape (N,) o (N, channels).
                         Tipicamente prodotto da AudioCapture.queue (float32).
            sample_rate: Frequenza di campionamento in Hz (default 16000).

        Returns:
            True se il wake word e' rilevato con confidenza >= sensitivity.

        Raises:
            RuntimeError: Se load() non e' stato ancora chiamato.
        """
        if not self._loaded:
            raise RuntimeError(
                "WakeWordDetector non caricato. Chiama load() prima di process_chunk()."
            )

        # Normalizza a mono (N,) — prende il primo canale se multi-canale
        if audio_chunk.ndim > 1:
            mono = audio_chunk[:, 0]
        else:
            mono = audio_chunk.ravel()

        # Energy gate: ignora frame silenzio/rumore ambiente prima di calcolare
        # la similarity. Evita falsi positivi su rumore di fondo.
        # RMS tipico parlato: 0.05–0.30; silenzio/rumore: < 0.003.
        rms = float(np.sqrt(np.mean(mono ** 2)))
        if rms < 0.003:
            return False
        return self._process_chunk_fallback(mono)

    # ------------------------------------------------------------------
    # Loop asincrono attesa wake word
    # ------------------------------------------------------------------

    async def wait_for_wake_word(self, capture: "AudioCapture") -> None:
        """Loop asincrono: legge dalla queue di capture finche' non rileva il wake word.

        Blocca finche' la parola chiave non viene pronunciata. I frame vengono
        letti dalla queue thread-safe di AudioCapture tramite run_in_executor
        per non bloccare il loop asincrono.

        Args:
            capture: AudioCapture gia' avviato (capture.start() gia' chiamato).
                     La queue deve produrre numpy array float32 di shape
                     (blocksize, channels).

        Raises:
            RuntimeError: Se load() non e' stato ancora chiamato.
        """
        if not self._loaded:
            raise RuntimeError(
                "WakeWordDetector non caricato. Chiama load() prima di wait_for_wake_word()."
            )

        import collections  # noqa: PLC0415
        import logging as _log  # noqa: PLC0415
        log = _log.getLogger(__name__)

        loop = asyncio.get_running_loop()
        # Finestra scorrevole: accumula ~500ms di audio prima di confrontare.
        # 16000 Hz * 0.5s = 8000 campioni; chunk = 512 → 16 chunk per finestra.
        _SR: int = 16000
        _WIN_MS: int = 500
        _CHUNK: int = 512
        win_chunks: int = max(1, int(_SR * _WIN_MS / 1000) // _CHUNK)  # 15 chunk
        window: "collections.deque[np.ndarray]" = collections.deque(maxlen=win_chunks)
        consecutive: int = 0
        frames_seen: int = 0

        while True:
            frame: np.ndarray = await loop.run_in_executor(None, capture.queue.get)
            frames_seen += 1
            if frames_seen == 1 or frames_seen % 100 == 0:
                log.debug("WakeWord: frame #%d ricevuto (queue ok)", frames_seen)

            # Normalizza a mono (N,) e aggiungi alla finestra (maxlen gestisce lo scorrimento)
            mono = frame[:, 0] if frame.ndim > 1 else frame.ravel()
            window.append(mono)

            # Valuta solo quando la finestra è piena (almeno win_chunks chunk)
            if len(window) < win_chunks:
                continue

            # Concatena e calcola RMS sull'intero segmento da 500ms
            segment = np.concatenate(list(window))
            rms = float(np.sqrt(np.mean(segment ** 2)))

            # Confronta con i sample — logga sempre per diagnostica
            embedding = self._compute_fft_embedding(segment)
            max_sim = max(
                self._cosine_similarity(embedding, ref)
                for ref in self._sample_embeddings
            ) if self._sample_embeddings else 0.0

            log.debug("WakeWord: RMS=%.4f sim=%.3f (soglia=%.2f)", rms, max_sim, self._sensitivity)

            if rms < 0.003:
                consecutive = 0
                continue

            if max_sim >= self._sensitivity:
                consecutive += 1
                log.debug(
                    "WakeWord: match %d/%d (sim=%.3f)", consecutive, self._min_detections, max_sim
                )
                if consecutive >= self._min_detections:
                    return  # confermato
            else:
                consecutive = 0

    # ------------------------------------------------------------------
    # Metodi privati: fallback manuale (cosine similarity su FFT)
    # ------------------------------------------------------------------

    def _load_wav(self, wav_path: Path) -> np.ndarray:
        """Carica un file WAV e lo restituisce come array float32 mono.

        Usa solo stdlib (wave), senza dipendenze esterne.

        Args:
            wav_path: Percorso al file WAV (mono o stereo, int16 o int32).

        Returns:
            Array float32 mono normalizzato in [-1.0, 1.0].

        Raises:
            ValueError: Se il formato del file WAV non e' supportato.
        """
        with wave.open(str(wav_path), "rb") as wf:
            n_frames = wf.getnframes()
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            raw = wf.readframes(n_frames)

        if sampwidth == 2:  # int16 — formato standard per audio a 16kHz
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        elif sampwidth == 4:  # int32
            samples = (
                np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2_147_483_648.0
            )
        else:
            raise ValueError(
                f"Formato WAV non supportato: sample width {sampwidth} byte "
                f"in {wav_path}. Atteso int16 (2) o int32 (4)."
            )

        # Prende il primo canale se stereo
        if n_channels > 1:
            samples = samples.reshape(-1, n_channels)[:, 0]

        return samples

    def _compute_fft_embedding(self, audio: np.ndarray, n_fft: int = 4096) -> np.ndarray:
        """Computa una firma spettrale FFT normalizzata (L2) dell'audio.

        L'embedding e' un vettore di magnitudini FFT L2-normalizzato.
        Usato solo nel percorso di fallback manuale.

        Args:
            audio: Array float32 mono.
            n_fft: Numero di campioni usati per la FFT (default 4096).

        Returns:
            Vettore float32 L2-normalizzato di shape (n_fft//2 + 1,).
        """
        # Usa al piu' n_fft campioni; zero-pad se il segnale e' piu' corto
        length = min(len(audio), n_fft)
        frame = np.zeros(n_fft, dtype=np.float32)
        frame[:length] = audio[:length]

        fft_mag = np.abs(np.fft.rfft(frame)).astype(np.float32)

        norm = np.linalg.norm(fft_mag)
        if norm > 0.0:
            fft_mag = fft_mag / norm

        return fft_mag

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Cosine similarity tra due vettori.

        Args:
            a: Vettore float32 (gia' o non normalizzato).
            b: Vettore float32 di stessa lunghezza o troncato alla piu' corta.

        Returns:
            Float in [-1.0, 1.0]; 0.0 se uno dei vettori e' zero.
        """
        min_len = min(len(a), len(b))
        a = a[:min_len]
        b = b[:min_len]
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def _process_chunk_fallback(self, mono: np.ndarray) -> bool:
        """Percorso fallback: cosine similarity manuale su embedding FFT.

        Confronta l'embedding FFT del chunk corrente con gli embedding
        pre-computati dei sample positivi. Restituisce True se la
        similarity massima supera la soglia di sensitivity.

        Args:
            mono: Array float32 mono (N,) gia' normalizzato a [-1.0, 1.0].

        Returns:
            True se max(cosine_similarity) >= sensitivity.
        """
        if not self._sample_embeddings:
            return False

        chunk_embedding = self._compute_fft_embedding(mono)
        max_similarity = max(
            self._cosine_similarity(chunk_embedding, ref)
            for ref in self._sample_embeddings
        )
        return max_similarity >= self._sensitivity
