"""
voice/runtime/mock_adapter.py — MockAdapter: implementazione di test di FactoryRuntime.

Non usa nessun LLM esterno: risponde con un echo del testo ricevuto.
Utile per test unitari, CI, sviluppo offline e verifica della pipeline vocale
senza dipendenze da Anthropic SDK o da un modello attivo.

Contratto rispettato (§7.2):
  - Acknowledgment emesso immediatamente come primo evento.
  - Latenza simulata di 300 ms dopo l'Acknowledgment (simula latenza LLM minima).
  - Controllo cancel dopo la latenza simulata.
  - SpokenSummary con echo del testo trascritto.
  - Artifact(kind="text") per il canale visivo.
  - Done() chiude il turno.
  - cancel() idempotente, stesso pattern di CustomLoopAdapter.
  - aclose() pulisce il dizionario _cancelled.

Nessun import di 'anthropic' o di qualunque altro LLM.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator

from voice.config import VoiceConfig
from voice.runtime.factory_runtime import (
    Acknowledgment,
    Artifact,
    Done,
    FactoryRuntime,
    RuntimeEvent,
    SpokenSummary,
)

logger = logging.getLogger(__name__)

# Latenza simulata in secondi — corrisponde ai 300 ms richiesti dalla spec.
_MOCK_LATENCY_S: float = 0.3


class MockAdapter(FactoryRuntime):
    """
    Adapter di test — echo deterministico, nessun LLM.

    Sequenza eventi emessi da submit():
      Acknowledgment → (300 ms) → SpokenSummary → Artifact → Done

    Utilizzo tipico::

        from voice.config import load_config
        from voice.runtime.mock_adapter import MockAdapter

        config = load_config()
        adapter = MockAdapter(config)
        try:
            async for event in adapter.submit("elenca i task aperti", session_id="turn-1"):
                print(event)
        finally:
            await adapter.aclose()
    """

    def __init__(self, config: VoiceConfig) -> None:
        """
        Inizializza il MockAdapter.

        Args:
            config: VoiceConfig letta da factory.config.yaml. Accettata per
                    compatibilità di firma con FactoryRuntime; non viene usata.
        """
        # config non viene usata — ricevuta solo per compatibilità firma (§7).
        self._config = config
        # _cancelled: dict[session_id → bool] — flag per cancel() idempotente.
        # Il generator submit() controlla il flag dopo la latenza simulata.
        self._cancelled: dict[str, bool] = {}

    # ------------------------------------------------------------------
    # submit() — async generator (contratto §7)
    # ------------------------------------------------------------------

    async def submit(  # type: ignore[override]
        self, text: str, session_id: str
    ) -> AsyncGenerator[RuntimeEvent, None]:
        """
        Emette una sequenza deterministica di eventi in risposta al testo ricevuto.

        Sequenza:
          1. Acknowledgment("ricevuto, elaboro in modalita' mock...") — immediato.
          2. asyncio.sleep(300 ms) — simula latenza LLM minima.
          3. Controllo cancel: se cancel() e' stato chiamato, termina pulitamente.
          4. SpokenSummary(f"Hai detto: {text}") — echo parlato.
          5. Artifact(kind="text", content=f"[MOCK] Input: {text}") — canale visivo.
          6. Done() — chiude il turno.

        Args:
            text: testo trascritto dall'STT (direttiva utente).
            session_id: identificatore univoco del turno (es. UUID).

        Yields:
            RuntimeEvent: Acknowledgment → SpokenSummary → Artifact → Done
        """
        # Inizializza (o resetta) il flag di cancel per questa sessione
        self._cancelled[session_id] = False
        logger.debug("MockAdapter.submit: avvio sessione=%s", session_id)

        # --- 1. Acknowledgment immediato (contratto §7.2) ---
        yield Acknowledgment("ricevuto, elaboro in modalita' mock...")

        # --- 2. Simula latenza LLM minima ---
        await asyncio.sleep(_MOCK_LATENCY_S)

        # --- 3. Controllo cancel (barge-in, Fase 3 US-144) ---
        if self._cancelled.get(session_id):
            logger.info(
                "MockAdapter: sessione %s cancellata dopo latenza simulata", session_id
            )
            return

        # --- 4. SpokenSummary — echo del testo trascritto ---
        yield SpokenSummary(f"Hai detto: {text}")

        # --- 5. Artifact — canale visivo (MAI al TTS, contratto §4.2 / US-145 AC3) ---
        yield Artifact(kind="text", content=f"[MOCK] Input: {text}")

        # --- 6. Done — chiude il turno ---
        yield Done()
        logger.debug("MockAdapter.submit: sessione=%s completata", session_id)

    # ------------------------------------------------------------------
    # cancel() — idempotente
    # ------------------------------------------------------------------

    async def cancel(self, session_id: str) -> None:
        """
        Imposta il flag di cancel per la sessione indicata.

        Idempotente: chiamarlo su una session_id non attiva, gia' completata o gia'
        cancellata non genera eccezioni (contratto §7.2).

        Args:
            session_id: identificatore della sessione da interrompere.
        """
        self._cancelled[session_id] = True
        logger.debug("MockAdapter.cancel: richiesto per sessione=%s", session_id)

    # ------------------------------------------------------------------
    # aclose() — rilascio risorse, idempotente
    # ------------------------------------------------------------------

    async def aclose(self) -> None:
        """
        Pulisce il dizionario _cancelled e rilascia lo stato interno.

        Idempotente: chiamarlo piu' volte e' sicuro.
        Dopo aclose() l'istanza non deve essere riutilizzata.
        """
        self._cancelled.clear()
        logger.debug("MockAdapter.aclose: risorse rilasciate")
