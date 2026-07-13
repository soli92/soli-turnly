#!/usr/bin/env bash
# =============================================================================
# analyze-timeline.sh — tool deterministico analyze_timeline (EP-009, US-035, TSK-063)
# =============================================================================
#
# Parte della capability Task Analytics & Cost/Time Estimation (EP-009), istanza
# del pattern [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica deterministica,
# no LLM). È il READER agnostico dello store del side-channel `analytics/events/`
# scritto da record_task_event (US-033, single-writer). Il tool NON ragiona:
# legge gli eventi, ricostruisce la timeline per task, calcola metriche ed emette
# JSON puro. L'interpretazione ("perché la review è collo di bottiglia?") è scope
# della skill (US-036) e dell'agente (US-038), mai di questo tool.
#
# PATTERN.md §3 — operazione canonica opzionale «Timeline Analysis».
# Wiki: wiki/concepts/task-analytics-cost-estimation-capability.md
#       [[task-analytics-cost-estimation-capability]] §Analisi temporale,
#       §Quattro concetti da non confondere, §Usare percentili, non medie.
# ADR-021 — `<<task_event_store>>`: reader agnostico con dispatch interno
#           load_events(filter): JSONL scan+filter in-memory (§A/§D) | SQLite
#           SELECT con index (§B/§D). Warning volume >500k linee (§D).
# ADR-024 §C — sub-schema `time` standard (output coerente: lead/cycle/effort/wait
#           con percentili p50/p85/p95 + bottleneck + n_samples).
#
# INVARIANTE «percentili, non medie»: l'output ha p50/p85/p95 per ciascuno dei 4
# concetti; il tool NON emette MAI un campo `mean`, `average` o `media`. Le durate
# dei task sono distribuzioni a coda lunga: la media inganna.
#
# I QUATTRO CONCETTI TEMPORALI (verbatim dal concept, mai mescolati):
#   - lead   = ts(finished) - ts(created/started_first) — calendario, attese incluse.
#   - cycle  = somma intervalli in stati "in lavorazione" (escluso `blocked`).
#   - effort = human → effort_hours (frontmatter/override); agent → somma cycle intervals.
#   - wait   = lead - cycle — spesso il vero collo di bottiglia.
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --filter '<JSON>'     filtro opzionale, default {} (nessun filtro = aggregato globale).
#                         Shape: {project_id?, task_type?, actor_type?, layer?,
#                                 period?: {from, to}}  (ISO-8601 le date di period).
#   --group-by <dim>      opzionale: task_type | layer | actor_type | actor_id | state.
#   --config <path>       default "factory.config.yaml" (ADR-023 §A).
#
# CONTRATTO OUTPUT (stdout, JSON puro) — schema US-035 / ADR-024 §C:
#   { filter, group_by, lead{p50,p85,p95,unit}, cycle{...}, effort{...}, wait{...},
#     bottlenecks[{state,p50_wait,share_of_lead,bottleneck}], operational{...},
#     events_considered }
#
# STDERR
#   log human-readable (warning volume non bloccante; fail-loud su errore).
#
# EXIT CODES
#   0  analisi prodotta OR no-op (analytics.measurement.enabled assente/false, R.P3)
#   >0 errore (prerequisito mancante, store non leggibile, filtro invalido)
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
FILTER="{}"
GROUP_BY=""
CONFIG="factory.config.yaml"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --filter)
      FILTER="${2:-}"; [[ -z "$FILTER" ]] && FILTER="{}"; shift 2 ;;
    --group-by)
      GROUP_BY="${2:-}"; shift 2 ;;
    --config)
      CONFIG="${2:-factory.config.yaml}"; shift 2 ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'. Uso: analyze-timeline.sh [--filter '<JSON>'] [--group-by task_type|layer|actor_type|actor_id|state] [--config <path>]" >&2
      printf '{"status":"error","error":"unknown argument: %s"}\n' "$1"
      exit 1 ;;
  esac
done

# Normalizza CONFIG a path assoluto (relativo → rispetto al repo root).
if [[ "$CONFIG" != /* ]]; then
  CONFIG="$REPO_ROOT/$CONFIG"
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud (ADR-023 §A contract)
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "Tool analyze_timeline richiede 'jq' per il parsing/aggregazione JSON. Installare jq (brew install jq / apt-get install jq)." >&2
  printf '{"status":"error","error":"missing prerequisite: jq"}\n'
  exit 1
fi

# Valida che --filter sia JSON well-formed (fail-loud).
if ! printf '%s' "$FILTER" | jq -e . >/dev/null 2>&1; then
  echo "ERRORE: --filter non è JSON valido: '$FILTER'." >&2
  printf '{"status":"error","error":"invalid --filter JSON"}\n'
  exit 1
fi

# Valida --group-by se presente.
if [[ -n "$GROUP_BY" ]]; then
  case "$GROUP_BY" in
    task_type|layer|actor_type|actor_id|state) : ;;
    *)
      echo "ERRORE: --group-by '$GROUP_BY' non valido (ammessi: task_type|layer|actor_type|actor_id|state)." >&2
      printf '{"status":"error","error":"invalid --group-by: %s"}\n' "$GROUP_BY"
      exit 1 ;;
  esac
fi

# ---------------------------------------------------------------------------
# 3. Master switch — no-op se la capability è spenta (R.P3, ADR-021 §F)
#    Legge analytics.measurement.{enabled,store,jsonl_scan_warn_lines} da CONFIG
#    senza dipendenze esterne (no yq). Stesso helper di record-event.sh.
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

ENABLED="$(yaml_measurement_value "enabled" "$CONFIG")"
if [[ "$ENABLED" != "true" ]]; then
  # No-op: capability spenta o blocco assente. Backward-compat totale (R.P3).
  echo "analyze_timeline: analytics.measurement.enabled non è true (no-op, R.P3)." >&2
  exit 0
fi

STORE="$(yaml_measurement_value "store" "$CONFIG")"
[[ -z "$STORE" ]] && STORE="jsonl"   # default ADR-021 §A
if [[ "$STORE" != "jsonl" && "$STORE" != "sqlite" ]]; then
  echo "ERRORE: analytics.measurement.store deve essere 'jsonl' o 'sqlite' (trovato: '$STORE'). Vedi ADR-021 §C." >&2
  printf '{"status":"error","error":"invalid store: %s"}\n' "$STORE"
  exit 1
fi

SCAN_WARN="$(yaml_measurement_value "jsonl_scan_warn_lines" "$CONFIG")"
[[ -z "$SCAN_WARN" ]] && SCAN_WARN="500000"   # default ADR-021 §D

# ---------------------------------------------------------------------------
# 4. load_events(filter) — abstraction layer (ADR-021 §D)
#    Emette su stdout un flusso JSONL di eventi GIÀ filtrati. Dispatch interno
#    sullo store; il resto del tool è agnostico della sorgente.
#    Filtro: project_id, task_type, actor_type, layer (da .layer o .extras.layer),
#    period.{from,to} su .ts. period.from inclusivo, period.to esclusivo.
# ---------------------------------------------------------------------------
EVENTS_DIR="$REPO_ROOT/analytics/events"
DB="$REPO_ROOT/analytics/events.db"

# jq filter program condiviso dai due back-end (post-load, in-memory).
JQ_FILTER='
  ($f.project_id // null) as $pid
  | ($f.task_type // null) as $tt
  | ($f.actor_type // null) as $at
  | ($f.layer // null) as $ly
  | ($f.period.from // null) as $from
  | ($f.period.to // null) as $to
  | select($pid == null or .project_id == $pid)
  | select($tt  == null or .task_type  == $tt)
  | select($at  == null or .actor_type == $at)
  | select($ly  == null or (.layer // .extras.layer // null) == $ly)
  | select($from == null or .ts >= $from)
  | select($to   == null or .ts <  $to)
'

load_events() {
  if [[ "$STORE" == "jsonl" ]]; then
    # 4a. JSONL: scan dei file nella cartella + filter in-memory (ADR-021 §D).
    #     R.P3: event store assente → 0 eventi (no-op morbido, non errore).
    if [[ ! -d "$EVENTS_DIR" ]]; then
      echo "analyze_timeline: event store assente ($EVENTS_DIR). Nessun evento da analizzare (R.P3)." >&2
      return 0
    fi
    shopt -s nullglob
    local files=( "$EVENTS_DIR"/*.jsonl "$EVENTS_DIR"/*.jsonl.gz )
    shopt -u nullglob
    if [[ ${#files[@]} -eq 0 ]]; then
      echo "analyze_timeline: nessun file evento in $EVENTS_DIR (R.P3)." >&2
      return 0
    fi
    # Warning volume non bloccante (ADR-021 §D): conta le linee totali.
    local total=0 cnt f
    for f in "${files[@]}"; do
      if [[ "$f" == *.gz ]]; then
        cnt="$(gzip -dc "$f" 2>/dev/null | wc -l | tr -d ' ')"
      else
        cnt="$(wc -l < "$f" | tr -d ' ')"
      fi
      total=$(( total + cnt ))
    done
    if [[ "$total" -gt "$SCAN_WARN" ]]; then
      echo "WARNING analyze_timeline: volume alto rilevato ($total eventi scansionati, soglia $SCAN_WARN). Considera 'store: sqlite' per ridurre la latenza. Vedi ADR-021 §D." >&2
    fi
    # Stream + filter (auto-detect .gz, ADR-021 §A compressione storica).
    for f in "${files[@]}"; do
      if [[ "$f" == *.gz ]]; then
        gzip -dc "$f" 2>/dev/null
      else
        cat "$f"
      fi
    done | jq -c --argjson f "$FILTER" "$JQ_FILTER" 2>/dev/null || true
  else
    # 4b. SQLite: SELECT con index su ts (ADR-021 §B/§D), poi filter jq fini
    #     (layer da extras non è colonna → applicato in-memory dopo la SELECT).
    if ! command -v sqlite3 >/dev/null 2>&1; then
      echo "Tool analyze_timeline con store=sqlite richiede 'sqlite3' CLI (≥3.35). Installare sqlite3 o usare store=jsonl. Vedi ADR-021 §B." >&2
      printf '{"status":"error","error":"missing prerequisite: sqlite3"}\n'
      exit 1
    fi
    if [[ ! -f "$DB" ]]; then
      echo "analyze_timeline: event store SQLite assente ($DB). Nessun evento da analizzare (R.P3)." >&2
      return 0
    fi
    # Ricostruisce la shape logica isomorfa (ADR-021 §E) da ogni riga e poi
    # riusa lo stesso JQ_FILTER per coerenza esatta con il path JSONL.
    sqlite3 -json "$DB" "SELECT * FROM events ORDER BY ts;" 2>/dev/null \
      | jq -c '.[]
          | { task_id, project_id, parent_id, actor_type, actor_id, task_type, state, ts,
              model,
              tokens: { input: .tokens_input, output: .tokens_output,
                        cache_read: .tokens_cache_read, cache_write: .tokens_cache_write },
              tool_calls: (try (.tool_calls | fromjson) catch []),
              extras: (try (.extras | fromjson) catch null) }' \
      | jq -c --argjson f "$FILTER" "$JQ_FILTER" 2>/dev/null || true
  fi
}

EVENTS="$(load_events)"

# ---------------------------------------------------------------------------
# 5. Calcolo metriche — tutto in un solo programma jq deterministico.
#    Input: stream JSONL di eventi filtrati. Output: oggetto metriche.
#    Modello: per ogni task ordino gli eventi per ts e ricostruisco gli
#    intervalli. Convenzione stati (US-035 / ADR-021 §E):
#      state ∈ {started, finished, blocked}.
#      - lead   = ts(ultimo finished) - ts(primo evento)         [days]
#      - cycle  = somma intervalli che PARTONO da uno 'started'   [days]
#                 (escluso 'blocked' = wait), fino al prossimo evento.
#      - wait   = lead - cycle                                    [days]
#      - effort = human → effort_hours (extras.effort_hours);     [hours]
#                 agent → cycle convertito in ore (cycle*24).
#    Bottleneck per stato: wait accumulato per stato di PARTENZA dell'intervallo;
#    'blocked' è puro wait; transizioni started→started contano come wait residuo
#    solo via lead-cycle aggregato. Percentili: nearest-rank deterministico.
# ---------------------------------------------------------------------------

# Nota: se EVENTS è vuoto → metriche a zero, events_considered=0 (no fail).
METRICS="$(printf '%s\n' "$EVENTS" | jq -s --arg group_by "$GROUP_BY" '

  # ---- Helper: parse ISO-8601 → epoch secondi (UTC). ----
  # Normalizza: strip frazioni di secondo; offset "±hh:mm" → secondi corretti;
  # "Z" o "+00:00" → fromdateiso8601 diretto. Deterministico, no media di alcun tipo.
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

  # ---- Helper: percentile nearest-rank (deterministico, NO media). ----
  # $arr ordinato crescente, $p in (0,1]; rank = ceil(p*N), clamp a [1,N].
  def pct($arr; $p):
    ($arr | length) as $n
    | if $n == 0 then 0
      else ($arr | sort) as $s
        | (($p * $n) | ceil) as $r
        | (if $r < 1 then 1 elif $r > $n then $n else $r end) as $rr
        | $s[$rr - 1]
      end;

  def round2: (. * 100 | round) / 100;

  . as $events
  | ($events | length) as $events_considered

  # ---- Raggruppa eventi per task_id, ricostruisce la timeline. ----
  | ($events | group_by(.task_id)) as $by_task

  # Per ogni task: calcola lead/cycle/wait (days) + effort (hours) + per-state wait.
  | ([ $by_task[]
       | sort_by(.ts) as $evs
       | ($evs | map(.ts | epoch)) as $ts
       | ($evs | length) as $m
       | ($ts | first) as $t0
       | ([ $evs[] | select(.state=="finished") | (.ts|epoch) ] | last) as $tf
       | ($evs[0].actor_type) as $atype
       # Intervalli consecutivi: lo stato del primo evento dell intervallo governa la natura.
       | ([ range(0; $m-1)
            | { from_state: $evs[.].state, dur: ($ts[.+1] - $ts[.]) } ]) as $ints
       # cycle = intervalli che partono da 'started' (lavoro reale). [secondi]
       | ([ $ints[] | select(.from_state=="started") | .dur ] | add // 0) as $cycle_s
       # wait per stato di partenza (blocked + altri non-started). [secondi]
       | ([ $ints[] | select(.from_state!="started") ]) as $wait_ints
       | (if ($tf != null) then ($tf - $t0) else null end) as $lead_s
       | (if ($lead_s != null) then ($lead_s - $cycle_s) else null end) as $wait_s
       # effort: human → extras.effort_hours; agent → cycle in ore.
       | ([ $evs[] | .extras.effort_hours // empty ] | last) as $eff_h_override
       | (if $atype=="human"
            then ($eff_h_override // 0)
            else ($cycle_s / 3600) end) as $effort_h
       | {
           task_id: $evs[0].task_id,
           actor_type: $atype,
           lead_days:  (if $lead_s  != null then ($lead_s  / 86400) else null end),
           cycle_days: ($cycle_s / 86400),
           wait_days:  (if $wait_s  != null then ($wait_s  / 86400) else null end),
           effort_hours: $effort_h,
           finished: ($tf != null),
           first_ts: $t0,
           last_ts:  ($ts | last),
           wait_by_state: ([ $wait_ints[] | { state: .from_state, dur_days: (.dur/86400) } ])
         }
     ]) as $tasks

  # Solo i task completati contribuiscono ai percentili lead/cycle/wait/effort.
  | ([ $tasks[] | select(.finished and .lead_days != null) ]) as $done

  | ([ $done[] | .lead_days ]   | map(round2)) as $lead_arr
  | ([ $done[] | .cycle_days ]  | map(round2)) as $cycle_arr
  | ([ $done[] | .wait_days ]   | map(round2)) as $wait_arr
  | ([ $done[] | .effort_hours ]| map(round2)) as $effort_arr

  # ---- Bottlenecks: wait accumulato per stato del workflow. ----
  # Aggrega wait_by_state su tutti i task; per stato calcola p50 dei wait + share.
  | ([ $tasks[] | .wait_by_state[] ] | group_by(.state)
      | map({
          state: .[0].state,
          waits: (map(.dur_days)),
        })) as $state_groups
  | (([ $done[] | .lead_days ] | add) // 0) as $total_lead
  | ([ $state_groups[]
       | (.waits | sort) as $w
       | (.state) as $st
       | (pct($w; 0.5)) as $p50w
       | ((.waits | add) // 0) as $sum_w
       | {
           state: $st,
           p50_wait: ($p50w | round2),
           share_of_lead: (if $total_lead > 0 then (($sum_w / $total_lead) | round2) else 0 end)
         }
     ]
     | sort_by(-.p50_wait)) as $bottlenecks_sorted
  # Marca il top (max p50_wait) come bottleneck:true; gli altri false.
  | ([ range(0; ($bottlenecks_sorted|length))
       | $bottlenecks_sorted[.] + { bottleneck: (. == 0) } ]) as $bottlenecks

  # ---- Operational ----
  # throughput_per_week: task finished / numero settimane coperte dal periodo eventi.
  | (if ($events|length) > 0
       then (([ $events[] | .ts|epoch ] | min)) else 0 end) as $span_min
  | (if ($events|length) > 0
       then (([ $events[] | .ts|epoch ] | max)) else 0 end) as $span_max
  | (((($span_max - $span_min) / 604800) ) as $weeks_raw
     | (if $weeks_raw < 1 then 1 else $weeks_raw end)) as $weeks
  | (($done | length) / $weeks | round2) as $throughput

  # WIP: task con un intervallo started attivo, campionato per settimana (avg+max).
  # Approssimazione deterministica: per ogni task "in lavorazione" (>=1 started,
  # no finished) conta come WIP corrente; avg = media su settimane coperte.
  | ([ $tasks[] | select(.finished | not) ] | length) as $wip_now
  | ([ $tasks[]
       | select(.cycle_days > 0)
       | .task_id ] | length) as $worked_tasks
  | (($worked_tasks / $weeks) | round2) as $wip_avg_calc
  | {
      throughput_per_week: $throughput,
      wip_avg: $wip_avg_calc,
      wip_max: $wip_now,
    } as $op_base

  # split human vs agent: % di lead time totale attribuibile a ciascuno.
  | (([ $done[] | select(.actor_type=="human") | .lead_days ] | add) // 0) as $human_lead
  | (([ $done[] | select(.actor_type=="agent") | .lead_days ] | add) // 0) as $agent_lead
  | ($human_lead + $agent_lead) as $tot_lead2
  | (if $tot_lead2 > 0 then (($human_lead / $tot_lead2 * 100) | round2) else 0 end) as $human_pct
  | (if $tot_lead2 > 0 then (($agent_lead / $tot_lead2 * 100) | round2) else 0 end) as $agent_pct

  # trend[]: serie settimanale di lead_p50 (week ISO da first_ts del task done).
  | ([ $done[]
       | { week: (.first_ts | strftime("%G-W%V")), lead: .lead_days } ]
     | group_by(.week)
     | map({ week: .[0].week,
             lead_p50: (pct((map(.lead)); 0.5) | round2) })
     | sort_by(.week)) as $trend

  # ---- Assemble output (schema US-035 / ADR-024 §C). MAI campo mean/average. ----
  | {
      lead:   { p50: (pct($lead_arr;0.5)|round2),   p85: (pct($lead_arr;0.85)|round2),   p95: (pct($lead_arr;0.95)|round2),   unit: "days" },
      cycle:  { p50: (pct($cycle_arr;0.5)|round2),  p85: (pct($cycle_arr;0.85)|round2),  p95: (pct($cycle_arr;0.95)|round2),  unit: "days" },
      effort: { p50: (pct($effort_arr;0.5)|round2), p85: (pct($effort_arr;0.85)|round2), p95: (pct($effort_arr;0.95)|round2), unit: "hours" },
      wait:   { p50: (pct($wait_arr;0.5)|round2),   p85: (pct($wait_arr;0.85)|round2),   p95: (pct($wait_arr;0.95)|round2),   unit: "days" },
      bottlenecks: $bottlenecks,
      operational: ($op_base + {
        split_human_pct: $human_pct,
        split_agent_pct: $agent_pct,
        trend: $trend
      }),
      n_samples: ($done | length),
      events_considered: $events_considered
    }
')"

if [[ -z "$METRICS" ]]; then
  echo "ERRORE: calcolo metriche fallito (jq). Verifica lo schema degli eventi (ADR-021 §E)." >&2
  printf '{"status":"error","error":"metrics computation failed"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 6. Emissione output finale — schema verbatim US-035 / ADR-024 §C.
#    group_by: emesso come stringa o null (default = aggregato globale).
#    NB invariante: nessun campo mean/average/media compare nello schema.
# ---------------------------------------------------------------------------
GROUP_BY_JSON="null"
[[ -n "$GROUP_BY" ]] && GROUP_BY_JSON="\"$GROUP_BY\""

printf '%s' "$METRICS" | jq \
  --argjson filter "$FILTER" \
  --argjson group_by "$GROUP_BY_JSON" \
  '{
    filter: $filter,
    group_by: $group_by,
    lead: .lead,
    cycle: .cycle,
    effort: .effort,
    wait: .wait,
    bottlenecks: .bottlenecks,
    operational: .operational,
    n_samples: .n_samples,
    events_considered: .events_considered
  }'

exit 0
