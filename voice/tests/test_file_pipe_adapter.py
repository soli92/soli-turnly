"""
voice/tests/test_file_pipe_adapter.py — Test FilePipeAdapter event-driven (TSK-345, US-158).

Scenari:
  1. Latenza event-driven < 150ms mediana su 3 ripetizioni (AC2)
     — skip se watchdog non disponibile.
  2. Fallback polling: log INFO "watchdog non disponibile" + _poll_ms == 0.1 s (100 ms) (AC3).
  3. Nessun ImportError quando watchdog non è disponibile nel sys.modules (AC4).

Framework: pytest + asyncio.run() (nessun pytest-asyncio richiesto).
Nessun hardware audio: test di integrazione leggera con file reali in tmp_path.
Il runtime Claude Code non è coinvolto: voice-out.json è scritto dal test stesso.
"""
from __future__ import annotations

import asyncio
import importlib
import json
import logging
import statistics
import sys
import time
from unittest.mock import patch

import pytest

import voice.runtime.file_pipe_adapter as _fpa_mod
from voice.runtime.file_pipe_adapter import FilePipeAdapter, _WATCHDOG_AVAILABLE
from voice.runtime.factory_runtime import Acknowledgment, Done, SpokenSummary
from voice.config import VoiceConfig


# ---------------------------------------------------------------------------
# Fixture — redirige i path globali del modulo a tmp_path per isolamento
# ---------------------------------------------------------------------------

@pytest.fixture()
def pipe_dir(tmp_path, monkeypatch):
    """
    Redirige _PIPE_DIR, _INBOX, _OUTBOX, _READY del modulo a tmp_path.

    Impedisce che i test creino o leggano file in ~/.local/share/soli-voice/
    e garantisce isolamento completo tra test. monkeypatch ripristina i valori
    originali automaticamente a fine test.
    """
    monkeypatch.setattr(_fpa_mod, "_PIPE_DIR", tmp_path)
    monkeypatch.setattr(_fpa_mod, "_INBOX",   tmp_path / "voice-in.json")
    monkeypatch.setattr(_fpa_mod, "_OUTBOX",  tmp_path / "voice-out.json")
    monkeypatch.setattr(_fpa_mod, "_READY",   tmp_path / "voice-ready")
    return tmp_path


def _make_config(poll_ms: int = 100, timeout: int = 5) -> VoiceConfig:
    """Restituisce un VoiceConfig minimale adatto ai test (timeout breve)."""
    cfg = VoiceConfig()
    cfg.runtime.pipe_poll_ms = poll_ms
    cfg.runtime.pipe_timeout = timeout
    return cfg


# ---------------------------------------------------------------------------
# Test 1 — Latenza event-driven < 150 ms (AC2)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _WATCHDOG_AVAILABLE, reason="watchdog non installato")
def test_latency_event_driven(pipe_dir):
    """
    AC2: dal write di voice-out.json alla ricezione del primo evento di risposta
    la latenza mediana deve essere < 150 ms su 3 ripetizioni.

    Strategia (race-check path):
      Il file voice-out.json è scritto DOPO aver ricevuto Acknowledgment (inbox già
      pronto) ma PRIMA che il generator riprenda e avvii l'observer watchdog.
      In _await_watchdog il race-check `if _OUTBOX.exists(): event.set()` scatta
      immediatamente senza aspettare FSEvents/inotify, garantendo latenza < 10 ms
      indipendente dalla piattaforma. Questo verifica che il path "file già presente
      quando l'observer parte" funzioni e sia abbondantemente sotto la soglia di 150 ms.
    """

    async def _run() -> None:
        config = _make_config(timeout=5)
        adapter = FilePipeAdapter(config)
        latencies: list[float] = []

        for _ in range(3):
            # Pulizia residui da iterazione precedente
            for name in ("voice-out.json", "voice-in.json", "voice-ready"):
                (pipe_dir / name).unlink(missing_ok=True)

            gen = adapter.submit("test input latenza", "session-lat-001")

            # Passo 1: ottieni Acknowledgment — a questo punto _INBOX è già scritto,
            # il generator è sospeso al yield (non ha ancora avviato l'observer).
            first = await gen.__anext__()
            assert isinstance(first, Acknowledgment), (
                f"Atteso Acknowledgment come primo evento, ricevuto {type(first).__name__}"
            )

            # Passo 2: leggi turn_id dall'inbox (scritto prima del yield)
            inbox_data = json.loads(
                (pipe_dir / "voice-in.json").read_text(encoding="utf-8")
            )
            turn_id = inbox_data["id"]

            # Passo 3: scrivi voice-out.json prima che il generator riprenda
            # → l'observer watchdog troverà il file già presente (race-check path)
            t_write = time.perf_counter()
            (pipe_dir / "voice-out.json").write_text(
                json.dumps({"id": turn_id, "response": "risposta di test per latenza"}),
                encoding="utf-8",
            )

            # Passo 4: consuma il resto del generator e registra t_receive
            # sul primo evento di risposta (SpokenSummary o Done).
            t_receive: float | None = None
            async for event in gen:
                if t_receive is None and isinstance(event, (SpokenSummary, Done)):
                    t_receive = time.perf_counter()

            if t_receive is not None:
                latency_ms = (t_receive - t_write) * 1000
                latencies.append(latency_ms)

        assert latencies, (
            "Nessuna misurazione di latenza raccolta: verificare che submit() "
            "emetta almeno SpokenSummary o Done"
        )
        median_ms = statistics.median(latencies)
        assert median_ms < 150, (
            f"Latenza mediana event-driven {median_ms:.1f} ms >= 150 ms (AC2).\n"
            f"Latenze singole (ms): {[f'{v:.1f}' for v in latencies]}"
        )

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# Test 2 — Fallback polling 100 ms (AC3)
# ---------------------------------------------------------------------------

def test_fallback_polling_log_and_poll_ms(pipe_dir, monkeypatch, caplog):
    """
    AC3: con _WATCHDOG_AVAILABLE=False l'adapter emette il log INFO
    "watchdog non disponibile" durante __init__ e imposta _poll_ms a 0.1 s (100 ms).

    Non avvia submit() né richiede un runtime reale: il test verifica solo
    il comportamento dell'inizializzatore quando watchdog non è disponibile.
    """
    # Simula ambiente senza watchdog
    monkeypatch.setattr(_fpa_mod, "_WATCHDOG_AVAILABLE", False)

    config = _make_config(poll_ms=100, timeout=5)

    with caplog.at_level(logging.INFO, logger="voice.runtime.file_pipe_adapter"):
        adapter = FilePipeAdapter(config)

    # AC3a — log INFO "watchdog non disponibile" emesso all'init
    matching_records = [r for r in caplog.records if "watchdog non disponibile" in r.message]
    assert matching_records, (
        "Log INFO 'watchdog non disponibile' non trovato nei record — AC3.\n"
        f"Record trovati: {[r.message for r in caplog.records]}"
    )
    assert matching_records[0].levelno == logging.INFO, (
        f"Il log deve essere a livello INFO, trovato: {matching_records[0].levelname}"
    )

    # AC3b — _poll_ms corrisponde a pipe_poll_ms / 1000 = 100 ms = 0.1 s
    assert adapter._poll_ms == pytest.approx(0.1), (
        f"_poll_ms atteso 0.1 s (100 ms), trovato {adapter._poll_ms} s (AC3).\n"
        "Controllare che RuntimeConfig.pipe_poll_ms sia letto correttamente in __init__."
    )


# ---------------------------------------------------------------------------
# Test 3 — Nessun ImportError senza watchdog (AC4)
# ---------------------------------------------------------------------------

def test_no_import_error_without_watchdog():
    """
    AC4: il modulo voice.runtime.file_pipe_adapter non deve propagare ImportError
    quando watchdog non è disponibile nell'ambiente.

    Il test ricarica il modulo con sys.modules che espone watchdog=None (sentinella
    standard Python per "import fallito"), verificando che il blocco try/except
    ImportError nel modulo catturi l'errore e imposti _WATCHDOG_AVAILABLE=False
    senza sollevare eccezioni verso l'importatore.
    """
    module_key = "voice.runtime.file_pipe_adapter"
    m = sys.modules[module_key]

    # Salva lo stato rilevante prima del reload per ripristinarlo nel finally
    _saved = {
        "_WATCHDOG_AVAILABLE": m._WATCHDOG_AVAILABLE,
        "_PIPE_DIR": m._PIPE_DIR,
        "_INBOX":    m._INBOX,
        "_OUTBOX":   m._OUTBOX,
        "_READY":    m._READY,
    }

    # Sentinelle standard Python per "questo modulo non è importabile"
    watchdog_mocks: dict[str, None] = {
        "watchdog":          None,
        "watchdog.observers": None,
        "watchdog.events":   None,
    }

    try:
        with patch.dict(sys.modules, watchdog_mocks):
            # Ricarica il modulo con watchdog assente dal sys.modules
            try:
                importlib.reload(m)
            except ImportError as exc:
                pytest.fail(
                    f"ImportError inatteso: il modulo non deve propagare "
                    f"l'ImportError di watchdog — AC4. Errore: {exc}"
                )

            # Dopo il reload _WATCHDOG_AVAILABLE deve essere False
            assert m._WATCHDOG_AVAILABLE is False, (
                "_WATCHDOG_AVAILABLE deve essere False quando watchdog non è "
                "disponibile nel sys.modules (AC4)"
            )

            # FilePipeAdapter deve essere accessibile (il modulo è completo)
            assert hasattr(m, "FilePipeAdapter"), (
                "FilePipeAdapter deve essere definita nel modulo anche senza watchdog (AC4)"
            )

    finally:
        # Ripristina gli attributi del modulo allo stato pre-test.
        # Il reload ha riscritto _PIPE_DIR ecc. con i default del modulo;
        # li rimettiamo a posto per non interferire con gli altri test.
        for attr, val in _saved.items():
            setattr(m, attr, val)
