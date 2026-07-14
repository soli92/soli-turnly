"""
voice/runtime/cursor_adapter.py — Adapter voice channel per factory Cursor (.cursor/rules/).

Legge i file .cursor/rules/*.mdc della factory (orchestrator + agenti principali)
per costruire il system prompt, poi chiama Anthropic API. Il voice channel ottiene
il contesto reale della factory Cursor invece di essere un chatbot generico.

Questo adapter è il corrispondente Cursor di ClaudeCodeAdapter:
  - Claude Code factory (.claude/)  → ClaudeCodeAdapter (provider: claude-code)
  - Cursor factory    (.cursor/)    → CursorAdapter     (provider: cursor)

Config (voice_channel.runtime):
  provider: cursor
  cursor_rules_dir: ".cursor/rules"   # path relativo alla factory root
  cursor_max_rules_chars: 8000        # caratteri max di regole nel system prompt
  llm_model: "claude-sonnet-4-6"      # modello Anthropic (stesso campo di anthropic)
  claude_code_max_spoken: 500         # riusato come max_spoken_chars
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING, AsyncGenerator

from voice.runtime.factory_runtime import (
    Acknowledgment,
    Artifact,
    Done,
    Error,
    FactoryRuntime,
    RuntimeEvent,
    SpokenSummary,
)

if TYPE_CHECKING:
    from voice.config import VoiceConfig

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "claude-sonnet-4-6"
_DEFAULT_MAX_RULES_CHARS = 8000
_DEFAULT_MAX_SPOKEN = 500

# Regole da caricare in ordine di priorità (partial match sul nome file)
_RULE_PRIORITY = [
    "orchestrator",
    "wiki-query",
    "wiki-keeper",
    "product-manager",
    "lead-architect",
    "tpm",
]

_SYSTEM_PREAMBLE = (
    "Sei l'assistente vocale di una factory multi-agente basata su Cursor IDE. "
    "Rispondi in italiano, in modo conciso e naturale adatto alla voce: "
    "niente elenchi puntati, niente markdown, frasi brevi. Massimo 3-4 frasi. "
    "Di seguito le regole della factory che definiscono il tuo contesto e ruolo:"
)

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b[@-Z\\-_]")
_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_HEADER_RE = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_BOLD_ITALIC_RE = re.compile(r"\*{1,3}(.+?)\*{1,3}", re.DOTALL)
_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")


def _strip_mdc_frontmatter(content: str) -> str:
    """Rimuove il blocco frontmatter YAML (---...---) da un file .mdc."""
    if not content.startswith("---"):
        return content
    end = content.find("\n---", 3)
    if end == -1:
        return content
    return content[end + 4:].lstrip()


def _extract_spoken(text: str, max_chars: int = _DEFAULT_MAX_SPOKEN) -> str:
    """Rimuove markup e artefatti tecnici, ritorna testo parlabile troncato."""
    text = _ANSI_RE.sub("", text)
    text = _CODE_BLOCK_RE.sub("", text)
    text = _INLINE_CODE_RE.sub(r"\1", text)
    text = _HEADER_RE.sub("", text)
    text = _BOLD_ITALIC_RE.sub(r"\1", text)
    text = _LINK_RE.sub(r"\1", text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def _load_cursor_rules(rules_dir: Path, max_chars: int) -> str:
    """Carica i file .mdc in ordine di priorità fino a max_chars totali."""
    if not rules_dir.exists():
        logger.warning("CursorAdapter: directory regole non trovata: %s", rules_dir)
        return ""

    all_mdcs = list(rules_dir.glob("*.mdc"))
    if not all_mdcs:
        logger.warning("CursorAdapter: nessun file .mdc in %s", rules_dir)
        return ""

    # Ordina: prima i file in _RULE_PRIORITY, poi gli altri in ordine alfabetico
    def _sort_key(p: Path) -> tuple[int, str]:
        name = p.stem.lower()
        for i, priority_name in enumerate(_RULE_PRIORITY):
            if priority_name in name:
                return (i, name)
        return (len(_RULE_PRIORITY), name)

    sorted_mdcs = sorted(all_mdcs, key=_sort_key)

    parts: list[str] = []
    total = 0
    for mdc in sorted_mdcs:
        try:
            raw = mdc.read_text(encoding="utf-8")
            content = _strip_mdc_frontmatter(raw).strip()
            if not content:
                continue
            segment = f"\n\n### {mdc.stem}\n{content}"
            if total + len(segment) > max_chars:
                # Tronca per stare nel budget
                remaining = max_chars - total
                if remaining > 200:
                    parts.append(segment[:remaining] + "\n[...]")
                break
            parts.append(segment)
            total += len(segment)
        except OSError as exc:
            logger.warning("CursorAdapter: errore lettura %s: %s", mdc, exc)

    return "".join(parts)


class CursorAdapter(FactoryRuntime):
    """
    Adapter per factory Cursor (.cursor/rules/).

    Costruisce il system prompt dai file .cursor/rules/*.mdc della factory,
    poi chiama Anthropic API. Il voice channel ottiene il contesto reale
    della factory Cursor (regole agenti, skill, workflow).

    Ogni turno è indipendente (sessione fresca a ogni utterance).
    Il system prompt viene costruito una volta sola nel costruttore.
    """

    def __init__(
        self,
        config: "VoiceConfig",
        repo_dir: str | None = None,
    ) -> None:
        self._config = config
        self._repo_dir = Path(repo_dir or Path.cwd())
        rt = config.runtime
        self._model: str = getattr(rt, "llm_model", _DEFAULT_MODEL) or _DEFAULT_MODEL
        self._max_spoken: int = getattr(rt, "claude_code_max_spoken", _DEFAULT_MAX_SPOKEN)
        self._cancelled: dict[str, bool] = {}

        # Determina la directory delle regole
        rules_rel = getattr(rt, "cursor_rules_dir", ".cursor/rules") or ".cursor/rules"
        rules_dir = self._repo_dir / rules_rel
        max_rules_chars = int(getattr(rt, "cursor_max_rules_chars", _DEFAULT_MAX_RULES_CHARS))

        # Costruisce il system prompt una volta sola
        rules_content = _load_cursor_rules(rules_dir, max_chars=max_rules_chars)
        if rules_content:
            self._system_prompt = f"{_SYSTEM_PREAMBLE}\n{rules_content}"
            logger.info(
                "CursorAdapter: system prompt costruito da %s (%d chars)",
                rules_dir, len(self._system_prompt),
            )
        else:
            # Fallback: system prompt generico
            self._system_prompt = (
                "Sei l'assistente vocale di una factory multi-agente. "
                "Rispondi in italiano, conciso e naturale, adatto alla voce."
            )
            logger.warning("CursorAdapter: nessuna regola trovata, uso system prompt generico")

        # Client Anthropic (lazy import)
        self._client = None
        self._startup_error = ""
        try:
            import anthropic as _anthropic  # noqa: PLC0415
            self._client = _anthropic.AsyncAnthropic()
        except ImportError:
            self._startup_error = (
                "anthropic SDK non installato. Esegui: pip install anthropic"
            )
        except Exception as exc:
            self._startup_error = f"Errore inizializzazione Anthropic: {exc}"

    # ------------------------------------------------------------------
    # submit
    # ------------------------------------------------------------------

    async def submit(
        self, text: str, session_id: str
    ) -> AsyncGenerator[RuntimeEvent, None]:
        """Invia il testo ad Anthropic API con il system prompt della factory Cursor."""
        self._cancelled[session_id] = False

        if self._startup_error:
            yield Error(self._startup_error)
            return

        yield Acknowledgment("sto consultando la factory Cursor...")

        if self._cancelled.get(session_id):
            return

        try:
            import asyncio as _asyncio  # noqa: PLC0415
            response = await _asyncio.wait_for(
                self._client.messages.create(
                    model=self._model,
                    max_tokens=1024,
                    system=self._system_prompt,
                    messages=[{"role": "user", "content": text}],
                ),
                timeout=60.0,
            )
        except Exception as exc:
            yield Error(f"Errore chiamata Anthropic: {exc}")
            return

        if self._cancelled.get(session_id):
            return

        full_text = ""
        if response.content:
            full_text = "".join(
                block.text for block in response.content
                if hasattr(block, "text")
            )

        if not full_text:
            yield Error("Nessuna risposta da Anthropic.")
            return

        spoken = _extract_spoken(full_text, max_chars=self._max_spoken)
        if not spoken:
            spoken = "elaborazione completata"

        yield SpokenSummary(spoken)
        yield Artifact(kind="text", content=full_text)
        yield Done()

        logger.debug(
            "CursorAdapter: sessione=%s completata (%d chars spoken=%d)",
            session_id, len(full_text), len(spoken),
        )

    # ------------------------------------------------------------------
    # cancel / aclose
    # ------------------------------------------------------------------

    async def cancel(self, session_id: str) -> None:
        self._cancelled[session_id] = True

    async def aclose(self) -> None:
        self._cancelled.clear()
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                pass
