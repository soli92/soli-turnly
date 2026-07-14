"""
voice/runtime/ollama_adapter.py — OllamaAdapter: runtime locale via Ollama.

Implementazione concreta di FactoryRuntime che delega a un server Ollama locale
tramite chiamate HTTP dirette (POST /api/chat con streaming ndjson).

Questo adapter NON usa il pacchetto 'ollama' di PyPI: usa httpx.AsyncClient
(dipendenza transitiva di 'anthropic') per lo streaming ndjson, con fallback
a urllib.request via asyncio.to_thread se httpx non e' disponibile.

Utile per:
  - Sviluppo e test offline senza accesso a Anthropic API.
  - Privacy: elaborazione locale, nessun dato inviato a cloud.
  - Costi: zero per token dopo il download del modello.

Prerequisiti:
  - Ollama installato e in esecuzione: https://ollama.com
      ollama serve          # avvia il server su http://localhost:11434
      ollama pull llama3.2  # scarica il modello di default
  - httpx (dipendenza transitiva di 'anthropic'):
      pip install httpx     # se non gia' presente

Formato streaming Ollama ndjson (POST /api/chat, stream: true):
  - Ogni riga e' un oggetto JSON: {"message": {"content": "<chunk>"}, "done": false}
  - Ultima riga: {"message": {"content": ""}, "done": true, "done_reason": "stop", ...}

Uso::

    from voice.config import load_config
    from voice.runtime.ollama_adapter import OllamaAdapter

    config = load_config()
    adapter = OllamaAdapter(config)
    try:
        async for event in adapter.submit("elenca i task aperti", session_id="turn-1"):
            await router.dispatch(event)
    finally:
        await adapter.aclose()
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator, Callable, Optional

from voice.config import VoiceConfig
from voice.runtime.factory_runtime import (
    Acknowledgment,
    Artifact,
    Done,
    Error,
    FactoryRuntime,
    RuntimeEvent,
    SpokenSummary,
)

logger = logging.getLogger(__name__)

# Endpoint Ollama di default
_DEFAULT_BASE_URL = "http://localhost:11434"
# Modello Ollama di default (disponibile via `ollama pull llama3.2`)
_DEFAULT_MODEL = "llama3.2"

# Importazione condizionale httpx (dipendenza transitiva di anthropic).
# Se non disponibile, si attiva il percorso fallback urllib.request.
try:
    import httpx as _httpx

    _HTTPX_AVAILABLE = True
except ImportError:
    _httpx = None  # type: ignore[assignment]
    _HTTPX_AVAILABLE = False
    logger.debug(
        "OllamaAdapter: httpx non disponibile — attivato fallback urllib.request. "
        "Per prestazioni migliori: pip install httpx"
    )


class OllamaAdapter(FactoryRuntime):
    """
    Adapter Ollama — loop LLM locale via HTTP ndjson streaming.

    Usa httpx.AsyncClient per chiamate async non bloccanti a POST /api/chat di Ollama.
    Fallback a urllib.request via asyncio.to_thread se httpx non e' disponibile.

    Il comportamento e' identico a CustomLoopAdapter dal punto di vista del layer vocale:
    entrambi implementano FactoryRuntime e producono la stessa tassonomia di eventi
    (Acknowledgment → SpokenSummary → Artifact → Done).

    Differenza chiave rispetto a CustomLoopAdapter:
      - CustomLoopAdapter: cloud LLM via Anthropic SDK (latenza rete, costo per token).
      - OllamaAdapter: LLM locale via Ollama (latenza hardware, costo zero post-download).

    La SpokenSummary emessa da OllamaAdapter e' il testo completo troncato ai primi 300
    caratteri (direttamente parlabile senza estrazione da parte del router, in quanto
    Ollama produce testo plain senza markup factory). Diversamente da CustomLoopAdapter
    (che emette un placeholder fisso in Fase 1 e delega la separazione a TSK-302), questo
    adapter produce una SpokenSummary significativa sin dalla Fase 1.

    Thread safety: stessa nota di CustomLoopAdapter — singolo event loop asyncio,
    no condivisione tra thread, istanze separate per esecuzioni parallele.
    """

    def __init__(
        self,
        config: VoiceConfig,
        base_url: str = _DEFAULT_BASE_URL,
        model: str = _DEFAULT_MODEL,
    ) -> None:
        """
        Inizializza l'adapter con la configurazione letta da factory.config.yaml.

        I parametri base_url e model vengono sovrascrittti se config ha un campo
        'runtime' (dict o oggetto con attributi) che li specifica, permettendo
        configurazione centralizzata via factory.config.yaml senza dover passare
        argomenti al costruttore.

        Args:
            config: VoiceConfig con i parametri del canale vocale.
            base_url: URL base del server Ollama. Default: http://localhost:11434.
                      Precedenza: config.runtime.base_url > parametro > default.
            model: nome del modello Ollama. Default: llama3.2.
                   Precedenza: config.runtime.model > parametro > default.
        """
        self._config = config

        # Leggi base_url e model da config.runtime se presente.
        # Supporta sia dict (da YAML) che oggetti con attributi (futura RuntimeConfig dataclass).
        runtime_cfg = getattr(config, "runtime", None)
        if isinstance(runtime_cfg, dict):
            base_url = str(runtime_cfg.get("base_url", base_url))
            model = str(runtime_cfg.get("model", model))
        elif runtime_cfg is not None:
            base_url = str(getattr(runtime_cfg, "base_url", base_url))
            model = str(getattr(runtime_cfg, "model", model))

        self._base_url: str = base_url.rstrip("/")
        self._model: str = model
        # _cancelled: dict[session_id → bool] — flag per cancel() idempotente.
        # Il generator submit() controlla il flag a ogni chunk per terminare pulito.
        self._cancelled: dict[str, bool] = {}
        # Client httpx riutilizzato per tutti i submit() della sessione.
        # timeout=None: lo stream Ollama puo' richiedere tempo variabile — nessun timeout fisso.
        self._client = (
            _httpx.AsyncClient(timeout=None)  # type: ignore[union-attr]
            if _HTTPX_AVAILABLE
            else None
        )
        logger.debug(
            "OllamaAdapter: inizializzato base_url=%s model=%s httpx=%s",
            self._base_url,
            self._model,
            _HTTPX_AVAILABLE,
        )

    # ------------------------------------------------------------------
    # submit() — async generator (contratto §7)
    # ------------------------------------------------------------------

    async def submit(  # type: ignore[override]
        self, text: str, session_id: str
    ) -> AsyncGenerator[RuntimeEvent, None]:
        """
        Invia la direttiva al runtime Ollama e itera gli eventi di risposta.

        Sequenza eventi emessi:
          1. Acknowledgment("ci sto lavorando con Ollama...") — immediato (contratto §7.2).
          2. Stream ndjson da POST /api/chat: accumula i chunk in full_text.
             Controlla cancel a ogni chunk per supportare barge-in (Fase 3, US-144 AC6).
          3. A done=true:
             - SpokenSummary(full_text[:300]) — sintesi parlabile (primi 300 char, troncata).
             - Artifact(kind="text", content=full_text) — testo completo per canale visivo.
               INVARIANTE: Artifact.content NON viene passato a TTS (contratto §4.2 + US-145 AC3).
          4. Done() — chiude il turno.

        In caso di errore di connessione (Ollama non avviato):
          Error("Ollama non raggiungibile. Avvia Ollama con: ollama serve")

        Args:
            text: testo trascritto dall'STT (direttiva utente).
            session_id: identificatore univoco del turno (es. UUID).

        Yields:
            RuntimeEvent: Acknowledgment → SpokenSummary → Artifact → Done
                          oppure ... → Error in caso di errore fatale.
        """
        # Inizializza (o resetta) il flag di cancel per questa sessione
        self._cancelled[session_id] = False
        logger.debug(
            "OllamaAdapter.submit: avvio sessione=%s model=%s", session_id, self._model
        )

        # --- 1. Acknowledgment immediato (contratto §7.2) ---
        yield Acknowledgment("ci sto lavorando con Ollama...")
        if self._cancelled.get(session_id):
            logger.info(
                "OllamaAdapter: sessione %s cancellata dopo Acknowledgment", session_id
            )
            return

        # --- 2. Stream ndjson da Ollama ---
        url = f"{self._base_url}/api/chat"
        body: dict = {
            "model": self._model,
            "messages": [{"role": "user", "content": text}],
            "stream": True,
        }
        full_text = ""

        if _HTTPX_AVAILABLE and self._client is not None:
            # Percorso primario: httpx async streaming (non bloccante)
            try:
                async with self._client.stream("POST", url, json=body) as response:
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        # Controlla cancel prima di ogni yield (supporto barge-in)
                        if self._cancelled.get(session_id):
                            logger.info(
                                "OllamaAdapter: sessione %s cancellata durante stream",
                                session_id,
                            )
                            return
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            logger.warning(
                                "OllamaAdapter: linea ndjson non valida ignorata: %r", line
                            )
                            continue
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            full_text += chunk
                        if data.get("done"):
                            break
            except _httpx.ConnectError as exc:  # type: ignore[union-attr]
                logger.error(
                    "OllamaAdapter: ConnectError [%s]: %s", session_id, exc
                )
                yield Error(
                    "Ollama non raggiungibile. Avvia Ollama con: ollama serve"
                )
                return
            except asyncio.CancelledError:
                # asyncio.CancelledError non deve essere swallowed — uscita pulita
                logger.info(
                    "OllamaAdapter: CancelledError per sessione %s — terminazione pulita",
                    session_id,
                )
                return
            except Exception as exc:
                logger.error(
                    "OllamaAdapter: errore inatteso [%s] %s: %s",
                    session_id,
                    type(exc).__name__,
                    exc,
                )
                yield Error(
                    f"Errore durante l'elaborazione Ollama: {type(exc).__name__}."
                )
                return
        else:
            # Percorso fallback: urllib.request via asyncio.to_thread (sincrono in thread)
            # Nota: il cancel granulare per chunk non e' supportato in questo percorso;
            # il flag viene controllato solo prima dell'avvio del thread.
            try:
                result = await asyncio.to_thread(
                    _urllib_post_ollama,
                    url,
                    body,
                    lambda: bool(self._cancelled.get(session_id, False)),
                )
                if result is None:
                    # Cancellato prima dell'avvio del thread (lambda ha restituito True)
                    logger.info(
                        "OllamaAdapter: sessione %s cancellata (fallback urllib)", session_id
                    )
                    return
                full_text = result
            except (ConnectionRefusedError, OSError) as exc:
                logger.error(
                    "OllamaAdapter: errore connessione urllib [%s]: %s", session_id, exc
                )
                yield Error(
                    "Ollama non raggiungibile. Avvia Ollama con: ollama serve"
                )
                return
            except asyncio.CancelledError:
                logger.info(
                    "OllamaAdapter: CancelledError (fallback urllib) sessione %s — terminazione pulita",
                    session_id,
                )
                return
            except Exception as exc:
                logger.error(
                    "OllamaAdapter: errore inatteso urllib [%s] %s: %s",
                    session_id,
                    type(exc).__name__,
                    exc,
                )
                yield Error(
                    f"Errore durante l'elaborazione Ollama: {type(exc).__name__}."
                )
                return

        if self._cancelled.get(session_id):
            logger.info(
                "OllamaAdapter: sessione %s cancellata dopo stream", session_id
            )
            return

        # --- 3. SpokenSummary (primi 300 char) + Artifact (testo completo per visivo) ---
        # SpokenSummary: troncatura a 300 char per compatibilita' con i TTS engine che hanno
        # latenza crescente su testi lunghi. Il testo completo e' disponibile via Artifact.
        # INVARIANTE (contratto §4.2 + US-145 AC3): Artifact.content NON deve mai raggiungere TTS.
        spoken = full_text[:300].strip() if full_text else "elaborazione completata"
        yield SpokenSummary(spoken)
        if full_text:
            yield Artifact(kind="text", content=full_text)

        # --- 4. Done — chiude il turno ---
        yield Done()
        logger.debug(
            "OllamaAdapter.submit: sessione=%s completata (%d chars)",
            session_id,
            len(full_text),
        )

    # ------------------------------------------------------------------
    # cancel() — idempotente
    # ------------------------------------------------------------------

    async def cancel(self, session_id: str) -> None:
        """
        Imposta il flag di cancel per la sessione indicata.

        Il generator submit() controlla _cancelled[session_id] a ogni chunk ndjson
        e termina pulitamente senza lasciare connessioni HTTP aperte.

        Idempotente: chiamarlo su una session_id non attiva, gia' completata o gia'
        cancellata non genera eccezioni (contratto §7.2).

        Args:
            session_id: identificatore della sessione da interrompere.
        """
        self._cancelled[session_id] = True
        logger.debug("OllamaAdapter.cancel: richiesto per sessione=%s", session_id)

    # ------------------------------------------------------------------
    # aclose() — rilascio risorse, idempotente
    # ------------------------------------------------------------------

    async def aclose(self) -> None:
        """
        Chiude il client httpx e ripulisce lo stato interno (_cancelled).

        Chiamato dallo state_machine al termine della sessione vocale o in caso
        di errore fatale non recuperabile. Idempotente: chiamarlo piu' volte e' sicuro.

        Dopo aclose() l'istanza non deve essere riutilizzata: creare una nuova
        istanza di OllamaAdapter per la sessione successiva.
        """
        self._cancelled.clear()
        if self._client is not None:
            await self._client.aclose()
        logger.debug("OllamaAdapter.aclose: risorse rilasciate")


# ---------------------------------------------------------------------------
# Fallback urllib.request (solo quando httpx non e' disponibile)
# ---------------------------------------------------------------------------

def _urllib_post_ollama(
    url: str,
    body: dict,
    is_cancelled: Callable[[], bool],
) -> Optional[str]:
    """
    Chiama POST /api/chat via urllib.request in modalita' sincrona.

    Invocato con asyncio.to_thread() dal percorso fallback di OllamaAdapter.submit()
    quando httpx non e' disponibile.

    Il cancel granulare per-chunk non e' supportato in questa implementazione:
    il flag is_cancelled viene controllato solo prima dell'avvio della connessione.
    Per cancel granulare durante lo stream installare httpx (percorso primario).

    Args:
        url: URL completo del endpoint Ollama (/api/chat).
        body: dizionario del body JSON (model, messages, stream).
        is_cancelled: callable senza argomenti che restituisce True se la sessione
                      e' stata cancellata. Controllato prima dell'apertura della connessione.

    Returns:
        Testo accumulato dallo stream ndjson, oppure None se la sessione era gia'
        cancellata prima dell'avvio (is_cancelled() era True).

    Raises:
        ConnectionRefusedError: se Ollama non e' in ascolto sull'URL specificato.
        urllib.error.URLError: altri errori di rete o HTTP.
        OSError: errori di socket di basso livello.
    """
    import urllib.error
    import urllib.request

    # Controlla cancel prima di aprire la connessione (unico punto di cancel nel fallback)
    if is_cancelled():
        return None

    encoded = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    full_text = ""
    try:
        with urllib.request.urlopen(req) as resp:
            for raw_line in resp:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                except json.JSONDecodeError:
                    logger.warning(
                        "_urllib_post_ollama: linea ndjson non valida ignorata: %r", line
                    )
                    continue
                chunk = parsed.get("message", {}).get("content", "")
                if chunk:
                    full_text += chunk
                if parsed.get("done"):
                    break
    except urllib.error.URLError as exc:
        # Scarta il wrapper URLError per esporre l'errore sottostante al chiamante
        raise exc.reason if isinstance(exc.reason, OSError) else OSError(str(exc)) from exc

    return full_text
