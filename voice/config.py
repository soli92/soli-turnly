"""
voice/config.py — VoiceConfig: lettura lazy della sezione voice_channel: da factory.config.yaml.

Nessun import di dipendenze audio/STT/TTS a livello di modulo.
Le dipendenze sounddevice, faster_whisper, piper sono importate lazily solo
nei sottomoduli che le utilizzano (audio/, stt/, tts/).

Uso:
    from voice.config import load_config
    cfg = load_config()          # cerca factory.config.yaml dalla cwd
    cfg = load_config("/path/factory.config.yaml")

Campi validati da from_factory_config:
    - enabled: bool
    - phase: int in {1, 2, 3, 4}
    - log_level: str in {'DEBUG', 'INFO', 'WARNING'}

Comportamento no-op (US-146 AC2):
    Quando enabled=False la funzione restituisce VoiceConfig con enabled=False.
    Nessun modulo voice/ importa sounddevice, faster_whisper o piper —
    la factory funziona esattamente come prima di EP-041.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Valori ammessi per i campi validati
_VALID_PHASES: frozenset[int] = frozenset({1, 2, 3, 4})
_VALID_LOG_LEVELS: frozenset[str] = frozenset({"DEBUG", "INFO", "WARNING"})


# ---------------------------------------------------------------------------
# Sub-dataclass per ogni blocco annidato dello schema voice_channel:
# ---------------------------------------------------------------------------

@dataclass
class STTConfig:
    """Configurazione Speech-To-Text (faster-whisper)."""
    provider: str = "faster-whisper"
    model: str = "medium"      # "tiny"|"base"|"small"|"medium"|"large" — default "medium" per produzione; usare "small" su hardware CPU-only con RAM < 8GB
    language: str = "it"
    no_speech_prob_threshold: float = 0.6
    # compression_ratio_threshold: soglia OpenAI Whisper (default upstream).
    # Calibrazione 2026-07-10 su modello medium, 5 campioni parlato reale italiano:
    #   cr osservato = 0.50–0.53 (media 0.524) → margine 4.5x rispetto a 2.4.
    # Testo allucinato ripetitivo produce cr >> 1.0 (tipicamente 3–8+).
    # Soglia 2.4 è conservativa e validata: nessun falso positivo atteso su parlato breve.
    compression_ratio_threshold: float = 2.4

    @classmethod
    def from_dict(cls, d: dict) -> "STTConfig":
        return cls(
            provider=str(d.get("provider", "faster-whisper")),
            model=str(d.get("model", "medium")),
            language=str(d.get("language", "it")),
            no_speech_prob_threshold=float(d.get("no_speech_prob_threshold", 0.6)),
            compression_ratio_threshold=float(d.get("compression_ratio_threshold", 2.4)),
        )


@dataclass
class TTSConfig:
    """Configurazione Text-To-Speech (piper-tts)."""
    provider: str = "piper-tts"
    voice: str = "it_IT-riccardo-medium"
    model_dir: Optional[str] = None  # override PIPER_MODEL_DIR
    playing_watchdog_s: int = 10     # Timeout reset flag tts_playing su TTS error (US-166 AC6)

    @classmethod
    def from_dict(cls, d: dict) -> "TTSConfig":
        return cls(
            provider=str(d.get("provider", "piper-tts")),
            voice=str(d.get("voice", "it_IT-riccardo-medium")),
            model_dir=d.get("model_dir") or None,
            playing_watchdog_s=int(d.get("playing_watchdog_s", 10)),
        )


@dataclass
class AudioConfig:
    """Selezione dispositivi audio hardware (null = default di sistema)."""
    input_device: Optional[str] = None
    output_device: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict) -> "AudioConfig":
        return cls(
            input_device=d.get("input_device", None),
            output_device=d.get("output_device", None),
        )


@dataclass
class VADConfig:
    """Voice Activity Detection — endpointing e mani-libere (Fase 2+)."""
    provider: str = "silero-vad"
    threshold: float = 0.5          # soglia base in stato CATTURA
    endpoint_silence_ms: int = 700  # silenzio (ms) per chiusura turno (500-800 ms)
    debounce_ms: int = 700          # finestra debounce VAD (ms) — US-155; 700ms per utterance pedagogiche lente (TSK-395)

    @classmethod
    def from_dict(cls, d: dict) -> "VADConfig":
        return cls(
            provider=str(d.get("provider", "silero-vad")),
            threshold=float(d.get("threshold", 0.5)),
            endpoint_silence_ms=int(d.get("endpoint_silence_ms", 700)),
            debounce_ms=int(d.get("debounce_ms", 700)),
        )


@dataclass
class BargeInConfig:
    """Barge-in (interrompibilita' TTS — Fase 3, US-144 AC6). Disabled in Fase 1/2."""
    enabled: bool = False
    vad_threshold: float = 0.7  # soglia VAD in stato PARLATO (override VADConfig.threshold)

    @classmethod
    def from_dict(cls, d: dict) -> "BargeInConfig":
        return cls(
            enabled=bool(d.get("enabled", False)),
            vad_threshold=float(d.get("vad_threshold", 0.7)),
        )


@dataclass
class AECConfig:
    """Acoustic Echo Cancellation (Fase 4, US-147 AC2). Opzionale con cuffie (AC4)."""
    enabled: bool = False
    provider: str = "webrtc-apm"  # webrtc-apm | speexdsp | noisereduce

    @classmethod
    def from_dict(cls, d: dict) -> "AECConfig":
        return cls(
            enabled=bool(d.get("enabled", False)),
            provider=str(d.get("provider", "webrtc-apm")),
        )


@dataclass
class WakeWordConfig:
    """Wake word detection (openWakeWord, opt-in). Fallback a PTT se disabled."""
    enabled: bool = False
    keyword: str = "prometeus"          # parola chiave di attivazione
    sensitivity: float = 0.5           # soglia cosine similarity (0.0–1.0)
    samples_dir: str = "voice/wake_word_samples"  # directory sample WAV per keyword
    listen_chunk_ms: int = 100         # durata chunk audio in ascolto continuo (ms)
    min_detections: int = 2            # chunk consecutivi positivi per confermare (debounce)
    filter_threshold: int = 3          # distanza Levenshtein max per filtro primo turno (US-156)

    @classmethod
    def from_dict(cls, d: dict) -> "WakeWordConfig":
        return cls(
            enabled=bool(d.get("enabled", False)),
            keyword=str(d.get("keyword", "prometeus")),
            sensitivity=float(d.get("sensitivity", 0.5)),
            samples_dir=str(d.get("samples_dir", "voice/wake_word_samples")),
            listen_chunk_ms=int(d.get("listen_chunk_ms", 100)),
            min_detections=int(d.get("min_detections", 2)),
            filter_threshold=int(d.get("filter_threshold", 3)),
        )


@dataclass
class CaptureConfig:
    """Timer di safety per il loop CATTURA (US-168 C4)."""
    onset_timeout_s: int = 5    # Abort turno se nessun onset VAD entro N s (valutato a ogni frame)
    max_duration_s: int = 30    # Cap hard cattura → IDLE con WARNING (mai TRASCRIZIONE)

    @classmethod
    def from_dict(cls, d: dict) -> "CaptureConfig":
        return cls(
            onset_timeout_s=int(d.get("onset_timeout_s", 5)),
            max_duration_s=int(d.get("max_duration_s", 30)),
        )


_VALID_RUNTIME_PROVIDERS: frozenset[str] = frozenset(
    {"anthropic", "ollama", "mock", "claude-code", "cursor", "file-pipe"}
)

_DEFAULT_CLAUDE_CODE_ALLOWED_TOOLS = (
    "Read,Glob,Bash(git log*),Bash(git status),Bash(git diff*)"
)


@dataclass
class RuntimeConfig:
    """Configurazione del runtime LLM (provider + parametri per-adapter)."""
    provider: str = "anthropic"       # anthropic | ollama | mock | claude-code
    llm_model: str = "claude-sonnet-4-6"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    # --- Campi claude-code adapter ---
    claude_code_bin: str = ""         # percorso esplicito (auto-detect se vuoto)
    claude_code_timeout: int = 120    # secondi max attesa risposta
    claude_code_max_spoken: int = 500 # caratteri max sintetizzati via TTS
    claude_code_allowed_tools: str = _DEFAULT_CLAUDE_CODE_ALLOWED_TOOLS
    claude_code_model: str = ""       # "" = usa il default di Claude Code
    # --- Campi cursor adapter ---
    cursor_rules_dir: str = ".cursor/rules"   # path relativo alla factory root
    cursor_max_rules_chars: int = 8000        # budget caratteri regole nel system prompt
    # --- Campi file-pipe adapter (US-158) ---
    pipe_poll_ms: int = 100        # ms intervallo polling fallback (watchdog non disponibile); via nominale: event-driven
    pipe_timeout: int = 180        # timeout totale submit() in secondi
    # --- Campi liveness check file-pipe (US-167) ---
    liveness_check: bool = True          # Fail-fast attivo per file-pipe (cambio deliberato D3)
    consumer_alive_path: Optional[str] = None  # None → CONSUMER_ALIVE da side_channel.py
    consumer_alive_ttl_s: int = 10       # Finestra freschezza heartbeat TTL (secondi)
    not_connected_message: str = "Nessuna sessione connessa."  # Feedback audio TTS AC4

    @classmethod
    def from_dict(cls, d: dict) -> "RuntimeConfig":
        provider = str(d.get("provider", "anthropic")).lower()
        if provider not in _VALID_RUNTIME_PROVIDERS:
            raise ValueError(
                f"voice_channel.runtime.provider deve essere in "
                f"{sorted(_VALID_RUNTIME_PROVIDERS)}, ricevuto: {provider!r}"
            )
        return cls(
            provider=provider,
            llm_model=str(d.get("llm_model", "claude-sonnet-4-6")),
            ollama_base_url=str(d.get("ollama_base_url", "http://localhost:11434")),
            ollama_model=str(d.get("ollama_model", "llama3.2")),
            claude_code_bin=str(d.get("claude_code_bin", "")),
            claude_code_timeout=int(d.get("claude_code_timeout", 120)),
            claude_code_max_spoken=int(d.get("claude_code_max_spoken", 500)),
            claude_code_allowed_tools=str(
                d.get("claude_code_allowed_tools", _DEFAULT_CLAUDE_CODE_ALLOWED_TOOLS)
            ),
            claude_code_model=str(d.get("claude_code_model", "")),
            cursor_rules_dir=str(d.get("cursor_rules_dir", ".cursor/rules")),
            cursor_max_rules_chars=int(d.get("cursor_max_rules_chars", 8000)),
            pipe_poll_ms=int(d.get("pipe_poll_ms", 100)),
            pipe_timeout=int(d.get("pipe_timeout", 180)),
            liveness_check=bool(d.get("liveness_check", True)),
            consumer_alive_path=d.get("consumer_alive_path", None),
            consumer_alive_ttl_s=int(d.get("consumer_alive_ttl_s", 10)),
            not_connected_message=str(d.get("not_connected_message", "Nessuna sessione connessa.")),
        )


# ---------------------------------------------------------------------------
# VoiceConfig — dataclass radice
# ---------------------------------------------------------------------------

@dataclass
class VoiceConfig:
    """
    Configurazione completa del canale vocale (EP-041).

    Tutti i campi hanno default espliciti: una sezione voice_channel: assente
    in factory.config.yaml produce VoiceConfig() con enabled=False (no-op, AC2).

    Accesso: cfg.stt.model, cfg.tts.voice, cfg.vad.threshold, ...
    """
    enabled: bool = False
    phase: int = 1
    stt: STTConfig = field(default_factory=STTConfig)
    tts: TTSConfig = field(default_factory=TTSConfig)
    audio: AudioConfig = field(default_factory=AudioConfig)
    vad: VADConfig = field(default_factory=VADConfig)
    barge_in: BargeInConfig = field(default_factory=BargeInConfig)
    aec: AECConfig = field(default_factory=AECConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)
    wake_word: WakeWordConfig = field(default_factory=WakeWordConfig)
    capture: CaptureConfig = field(default_factory=CaptureConfig)
    log_level: str = "INFO"
    # Percorso opzionale del PID file (US-159 AC5).
    # None → DEFAULT_PID_PATH in voice/app.py (~/.local/share/soli-voice/voice.pid).
    pid_file_path: Optional[str] = None

    @classmethod
    def from_factory_config(cls, raw: dict) -> "VoiceConfig":
        """
        Costruisce VoiceConfig dalla sezione voice_channel: del dizionario raw YAML.

        Validazioni:
          - enabled: deve essere bool; TypeError altrimenti.
          - phase: int in {1, 2, 3, 4}; ValueError se fuori range.
          - log_level: str in {'DEBUG', 'INFO', 'WARNING'} (case-insensitive); ValueError altrimenti.

        Tutti i campi sub-sezione usano from_dict con default espliciti:
        una sezione mancante o parziale non causa KeyError.

        Quando enabled=False la factory funziona identicamente a v2.27 (AC2).
        """
        vc = raw.get("voice_channel", {})

        # --- Validazione enabled ---
        enabled = vc.get("enabled", False)
        if not isinstance(enabled, bool):
            raise TypeError(
                f"voice_channel.enabled deve essere bool, ricevuto: {type(enabled).__name__!r}"
            )

        # --- Validazione phase ---
        phase_raw = vc.get("phase", 1)
        try:
            phase = int(phase_raw)
        except (TypeError, ValueError):
            raise ValueError(
                f"voice_channel.phase deve essere intero in {sorted(_VALID_PHASES)}, "
                f"ricevuto: {phase_raw!r}"
            )
        if phase not in _VALID_PHASES:
            raise ValueError(
                f"voice_channel.phase deve essere in {sorted(_VALID_PHASES)}, "
                f"ricevuto: {phase}"
            )

        # --- Validazione log_level (case-insensitive) ---
        log_level = str(vc.get("log_level", "INFO")).upper()
        if log_level not in _VALID_LOG_LEVELS:
            raise ValueError(
                f"voice_channel.log_level deve essere in {sorted(_VALID_LOG_LEVELS)}, "
                f"ricevuto: {log_level!r}"
            )

        return cls(
            enabled=enabled,
            phase=phase,
            stt=STTConfig.from_dict(vc.get("stt") or {}),
            tts=TTSConfig.from_dict(vc.get("tts") or {}),
            audio=AudioConfig.from_dict(vc.get("audio") or {}),
            vad=VADConfig.from_dict(vc.get("vad") or {}),
            barge_in=BargeInConfig.from_dict(vc.get("barge_in") or {}),
            aec=AECConfig.from_dict(vc.get("aec") or {}),
            runtime=RuntimeConfig.from_dict(vc.get("runtime") or {}),
            wake_word=WakeWordConfig.from_dict(vc.get("wake_word") or {}),
            capture=CaptureConfig.from_dict(vc.get("capture") or {}),
            log_level=log_level,
            pid_file_path=vc.get("pid_file_path", None),
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_factory_config(start: Optional[Path] = None) -> Optional[Path]:
    """Risale il filesystem dalla directory start cercando factory.config.yaml."""
    current = (start or Path.cwd()).resolve()
    for parent in [current, *current.parents]:
        candidate = parent / "factory.config.yaml"
        if candidate.exists():
            return candidate
    return None


def load_config(path: Optional[str] = None) -> VoiceConfig:
    """
    Legge la sezione voice_channel: da factory.config.yaml e restituisce VoiceConfig.

    Args:
        path: percorso esplicito a factory.config.yaml. Se None, risale il filesystem
              dalla cwd cercando il file (comportamento di default).

    Returns:
        VoiceConfig con i valori da factory.config.yaml, oppure VoiceConfig() con
        tutti i default se il file non esiste o la sezione voice_channel: e' assente.

    Note:
        Quando enabled=False nessun import di dipendenze audio/STT/TTS avviene.
        Le dipendenze sounddevice, faster_whisper, piper sono importate lazily
        solo nei sottomoduli che le utilizzano (AC2).
    """
    # Import PyYAML lazily — presente nel progetto base, NON e' una dipendenza vocale.
    try:
        import yaml
    except ImportError:
        # Graceful degradation: senza PyYAML restituisce config di default (enabled=False).
        # Il canale vocale non potra' essere attivato ma la factory rimane operativa.
        return VoiceConfig()

    if path is not None:
        config_path = Path(path)
    else:
        config_path = _find_factory_config()

    if config_path is None or not config_path.exists():
        return VoiceConfig()

    with config_path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}

    return VoiceConfig.from_factory_config(raw)
