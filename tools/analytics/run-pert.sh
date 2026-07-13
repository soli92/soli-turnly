#!/usr/bin/env bash
# =============================================================================
# run-pert.sh — tool deterministico run_pert (EP-010, US-041, TSK-072)
# =============================================================================
#
# Parte della capability Task Analytics & Cost/Time Estimation (EP-010, faccia
# previsionale), istanza del pattern [[thin-agents-fat-skills-refactor]]: questo è il TOOL
# (logica deterministica, no LLM). Implementa il Metodo 2 — PERT three-point
# estimation. Il tool NON ragiona sulla metodologia (quale metodo applicare, quale
# similarity, quale contingency): quella scelta è scope della skill `project-estimation`
# (US-040) e dell'agente `estimation-analyst` (US-043). Questo tool riceve voci O/M/P
# ed emette attesa + varianza + std + percentili approssimati. JSON puro su stdout.
#
# PATTERN.md §3 — operazione canonica opzionale «Project Estimation» / «PERT».
# Wiki: wiki/concepts/task-analytics-cost-estimation-capability.md
#       [[task-analytics-cost-estimation-capability]] §Stima enterprise (faccia previsionale).
#       wiki/syntheses/task-analytics-estimation-methods.md §Metodo 2 — PERT three-point.
# ADR-025 §E — PERT scope ingestion: esplicito (default) + `--from-kanban` opt-in.
#           §E punto 5: formula PERT verbatim attesa=(O+4M+P)/6, varianza=((P-O)/6)^2.
# ADR-026 — runtime Monte Carlo separato (run-monte-carlo.py); qui solo i percentili
#           approssimati da distribuzione normale (rinvio a Monte Carlo per precisione).
#
# INVARIANTE «mai numero puntuale» (PATTERN §3, ADR-024/025): ogni stima è un intervallo.
#   Anche con una sola voce a std=0 il totale espone p50/p85/p95 (eventualmente uguali).
#   Il tool NON emette MAI un campo `mean`/`average`/`media` come valore primario:
#   `expected` è l'attesa PERT (media pesata three-point), accompagnata SEMPRE da std e
#   percentili — mai presentata come stima puntuale.
#
# FORMULE VERBATIM (synthesis §Metodo 2 / ADR-025 §E punto 5):
#   attesa   = (O + 4M + P) / 6
#   varianza = ((P - O) / 6)^2
#   std      = sqrt(varianza) = |P - O| / 6
# Aggregazione progetto (somma di voci indipendenti):
#   attesa_totale   = Σ attesa_i
#   varianza_totale = Σ varianza_i
#   std_totale      = sqrt(varianza_totale)
# Percentili approssimati (distribuzione normale del totale, teorema del limite centrale):
#   p50 ≈ attesa_totale
#   p85 ≈ attesa_totale + 1.04  * std_totale
#   p95 ≈ attesa_totale + 1.645 * std_totale
#
# LIMITE DOCUMENTATO (concept §Limiti): il tool NON somma ore-persona come tempo di
#   calendario. Se le voci sono in `unit: hours`, l'output resta in ore ed espone la
#   nota "Effort, non calendar time". La conversione effort→calendario è scope umano.
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --voices '<JSON>'      lista JSON delle voci. Shape per voce:
#                          {name, O: float, M: float, P: float, unit?: "days"|"hours"}.
#                          `unit` opzionale per voce; default = --unit globale (days).
#   --unit <days|hours>    unit di default per le voci senza campo `unit` (default days).
#   --config <path>        default "factory.config.yaml" (ADR-023 §A contract).
#
#   NB: `--from-kanban=<EP-id>` (ADR-025 §E modalità 2) è auto-decomposizione data-driven
#       che richiede l'event store EP-009 e la skill US-040 per derivare O/M/P dai
#       percentili della reference class: NON è scope di questo tool numerico (R: i tool
#       non ragionano sulla metodologia). La skill `project-estimation` deriva O/M/P e poi
#       invoca questo tool in modalità esplicita `--voices`. Vedi ADR-025 §E + US-040.
#
# CONTRATTO OUTPUT (stdout, JSON puro) — schema US-041 §Tool run_pert / TSK-072:
#   {
#     "voices": [{ "name", "expected", "variance", "std", "unit" }],
#     "total": {
#       "expected", "std", "variance",
#       "p50_approx", "p85_approx", "p95_approx",
#       "unit",
#       "approximation_note"
#     }
#   }
#   Se unit == hours, total.effort_note = "Effort, non calendar time".
#
# STDERR
#   log human-readable (fail-loud su errore; quiet su success).
#
# EXIT CODES
#   0  stima prodotta OR no-op (analytics.estimation.enabled assente/false, R.P3)
#   >0 errore (prerequisito mancante, voices invalido/mancante, O/M/P non numerici,
#      vincolo O<=M<=P violato)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Risoluzione root del repo (lo script è invocabile da qualunque cwd)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .claude/tools/analytics/ → repo root è 3 livelli sopra.
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
VOICES=""
UNIT="days"
CONFIG="factory.config.yaml"

usage() {
  echo "Uso: run-pert.sh --voices '<JSON>' [--unit days|hours] [--config <path>]" >&2
  echo "  voice shape: {\"name\":\"...\",\"O\":2,\"M\":4,\"P\":8,\"unit\":\"days\"}" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --voices)
      VOICES="${2:-}"; shift 2 ;;
    --voices=*)
      VOICES="${1#--voices=}"; shift ;;
    --unit)
      UNIT="${2:-days}"; shift 2 ;;
    --unit=*)
      UNIT="${1#--unit=}"; shift ;;
    --config)
      CONFIG="${2:-factory.config.yaml}"; shift 2 ;;
    --config=*)
      CONFIG="${1#--config=}"; shift ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'." >&2; usage
      printf '{"status":"error","error":"unknown argument: %s"}\n' "$1"
      exit 1 ;;
  esac
done

# Normalizza CONFIG a path assoluto (relativo → rispetto al repo root).
if [[ "$CONFIG" != /* ]]; then
  CONFIG="$REPO_ROOT/$CONFIG"
fi

# Valida --unit (days|hours).
if [[ "$UNIT" != "days" && "$UNIT" != "hours" ]]; then
  echo "ERRORE: --unit deve essere 'days' o 'hours' (trovato: '$UNIT')." >&2
  printf '{"status":"error","error":"invalid --unit: %s"}\n' "$UNIT"
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud (ADR-023 §A contract)
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "Tool run_pert richiede 'jq' per il parsing/calcolo JSON. Installare jq (brew install jq / apt-get install jq)." >&2
  printf '{"status":"error","error":"missing prerequisite: jq"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Helper YAML — estrae valori da analytics.estimation.<key> (no yq, no deps).
#    Stesso pattern dell'helper di analyze-timeline.sh / compute-agentic-cost.sh,
#    ma sul blocco `estimation` (faccia previsionale EP-010) invece di `measurement`.
# ---------------------------------------------------------------------------
yaml_estimation_value() {
  # $1 = key sotto analytics.estimation ; $2 = file
  local key="$1" file="$2"
  [[ -f "$file" ]] || return 0
  awk -v want="$key" '
    function indent(s,   n){ n=0; while (substr(s,n+1,1)==" ") n++; return n }
    {
      raw=$0
      sub(/[[:space:]]+#.*$/, "", raw)
      ind=indent(raw)
      line=raw; gsub(/^[[:space:]]+/, "", line); gsub(/[[:space:]]+$/, "", line)
      if (line=="") next
      if (line ~ /^analytics:/)    { in_a=1; a_ind=ind; in_e=0; next }
      if (in_a && ind<=a_ind && line !~ /^analytics:/) { in_a=0; in_e=0 }
      if (in_a && line ~ /^estimation:/) { in_e=1; e_ind=ind; next }
      if (in_e && ind<=e_ind) { in_e=0 }
      if (in_e && line ~ ("^" want ":")) {
        v=line; sub(("^" want ":[[:space:]]*"), "", v)
        gsub(/^["'"'"']|["'"'"']$/, "", v)
        print v; exit
      }
    }
  ' "$file"
}

# ---------------------------------------------------------------------------
# 4. Master switch — no-op se la capability è spenta (R.P3, ADR-025 §G).
#    Assenza del file/blocco => disabilitato => exit 0 silenzioso, 0 output JSON.
#    Backward-compat totale: factory v2.17- senza il blocco estimation = no-op.
# ---------------------------------------------------------------------------
ENABLED="$(yaml_estimation_value "enabled" "$CONFIG")"
if [[ "$ENABLED" != "true" ]]; then
  echo "run_pert: analytics.estimation.enabled non è true (no-op, R.P3)." >&2
  exit 0
fi

# ---------------------------------------------------------------------------
# 5. Validazione input voices — fail-loud (R.P3: input mancante => fail-loud,
#    NON output fittizio). La capability è attiva ma manca lo scope.
# ---------------------------------------------------------------------------
if [[ -z "$VOICES" ]]; then
  echo "ERRORE: --voices mancante. run_pert richiede una lista di voci O/M/P. Vedi US-041 §Tool run_pert." >&2
  usage
  printf '{"status":"error","error":"missing --voices"}\n'
  exit 1
fi

# --voices deve essere JSON well-formed.
if ! printf '%s' "$VOICES" | jq -e . >/dev/null 2>&1; then
  echo "ERRORE: --voices non è JSON valido: '$VOICES'." >&2
  printf '{"status":"error","error":"invalid --voices JSON"}\n'
  exit 1
fi

# Deve essere un array non vuoto.
if ! printf '%s' "$VOICES" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
  echo "ERRORE: --voices deve essere un array JSON non vuoto di voci {name,O,M,P}." >&2
  printf '{"status":"error","error":"voices must be a non-empty array"}\n'
  exit 1
fi

# Ogni voce deve avere O/M/P numerici. Fail-loud con indice della voce offendente.
VALIDATION="$(printf '%s' "$VOICES" | jq -r '
  to_entries
  | map(
      .key as $i | .value as $v
      | if ($v.O == null or ($v.O | type) != "number"
            or $v.M == null or ($v.M | type) != "number"
            or $v.P == null or ($v.P | type) != "number")
        then "ERR_NUMERIC:\($i)"
        elif ($v.O > $v.M or $v.M > $v.P)
        then "ERR_ORDER:\($i):O=\($v.O),M=\($v.M),P=\($v.P)"
        else empty
        end
    )
  | first // "OK"
')"

case "$VALIDATION" in
  OK) : ;;
  ERR_NUMERIC:*)
    idx="${VALIDATION#ERR_NUMERIC:}"
    echo "ERRORE: voce all'indice $idx ha O/M/P mancanti o non numerici. Ogni voce richiede O,M,P come numeri. Vedi US-041 §Tool run_pert." >&2
    printf '{"status":"error","error":"voice %s has non-numeric or missing O/M/P"}\n' "$idx"
    exit 1 ;;
  ERR_ORDER:*)
    rest="${VALIDATION#ERR_ORDER:}"
    idx="${rest%%:*}"; vals="${rest#*:}"
    echo "ERRORE: voce all'indice $idx viola il vincolo O<=M<=P ($vals). PERT richiede ottimistico<=probabile<=pessimistico." >&2
    printf '{"status":"error","error":"voice %s violates O<=M<=P: %s"}\n' "$idx" "$vals"
    exit 1 ;;
  *)
    echo "ERRORE: validazione voices fallita (output inatteso: $VALIDATION)." >&2
    printf '{"status":"error","error":"voices validation failed"}\n'
    exit 1 ;;
esac

# ---------------------------------------------------------------------------
# 6. Calcolo PERT — formule verbatim in un unico programma jq deterministico.
#    Per ogni voce: expected=(O+4M+P)/6, variance=((P-O)/6)^2, std=sqrt(variance).
#    Totale: somma attese + somma varianze → std_totale=sqrt(varianza_totale).
#    Percentili dal totale assumendo normalità (z85=1.04, z95=1.645).
#    `unit` per voce: campo della voce se presente, altrimenti --unit globale.
#    Determinismo: stesse voci → stesso output (no randomness, no media a coda).
# ---------------------------------------------------------------------------
RESULT="$(printf '%s' "$VOICES" | jq \
  --arg default_unit "$UNIT" '

  # Arrotondamenti deterministici (no falsa precisione).
  def round2: (. * 100 | round) / 100;
  def round4: (. * 10000 | round) / 10000;

  # Percentili z-score normale standard (one-sided, upper tail).
  1.04  as $z85
  | 1.645 as $z95

  | ([ .[]
       | (.O) as $O | (.M) as $M | (.P) as $P
       | ((.unit // $default_unit)) as $u
       | (($O + 4*$M + $P) / 6) as $expected
       | (((($P - $O) / 6)) | (. * .)) as $variance
       | ($variance | sqrt) as $std
       | {
           name: (.name // "(unnamed)"),
           expected: ($expected | round2),
           variance: ($variance | round4),
           std: ($std | round2),
           unit: $u
         }
     ]) as $voices

  # Aggregazione progetto: somma attese + somma varianze (voci indipendenti).
  | ([ $voices[] | .expected ] | add) as $sum_expected_rounded
  | ([ $voices[] | .variance ] | add) as $sum_variance_rounded
  | ($sum_variance_rounded | sqrt) as $std_total

  # unit del totale: coerente solo se tutte le voci condividono l unit.
  | ([ $voices[] | .unit ] | unique) as $units
  | (if ($units | length) == 1 then $units[0] else "mixed" end) as $total_unit

  | {
      voices: $voices,
      total: ({
        expected:  ($sum_expected_rounded | round2),
        variance:  ($sum_variance_rounded | round4),
        std:       ($std_total | round2),
        p50_approx: ($sum_expected_rounded | round2),
        p85_approx: (($sum_expected_rounded + $z85 * $std_total) | round2),
        p95_approx: (($sum_expected_rounded + $z95 * $std_total) | round2),
        unit: $total_unit,
        approximation_note: "Percentili derivati da media + std assumendo distribuzione normale (z85=1.04, z95=1.645); per stima rigorosa usare Monte Carlo su questi parametri (run-monte-carlo.py, TSK-073 / ADR-026)."
      }
      # Limite documentato (concept §Limiti): ore-persona != calendario.
      + (if $total_unit == "hours"
           then { effort_note: "Effort, non calendar time. La conversione effort→calendario (capacità team, parallelismo) è scope umano, non del tool." }
           else {} end)
      + (if $total_unit == "mixed"
           then { unit_warning: "Voci con unit eterogenee (days/hours): il totale aggrega quantità non omogenee. Normalizzare lo scope a una sola unit prima di sommare." }
           else {} end))
    }
')"

if [[ -z "$RESULT" ]]; then
  echo "ERRORE: calcolo PERT fallito (jq). Verifica lo schema delle voci (US-041 §Tool run_pert)." >&2
  printf '{"status":"error","error":"pert computation failed"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 7. Emissione output finale — JSON puro su stdout.
#    Invariante «mai numero puntuale»: l'output espone sempre p50/p85/p95; con
#    una sola voce a std=0 i tre percentili coincidono (distribuzione collassata),
#    ma restano tre campi distinti (la skill US-040 marca confidence: very_low).
# ---------------------------------------------------------------------------
N_VOICES="$(printf '%s' "$VOICES" | jq -r 'length')"
echo "run_pert: $N_VOICES voci processate (unit default: $UNIT)." >&2

printf '%s\n' "$RESULT"
exit 0
