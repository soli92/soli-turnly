---
id: analytics-pricing-runbook
title: "Runbook — Governance aggiornamento analytics/pricing.yaml"
status: active
created: 2026-06-15
related:
  - analytics/pricing.yaml
  - .claude/tools/analytics/show-session-tokens.py
  - design_&_architecture/decisions/ADR-022.md
---

# Runbook — Governance aggiornamento `analytics/pricing.yaml`

Questo runbook documenta il processo di governance per mantenere aggiornata la tabella
prezzi `analytics/pricing.yaml`, che è il single-source-of-truth per il calcolo dei costi
del Token Ledger (EP-022) e dell'intera infrastruttura analytics (EP-009).

---

## 1. Scopo

`analytics/pricing.yaml` è un file di configurazione **versionato via git**, con ruolo
di single-source-of-truth per il costo di ogni token LLM consumato dalla factory.

**Perche' e' critico:**

- Il Token Ledger (`show-session-tokens.py`) legge questo file per calcolare il costo
  della sessione corrente. Se un modello non e' presente, lo script cade su un fallback
  hardcoded basato sul prefisso (es. `claude-sonnet-* → $3/$15`), perdendo precisione.
- Il sistema di analytics EP-009 (`compute_agentic_cost` US-034) applica il pricing
  storico in modo deterministico: un evento del 2026-01 e' sempre valutato col prezzo
  del 2026-01, non con quello corrente. Questo garantisce il determinismo retrospettivo
  (ADR-022 §F).
- Un modello non censito viene segnalato con `fail-loud` dalla skill
  `cost-and-time-analytics` (US-036): «Modello sconosciuto. Aggiungere in
  `analytics/pricing.yaml`.» Il costo zero imputato silenziosamente non e' mai
  accettabile (ADR-022 §D principio fail-loud).
- Il parametro `drift_warn_days` in `factory.config.yaml` emette un WARNING se il file
  non viene aggiornato per piu' di N giorni, segnalando potenziale disallineamento con
  il listino Anthropic corrente.

**Single-writer logico:** PM o Arch della factory. Nessun tool del framework modifica
`pricing.yaml` a runtime. Ogni cambio avviene via commit convenzionale su PR.

---

## 2. Procedura — Verifica modelli mancanti

### 2.1 Segnale primario: output di `show-session-tokens.py`

Quando il Token Ledger non riesce a risolvere il modello tramite `pricing.yaml`, lo
script ricorre a un fallback hardcoded (prefisso `claude-opus-*`, `claude-sonnet-*`,
ecc.). Il modello usato viene mostrato nel display `--full`:

```bash
python3 "/Users/simone.olivieri/Documents/Personal/Repos/soli-multi-agents-factory/.claude/tools/analytics/show-session-tokens.py" --full
```

Output di esempio con modello risolto via `pricing.yaml`:

```
╭────────────────────────────────────────────────────╮
│  TOKEN LEDGER — sessione corrente                  │
│  Modelli: claude-sonnet-4-6                        │
├────────────────────────────────────────────────────┤
│  Input:           45.2k  tokens                    │
│  Output:           8.3k  tokens                    │
│  Cache read:      31.1k  tokens                    │
│  Risparmio:      $0.0093                           │
├────────────────────────────────────────────────────┤
│  Costo sessione:  ~$  0.2847                       │
╰────────────────────────────────────────────────────╯
```

Se il modello appare come `unknown` o il costo sembra anomalo (zero o molto basso
rispetto all'atteso), e' probabile che si stia usando il fallback hardcoded anziché
i prezzi da `pricing.yaml`.

### 2.2 Verifica diretta dal transcript JSONL

Il transcript JSONL si trova tipicamente in:

```
~/.claude/projects/<project-slug>/<session-id>.jsonl
```

Per estrarre i `model_id` reali usati nella sessione:

```bash
# Trova il transcript piu' recente del progetto
find ~/.claude/projects/ -name "*.jsonl" -newer analytics/pricing.yaml | sort | tail -5

# Estrai tutti i model_id distinti dai messaggi assistant
grep '"type":"assistant"' <transcript.jsonl> \
  | python3 -c "
import sys, json
ids = set()
for line in sys.stdin:
    try:
        d = json.loads(line)
        m = d.get('message', {}).get('model')
        if m: ids.add(m)
    except: pass
for i in sorted(ids): print(i)
"
```

Output tipico:

```
claude-sonnet-4-6[1m]
claude-opus-4-8[1m]
```

### 2.3 Confronta con le entry in `pricing.yaml`

```bash
grep "^  - id:" analytics/pricing.yaml
```

Per ogni `model_id` trovato nel transcript, verifica che esista come `id:` diretto
oppure nella lista `aliases:` di una entry. La normalizzazione applicata dallo script
e' `lowercase + strip suffix [...]`:

- `claude-sonnet-4-6[1m]` → normalizzato a `claude-sonnet-4-6` → cerca id/alias
- `anthropic/claude-opus-4-8` → normalizzato a `anthropic/claude-opus-4-8` → cerca in aliases

Se un modello normalizzato non corrisponde a nessun `id` ne' `alias`, la entry manca.

### 2.4 Verifica via `factory.config.yaml` (`drift_warn_days`)

```bash
grep "drift_warn_days" factory.config.yaml
```

Se l'ultima modifica a `pricing.yaml` supera il numero di giorni configurato (default
90), il framework emette un WARNING durante le operazioni analytics. Questo segnale
indica che potrebbe essere il momento di ricontrollare i prezzi.

---

## 3. Procedura — Aggiunta di una nuova entry

### 3.1 Schema obbligatorio (ADR-022 §B verbatim)

```yaml
models:
  - id: <model-id-canonical>          # lowercase, kebab-case, no dots, no [bracket]
    provider: anthropic                # informativo, nessuna logica dipende da questo campo
    display_name: "Claude X.Y"        # human-readable per i report
    aliases:                           # varianti raw che appaiono nei transcript
      - claude-x.y                     # formato Anthropic SDK (dots → trattini)
      - claude-x-y[1m]                 # formato Claude Code (suffix bracket)
      - anthropic/claude-x-y           # formato OpenRouter (prefix provider)
    pricing:                           # lista ordinata asc per valid_from, almeno una entry
      - valid_from: YYYY-MM-DD         # ISO 8601 date, obbligatorio
        input_per_1m_tokens: N.N       # USD per 1M token input
        output_per_1m_tokens: N.N      # USD per 1M token output
        cache_read_per_1m_tokens: N.N  # 0.1 × input (moltiplicatore standard Anthropic)
        cache_write_per_1m_tokens: N.N # 1.25 × input (write 5m TTL, standard Anthropic)
```

**Regole invarianti (ADR-022 §B + §E):**

- `id` e' la chiave primaria: lowercase, kebab-case, no dots, no suffix `[...]`.
- `pricing:` deve essere ordinata ascendente per `valid_from`.
- Ogni entry `valid_from` e' **semi-aperta a destra**: e' valida da `valid_from` fino
  alla `valid_from` della entry successiva (o ∞ se e' l'ultima).
- **No retroactive edit**: non modificare mai una entry con `valid_from` nel passato.
  Per cambiare un prezzo, aggiungere una nuova entry. Per un fix di dato anomalo,
  commit esplicito `fix(pricing): retroactive correction for entry valid_from=YYYY-MM-DD, reason=...`.
- `currency:` e' dichiarata a livello file (unica per tutto il file). Default EUR
  nel file corrente; i prezzi Anthropic sono in USD — se si gestisce la factory in EUR,
  applicare il tasso di cambio e annotarlo nel commit message.

### 3.2 Fonte dei prezzi

Fonte autorevole: **https://www.anthropic.com/pricing** (sezione API Pricing) o
il portale sviluppatori **https://docs.anthropic.com/api/pricing**.

Verificare sempre la valuta del listino (USD) e convertire se il file e' in EUR,
annotando il tasso nel commit message.

**Moltiplicatori cache standard Anthropic** (al 2026-06):
- Cache read: `input × 0.1` (es. $3.00/1M input → $0.30/1M cache_read)
- Cache write (5m TTL): `input × 1.25` (es. $3.00/1M input → $3.75/1M cache_write)

### 3.3 Esempio concreto: aggiunta `claude-haiku-5`

Scenario: Anthropic annuncia Claude Haiku 5 con prezzo $0.80/$4.00 per 1M token,
disponibile dal 2026-09-01.

```yaml
  - id: claude-haiku-5
    provider: anthropic
    display_name: "Claude Haiku 5"
    aliases:
      - claude-haiku-5.0
      - claude-haiku-5[1m]
      - anthropic/claude-haiku-5
    pricing:
      - valid_from: 2026-09-01
        input_per_1m_tokens: 0.80
        output_per_1m_tokens: 4.00
        cache_read_per_1m_tokens: 0.08    # 0.1 × 0.80
        cache_write_per_1m_tokens: 1.0    # 1.25 × 0.80
```

Commit convenzionale:

```
chore(pricing): add claude-haiku-5 entry valid_from=2026-09-01

Prezzi da https://www.anthropic.com/pricing (USD/1M token).
Input $0.80, output $4.00. Cache: read 0.1x, write-5m 1.25x.
```

### 3.4 Esempio concreto: aggiornamento prezzo esistente (bump)

Scenario: Anthropic riduce il prezzo di Sonnet 4.6 da $3.00 a $2.50 input, dal 2026-10-01.

```yaml
  - id: claude-sonnet-4-6
    # ... (entry precedente 2026-01-01 invariata) ...
    pricing:
      - valid_from: 2026-01-01
        input_per_1m_tokens: 3.0
        output_per_1m_tokens: 15.0
        cache_read_per_1m_tokens: 0.3
        cache_write_per_1m_tokens: 3.75
      - valid_from: 2026-10-01            # nuova entry — NON toccare quella sopra
        input_per_1m_tokens: 2.5
        output_per_1m_tokens: 12.5
        cache_read_per_1m_tokens: 0.25
        cache_write_per_1m_tokens: 3.125
```

Commit convenzionale:

```
chore(pricing): bump claude-sonnet-4-6 input 3.0→2.5 valid_from=2026-10-01

Fonte: https://www.anthropic.com/pricing annuncio 2026-09-28.
Entry 2026-01-01 invariata (no retroactive edit, ADR-022 §E).
```

---

## 4. Periodicita' raccomandata

### Trigger obbligatori (event-driven)

1. **Nuova versione modello Anthropic annunciata** — aggiungere la entry appena
   disponibile il listino ufficiale, anche se la factory non usa ancora quel modello
   (e' preferibile averla pronta per quando apparira' nei transcript).
2. **`drift_warn_days` superato** — il WARNING del framework indica che il file
   non viene aggiornato da piu' di 90 giorni (default). Verificare se ci sono nuovi
   modelli o variazioni di prezzo non ancora registrate.
3. **Modello `unknown` nei log analytics** — segnale diretto che manca una entry.

### Revisione periodica raccomandata

**Mensile**: nei primi giorni del mese, verificare che:
- Non ci siano nuovi modelli Anthropic annunciati nell'ultimo mese
  (fonte: https://www.anthropic.com/news o changelog API)
- I prezzi delle entry esistenti siano allineati al listino corrente
- `drift_warn_days` in `factory.config.yaml` non abbia emesso WARNING

La revisione mensile e' sufficiente perche' Anthropic non modifica i prezzi dei modelli
esistenti con frequenza superiore (le variazioni avvengono tipicamente con nuove versioni
o annunci trimestrali). In periodi di forte accelerazione (es. lancio di nuova famiglia
di modelli), aumentare la frequenza a settimanale per 1-2 mesi.

---

## 5. Gestione `drift_warn_days`

### Significato

`analytics.measurement.drift_warn_days` e' un parametro in `factory.config.yaml` che
configura la soglia di allerta per il disallineamento del pricing:

```yaml
# factory.config.yaml (sezione analytics.measurement)
analytics:
  measurement:
    drift_warn_days: 90    # warn se pricing_table non aggiornata da > N giorni
```

Quando l'ultima modifica a `analytics/pricing.yaml` (data del commit git piu' recente)
supera questo numero di giorni, il framework emette un WARNING nelle operazioni analytics
per segnalare che i prezzi potrebbero essere obsoleti.

### Valore default: 90 giorni

Il valore default di **90 giorni (3 mesi)** e' calibrato su:
- La frequenza tipica con cui Anthropic rilascia nuovi modelli (trimestrale/semestrale)
- La frequenza tipica con cui i prezzi cambiano (raramente per modelli esistenti)
- Il margine sufficiente per che il maintainer non riceva WARNING inutili in periodi
  di stabilita' del listino

### Quando aggiornarlo

| Situazione | Azione consigliata |
|---|---|
| Factory con aggiornamenti frequenti (es. experimenting con beta model) | Ridurre a `30` o `60` giorni |
| Factory stabile, uso modelli consolidati | Mantenere a `90` giorni (default) |
| Factory con SLA di costo auditable (es. progetto cliente) | Ridurre a `30` giorni per massima vigilanza |
| WARNING frequenti ingiustificati (pricing stabile) | Aumentare a `120`-`180` giorni |

Per aggiornare:

```bash
# factory.config.yaml
analytics:
  measurement:
    drift_warn_days: 60    # es. ridotto per factory con modelli beta
```

Documentare la motivazione nel commit:

```
chore(config): reduce drift_warn_days 90→60

Factory usa modelli beta con pricing instabile.
Piu' alta vigilanza richiesta per accuratezza costi.
```

---

## 6. Troubleshooting

### 6.1 Il prezzo non e' pubblicamente disponibile

Scenario tipico: Anthropic annuncia un nuovo modello ma il listino ufficiale non e'
ancora disponibile o riporta solo prezzi "a partire da".

**Procedura:**

1. **Non aggiungere la entry finche' i prezzi non sono confermati.** Il fallback
   prefix-based di `show-session-tokens.py` usa valori ragionevoli in assenza di entry
   esplicita (es. `claude-opus-*` → $5.00/$25.00). E' accettabile come misura
   temporanea.
2. **Apri un issue o task** (es. `TSK-NNN — Aggiungere entry claude-X-Y a pricing.yaml`)
   con label `blocked:pricing-unavailable`.
3. **Aggiungi un commento placeholder** nel file per tracciare il modello atteso:
   ```yaml
   # TODO: claude-X-Y — prezzo non ancora disponibile al YYYY-MM-DD.
   # Fonte da monitorare: https://www.anthropic.com/pricing
   # Fallback attivo: _MODEL_FALLBACKS["claude-..."] in show-session-tokens.py
   ```
4. **Non usare prezzi di terze parti** (es. blog, forum) come fonte: attendere il
   listino ufficiale Anthropic o documentare esplicitamente nel commit che si tratta
   di una stima con un commit message `fix(pricing): estimated price for claude-X-Y,
   source=<URL>, reason=official list not yet published`.

### 6.2 Il modello appare come `unknown` nel display

Il modello trovato nel transcript non corrisponde a nessun `id` ne' `alias` in
`pricing.yaml`. Lo script usa i fallback hardcoded `_MODEL_FALLBACKS`.

**Diagnosi:**

```bash
# Mostra il model_id raw dal transcript
grep '"type":"assistant"' ~/.claude/projects/<slug>/<session>.jsonl \
  | python3 -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line.strip())
    m = d.get('message', {}).get('model')
    if m: print(repr(m))
" | sort | uniq
```

Il model_id raw potrebbe avere un formato non ancora censito (es. nuovo suffix, nuovo
schema di versioning). Aggiungere come `alias:` all'entry corretta o creare nuova entry
se e' un modello diverso.

### 6.3 Il costo calcolato sembra errato (zero o anomalo)

Possibili cause:

1. **`pricing.yaml` non trovato** — lo script usa solo fallback hardcoded. Verificare
   che `CLAUDE_PROJECT_DIR` punti alla root del repo:
   ```bash
   echo $CLAUDE_PROJECT_DIR
   ls $CLAUDE_PROJECT_DIR/analytics/pricing.yaml
   ```
2. **`pyyaml` non installato** — lo script ignora silenziosamente l'errore di import.
   Installare: `pip install pyyaml`.
3. **Entry `valid_from` piu' recente del timestamp dell'evento** — ADR-022 §E richiede
   che esista almeno una entry con `valid_from <= event_timestamp`. Se l'evento e'
   precedente alla prima entry, la skill `cost-and-time-analytics` emette fail-loud.
   Per `show-session-tokens.py`, lo script usa semplicemente l'ultima entry disponibile
   (ultima in lista).
4. **`cache_*` omessi** — se `cache_read_per_1m_tokens` e' omesso, il campo vale 0.
   Per modelli che non supportano cache (es. alcuni OpenAI), questo e' corretto.
   Per modelli Anthropic, l'omissione e' probabile un errore: aggiungere i campi.

### 6.4 Retroactive correction necessaria (errore di prezzo storico)

Se si scopre che un prezzo inserito in passato era errato e ha contaminato report
storici, il protocollo e' il seguente (ADR-022 §E):

1. **Non modificare silenziosamente la entry**: qualsiasi modifica a una entry passata
   altera i costi storici gia' calcolati e compromette l'audit trail.
2. **Commit esplicito con segnalazione chiara:**
   ```
   fix(pricing): retroactive correction for entry valid_from=2026-01-01, reason=...
   
   Valori precedenti: input=X, output=Y (non allineati al listino ufficiale).
   Valori corretti: input=A, output=B. Fonte: https://www.anthropic.com/pricing.
   I report storici precedenti a questo commit potrebbero mostrare costi diversi.
   ```
3. **Documentare l'impatto** nei report già generati (es. aggiungere nota nei digest
   settimanali `code_quality/reports/_digests/`).

---

## Riferimenti

- [ADR-022](../../design_&_architecture/decisions/ADR-022.md) — Schema e versioning
  `pricing.yaml` + `<<model_id>>` canonical naming + aliases. Autorita' su tutto lo
  schema e le invarianti descritte in questo runbook.
- [analytics/pricing.yaml](../../analytics/pricing.yaml) — File di pricing della
  factory corrente (soli-multi-agents-factory).
- [.claude/tools/analytics/show-session-tokens.py](../../.claude/tools/analytics/show-session-tokens.py)
  — Script Token Ledger: legge transcript JSONL, risolve pricing, mostra costo sessione.
- [wiki/concepts/task-analytics-cost-estimation-capability.md](../concepts/task-analytics-cost-estimation-capability.md)
  — Concept EP-009 sul sistema di stima costi agentic.
- [management/kanban/EP-022-token-ledger/](../../management/kanban/EP-022-token-ledger/)
  — Epica Token Ledger (EP-022) che ha prodotto questo runbook.
