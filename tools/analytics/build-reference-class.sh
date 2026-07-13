#!/usr/bin/env bash
# =============================================================================
# build-reference-class.sh — tool deterministico build_reference_class
#                            (EP-010, US-041, TSK-074)
# =============================================================================
#
# Parte della capability Task Analytics & Cost/Time Estimation — faccia
# PREVISIONALE (EP-010), istanza del pattern [[thin-agents-fat-skills-refactor]]: questo
# è il TOOL (logica deterministica, no LLM). Costruisce la REFERENCE CLASS per
# un tipo di lavoro: filtra lo storico (task_type/layer/period) via il tool
# analyze_timeline (EP-009, US-035), conta i campioni N, estrae la distribuzione
# di durata e costo, e arricchisce N + similarity con la Reference Class
# Sufficiency Policy (ADR-025 §A-B-C-D) → `confidence` + `mode_recommended`.
#
# Il tool NON ragiona sulla metodologia: la SCELTA del metodo di stima resta
# nella skill `project-estimation` (US-040) e nell'agente (US-043). Questo tool
# esegue solo il sampling deterministico + il lookup della policy. L'output è
# JSON puro, consumato da estimate_project (TSK-075) e dalla skill (TSK-071).
#
# PATTERN.md §3 — operazione canonica opzionale «Reference Class» (sotto-voce di
#                 «Project Estimation»). Invariante della capability: mai numero
#                 puntuale — ogni stima è intervallo + confidenza + qualità della
#                 reference class (N, similarity, confidence). Vedi ADR-025 §F.
# Wiki: wiki/concepts/task-analytics-cost-estimation-capability.md
#       [[task-analytics-cost-estimation-capability]] §Stima enterprise,
#       §Usare percentili, non medie.
#       wiki/syntheses/task-analytics-estimation-methods.md
#       §Metodo 1 — Reference-class forecasting (outside view).
# ADR-025 §A — Reference Class Sufficiency Policy: soglie N→confidence
#           (N>=30 high / 10-29 medium / 1-9 low / 0 very_low) configurabili
#           via analytics.estimation.rcf_{low,medium,high}_confidence_threshold.
# ADR-025 §B — similarity factor: downgrade del bucket calcolato da N
#           (high=0 / medium=-1 / low=-2 livelli; floor very_low).
# ADR-025 §C — mapping confidence → mode_recommended (high→rcf, medium→hybrid,
#           low→pert, very_low→pert).
# ADR-025 §D — fallback N=0: very_low + PERT-only + warning esplicito (R.P3).
# ADR-021 — `<<task_event_store>>`: sorgente dati via analyze_timeline reader.
#
# INVARIANTE «percentili, non medie»: la distribuzione emessa usa p10/p50/p85/
# p90/p95; nessun campo `mean`/`average`/`media` compare nell'output.
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --filter '<JSON>'     filtro reference class (default {}). Shape:
#                         {task_type?, layer?, project_id?, period?:{from,to},
#                          similarity_score_min?: 0..1}. Passato verbatim a
#                         analyze_timeline (le chiavi extra sono ignorate dal
#                         reader, ma conservate nell'output `filter`).
#   --similarity <lvl>    high | medium | low (default: medium = conservativo,
#                         ADR-025 §B punto 3 "safe by default").
#   --config <path>       default "factory.config.yaml".
#
# CONTRATTO OUTPUT (stdout, JSON puro) — schema US-041 / ADR-025:
#   { filter, N, period_covered{from,to}, distribution{ duration_days{p10..p95},
#     cost_total{p10..p95}, split_human_pct_p50, split_agent_pct_p50 },
#     confidence, mode_recommended,
#     [warnings[]]  (solo N=0, ADR-025 §D) }
#
# STDERR
#   log human-readable; fail-loud su errore o prerequisito mancante.
#
# EXIT CODES
#   0  reference class prodotta OR no-op (analytics.estimation.enabled assente/
#      false, R.P3)
#   >0 errore: EP-009 non attiva (ADR-025 §D fail-loud), prerequisito mancante,
#      filtro invalido, similarity invalida, soglie mis-configurate.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Risoluzione root del repo (lo script è invocabile da qualunque cwd)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .claude/tools/analytics/ → repo root è 3 livelli sopra.
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ANALYZE_TIMELINE="$SCRIPT_DIR/analyze-timeline.sh"

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
FILTER="{}"
SIMILARITY="medium"
CONFIG="factory.config.yaml"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --filter)
      FILTER="${2:-}"; [[ -z "$FILTER" ]] && FILTER="{}"; shift 2 ;;
    --similarity)
      SIMILARITY="${2:-}"; shift 2 ;;
    --config)
      CONFIG="${2:-factory.config.yaml}"; shift 2 ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'. Uso: build-reference-class.sh [--filter '<JSON>'] [--similarity high|medium|low] [--config <path>]" >&2
      printf '{"status":"error","error":"unknown argument: %s"}\n' "$1"
      exit 1 ;;
  esac
done

# Normalizza CONFIG a path assoluto (relativo → rispetto al repo root).
if [[ "$CONFIG" != /* ]]; then
  CONFIG="$REPO_ROOT/$CONFIG"
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "Tool build_reference_class richiede 'jq' per il parsing/aggregazione JSON. Installare jq (brew install jq / apt-get install jq)." >&2
  printf '{"status":"error","error":"missing prerequisite: jq"}\n'
  exit 1
fi

if [[ ! -x "$ANALYZE_TIMELINE" ]]; then
  echo "ERRORE: analyze-timeline.sh non trovato o non eseguibile ($ANALYZE_TIMELINE). build_reference_class lo invoca internamente (US-041, EP-009/US-035)." >&2
  printf '{"status":"error","error":"analyze-timeline.sh not executable"}\n'
  exit 1
fi

# Valida che --filter sia JSON well-formed (fail-loud).
if ! printf '%s' "$FILTER" | jq -e . >/dev/null 2>&1; then
  echo "ERRORE: --filter non è JSON valido: '$FILTER'." >&2
  printf '{"status":"error","error":"invalid --filter JSON"}\n'
  exit 1
fi

# Valida --similarity (ADR-025 §B).
case "$SIMILARITY" in
  high|medium|low) : ;;
  *)
    echo "ERRORE: --similarity '$SIMILARITY' non valido (ammessi: high|medium|low). Default = medium (ADR-025 §B 'safe by default')." >&2
    printf '{"status":"error","error":"invalid --similarity: %s"}\n' "$SIMILARITY"
    exit 1 ;;
esac

# ---------------------------------------------------------------------------
# 3. Lettura config — helper minimale (no yq), analogo a analyze-timeline.sh.
#    Legge sotto-chiave scalare di un blocco annidato analytics.<section>.
# ---------------------------------------------------------------------------
yaml_nested_value() {
  # $1 = section sotto analytics: ; $2 = key sotto la section ; $3 = file
  local section="$1" key="$2" file="$3"
  [[ -f "$file" ]] || return 0
  awk -v sect="$section" -v want="$key" '
    function indent(s,   n){ n=0; while (substr(s,n+1,1)==" ") n++; return n }
    {
      raw=$0
      sub(/[[:space:]]+#.*$/, "", raw)
      ind=indent(raw)
      line=raw; gsub(/^[[:space:]]+/, "", line); gsub(/[[:space:]]+$/, "", line)
      if (line=="") next
      if (line ~ /^analytics:/)    { in_a=1; a_ind=ind; in_s=0; next }
      if (in_a && ind<=a_ind && line !~ /^analytics:/) { in_a=0; in_s=0 }
      if (in_a && line ~ ("^" sect ":")) { in_s=1; s_ind=ind; next }
      if (in_s && ind<=s_ind) { in_s=0 }
      if (in_s && line ~ ("^" want ":")) {
        v=line; sub(("^" want ":[[:space:]]*"), "", v)
        gsub(/^["'"'"']|["'"'"']$/, "", v)
        print v; exit
      }
    }
  ' "$file"
}

# ---------------------------------------------------------------------------
# 4. Master switch EP-010 — no-op se la capability previsionale è spenta.
#    R.P3: backward-compat totale a analytics.estimation.enabled assente/false.
# ---------------------------------------------------------------------------
EST_ENABLED="$(yaml_nested_value "estimation" "enabled" "$CONFIG")"
if [[ "$EST_ENABLED" != "true" ]]; then
  echo "build_reference_class: analytics.estimation.enabled non è true (no-op, R.P3)." >&2
  exit 0
fi

# ---------------------------------------------------------------------------
# 5. Fail-loud su EP-009 non attiva (ADR-025 §D + US-041 §Business Rules).
#    build_reference_class consuma analyze_timeline, che richiede l'event store
#    di EP-009. Senza misurazione attiva, NON degrada silenziosamente.
# ---------------------------------------------------------------------------
MEAS_ENABLED="$(yaml_nested_value "measurement" "enabled" "$CONFIG")"
if [[ "$MEAS_ENABLED" != "true" ]]; then
  echo "EP-009 (measurement) richiesta per build_reference_class. Attivare \`analytics.measurement.enabled: true\` o usare run_pert standalone." >&2
  printf '{"status":"error","error":"EP-009 measurement not enabled"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 6. Soglie sufficiency policy — da config, con default ADR-025 §A.
#    Validation: 1 <= rcf_low < rcf_medium < rcf_high (fail-loud su mis-config,
#    ADR-025 §A "Validation" + Rationale punto 13 fast-fail).
# ---------------------------------------------------------------------------
RCF_LOW="$(yaml_nested_value "estimation" "rcf_low_confidence_threshold" "$CONFIG")"
RCF_MEDIUM="$(yaml_nested_value "estimation" "rcf_medium_confidence_threshold" "$CONFIG")"
RCF_HIGH="$(yaml_nested_value "estimation" "rcf_high_confidence_threshold" "$CONFIG")"
[[ -z "$RCF_LOW" ]]    && RCF_LOW="1"
[[ -z "$RCF_MEDIUM" ]] && RCF_MEDIUM="10"
[[ -z "$RCF_HIGH" ]]   && RCF_HIGH="30"

if ! [[ "$RCF_LOW" =~ ^[0-9]+$ && "$RCF_MEDIUM" =~ ^[0-9]+$ && "$RCF_HIGH" =~ ^[0-9]+$ ]]; then
  echo "ERRORE: soglie rcf_*_confidence_threshold devono essere interi (trovati: low=$RCF_LOW medium=$RCF_MEDIUM high=$RCF_HIGH). Vedi ADR-025 §A." >&2
  printf '{"status":"error","error":"non-integer rcf thresholds"}\n'
  exit 1
fi
if ! (( RCF_LOW >= 1 && RCF_LOW < RCF_MEDIUM && RCF_MEDIUM < RCF_HIGH )); then
  echo "ERRORE: soglie sufficiency mis-configurate. Richiesto 1 <= rcf_low < rcf_medium < rcf_high (trovati: low=$RCF_LOW medium=$RCF_MEDIUM high=$RCF_HIGH). Vedi ADR-025 §A 'Validation'." >&2
  printf '{"status":"error","error":"invalid rcf threshold ordering"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 7. Invoca analyze_timeline internamente con --filter passato.
#    analyze_timeline è il reader agnostico dello store (jsonl|sqlite): ne
#    consumiamo n_samples (= N della reference class), il sub-schema time
#    (per la distribuzione di durata) e operational.split_* per lo split.
#    NB: analyze_timeline a sua volta no-op/fail-loud secondo EP-009; qui EP-009
#    è già verificata attiva (§5), quindi un output vuoto = N=0 legittimo.
# ---------------------------------------------------------------------------
TIMELINE_JSON="$("$ANALYZE_TIMELINE" --filter "$FILTER" --config "$CONFIG" 2>/dev/null || true)"

# Se analyze_timeline non ha prodotto JSON (store assente → no-op stdout vuoto),
# trattiamo come reference class vuota (N=0), non come errore (ADR-025 §D).
if [[ -z "$TIMELINE_JSON" ]] || ! printf '%s' "$TIMELINE_JSON" | jq -e . >/dev/null 2>&1; then
  TIMELINE_JSON='{"n_samples":0,"lead":{},"operational":{}}'
fi

# Propaga un eventuale errore strutturato di analyze_timeline (fail-loud).
TL_STATUS="$(printf '%s' "$TIMELINE_JSON" | jq -r '.status // empty' 2>/dev/null || true)"
if [[ "$TL_STATUS" == "error" ]]; then
  echo "ERRORE: analyze_timeline ha riportato un errore durante il sampling della reference class:" >&2
  printf '%s' "$TIMELINE_JSON" | jq -r '.error // "unknown"' >&2
  printf '%s\n' "$TIMELINE_JSON"
  exit 1
fi

# ---------------------------------------------------------------------------
# 8. Estrai N, distribuzione, period e assembla l'output arricchito dalla
#    Sufficiency Policy. Tutto in un solo programma jq deterministico.
#    Mapping N→bucket (ADR-025 §A), downgrade similarity (§B), mode (§C/§D).
#    INVARIANTE: nessun campo mean/average; la distribuzione usa percentili.
# ---------------------------------------------------------------------------
OUTPUT="$(printf '%s' "$TIMELINE_JSON" | jq \
  --argjson filter "$FILTER" \
  --arg similarity "$SIMILARITY" \
  --argjson rcf_low "$RCF_LOW" \
  --argjson rcf_medium "$RCF_MEDIUM" \
  --argjson rcf_high "$RCF_HIGH" '

  def round2: (. * 100 | round) / 100;

  # ---- Bucket-by-N (ADR-025 §A). Enum index: 0=very_low .. 3=high. ----
  def bucket_index($N):
    if   $N >= $rcf_high   then 3        # high
    elif $N >= $rcf_medium then 2        # medium
    elif $N >= $rcf_low    then 1        # low
    else 0 end;                          # very_low (incl. N==0 e 1<=N<rcf_low edge)

  # ---- Downgrade per similarity (ADR-025 §B): livelli verso il basso. ----
  # high = 0 (mantieni), medium = -1, low = -2. Floor = 0 (very_low).
  def similarity_downgrade($s):
    if   $s == "high"   then 0
    elif $s == "medium" then 1
    else 2 end;                          # low

  def idx_to_confidence($i):
    if   $i >= 3 then "high"
    elif $i == 2 then "medium"
    elif $i == 1 then "low"
    else "very_low" end;

  # ---- Mode raccomandato per confidence (ADR-025 §C/§D). ----
  def mode_for($conf):
    if   $conf == "high"   then "rcf"
    elif $conf == "medium" then "hybrid"
    else "pert" end;                     # low + very_low → PERT primario

  # ---- Sorgente: output di analyze_timeline. ----
  . as $tl
  | ($tl.n_samples // 0) as $N
  | $tl.lead   as $lead
  | $tl.cycle  as $cycle
  | ($tl.operational // {}) as $op

  # Confidence finale = downgrade(bucket_by_N, similarity).
  | bucket_index($N) as $b
  | ($b - similarity_downgrade($similarity)) as $i_raw
  | (if $i_raw < 0 then 0 else $i_raw end) as $i
  | idx_to_confidence($i) as $confidence
  | mode_for($confidence) as $mode

  # Distribuzione durata: deriva da lead time (calendario) di analyze_timeline.
  # p90 non è emesso da analyze_timeline → interpola conservativo tra p85 e p95.
  | ( ($lead.p10 // null) ) as $d10
  | ( ($lead.p50 // null) ) as $d50
  | ( ($lead.p85 // null) ) as $d85
  | ( ($lead.p95 // null) ) as $d95
  | ( if ($d85 != null and $d95 != null)
        then (( ($d85 + $d95) / 2 ) | round2)
        else null end ) as $d90

  | {
      filter: $filter,
      N: $N,
      period_covered: {
        from: ($op.period_from // null),
        to:   ($op.period_to // null)
      },
      distribution: {
        duration_days: {
          p10: $d10, p50: $d50, p85: $d85, p90: $d90, p95: $d95
        },
        cost_total: {
          p10: null, p50: null, p85: null, p90: null, p95: null
        },
        split_human_pct_p50: ($op.split_human_pct // null),
        split_agent_pct_p50: ($op.split_agent_pct // null)
      },
      similarity: $similarity,
      confidence: $confidence,
      mode_recommended: $mode,
      thresholds: { rcf_low: $rcf_low, rcf_medium: $rcf_medium, rcf_high: $rcf_high }
    }

  # ---- Fallback N=0 (ADR-025 §D): very_low + PERT-only + warning. ----
  | if $N == 0 then
      . + {
        warnings: [
          "Nessun dato storico disponibile (N=0): reference class vuota. Stima possibile solo PERT-only basata su elicitation. Bias di ottimismo non mitigato (Kahneman/Flyvbjerg). Calibrare contingency al rialzo (raccomandato >=30%). Vedi ADR-025 §D."
        ]
      }
    else . end
')"

if [[ -z "$OUTPUT" ]]; then
  echo "ERRORE: costruzione reference class fallita (jq). Verifica l'output di analyze_timeline (ADR-024 §C)." >&2
  printf '{"status":"error","error":"reference class computation failed"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 9. Emissione output finale (JSON puro su stdout).
#    N=0 emette anche warnings[] (ADR-025 §D) + warning su stderr (R.P3).
# ---------------------------------------------------------------------------
N_FINAL="$(printf '%s' "$OUTPUT" | jq -r '.N')"
if [[ "$N_FINAL" == "0" ]]; then
  echo "WARNING build_reference_class: reference class vuota (N=0) per il filtro dato. confidence=very_low, mode_recommended=pert (PERT-only). Vedi ADR-025 §D." >&2
fi

printf '%s\n' "$OUTPUT"
exit 0
