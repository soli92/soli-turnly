---
id: semantic-drift-prerequisites
type: runbook
title: "Semantic Drift Detection — Prerequisiti e Configurazione"
status: draft
created: 2026-06-25
updated: 2026-06-25
sources: []
tags: [ep-031, semantic-drift, embedding, wiki-lint, research]
pattern_version: "2.23-candidate"
---

# Semantic Drift Detection — Prerequisiti e Configurazione

Runbook operativo per l'attivazione del check sperimentale di embedding similarity
(`wiki_lint.semantic_check`) introdotto da **EP-031** (US-107..109, Sprint 31).

> **Natura sperimentale**: questo check è un EP di ricerca. A flag spento (default)
> il comportamento della factory è identico a v2.22 (backward compat totale, R.P3).
> Il check emette solo `INFO`, mai `WARNING` o `ERROR`; non blocca nessun gate
> pipeline. L'ADR go/no-go di promozione a layer stabile sarà prodotto da US-109.

---

## 1. Prerequisiti

### 1.1 Accesso API embedding

Il check richiede un'API di embedding compatibile. Sono supportate due opzioni:

| Opzione | Modello default | Endpoint | Note |
|---|---|---|---|
| **Voyage via Anthropic** | `voyage-3` | `https://api.voyageai.com/v1/embeddings` | Consigliata. Qualità superiore per testi tecnici in italiano/inglese. |
| **OpenAI** | `text-embedding-3-small` | `https://api.openai.com/v1/embeddings` | Alternativa se già disponibile nella factory. |

### 1.2 Credenziali

Imposta la variabile d'ambiente prima di eseguire `/lint` con il check abilitato:

```bash
# Per Voyage via Anthropic (default):
export ANTHROPIC_API_KEY="sk-ant-..."

# Per OpenAI (alternativa):
export OPENAI_API_KEY="sk-..."
```

La variabile viene letta a runtime dal wiki-lint agent. Non è necessario modificare
`factory.config.yaml` per le credenziali (segue il pattern degli altri layer opt-in
del framework).

### 1.3 Dipendenza SDK Python (opzionale)

Il check può operare via chiamata REST diretta (senza dipendenze aggiuntive) oppure
via SDK Python:

```bash
# SDK Voyage (opzionale — solo se si vuole uso via SDK, non REST):
pip install voyageai

# SDK OpenAI (opzionale):
pip install openai
```

Se l'SDK non è installato, il wiki-lint agent usa la chiamata REST diretta (fallback
automatico). Non è richiesta alcuna configurazione aggiuntiva.

---

## 2. Configurazione

### 2.1 Abilitare il check

Modifica `factory.config.yaml`, blocco `wiki_lint.semantic_check:`:

```yaml
wiki_lint:
  semantic_check:
    enabled: true                      # attiva il check (default false)
    similarity_threshold: 0.75         # soglia coseno — vedi §4 per stima costo
    embedding_model: "voyage-3"        # o "text-embedding-3-small"
    cost_warn_usd: 1.0                 # gate di conferma esplicita prima del scan
    output_report: true                # produce wiki-lint-semantic-<YYYY-MM-DD>.md
    output_report_path: "code_quality/reports/"
```

### 2.2 Selezione del modello

| Flag `embedding_model` | Fornitore | Dimensione vettore | Costo indicativo |
|---|---|---|---|
| `voyage-3` | Voyage AI (Anthropic) | 1024 | ~$0.00010 / 1K token |
| `text-embedding-3-small` | OpenAI | 1536 | ~$0.00002 / 1K token |

Il modello `voyage-3` è raccomandato per contenuti tecnici in lingua mista
italiano/inglese (superiore qualità semantica su testi di architettura software).
La scelta del modello influisce sul costo (vedi §4) e sulla calibrazione della
`similarity_threshold` (valore 0.75 tarato su `voyage-3`; può richiedere
aggiustamento per altri modelli — US-108).

### 2.3 Gate di costo

Il campo `cost_warn_usd` funge da gate esplicito: se il costo stimato del scan
supera la soglia, il wiki-lint agent richiede conferma prima di procedere (analogo
al meccanismo `full_rebuild_cost_warn` di Graphify). Default: `1.0` USD.

Per scan di grandi wiki (>500 pagine), abbassare la soglia o aumentarla
consapevolmente dopo la stima (§4).

---

## 3. Frontmatter pagine wiki

Per partecipare al monitoraggio della deriva semantica, le pagine wiki devono
includere il campo `pattern_section:` nel frontmatter YAML:

```yaml
---
id: mia-pagina
type: concept
title: "Titolo Pagina"
status: stable
pattern_section: "§3"          # sezione PATTERN.md di riferimento
---
```

Il campo `pattern_section:` dichiara la sezione del `PATTERN.md` a cui la pagina
si àncora semanticamente. Il check misura la similarità coseno tra l'embedding
della pagina e quello della sezione dichiarata.

**Pagine senza `pattern_section:`**: vengono saltate silenziosamente (no errore,
no warning). Il check processa solo le pagine che dichiarano esplicitamente
l'ancoraggio.

**Valori ammessi**: riferimenti a sezioni `PATTERN.md` nella forma `§N` o
`§N.M` (es. `§3`, `§7`, `§18.3`). Il formato è validato al momento del scan.

---

## 4. Stima costo

### 4.1 Formula indicativa

```
Costo_scan ≈ N_pagine × avg_tokens_per_pagina × prezzo_per_token
```

Con `voyage-3` e pagine wiki di dimensione media (~800 token):

| N pagine | Costo stimato (voyage-3) | Note |
|---|---|---|
| 50 | ~$0.004 | Corpus piccolo |
| 100 | ~$0.008 | Corpus medio |
| 200 | ~$0.016 | Corpus tipico meta-framework |
| 500 | ~$0.040 | Corpus grande |

> **Nota**: il prezzo $0.0001 per 1K token è indicativo (da misurare empiricamente
> in US-108). Il pricing Voyage AI può variare; verificare il listino corrente su
> https://www.voyageai.com/pricing prima di scan su larga scala.

### 4.2 Prima del primo scan

Prima di abilitare il check su un corpus reale:

1. Contare le pagine wiki con `pattern_section:` valorizzato:
   ```bash
   grep -rl "pattern_section:" wiki/ | wc -l
   ```
2. Stimare i token medi per pagina (approssimazione: 1 parola ≈ 1.3 token).
3. Moltiplicare per il prezzo del modello scelto.
4. Confrontare con `cost_warn_usd` configurato.

Il gate `cost_warn_usd` interverrà automaticamente se la stima supera la soglia.

---

## 5. Avvertenze

### 5.1 Natura sperimentale

- **Output solo INFO**: il check non produce mai `WARNING` o `ERROR`; non blocca
  gate di pipeline, commit, release o altre operazioni. L'unico output concreto
  è il report opzionale in `code_quality/reports/`.
- **Nessun gate pipeline**: a differenza di CQRL (EP-006) o Flakiness Detection
  (EP-027), questo check non ha Lint Check associato con soglia di enforcement.
  L'eventuale promozione a layer stabile (con gate) dipende dall'ADR go/no-go
  di US-109.
- **Calibrazione empirica richiesta**: la `similarity_threshold: 0.75` è un valore
  di default che richiede calibrazione su dati reali (US-108). Soglie troppo alte
  producono falsi positivi; soglie troppo basse producono falsi negativi. Il
  calibration report di US-108 fornirà raccomandazioni basate su dati del
  meta-framework.

### 5.2 Rischi operativi

- **Latenza**: ogni pagina richiede una chiamata API. Per corpus grandi (>100 pagine)
  il scan può richiedere diversi minuti. Non eseguire durante sessioni interattive
  dove la latenza è critica.
- **Rate limiting**: l'API Voyage ha limiti di rate. Per corpus molto grandi,
  implementare pause tra le chiamate (configurabile in US-108 se promosso).
- **Costo cumulativo**: scan ripetuti su corpus grandi possono accumularsi.
  Tenere traccia dei costi tramite il report generato e il Token Ledger (EP-022).

### 5.3 Scope EP-031

Il presente check è parte dell'EP-031 di ricerca (3 US):
- **US-107** (Sprint 31): config block + prerequisiti (questo runbook).
- **US-108** (Sprint 31+): scan pilota + calibration report (alimentato da questo check).
- **US-109** (Sprint 31+): ADR go/no-go promozione a layer stabile.

La feature è in scope `docs` per US-107; il codice del check effettivo (se promosso)
sarà sviluppato in US-108 in scope `be` o `qa` (tbd in US-109 ADR).
