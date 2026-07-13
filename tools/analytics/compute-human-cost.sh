#!/usr/bin/env bash
# =============================================================================
# compute-human-cost.sh — tool deterministico compute_human_cost (EP-009, US-034, TSK-062)
# =============================================================================
#
# Parte della capability Task Analytics & Cost/Time Estimation (EP-009), istanza
# del pattern [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica deterministica,
# no LLM). È un READER agnostico del side-channel `analytics/events/` (scritto
# single-source da record_task_event, US-033) + un READER della rate card
# versionata `analytics/rates.yaml`. Il tool NON ragiona: filtra gli eventi
# `actor_type: human`, risolve `actor_id → role_id`, applica la formula del costo
# umano verbatim, fa enforcement della privacy N>=5 ed emette JSON puro.
# L'interpretazione narrativa è scope della skill (US-036), mai di questo tool.
#
# PATTERN.md §3 — operazione canonica opzionale «Cost Computation» (Human Cost),
#   con le DUE invarianti operative della capability:
#     - aggregazione minima N>=5 sui dati personali (ADR-023 §C).
#     - rate_basis esplicito in ogni output che usa la rate card (ADR-023 §E).
# Wiki: wiki/concepts/task-analytics-cost-estimation-capability.md
#       [[task-analytics-cost-estimation-capability]] §Costo umano §Limiti.
#
# FORMULA verbatim (concept §2.2):
#       costo_umano(task) = ore_sforzo · tariffa_ruolo      # da <<rate_card>>
#   ore_sforzo: da `effort_hours` (frontmatter TSK / extras evento, override
#       esplicito) oppure auto-derivato da ts(finished) - ts(started).
#   tariffa_ruolo: da analytics/rates.yaml, selezionata per `valid_from` valido
#       al timestamp dell'effort. MAI hardcodata nel codice.
#
# ADR-022 — schema `<<rate_card>>` (analytics/rates.yaml): YAML versionato git con
#   `valid_from` semi-aperto a destra (§E), canonical role `id` + `aliases:` (§C),
#   `rate_basis` a livello file obbligatorio (§C), resolution role/valid_from (§D).
# ADR-023 — registrazione tool analytics in `.claude/tools/analytics/*` (no MCP),
#   contract minimo: --config opzionale, stdout=JSON / stderr=log, exit code
#   semantico, stateless (§A). Policy dati `<<policy_dati>>`:
#     §C — aggregazione minima N>=5: report `executive`/`project` con N < soglia
#          distinct actor_id ⇒ `per_actor` OMESSO (mai costo individuale esposto),
#          sostituito da aggregazione per ruolo + nota di soppressione.
#     §D — `actor_id → role_id` via cascade: analytics/actors.yaml (gitignored
#          opt-in) → factory.config.yaml.analytics.measurement.actors_map →
#          fallback `role: unknown` + warning (no fail-loud, evento recuperabile).
#     §E — `rate_basis` esplicito + fail-loud su mismatch config vs file.
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --task-id <id>        analizza un singolo task (mutuamente escl. con --filter).
#   --filter '<JSON>'     filtro su event store, default {} (aggregato globale).
#                         Shape: {project_id?, task_type?, period?:{from,to}}.
#   --rates <path>        rate card, default analytics/rates.yaml (o
#                         analytics.measurement.rate_card_path da config).
#   --audience <lvl>      executive | project | operativa (default operativa).
#                         Governa il mascheramento privacy N>=5 (ADR-023 §C).
#   --rate-as-of <date>   what-if: forza la resolution valid_from a una data
#                         ISO-8601 specifica (proiezione esplicita, ADR-022 §F).
#   --config <path>       default "factory.config.yaml" (ADR-023 §A).
#
# CONTRATTO OUTPUT (stdout, JSON puro) — schema US-034 / ADR-023 §E:
#   {
#     "cost": <float>, "currency": "EUR",
#     "rate_basis": "fully-loaded|bill-rate",          // se cost > 0
#     "breakdown": {
#       "per_role":  {"<role_id>": <float>, ...},
#       "per_actor": {"<actor_id>": <float>, ...}       // OMESSO se N < soglia
#     },
#     "events_considered": <int>,
#     "rate_card_version": "<git-hash|date>",
#     "notes": [ ... ]                                  // include nota privacy se soppresso
#   }
#
# STDERR
#   log human-readable (warning non bloccanti; fail-loud su errore).
#
# EXIT CODES
#   0  costo calcolato OR no-op (analytics.measurement.enabled assente/false, R.P3)
#   >0 errore (prerequisito mancante, rates assente/illeggibile a capability ON,
#      mismatch rate_basis, filtro/argomenti invalidi).
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
TASK_ID=""
FILTER="{}"
RATES=""
AUDIENCE="operativa"
RATE_AS_OF=""
CONFIG="factory.config.yaml"

usage() {
  echo "Uso: compute-human-cost.sh [--task-id <id> | --filter '<JSON>'] [--rates <path>] [--audience executive|project|operativa] [--rate-as-of <ISO-date>] [--config <path>]" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task-id)
      TASK_ID="${2:-}"; shift 2 ;;
    --filter)
      FILTER="${2:-}"; [[ -z "$FILTER" ]] && FILTER="{}"; shift 2 ;;
    --rates)
      RATES="${2:-}"; shift 2 ;;
    --audience)
      AUDIENCE="${2:-operativa}"; shift 2 ;;
    --rate-as-of)
      RATE_AS_OF="${2:-}"; shift 2 ;;
    --config)
      CONFIG="${2:-factory.config.yaml}"; shift 2 ;;
    *)
      usage
      printf '{"status":"error","error":"unknown argument: %s"}\n' "$1"
      exit 1 ;;
  esac
done

# --task-id e --filter sono mutuamente esclusivi.
if [[ -n "$TASK_ID" && "$FILTER" != "{}" ]]; then
  echo "ERRORE: --task-id e --filter sono mutuamente esclusivi." >&2
  printf '{"status":"error","error":"--task-id and --filter are mutually exclusive"}\n'
  exit 1
fi

# Audience ammessa (ADR-023 §C).
case "$AUDIENCE" in
  executive|project|operativa) : ;;
  *)
    echo "ERRORE: --audience '$AUDIENCE' non valido (ammessi: executive|project|operativa). Vedi ADR-023 §C." >&2
    printf '{"status":"error","error":"invalid --audience: %s"}\n' "$AUDIENCE"
    exit 1 ;;
esac

# Normalizza CONFIG a path assoluto (relativo → rispetto al repo root).
if [[ "$CONFIG" != /* ]]; then
  CONFIG="$REPO_ROOT/$CONFIG"
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud (ADR-023 §A contract)
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "Tool compute_human_cost richiede 'jq' per il parsing/aggregazione JSON. Installare jq (brew install jq / apt-get install jq)." >&2
  printf '{"status":"error","error":"missing prerequisite: jq"}\n'
  exit 1
fi

# Valida --filter JSON well-formed (fail-loud).
if ! printf '%s' "$FILTER" | jq -e . >/dev/null 2>&1; then
  echo "ERRORE: --filter non è JSON valido: '$FILTER'." >&2
  printf '{"status":"error","error":"invalid --filter JSON"}\n'
  exit 1
fi

# Valida --rate-as-of se presente (ISO-8601 date YYYY-MM-DD).
if [[ -n "$RATE_AS_OF" ]] && ! printf '%s' "$RATE_AS_OF" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "ERRORE: --rate-as-of '$RATE_AS_OF' non è una data ISO-8601 (YYYY-MM-DD)." >&2
  printf '{"status":"error","error":"invalid --rate-as-of: %s"}\n' "$RATE_AS_OF"
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Helper YAML minimale (no yq) — estrae uno scalare da analytics.measurement.<key>.
#    Stesso parser di record-event.sh / analyze-timeline.sh per coerenza esatta.
# ---------------------------------------------------------------------------
yaml_measurement_value() {
  # $1 = key sotto analytics.measurement ; $2 = file
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
      if (line ~ /^analytics:/)    { in_a=1; a_ind=ind; in_m=0; next }
      if (in_a && ind<=a_ind && line !~ /^analytics:/) { in_a=0; in_m=0 }
      if (in_a && line ~ /^measurement:/) { in_m=1; m_ind=ind; next }
      if (in_m && ind<=m_ind) { in_m=0 }
      if (in_m && line ~ ("^" want ":")) {
        v=line; sub(("^" want ":[[:space:]]*"), "", v)
        gsub(/^["'"'"']|["'"'"']$/, "", v)
        print v; exit
      }
    }
  ' "$file"
}

# ---------------------------------------------------------------------------
# 4. Master switch — no-op se la capability è spenta (R.P3, ADR-023 §I)
#    Assenza del file/blocco => disabilitato => exit 0 silenzioso, 0 file scritti.
# ---------------------------------------------------------------------------
ENABLED="$(yaml_measurement_value "enabled" "$CONFIG")"
if [[ "$ENABLED" != "true" ]]; then
  echo "compute_human_cost: analytics.measurement.enabled non è true (no-op, R.P3)." >&2
  exit 0
fi

# Config valori (con default ADR-021/022/023).
STORE="$(yaml_measurement_value "store" "$CONFIG")"
[[ -z "$STORE" ]] && STORE="jsonl"
if [[ "$STORE" != "jsonl" && "$STORE" != "sqlite" ]]; then
  echo "ERRORE: analytics.measurement.store deve essere 'jsonl' o 'sqlite' (trovato: '$STORE'). Vedi ADR-021 §C." >&2
  printf '{"status":"error","error":"invalid store: %s"}\n' "$STORE"
  exit 1
fi

# rate_card_path: --rates ha precedenza, poi config, poi default.
if [[ -z "$RATES" ]]; then
  RATES="$(yaml_measurement_value "rate_card_path" "$CONFIG")"
  [[ -z "$RATES" ]] && RATES="analytics/rates.yaml"
fi
if [[ "$RATES" != /* ]]; then
  RATES="$REPO_ROOT/$RATES"
fi

# min_aggregation_n: default 5 (GDPR-safe), floor 1 (ADR-023 §C).
MIN_N="$(yaml_measurement_value "min_aggregation_n" "$CONFIG")"
[[ -z "$MIN_N" ]] && MIN_N="5"
if ! printf '%s' "$MIN_N" | grep -Eq '^[0-9]+$' || [[ "$MIN_N" -lt 1 ]]; then
  echo "ERRORE: analytics.measurement.min_aggregation_n deve essere intero >= 1 (trovato: '$MIN_N'). Vedi ADR-023 §C." >&2
  printf '{"status":"error","error":"invalid min_aggregation_n: %s"}\n' "$MIN_N"
  exit 1
fi

# operational_show_actor_id: default false (safe, ADR-023 §C).
OP_SHOW="$(yaml_measurement_value "operational_show_actor_id" "$CONFIG")"
[[ -z "$OP_SHOW" ]] && OP_SHOW="false"

# rate_basis dichiarato in config (per validation cross-file, ADR-023 §E).
CFG_RATE_BASIS="$(yaml_measurement_value "rate_basis" "$CONFIG")"

# ---------------------------------------------------------------------------
# 5. Rate card — fail-loud se assente a capability ON (ADR-022 §G, R.P3).
#    NB: il no-op vive SOLO sul master switch (§4). Qui la capability è ON:
#    l'assenza della rate card è un errore azionabile, non un no-op.
# ---------------------------------------------------------------------------
REL_RATES="${RATES#"$REPO_ROOT"/}"
if [[ ! -f "$RATES" ]]; then
  echo "ERRORE: rate card '$REL_RATES' mancante ma analytics.measurement.enabled=true. Copia analytics/rates.yaml.template in analytics/rates.yaml e adatta. Vedi ADR-022 §B/§G." >&2
  printf '{"status":"error","error":"missing rate card: %s"}\n' "$REL_RATES"
  exit 1
fi
if [[ ! -r "$RATES" ]]; then
  echo "ERRORE: rate card '$REL_RATES' non leggibile." >&2
  printf '{"status":"error","error":"unreadable rate card: %s"}\n' "$REL_RATES"
  exit 1
fi

# 5.1 Parse rates.yaml → JSON (parser YAML minimale dedicato, no yq).
#     Estrae: currency, rate_basis (file-level), roles[] con id, aliases[], rates[].
RATES_JSON="$(awk '
  function trim(s){ gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
  function indent(s,   n){ n=0; while (substr(s,n+1,1)==" ") n++; return n }
  function strip_comment(s){ sub(/[[:space:]]+#.*$/, "", s); return s }
  function unq(s){ gsub(/^["'"'"']|["'"'"']$/, "", s); return s }
  BEGIN {
    currency="EUR"; rate_basis=""; nroles=0;
    state="top"; ri=0; in_aliases=0; in_rates=0; rk=0;
  }
  {
    raw=strip_comment($0)
    ind=indent(raw)
    line=trim(raw)
    if (line=="") next

    # Top-level scalars.
    if (ind==0 && line ~ /^currency:/)  { v=line; sub(/^currency:[[:space:]]*/,"",v); currency=unq(trim(v)); next }
    if (ind==0 && line ~ /^rate_basis:/){ v=line; sub(/^rate_basis:[[:space:]]*/,"",v); rate_basis=unq(trim(v)); next }
    if (ind==0 && line ~ /^roles:/)     { state="roles"; next }

    if (state!="roles") next

    # Nuova entry ruolo: "- id: <x>"
    if (line ~ /^-[[:space:]]*id:/) {
      ri=nroles; nroles++;
      v=line; sub(/^-[[:space:]]*id:[[:space:]]*/,"",v); role_id[ri]=unq(trim(v));
      role_disp[ri]=""; nalias[ri]=0; nrate[ri]=0;
      in_aliases=0; in_rates=0; cur_indent=ind;
      next
    }
    if (line ~ /^display_name:/) { v=line; sub(/^display_name:[[:space:]]*/,"",v); role_disp[ri]=unq(trim(v)); in_aliases=0; in_rates=0; next }
    if (line ~ /^aliases:/)      { in_aliases=1; in_rates=0; next }
    if (line ~ /^rates:/)        { in_rates=1; in_aliases=0; next }

    # Alias item: "- <name>"
    if (in_aliases && line ~ /^-[[:space:]]/) {
      v=line; sub(/^-[[:space:]]*/,"",v); alias_v[ri,nalias[ri]]=unq(trim(v)); nalias[ri]++; next
    }
    # Rate entry start: "- valid_from: <date>"
    if (in_rates && line ~ /^-[[:space:]]*valid_from:/) {
      rk=nrate[ri]; nrate[ri]++;
      v=line; sub(/^-[[:space:]]*valid_from:[[:space:]]*/,"",v); rate_vf[ri,rk]=unq(trim(v)); rate_hr[ri,rk]="";
      next
    }
    # Rate entry continuation: "hourly_rate: <num>"
    if (in_rates && line ~ /^hourly_rate:/) {
      v=line; sub(/^hourly_rate:[[:space:]]*/,"",v); rate_hr[ri,rk]=unq(trim(v)); next
    }
  }
  END {
    # Emette JSON via jq @json sui valori; qui costruiamo una struttura raw.
    printf "{"
    printf "\"currency\":\"%s\",", currency
    printf "\"rate_basis\":\"%s\",", rate_basis
    printf "\"roles\":["
    for (i=0;i<nroles;i++) {
      if (i>0) printf ","
      printf "{\"id\":\"%s\",\"display_name\":\"%s\",\"aliases\":[", role_id[i], role_disp[i]
      for (a=0;a<nalias[i];a++) { if(a>0)printf ","; printf "\"%s\"", alias_v[i,a] }
      printf "],\"rates\":["
      for (r=0;r<nrate[i];r++) { if(r>0)printf ","; printf "{\"valid_from\":\"%s\",\"hourly_rate\":%s}", rate_vf[i,r], (rate_hr[i,r]==""?"null":rate_hr[i,r]) }
      printf "]}"
    }
    printf "]}"
  }
' "$RATES")"

# Valida che il parse sia JSON ben formato (difensivo).
if ! printf '%s' "$RATES_JSON" | jq -e . >/dev/null 2>&1; then
  echo "ERRORE: parsing di '$REL_RATES' fallito (YAML non conforme allo schema ADR-022 §C)." >&2
  printf '{"status":"error","error":"failed to parse rate card"}\n'
  exit 1
fi

FILE_RATE_BASIS="$(printf '%s' "$RATES_JSON" | jq -r '.rate_basis // ""')"
CURRENCY="$(printf '%s' "$RATES_JSON" | jq -r '.currency // "EUR"')"

# 5.2 rate_basis a livello file OBBLIGATORIO (ADR-022 §C).
if [[ -z "$FILE_RATE_BASIS" || "$FILE_RATE_BASIS" == "null" ]]; then
  echo "ERRORE: '$REL_RATES' privo di 'rate_basis' a livello file (obbligatorio: fully-loaded|bill-rate). Vedi ADR-022 §C, ADR-023 §E." >&2
  printf '{"status":"error","error":"missing file-level rate_basis"}\n'
  exit 1
fi
if [[ "$FILE_RATE_BASIS" != "fully-loaded" && "$FILE_RATE_BASIS" != "bill-rate" ]]; then
  echo "ERRORE: rate_basis '$FILE_RATE_BASIS' non valido in '$REL_RATES' (ammessi: fully-loaded|bill-rate). Vedi ADR-022 §C." >&2
  printf '{"status":"error","error":"invalid rate_basis: %s"}\n' "$FILE_RATE_BASIS"
  exit 1
fi

# 5.3 Validation cross-file: config.rate_basis vs file.rate_basis (ADR-023 §E).
#     Fail-loud su mismatch (meglio errore rumoroso che report ambiguo).
if [[ -n "$CFG_RATE_BASIS" && "$CFG_RATE_BASIS" != "$FILE_RATE_BASIS" ]]; then
  echo "ERRORE: mismatch rate_basis — factory.config.yaml dichiara '$CFG_RATE_BASIS' ma '$REL_RATES' dichiara '$FILE_RATE_BASIS'. Allinea i due. Vedi ADR-023 §E." >&2
  printf '{"status":"error","error":"rate_basis mismatch: config=%s file=%s"}\n' "$CFG_RATE_BASIS" "$FILE_RATE_BASIS"
  exit 1
fi

# 5.4 rate_card_version: git hash del file se in repo git, altrimenti data del file.
RATE_CARD_VERSION="unknown"
if command -v git >/dev/null 2>&1 && git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  GH="$(git -C "$REPO_ROOT" log -1 --format=%h -- "$RATES" 2>/dev/null || true)"
  [[ -n "$GH" ]] && RATE_CARD_VERSION="$GH"
fi
if [[ "$RATE_CARD_VERSION" == "unknown" ]]; then
  # Fallback: mtime del file (YYYY-MM-DD), deterministico per audit.
  RATE_CARD_VERSION="$(date -u -r "$RATES" +%Y-%m-%d 2>/dev/null || echo "unknown")"
fi

# ---------------------------------------------------------------------------
# 6. actors_map — cascade analytics/actors.yaml → config.actors_map → unknown.
#    (ADR-023 §D). Produce un JSON object {actor_id: role_id}.
# ---------------------------------------------------------------------------
ACTORS_FILE="$REPO_ROOT/analytics/actors.yaml"
ACTORS_MAP="{}"

parse_actor_map_yaml() {
  # Estrae coppie "key: value" sotto la chiave 'actors:' (file actors.yaml) o
  # sotto 'actors_map:' annidato in analytics.measurement (factory.config.yaml).
  # $1 = file ; $2 = chiave contenitore ("actors" | "actors_map")
  local file="$1" container="$2"
  [[ -f "$file" ]] || return 0
  awk -v container="$container" '
    function trim(s){ gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
    function indent(s,   n){ n=0; while (substr(s,n+1,1)==" ") n++; return n }
    function strip_comment(s){ sub(/[[:space:]]+#.*$/, "", s); return s }
    function unq(s){ gsub(/^["'"'"']|["'"'"']$/, "", s); return s }
    BEGIN { in_c=0; c_ind=-1; printf "{"; first=1 }
    {
      raw=strip_comment($0); ind=indent(raw); line=trim(raw)
      if (line=="") next
      if (line ~ ("^" container ":")) { in_c=1; c_ind=ind; next }
      if (in_c) {
        if (ind<=c_ind) { in_c=0 }
        else if (line ~ /^[A-Za-z0-9._-]+:[[:space:]]*[A-Za-z0-9._-]/) {
          k=line; sub(/:.*$/,"",k); k=trim(k)
          v=line; sub(/^[^:]*:[[:space:]]*/,"",v); v=unq(trim(v))
          if (k!="" && v!="") { if(!first)printf ","; printf "\"%s\":\"%s\"", k, v; first=0 }
        }
      }
    }
    END { printf "}" }
  ' "$file"
}

# 6a. Priorità 1: analytics/actors.yaml (gitignored opt-in).
if [[ -f "$ACTORS_FILE" && -r "$ACTORS_FILE" ]]; then
  FROM_FILE="$(parse_actor_map_yaml "$ACTORS_FILE" "actors")"
  if printf '%s' "$FROM_FILE" | jq -e . >/dev/null 2>&1; then
    ACTORS_MAP="$FROM_FILE"
  fi
fi
# 6b. Priorità 2 (fallback): factory.config.yaml analytics.measurement.actors_map.
#     Solo per le chiavi non già risolte dal file (file ha precedenza).
FROM_CFG="$(parse_actor_map_yaml "$CONFIG" "actors_map")"
if printf '%s' "$FROM_CFG" | jq -e . >/dev/null 2>&1; then
  ACTORS_MAP="$(jq -c -n --argjson cfg "$FROM_CFG" --argjson file "$ACTORS_MAP" '$cfg + $file')"
fi

# ---------------------------------------------------------------------------
# 7. load_events(filter) — reader agnostico (ADR-021 §D), solo actor_type=human.
#    Se --task-id è dato, filtra anche per task_id. Stesso dispatch di
#    analyze-timeline.sh per coerenza esatta.
# ---------------------------------------------------------------------------
EVENTS_DIR="$REPO_ROOT/analytics/events"
DB="$REPO_ROOT/analytics/events.db"

JQ_FILTER='
  ($f.project_id // null) as $pid
  | ($f.task_type // null) as $tt
  | ($f.period.from // null) as $from
  | ($f.period.to // null) as $to
  | select(.actor_type == "human")
  | select($task == "" or .task_id == $task)
  | select($pid == null or .project_id == $pid)
  | select($tt  == null or .task_type  == $tt)
  | select($from == null or .ts >= $from)
  | select($to   == null or .ts <  $to)
'

load_events() {
  if [[ "$STORE" == "jsonl" ]]; then
    if [[ ! -d "$EVENTS_DIR" ]]; then
      echo "compute_human_cost: event store assente ($EVENTS_DIR). Nessun evento (R.P3)." >&2
      return 0
    fi
    shopt -s nullglob
    local files=( "$EVENTS_DIR"/*.jsonl "$EVENTS_DIR"/*.jsonl.gz )
    shopt -u nullglob
    if [[ ${#files[@]} -eq 0 ]]; then
      echo "compute_human_cost: nessun file evento in $EVENTS_DIR (R.P3)." >&2
      return 0
    fi
    local f
    for f in "${files[@]}"; do
      if [[ "$f" == *.gz ]]; then gzip -dc "$f" 2>/dev/null; else cat "$f"; fi
    done | jq -c --argjson f "$FILTER" --arg task "$TASK_ID" "$JQ_FILTER" 2>/dev/null || true
  else
    if ! command -v sqlite3 >/dev/null 2>&1; then
      echo "Tool compute_human_cost con store=sqlite richiede 'sqlite3' CLI (≥3.35). Installare sqlite3 o usare store=jsonl. Vedi ADR-021 §B." >&2
      printf '{"status":"error","error":"missing prerequisite: sqlite3"}\n'
      exit 1
    fi
    if [[ ! -f "$DB" ]]; then
      echo "compute_human_cost: event store SQLite assente ($DB). Nessun evento (R.P3)." >&2
      return 0
    fi
    sqlite3 -json "$DB" "SELECT * FROM events WHERE actor_type='human' ORDER BY ts;" 2>/dev/null \
      | jq -c '.[]
          | { task_id, project_id, parent_id, actor_type, actor_id, task_type, state, ts,
              model,
              tokens: { input: .tokens_input, output: .tokens_output,
                        cache_read: .tokens_cache_read, cache_write: .tokens_cache_write },
              tool_calls: (try (.tool_calls | fromjson) catch []),
              extras: (try (.extras | fromjson) catch null) }' \
      | jq -c --argjson f "$FILTER" --arg task "$TASK_ID" "$JQ_FILTER" 2>/dev/null || true
  fi
}

EVENTS="$(load_events)"

# ---------------------------------------------------------------------------
# 8. Calcolo costo umano — un solo programma jq deterministico.
#    Per ogni task (group_by task_id):
#      - actor_id  = actor_id del task (primo evento).
#      - role_id   = actors_map[actor_id] // "unknown" (warning lato shell).
#      - ore_sforzo = effort_hours esplicito (extras.effort_hours, ultimo non-null)
#                     altrimenti ts(ultimo finished) - ts(primo started) in ore.
#      - tariffa   = rates.roles[id|alias].rates[valid_from <= as_of < next].hourly_rate
#                     dove as_of = --rate-as-of se dato, altrimenti il ts effort.
#      - costo     = ore_sforzo · tariffa_ruolo   (formula §2.2 verbatim).
#    Output intermedio: per_actor{}, per_role{}, total, distinct_actors, warnings.
# ---------------------------------------------------------------------------
COMPUTE="$(printf '%s\n' "$EVENTS" | jq -s \
  --argjson rates "$RATES_JSON" \
  --argjson actors "$ACTORS_MAP" \
  --arg rate_as_of "$RATE_AS_OF" '

  # ISO-8601 → epoch secondi (UTC). Stessa logica di analyze-timeline.sh.
  def epoch:
    sub("\\.[0-9]+";"") as $s0
    | ($s0 | capture("(?<base>.*T[0-9:]+)(?<tz>Z|[+-][0-9]{2}:[0-9]{2})$")) as $c
    | ($c.base + "Z" | fromdateiso8601) as $utc
    | if $c.tz == "Z" then $utc
      else
        ($c.tz | capture("(?<sign>[+-])(?<h>[0-9]{2}):(?<m>[0-9]{2})")) as $o
        | (($o.h|tonumber)*3600 + ($o.m|tonumber)*60) as $off
        | if $o.sign == "+" then ($utc - $off) else ($utc + $off) end
      end;

  def round2: (. * 100 | round) / 100;

  # Resolve role_id da actor_id via actors_map; fallback "unknown".
  def resolve_role($aid): ($actors[$aid] // "unknown");

  # Resolve hourly_rate per role_id a una data ISO ($asof, YYYY-MM-DD...).
  # Match canonical id OR alias; poi valid_from semi-aperto (ADR-022 §D/§E).
  # Ritorna {rate, found, canonical_role} — found=false se ruolo o data non
  # risolvibili. canonical_role = id canonico della rate card (alias normalizzato
  # al canonical, ADR-022 §C/§D); fallback al $role passato se non trovato.
  def resolve_rate($role; $asof):
    ( $rates.roles
      | map(select(.id == $role or (((.aliases // []) | index($role)) != null)))
      | .[0] ) as $r
    | if $r == null then { rate: 0, found: false, reason: "role-not-found", canonical_role: $role }
      else
        ( $r.rates | sort_by(.valid_from) ) as $sorted
        | ( [ range(0; ($sorted|length))
              | { i: ., vf: $sorted[.].valid_from, hr: $sorted[.].hourly_rate } ]
            | map(select(.vf <= $asof))
            | last ) as $pick
        | if $pick == null
            then { rate: 0, found: false, reason: "no-valid-from-before-asof", canonical_role: $r.id }
            else { rate: ($pick.hr // 0), found: true, reason: "ok", canonical_role: $r.id }
          end
      end;

  . as $events
  | ($events | length) as $events_considered
  | ($events | group_by(.task_id)) as $by_task

  | ([ $by_task[]
       | sort_by(.ts) as $evs
       | ($evs[0].actor_id) as $aid
       | (resolve_role($aid)) as $role
       # effort_hours esplicito (ultimo non-null tra gli eventi del task).
       | ([ $evs[] | .extras.effort_hours // empty ] | last) as $eff_override
       # ts del primo started e ultimo finished (per derivazione effort + as_of).
       | ([ $evs[] | select(.state=="started") | .ts ] | first) as $ts_start
       | ([ $evs[] | select(.state=="finished") | .ts ] | last)  as $ts_finish
       | (if ($ts_start != null and $ts_finish != null)
            then (((($ts_finish|epoch) - ($ts_start|epoch)) / 3600))
            else 0 end) as $eff_derived
       | (if ($eff_override != null) then ($eff_override) else $eff_derived end) as $hours
       # as_of per la resolution tariffa: --rate-as-of (proiezione) o ts effort.
       | (if ($rate_as_of != "") then $rate_as_of
            else (($ts_finish // $ts_start // $evs[0].ts) | .[0:10]) end) as $asof
       | (resolve_rate($role; $asof)) as $rr
       | (($hours * $rr.rate) | round2) as $cost
       | {
           task_id: $evs[0].task_id,
           actor_id: $aid,
           role_id: $rr.canonical_role,
           hours: ($hours | round2),
           rate: $rr.rate,
           rate_found: $rr.found,
           rate_reason: $rr.reason,
           cost: $cost
         }
     ]) as $task_costs

  # Aggregazioni.
  | ( [ $task_costs[].cost ] | add // 0 | round2 ) as $total
  | ( [ $task_costs[] | select(.actor_id != null and .actor_id != "") | .actor_id ]
      | unique | length ) as $distinct_actors
  | ( reduce $task_costs[] as $t ({};
        .[$t.role_id] = ((.[$t.role_id] // 0) + $t.cost) ) ) as $per_role_raw
  | ( reduce $task_costs[] as $t ({};
        .[$t.actor_id] = ((.[$t.actor_id] // 0) + $t.cost) ) ) as $per_actor_raw
  | ( $per_role_raw  | with_entries(.value |= round2) ) as $per_role
  | ( $per_actor_raw | with_entries(.value |= round2) ) as $per_actor
  # Warning collectors per la shell.
  | ( [ $task_costs[] | select(.role_id == "unknown") | .actor_id ] | unique ) as $unmapped
  | ( [ $task_costs[] | select(.rate_found == false and .cost == 0 and .hours > 0)
        | { role: .role_id, reason: .rate_reason } ] | unique ) as $rate_misses

  | {
      total: $total,
      distinct_actors: $distinct_actors,
      per_role: $per_role,
      per_actor: $per_actor,
      events_considered: $events_considered,
      unmapped_actors: $unmapped,
      rate_misses: $rate_misses
    }
')"

if [[ -z "$COMPUTE" ]]; then
  echo "ERRORE: calcolo costo umano fallito (jq). Verifica lo schema degli eventi (ADR-021 §E) e della rate card (ADR-022 §C)." >&2
  printf '{"status":"error","error":"human cost computation failed"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 9. Warning non bloccanti su stderr (ADR-023 §D — actor non mappato è recuperabile).
# ---------------------------------------------------------------------------
UNMAPPED="$(printf '%s' "$COMPUTE" | jq -r '.unmapped_actors[]?' 2>/dev/null || true)"
if [[ -n "$UNMAPPED" ]]; then
  while IFS= read -r a; do
    [[ -z "$a" ]] && continue
    echo "WARNING compute_human_cost: actor_id '$a' non mappato a un role_id (cascade analytics/actors.yaml → factory.config.yaml.analytics.measurement.actors_map). Aggregato come role='unknown'. Vedi ADR-023 §D." >&2
  done <<< "$UNMAPPED"
fi
RATE_MISS="$(printf '%s' "$COMPUTE" | jq -c '.rate_misses[]?' 2>/dev/null || true)"
if [[ -n "$RATE_MISS" ]]; then
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    rl="$(printf '%s' "$m" | jq -r '.role')"; rs="$(printf '%s' "$m" | jq -r '.reason')"
    echo "WARNING compute_human_cost: nessuna tariffa risolta per role='$rl' ($rs). Tariffa 0 applicata (ore>0). Verifica '$REL_RATES' (id/alias + valid_from). Vedi ADR-022 §D." >&2
  done <<< "$RATE_MISS"
fi

# ---------------------------------------------------------------------------
# 10. Privacy mascheramento N>=5 (ADR-023 §C) — INVARIANTE NON NEGOZIABILE.
#     Decisione di soppressione di per_actor:
#       - executive | project : N < MIN_N ⇒ SOPPRIMI per_actor (mai eccezioni).
#       - operativa            : SOPPRIMI se operational_show_actor_id=false;
#                                altrimenti mostra MA con warning sotto soglia.
#     "Soppressione" = il campo per_actor è OMESSO dall'output: nessun costo
#     individuale è mai esposto sotto soglia. per_role resta sempre l'aggregato.
# ---------------------------------------------------------------------------
DISTINCT="$(printf '%s' "$COMPUTE" | jq -r '.distinct_actors')"
SUPPRESS_ACTOR="false"
PRIVACY_NOTE=""

if [[ "$DISTINCT" -lt "$MIN_N" ]]; then
  case "$AUDIENCE" in
    executive|project)
      SUPPRESS_ACTOR="true"
      PRIVACY_NOTE="aggregated below threshold (ADR-023 §C): N=$DISTINCT < min_aggregation_n=$MIN_N, per_actor omesso; aggregazione per ruolo. Audience=$AUDIENCE."
      ;;
    operativa)
      if [[ "$OP_SHOW" == "true" ]]; then
        SUPPRESS_ACTOR="false"
        PRIVACY_NOTE="WARNING: per_actor mostrato con N=$DISTINCT < min_aggregation_n=$MIN_N (operational_show_actor_id=true). Verificare diritto di accesso del lettore. Vedi ADR-023 §C."
      else
        SUPPRESS_ACTOR="true"
        PRIVACY_NOTE="aggregated below threshold (ADR-023 §C): N=$DISTINCT < min_aggregation_n=$MIN_N, per_actor omesso (operational_show_actor_id=false). Audience=$AUDIENCE."
      fi
      ;;
  esac
fi

# Nota trasparenza soglia applicata (sempre dichiarata, ADR-023 §C override).
THRESHOLD_NOTE="Privacy threshold applicata: min_aggregation_n=$MIN_N, distinct actor_id=$DISTINCT, audience=$AUDIENCE."
# Nota rate_basis (regola di trasparenza, ADR-023 §E) — sempre presente se cost>0.
RATE_BASIS_NOTE="Rate basis: $FILE_RATE_BASIS. Vedi ADR-022 §C, ADR-023 §E."

# ---------------------------------------------------------------------------
# 11. Emissione output finale — schema US-034 / ADR-023 §E.
#     rate_basis presente SOLO se cost > 0 (DoD). per_actor condizionale.
# ---------------------------------------------------------------------------
printf '%s' "$COMPUTE" | jq \
  --arg currency "$CURRENCY" \
  --arg rate_basis "$FILE_RATE_BASIS" \
  --arg rate_card_version "$RATE_CARD_VERSION" \
  --argjson suppress "$SUPPRESS_ACTOR" \
  --arg privacy_note "$PRIVACY_NOTE" \
  --arg threshold_note "$THRESHOLD_NOTE" \
  --arg rate_basis_note "$RATE_BASIS_NOTE" \
  '
  .total as $cost
  | {
      cost: $cost,
      currency: $currency,
      breakdown: ( { per_role: .per_role }
                   + ( if $suppress then {} else { per_actor: .per_actor } end ) ),
      events_considered: .events_considered,
      rate_card_version: $rate_card_version
    }
  # rate_basis OBBLIGATORIO solo se cost > 0 (DoD US-034 + ADR-023 §E).
  | ( if $cost > 0 then . + { rate_basis: $rate_basis } else . end )
  # notes: privacy (se presente) + threshold + rate_basis (se cost>0).
  | . + { notes: ( []
            + ( if $privacy_note != "" then [ $privacy_note ] else [] end )
            + [ $threshold_note ]
            + ( if $cost > 0 then [ $rate_basis_note ] else [] end ) ) }
  '

exit 0
