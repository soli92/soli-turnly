"""
voice/runtime/claude_code_adapter.py — Adapter Claude Code CLI (EP-041 ext).

Invia l'utterance vocale trascritto a `claude -p "<text>"` con il contesto
completo della factory (CLAUDE.md, wiki, skill, config). La risposta JSON viene
filtrata per TTS e mostrata integralmente nel canale visivo (stdout).

Questo adapter trasforma il voice channel da "secondo chatbot standalone" al
suo scopo originale: front-end vocale per la factory multi-agente.

Prerequisiti:
  - Claude Code installato (https://claude.ai/download)
  - ANTHROPIC_API_KEY nel PATH oppure autenticazione OAuth in corso
  - factory.config.yaml nella CWD o in una parent directory

Config (voice_channel.runtime):
  provider: claude-code
  claude_code_bin: ""           # percorso esplicito (auto-detect se vuoto)
  claude_code_timeout: 120      # secondi max attesa risposta
  claude_code_max_spoken: 500   # caratteri max sintetizzati via TTS
  claude_code_model: ""         # "" = usa il default di Claude Code
  claude_code_allowed_tools: "Read,Glob,Bash(git log*),Bash(git status),Bash(git diff*)"
                                # lista tool permessi (default: sola lettura)
                                # "*" per accesso completo (richiede conferma esplicita)

Nota: con allowed_tools="*" Claude Code ha accesso completo ai tool (scrittura,
esecuzione bash, ecc.). Abilitare solo dopo aver compreso le implicazioni.
Il default (sola lettura) supporta query di stato, lettura wiki, git log.
"""
from __future__ import annotations

import asyncio
import glob
import json
import logging
import re
import shutil
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

# Tool di default: accesso in sola lettura (sicuro per query vocali di stato)
_DEFAULT_ALLOWED_TOOLS = "Read,Glob,Bash(git log*),Bash(git status),Bash(git diff*)"

# ---------------------------------------------------------------------------
# Regex per filtro TTS
# ---------------------------------------------------------------------------
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b[@-Z\\-_]")
_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_HEADER_RE = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_BOLD_ITALIC_RE = re.compile(r"\*{1,3}(.+?)\*{1,3}", re.DOTALL)
_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")


def _extract_spoken(text: str, max_chars: int = 500) -> str:
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


# ---------------------------------------------------------------------------
# Auto-detection binary Claude Code
# ---------------------------------------------------------------------------

def _find_claude_binary(config_bin: str = "") -> str:
    """Trova l'eseguibile claude nell'ordine: config → PATH → app macOS → VSCode ext."""
    if config_bin:
        p = Path(config_bin).expanduser()
        if p.exists():
            return str(p)
        raise FileNotFoundError(f"claude_code_bin configurato non trovato: {config_bin}")

    # 1. PATH
    found = shutil.which("claude")
    if found:
        return found

    # 2. macOS Claude Code app (versioned, newest first)
    app_base = Path.home() / "Library/Application Support/Claude/claude-code"
    if app_base.exists():
        versions = sorted(
            (p for p in app_base.iterdir() if p.is_dir()),
            key=lambda p: p.name,
            reverse=True,
        )
        for v in versions:
            binary = v / "claude.app/Contents/MacOS/claude"
            if binary.exists():
                logger.info("ClaudeCodeAdapter: binary trovato in %s", binary)
                return str(binary)

    # 3. VSCode extension (anthropic.claude-code-*)
    pattern = str(
        Path.home() / ".vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude"
    )
    matches = sorted(glob.glob(pattern), reverse=True)
    if matches:
        logger.info("ClaudeCodeAdapter: binary trovato in VSCode ext: %s", matches[0])
        return matches[0]

    raise FileNotFoundError(
        "claude CLI non trovato. Installa Claude Code (https://claude.ai/download) "
        "oppure imposta voice_channel.runtime.claude_code_bin in factory.config.yaml."
    )


# ---------------------------------------------------------------------------
# ClaudeCodeAdapter
# ---------------------------------------------------------------------------

class ClaudeCodeAdapter(FactoryRuntime):
    """
    Adapter che delega ogni utterance vocale a `claude -p` CLI.

    La factory viene eseguita con accesso ai tool specificati in claude_code_allowed_tools
    (default: sola lettura). Claude Code legge CLAUDE.md e applica l'intero contesto
    della factory (skill, agenti, wiki, config).

    Ogni turno e' indipendente (sessione fresca a ogni utterance).
    """

    def __init__(
        self,
        config: "VoiceConfig",
        repo_dir: str | None = None,
    ) -> None:
        self._config = config
        self._repo_dir = repo_dir or str(Path.cwd())
        rt = config.runtime
        self._timeout: int = getattr(rt, "claude_code_timeout", 120)
        self._max_spoken: int = getattr(rt, "claude_code_max_spoken", 500)
        self._allowed_tools: str = getattr(rt, "claude_code_allowed_tools", _DEFAULT_ALLOWED_TOOLS)
        self._model: str = getattr(rt, "claude_code_model", "")
        self._cancelled: dict[str, bool] = {}

        # Auto-detect binary una volta sola nel costruttore
        try:
            self._bin = _find_claude_binary(getattr(rt, "claude_code_bin", ""))
        except FileNotFoundError as exc:
            self._bin = ""
            self._startup_error = str(exc)
        else:
            self._startup_error = ""

    # ------------------------------------------------------------------
    # submit
    # ------------------------------------------------------------------

    async def submit(
        self, text: str, session_id: str
    ) -> AsyncGenerator[RuntimeEvent, None]:
        """Esegue `claude -p "<text>" --output-format json` e itera eventi vocali."""
        self._cancelled[session_id] = False

        if self._startup_error:
            yield Error(self._startup_error)
            return

        yield Acknowledgment("sto consultando la factory...")

        if self._cancelled.get(session_id):
            return

        # Costruisce il comando claude -p
        cmd = [
            self._bin,
            "--print",
            text,
            "--output-format", "json",
            "--allowedTools", self._allowed_tools,
        ]
        if self._model:
            cmd += ["--model", self._model]

        logger.debug(
            "ClaudeCodeAdapter: avvio cmd=%r cwd=%s allowed_tools=%r",
            cmd[0], self._repo_dir, self._allowed_tools,
        )

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self._repo_dir,
            )

            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(), timeout=self._timeout
                )
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                    await proc.communicate()
                except Exception:
                    pass
                yield Error(f"Timeout: la factory non ha risposto in {self._timeout}s.")
                return

        except FileNotFoundError:
            yield Error(
                "claude CLI non trovato. "
                "Installa Claude Code oppure imposta claude_code_bin in factory.config.yaml."
            )
            return
        except Exception as exc:
            yield Error(f"Errore avvio ClaudeCode: {exc}")
            return

        if self._cancelled.get(session_id):
            return

        stdout_raw = stdout_b.decode("utf-8", errors="replace").strip()
        stderr_raw = stderr_b.decode("utf-8", errors="replace").strip()

        if not stdout_raw:
            yield Error(f"Nessuna risposta dalla factory. {stderr_raw[:200]}")
            return

        # Parse JSON output di claude -p --output-format json
        result_text = ""
        is_error_flag = False
        try:
            data = json.loads(stdout_raw)
            result_text = data.get("result", "")
            is_error_flag = bool(data.get("is_error", False))
        except json.JSONDecodeError:
            # Fallback: output non JSON (versione claude diversa o errore)
            result_text = stdout_raw

        if is_error_flag or not result_text:
            err_msg = result_text or stderr_raw[:200] or "Risposta vuota dalla factory."
            yield Error(err_msg[:300])
            return

        spoken = _extract_spoken(result_text, max_chars=self._max_spoken)
        if not spoken:
            spoken = "elaborazione completata"

        yield SpokenSummary(spoken)
        yield Artifact(kind="text", content=result_text)
        yield Done()

        logger.debug(
            "ClaudeCodeAdapter: sessione=%s completata (%d chars, spoken=%d chars)",
            session_id, len(result_text), len(spoken),
        )

    # ------------------------------------------------------------------
    # cancel / aclose
    # ------------------------------------------------------------------

    async def cancel(self, session_id: str) -> None:
        self._cancelled[session_id] = True

    async def aclose(self) -> None:
        self._cancelled.clear()
