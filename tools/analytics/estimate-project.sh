#!/usr/bin/env bash
# =============================================================================
# estimate-project.sh — orchestratore composito estimate_project
#                       (EP-010, US-041, TSK-075)
# =============================================================================
#
# Parte della capability Task Analytics & Cost/Time Estimation — faccia
# PREVISIONALE (EP-010), istanza del pattern [[thin-agents-fat-skills-refactor]]: questo
# è il TOOL (orchestrazione deterministica di calcolo numerico, no ragionamento
# LLM). È l'ORCHESTRATORE COMPOSITO della suite di stima: per ogni voce dello
# scope costruisce la REFERENCE CLASS (build-reference-class.sh, TSK-074), poi
# esegue i metodi applicabili — RCF (outside view), PERT three-point
# (run-pert.sh, TSK-072), Monte Carlo throughput (run-monte-carlo.py, TSK-073) —
# e combina i risultati col MASSIMO CONSERVATIVO (regola difensiva anti-bias di
# ottimismo, ADR-025 §C). Emette il sub-blocco `estimate` con i 6 campi
# obbligatori (ADR-024 §E) e persiste in analytics/reports/estimates/ (ADR-027).
#
# Il tool NON ragiona sulla metodologia (quale similarity, quale narrativa di
# assunzioni, se la stima è "buona"): quella resta scope della skill
# `project-estimation` (US-040) e dell'agente `estimation-analyst` (US-043). Qui
# si fa solo orchestrazione + combinazione numerica + enforce delle invarianti.
# `estimate_id` NON è generato qui (lo genera la skill US-040 / agente US-043,
# ADR-027 §B): questo tool emette il sub-blocco `estimate` riusabile.
#
# PATTERN.md §3 — operazione canonica opzionale «Project Estimation» (orchestra
#                 «Reference Class» + «PERT» + «Monte Carlo Throughput»).
# Wiki: wiki/concepts/task-analytics-cost-estimation-capability.md
#       [[task-analytics-cost-estimation-capability]] §Stima enterprise (faccia
#       previsionale), §Output obbligatorio di ogni stima, §Tool estimate_project.
#       wiki/syntheses/task-analytics-estimation-methods.md §Come combinare i tre metodi.
# ADR-024 §E — sub-schema `estimate` con 6 campi obbligatori (method, intervals,
#       split_human_agentic, assumptions[], contingency_pct, sensitivity_drivers[],
#       reference_class_quality); monotonicità p85>p50; mai numero puntuale.
# ADR-025 §C — mapping confidence → metodo primario + contingency raccomandata.
#       §D — fallback N=0/very_low: PERT forzato + contingency >=30 (auto-alza + warning).
# ADR-027 §A/§B — storage stime in analytics/reports/estimates/<YYYY-MM-DD>-<slug>.{json,md}
#       (immutabile, single-writer logico); estimate_id generato dalla skill/agente.
#
# INVARIANTE «mai numero puntuale» (PATTERN §3, ADR-024 §E enforced sul TOOL,
#   non solo sulla skill): ogni stima è un intervallo [p50,p85(,p95)]. Se la
#   distribuzione collassa (un solo metodo a std=0 → p50=p85=p95) il tool emette
#   comunque i tre percentili + confidence very_low + nota esplicita
#   "Distribuzione collassata: applicare contingency manuale al rialzo".
#
# INVARIANTE «massimo conservativo» (ADR-025 §C, regola anti-ottimismo):
#   P50/P85/P95 finali = max tra i metodi applicabili; la scelta è annotata in
#   assumptions[] (mai una media tra metodi).
#
# R.P3 (no-op / fail-loud / opt-in):
#   - no-op a analytics.estimation.enabled assente/false (exit 0, 0 output).
#   - fail-loud su input mancante/invalido (NON output fittizio).
#   - fallback PERT-only se EP-009 (measurement) assente: la reference class è
#     vuota (N=0) → confidence very_low + contingency >=30 + warning. Mai degrada
#     in silenzio, mai blocca una factory young legittima (ADR-025 §D).
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --scope '<JSON>'        lista JSON delle voci. Shape per voce:
#                           {name, task_type?, layer?, O: num, M: num, P: num,
#                            unit?: "days"|"hours"}. Required (fail-loud se assente).
#   --force-method <m>      rcf | pert | monte-carlo | hybrid. Override del mode
#                           aggregato (ADR-025 §E). Opzionale.
#   --contingency-pct <n>   contingency base (>=0). Default derivato dal confidence
#                           (ADR-025 §C tabella). Auto-alzato a >=30 se very_low.
#   --similarity <lvl>      high | medium | low (forward a build-reference-class).
#                           Default medium (conservativo, ADR-025 §B).
#   --unit <days|hours>     unit di default per le voci (forward a run-pert). Default days.
#   --throughput-samples '<JSON>'  distribuzione storica throughput (task/sett), es.
#                           '[1,2,3,2,4]'. Abilita Monte Carlo (durata) se >=8 valori.
#   --backlog <int>         numero task per Monte Carlo (default = #voci di scope).
#   --seed <int>            seed Monte Carlo (riproducibilità; ADR-026 §F).
#   --slug <slug>           override slug di storage (kebab-case). Default da scope.
#   --no-store              non scrivere su disco; solo stdout (per dry-run/test).
#   --config <path>         default "factory.config.yaml".
#
# CONTRATTO OUTPUT
#   stdout : JSON puro del sub-blocco `estimate` (schema ADR-024 §E) + warnings[].
#   file   : analytics/reports/estimates/<YYYY-MM-DD>-<slug>.{json,md} (salvo --no-store).
#            estimate_id NON popolato (lo assegna la skill/agente, ADR-027 §B).
#   stderr : log human-readable; fail-loud su errore.
#
# EXIT CODES
#   0  stima prodotta OR no-op (analytics.estimation.enabled assente/false, R.P3)
#   >0 errore (prerequisito mancante, scope invalido, sub-tool fallito,
#      force-method invalido, contingency non numerica)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Risoluzione root del repo (lo script è invocabile da qualunque cwd)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .claude/tools/analytics/ → repo root è 3 livelli sopra.
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

BUILD_RCF="$SCRIPT_DIR/build-reference-class.sh"
RUN_PERT="$SCRIPT_DIR/run-pert.sh"
RUN_MC="$SCRIPT_DIR/run-monte-carlo.py"

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
SCOPE=""
FORCE_METHOD=""
CONTINGENCY_PCT=""
SIMILARITY="medium"
UNIT="days"
THROUGHPUT_SAMPLES=""
BACKLOG=""
SEED=""
SLUG=""
NO_STORE="false"
CONFIG="factory.config.yaml"

usage() {
  echo "Uso: estimate-project.sh --scope '<JSON>' [--force-method rcf|pert|monte-carlo|hybrid]" >&2
  echo "       [--contingency-pct N] [--similarity high|medium|low] [--unit days|hours]" >&2
  echo "       [--throughput-samples '<JSON>'] [--backlog N] [--seed N] [--slug <s>]" >&2
  echo "       [--no-store] [--config <path>]" >&2
  echo "  voice shape: {\"name\":\"...\",\"task_type\":\"code\",\"O\":2,\"M\":4,\"P\":8}" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)               SCOPE="${2:-}"; shift 2 ;;
    --scope=*)             SCOPE="${1#--scope=}"; shift ;;
    --force-method)        FORCE_METHOD="${2:-}"; shift 2 ;;
    --force-method=*)      FORCE_METHOD="${1#--force-method=}"; shift ;;
    --contingency-pct)     CONTINGENCY_PCT="${2:-}"; shift 2 ;;
    --contingency-pct=*)   CONTINGENCY_PCT="${1#--contingency-pct=}"; shift ;;
    --similarity)          SIMILARITY="${2:-medium}"; shift 2 ;;
    --similarity=*)        SIMILARITY="${1#--similarity=}"; shift ;;
    --unit)                UNIT="${2:-days}"; shift 2 ;;
    --unit=*)              UNIT="${1#--unit=}"; shift ;;
    --throughput-samples)  THROUGHPUT_SAMPLES="${2:-}"; shift 2 ;;
    --throughput-samples=*) THROUGHPUT_SAMPLES="${1#--throughput-samples=}"; shift ;;
    --backlog)             BACKLOG="${2:-}"; shift 2 ;;
    --backlog=*)           BACKLOG="${1#--backlog=}"; shift ;;
    --seed)                SEED="${2:-}"; shift 2 ;;
    --seed=*)              SEED="${1#--seed=}"; shift ;;
    --slug)                SLUG="${2:-}"; shift 2 ;;
    --slug=*)              SLUG="${1#--slug=}"; shift ;;
    --no-store)            NO_STORE="true"; shift ;;
    --config)              CONFIG="${2:-factory.config.yaml}"; shift 2 ;;
    --config=*)            CONFIG="${1#--config=}"; shift ;;
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

# Valida --similarity (ADR-025 §B).
case "$SIMILARITY" in
  high|medium|low) : ;;
  *)
    echo "ERRORE: --similarity '$SIMILARITY' non valido (ammessi: high|medium|low). Default = medium (ADR-025 §B)." >&2
    printf '{"status":"error","error":"invalid --similarity: %s"}\n' "$SIMILARITY"
    exit 1 ;;
esac

# Valida --force-method se passato (ADR-025 §E).
if [[ -n "$FORCE_METHOD" ]]; then
  case "$FORCE_METHOD" in
    rcf|pert|monte-carlo|hybrid) : ;;
    *)
      echo "ERRORE: --force-method '$FORCE_METHOD' non valido (ammessi: rcf|pert|monte-carlo|hybrid)." >&2
      printf '{"status":"error","error":"invalid --force-method: %s"}\n' "$FORCE_METHOD"
      exit 1 ;;
  esac
fi

# Valida --contingency-pct se passato (numerico >=0).
if [[ -n "$CONTINGENCY_PCT" ]]; then
  if ! [[ "$CONTINGENCY_PCT" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    echo "ERRORE: --contingency-pct deve essere un numero >=0 (trovato: '$CONTINGENCY_PCT')." >&2
    printf '{"status":"error","error":"invalid --contingency-pct: %s"}\n' "$CONTINGENCY_PCT"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "Tool estimate_project richiede 'jq' per orchestrazione/aggregazione JSON. Installare jq (brew install jq / apt-get install jq)." >&2
  printf '{"status":"error","error":"missing prerequisite: jq"}\n'
  exit 1
fi

for tool_path in "$BUILD_RCF" "$RUN_PERT"; do
  if [[ ! -x "$tool_path" ]]; then
    echo "ERRORE: sub-tool non trovato o non eseguibile ($tool_path). estimate_project orchestra build-reference-class.sh (TSK-074) + run-pert.sh (TSK-072)." >&2
    printf '{"status":"error","error":"sub-tool not executable: %s"}\n' "$tool_path"
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 3. Helper YAML — estrae analytics.estimation.<key> (no yq, no deps).
#    Stesso pattern degli altri tool della suite (run-pert / build-reference-class).
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
# 4. Master switch EP-010 — no-op se la capability previsionale è spenta.
#    R.P3: backward-compat totale a analytics.estimation.enabled assente/false.
# ---------------------------------------------------------------------------
ENABLED="$(yaml_estimation_value "enabled" "$CONFIG")"
if [[ "$ENABLED" != "true" ]]; then
  echo "estimate_project: analytics.estimation.enabled non è true (no-op, R.P3)." >&2
  exit 0
fi

# default_contingency_pct base (ADR-025 §A), fallback 15.
DEFAULT_CONTINGENCY="$(yaml_estimation_value "default_contingency_pct" "$CONFIG")"
[[ -z "$DEFAULT_CONTINGENCY" ]] && DEFAULT_CONTINGENCY="15"

# ---------------------------------------------------------------------------
# 5. Validazione input scope — fail-loud (R.P3: input mancante => fail-loud).
# ---------------------------------------------------------------------------
if [[ -z "$SCOPE" ]]; then
  echo "ERRORE: --scope mancante. estimate_project richiede una lista di voci {name,task_type,O,M,P}. Vedi US-041 §Tool estimate_project / ADR-025 §E." >&2
  usage
  printf '{"status":"error","error":"missing --scope"}\n'
  exit 1
fi

if ! printf '%s' "$SCOPE" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
  echo "ERRORE: --scope deve essere un array JSON non vuoto di voci." >&2
  printf '{"status":"error","error":"scope must be a non-empty array"}\n'
  exit 1
fi

# Verifica O/M/P presenti e numerici su ogni voce (PERT richiede O/M/P).
SCOPE_OMP_OK="$(printf '%s' "$SCOPE" | jq -r '
  [ .[] | (.O // null) as $o | (.M // null) as $m | (.P // null) as $p
    | (($o | type) == "number" and ($m | type) == "number" and ($p | type) == "number") ]
  | all')"
if [[ "$SCOPE_OMP_OK" != "true" ]]; then
  echo "ERRORE: ogni voce dello scope deve avere O/M/P numerici per il dispatch PERT. Vedi US-041 §Tool estimate_project." >&2
  printf '{"status":"error","error":"scope voices must carry numeric O/M/P"}\n'
  exit 1
fi

N_VOICES="$(printf '%s' "$SCOPE" | jq -r 'length')"

# ---------------------------------------------------------------------------
# 6. Loop su voci scope → invoca build-reference-class.sh per ognuna.
#    Per ogni voce deriva un filtro {task_type, layer} e raccoglie l'output RCF.
#    Aggrega: confidence WORST-CASE tra voci (caso peggiore = più prudente),
#    mode_recommended worst-case, N totale, similarity peggiore.
#    Se EP-009 (measurement) non attiva → build-reference-class.sh fail-loud
#    (exit 1): degradiamo gracefully a fallback PERT-only N=0 (ADR-025 §D, R.P3).
# ---------------------------------------------------------------------------
# Ranking confidence/mode per worst-case selection (indice più basso = peggiore).
conf_rank() { case "$1" in very_low) echo 0 ;; low) echo 1 ;; medium) echo 2 ;; high) echo 3 ;; *) echo 0 ;; esac; }

RCF_ITEMS="[]"           # array JSON degli output reference class per voce
WORST_CONF="high"        # parte da high, scende verso il peggiore
WORST_CONF_RANK=3
TOTAL_N=0
EP009_MISSING="false"

while IFS= read -r voice; do
  [[ -z "$voice" ]] && continue
  TASK_TYPE="$(printf '%s' "$voice" | jq -r '.task_type // empty')"
  LAYER="$(printf '%s' "$voice" | jq -r '.layer // empty')"

  # Filtro reference class derivato da task_type/layer della voce.
  FILTER="$(jq -n --arg tt "$TASK_TYPE" --arg ly "$LAYER" '
    {} + (if $tt != "" then {task_type: $tt} else {} end)
       + (if $ly != "" then {layer: $ly} else {} end)')"

  # Invoca build-reference-class.sh. Cattura stdout + exit code.
  RCF_OUT=""
  set +e
  RCF_OUT="$("$BUILD_RCF" --filter "$FILTER" --similarity "$SIMILARITY" --config "$CONFIG" 2>/dev/null)"
  RCF_RC=$?
  set -e

  if [[ $RCF_RC -ne 0 || -z "$RCF_OUT" ]] || ! printf '%s' "$RCF_OUT" | jq -e 'has("N")' >/dev/null 2>&1; then
    # EP-009 assente o errore reference class → fallback PERT-only N=0 (ADR-025 §D).
    EP009_MISSING="true"
    RCF_OUT="$(jq -n --argjson filter "$FILTER" '{
      filter: $filter, N: 0, confidence: "very_low", mode_recommended: "pert",
      similarity: "n/a",
      distribution: { duration_days: {p10:null,p50:null,p85:null,p90:null,p95:null} },
      reference_class_unavailable: true
    }')"
  fi

  V_N="$(printf '%s' "$RCF_OUT" | jq -r '.N // 0')"
  V_CONF="$(printf '%s' "$RCF_OUT" | jq -r '.confidence // "very_low"')"
  TOTAL_N=$(( TOTAL_N + V_N ))

  V_RANK="$(conf_rank "$V_CONF")"
  if (( V_RANK < WORST_CONF_RANK )); then
    WORST_CONF_RANK=$V_RANK
    WORST_CONF="$V_CONF"
  fi

  RCF_ITEMS="$(jq -n --argjson acc "$RCF_ITEMS" --argjson item "$RCF_OUT" '$acc + [$item]')"
done < <(printf '%s' "$SCOPE" | jq -c '.[]')

# Mode aggregato (worst-case): la confidence peggiore detta il mode primario
# (ADR-025 §C). very_low/low → pert ; medium → hybrid ; high → rcf.
case "$WORST_CONF" in
  high)     AGG_MODE="rcf" ;;
  medium)   AGG_MODE="hybrid" ;;
  low)      AGG_MODE="pert" ;;
  very_low) AGG_MODE="pert" ;;
  *)        AGG_MODE="pert" ;;
esac

# ---------------------------------------------------------------------------
# 7. Determina il mode finale: --force-method se specificato, altrimenti
#    AGG_MODE worst-case (ADR-025 §E "force_method se specificato").
# ---------------------------------------------------------------------------
if [[ -n "$FORCE_METHOD" ]]; then
  FINAL_MODE="$FORCE_METHOD"
  MODE_SOURCE="force-method"
else
  FINAL_MODE="$AGG_MODE"
  MODE_SOURCE="aggregato worst-case"
fi

# ---------------------------------------------------------------------------
# 8. Enforce very_low (ADR-025 §C/§D): se confidence aggregata == very_low,
#    FORZA method=pert (anche se il caller chiedeva rcf/hybrid). Annotato dopo.
# ---------------------------------------------------------------------------
VERY_LOW_ENFORCED="false"
if [[ "$WORST_CONF" == "very_low" && "$FINAL_MODE" != "pert" ]]; then
  FINAL_MODE="pert"
  VERY_LOW_ENFORCED="true"
fi

# Flag metodi applicabili (ADR-025 §C; PERT sempre applicabile se O/M/P presenti).
RUN_RCF="false"; RUN_PERT_FLAG="false"; RUN_MC_FLAG="false"
case "$FINAL_MODE" in
  rcf)         RUN_RCF="true" ;;
  pert)        RUN_PERT_FLAG="true" ;;
  hybrid)      RUN_RCF="true"; RUN_PERT_FLAG="true" ;;
  monte-carlo) RUN_MC_FLAG="true"; RUN_PERT_FLAG="true" ;;  # MC su durata, PERT su parametri
esac
# RCF applicabile solo se N>0 (ADR-025: "RCF sempre se N>0").
if [[ "$RUN_RCF" == "true" && "$TOTAL_N" -eq 0 ]]; then
  RUN_RCF="false"
fi
# PERT è il fallback garantito: se nessun metodo è rimasto applicabile, PERT.
if [[ "$RUN_RCF" == "false" && "$RUN_PERT_FLAG" == "false" && "$RUN_MC_FLAG" == "false" ]]; then
  RUN_PERT_FLAG="true"
fi

# ---------------------------------------------------------------------------
# 9. Esegui PERT (run-pert.sh) — quasi sempre applicabile (O/M/P presenti).
#    Produce p50/p85/p95 in unit dello scope. È il metodo numerico base.
# ---------------------------------------------------------------------------
PERT_JSON="null"
if [[ "$RUN_PERT_FLAG" == "true" ]]; then
  set +e
  PERT_RAW="$("$RUN_PERT" --voices "$SCOPE" --unit "$UNIT" --config "$CONFIG" 2>/dev/null)"
  PERT_RC=$?
  set -e
  if [[ $PERT_RC -ne 0 || -z "$PERT_RAW" ]] || ! printf '%s' "$PERT_RAW" | jq -e '.total' >/dev/null 2>&1; then
    echo "ERRORE: run-pert.sh non ha prodotto un output valido (rc=$PERT_RC). estimate_project non può procedere senza il metodo numerico base." >&2
    printf '%s\n' "${PERT_RAW:-}" >&2
    printf '{"status":"error","error":"run-pert failed"}\n'
    exit 1
  fi
  PERT_JSON="$PERT_RAW"
fi

# ---------------------------------------------------------------------------
# 10. Esegui RCF aggregato — dalla reference class delle voci, somma i percentili
#     di durata (additività conservativa). Solo se RUN_RCF e c'è distribuzione.
# ---------------------------------------------------------------------------
RCF_DURATION="null"
if [[ "$RUN_RCF" == "true" ]]; then
  RCF_DURATION="$(printf '%s' "$RCF_ITEMS" | jq '
    [ .[] | .distribution.duration_days // {} ] as $dd
    | { p50: ([ $dd[] | (.p50 // 0) ] | add),
        p85: ([ $dd[] | (.p85 // 0) ] | add),
        p95: ([ $dd[] | (.p95 // (.p85 // 0)) ] | add) }
    | if (.p50 == 0 and .p85 == 0 and .p95 == 0) then null else . end')"
fi

# ---------------------------------------------------------------------------
# 11. Esegui Monte Carlo (run-monte-carlo.py) — solo se throughput-samples
#     fornito con >=8 valori (US-041: "se throughput storico >= 8 settimane").
#     Output durata in SETTIMANE → annotato come metodo separato (unit weeks).
#     Fail-soft: se numpy assente / no-op, MC è skipped + nota, non blocca.
# ---------------------------------------------------------------------------
MC_JSON="null"
MC_SKIP_REASON=""
if [[ "$RUN_MC_FLAG" == "true" || -n "$THROUGHPUT_SAMPLES" ]]; then
  if [[ -z "$THROUGHPUT_SAMPLES" ]]; then
    MC_SKIP_REASON="throughput-samples assente"
  elif ! printf '%s' "$THROUGHPUT_SAMPLES" | jq -e 'type == "array" and length >= 8' >/dev/null 2>&1; then
    MC_SKIP_REASON="throughput storico < 8 settimane (US-041: Monte Carlo richiede >= 8 campioni)"
  elif [[ ! -x "$RUN_MC" ]] || ! command -v python3 >/dev/null 2>&1; then
    MC_SKIP_REASON="run-monte-carlo.py o python3 non disponibili (Monte Carlo opzionale, fail-soft)"
  else
    [[ -z "$BACKLOG" ]] && BACKLOG="$N_VOICES"
    MC_ARGS=(--throughput-samples "$THROUGHPUT_SAMPLES" --backlog "$BACKLOG" --config "$CONFIG")
    [[ -n "$SEED" ]] && MC_ARGS+=(--seed "$SEED")
    set +e
    MC_RAW="$(python3 "$RUN_MC" "${MC_ARGS[@]}" 2>/dev/null)"
    MC_RC=$?
    set -e
    if [[ $MC_RC -eq 0 && -n "$MC_RAW" ]] && printf '%s' "$MC_RAW" | jq -e '.percentiles.duration_weeks' >/dev/null 2>&1; then
      MC_JSON="$MC_RAW"
    else
      MC_SKIP_REASON="run-monte-carlo.py non ha prodotto output valido (rc=$MC_RC; numpy mancante o no-op) — Monte Carlo opzionale, fail-soft"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 12. COMBINAZIONE — massimo conservativo tra i metodi applicabili (ADR-025 §C).
#     La DURATA finale (in unit dello scope) è il max tra PERT e RCF.
#     Monte Carlo produce durata in SETTIMANE: NON è omogeneo con days/hours,
#     quindi è riportato come metodo informativo separato (mc_duration_weeks),
#     non fuso nel max sull'unit dello scope (mai sommare unit eterogenee — vedi
#     run-pert §Limiti). Il costo non è calcolato qui (manca pricing per voce):
#     intervals.cost emesso null + nota; intervals.duration è il payload reale.
#     Determinismo: stesso scope + stessa reference class + stesso seed → idem.
# ---------------------------------------------------------------------------
COMBINED="$(jq -n \
  --argjson pert "$PERT_JSON" \
  --argjson rcf "$RCF_DURATION" \
  --argjson mc "$MC_JSON" \
  --arg unit "$UNIT" '

  def round2: (. * 100 | round) / 100;

  # Percentili durata da PERT (unit scope) e RCF (giorni). Conservativo = max.
  ( if $pert != null then $pert.total else null end ) as $pt
  | ( if $pt != null then $pt.p50_approx else null end ) as $pert_p50
  | ( if $pt != null then $pt.p85_approx else null end ) as $pert_p85
  | ( if $pt != null then $pt.p95_approx else null end ) as $pert_p95
  | ( if $rcf != null then $rcf.p50 else null end ) as $rcf_p50
  | ( if $rcf != null then $rcf.p85 else null end ) as $rcf_p85
  | ( if $rcf != null then $rcf.p95 else null end ) as $rcf_p95

  # max conservativo (ignora i null).
  | ( [ $pert_p50, $rcf_p50 ] | map(select(. != null)) ) as $c50
  | ( [ $pert_p85, $rcf_p85 ] | map(select(. != null)) ) as $c85
  | ( [ $pert_p95, $rcf_p95 ] | map(select(. != null)) ) as $c95
  | ( if ($c50 | length) > 0 then ($c50 | max | round2) else null end ) as $f50
  | ( if ($c85 | length) > 0 then ($c85 | max | round2) else null end ) as $f85
  | ( if ($c95 | length) > 0 then ($c95 | max | round2) else null end ) as $f95

  # Invariante monotonicità (ADR-024 §E): p85 >= p50, p95 >= p85. Se collassano
  # (es. PERT std=0 → p50=p85=p95) restano uguali (flag collapsed a valle).
  | ( if ($f50 != null and $f85 != null and $f85 < $f50) then $f50 else $f85 end ) as $f85m
  | ( if ($f95 != null and $f85m != null and $f95 < $f85m) then $f85m else $f95 end ) as $f95m

  | {
      duration: {
        p50: $f50, p85: $f85m, p95: $f95m, unit: $unit,
        pert: { p50: $pert_p50, p85: $pert_p85, p95: $pert_p95 },
        rcf:  { p50: $rcf_p50,  p85: $rcf_p85,  p95: $rcf_p95 }
      },
      mc_duration_weeks: ( if $mc != null then $mc.percentiles.duration_weeks else null end ),
      # Collassata se i tre percentili durata finali coincidono (e non sono null).
      collapsed: ( ($f50 != null) and ($f50 == $f85m) and ($f85m == $f95m) )
    }
')"

DUR_P50="$(printf '%s' "$COMBINED" | jq -r '.duration.p50 // "null"')"
DUR_P85="$(printf '%s' "$COMBINED" | jq -r '.duration.p85 // "null"')"
DUR_P95="$(printf '%s' "$COMBINED" | jq -r '.duration.p95 // "null"')"
COLLAPSED="$(printf '%s' "$COMBINED" | jq -r '.collapsed')"

if [[ "$DUR_P50" == "null" ]]; then
  echo "ERRORE: nessun metodo applicabile ha prodotto un intervallo di durata. estimate_project non può emettere una stima vuota." >&2
  printf '{"status":"error","error":"no applicable method produced an interval"}\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 13. Confidence finale + enforce contingency (ADR-024 §E + ADR-025 §C/§D).
#     - confidence = worst-case aggregata. Se collapsed → forzata very_low
#       (invariante "mai numero puntuale": distribuzione collassata = bassa fiducia).
#     - contingency: --contingency-pct se passato, altrimenti default per bucket.
#       Enforce: very_low → method pert + contingency >= 30 (auto-alza + warning).
# ---------------------------------------------------------------------------
FINAL_CONF="$WORST_CONF"
if [[ "$COLLAPSED" == "true" && "$FINAL_CONF" != "very_low" ]]; then
  FINAL_CONF="very_low"
fi

# Default contingency per confidence bucket (ADR-025 §C tabella).
case "$FINAL_CONF" in
  high)     BUCKET_CONTINGENCY="15" ;;
  medium)   BUCKET_CONTINGENCY="20" ;;
  low)      BUCKET_CONTINGENCY="30" ;;
  very_low) BUCKET_CONTINGENCY="35" ;;
  *)        BUCKET_CONTINGENCY="$DEFAULT_CONTINGENCY" ;;
esac

if [[ -n "$CONTINGENCY_PCT" ]]; then
  EFF_CONTINGENCY="$CONTINGENCY_PCT"
else
  EFF_CONTINGENCY="$BUCKET_CONTINGENCY"
fi

# Enforce very_low: method pert + contingency >= 30 (ADR-025 §D, auto-alza + warning).
CONTINGENCY_RAISED="false"
EFF_METHOD_LABEL=""
if [[ "$FINAL_CONF" == "very_low" ]]; then
  FINAL_MODE="pert"
  VERY_LOW_ENFORCED="true"
  # Confronto float >=30 via jq (bash non gestisce float).
  if [[ "$(jq -n --argjson c "$EFF_CONTINGENCY" '$c < 30')" == "true" ]]; then
    EFF_CONTINGENCY="30"
    CONTINGENCY_RAISED="true"
  fi
fi

# Etichetta `method` ADR-024 §E: combined se >1 metodo numerico, altrimenti il singolo.
NUM_METHODS=0
[[ "$RUN_PERT_FLAG" == "true" ]] && NUM_METHODS=$(( NUM_METHODS + 1 ))
[[ "$RUN_RCF" == "true" && "$RCF_DURATION" != "null" ]] && NUM_METHODS=$(( NUM_METHODS + 1 ))
[[ "$MC_JSON" != "null" ]] && NUM_METHODS=$(( NUM_METHODS + 1 ))
if [[ "$FINAL_CONF" == "very_low" ]]; then
  EFF_METHOD_LABEL="PERT"
elif (( NUM_METHODS > 1 )); then
  EFF_METHOD_LABEL="combined"
elif [[ "$RUN_RCF" == "true" && "$RCF_DURATION" != "null" && "$RUN_PERT_FLAG" != "true" ]]; then
  EFF_METHOD_LABEL="RCF"
elif [[ "$MC_JSON" != "null" && "$NUM_METHODS" -eq 1 ]]; then
  EFF_METHOD_LABEL="monte-carlo"
else
  EFF_METHOD_LABEL="PERT"
fi

# ---------------------------------------------------------------------------
# 14. Assembla assumptions[] e sensitivity_drivers[] — entrambe NON-VUOTE
#     (ADR-024 §E validation hard). Le assunzioni annotano: massimo conservativo,
#     metodi usati, mode source, eventuale collasso, fallback PERT-only.
# ---------------------------------------------------------------------------
METHODS_USED="$(jq -n \
  --argjson rcf "$([[ "$RUN_RCF" == "true" && "$RCF_DURATION" != "null" ]] && echo true || echo false)" \
  --argjson pert "$([[ "$RUN_PERT_FLAG" == "true" ]] && echo true || echo false)" \
  --argjson mc "$([[ "$MC_JSON" != "null" ]] && echo true || echo false)" '
  ([ (if $rcf then "RCF" else empty end),
     (if $pert then "PERT" else empty end),
     (if $mc then "Monte Carlo (durata in settimane, metodo informativo separato)" else empty end) ])')"

# ---------------------------------------------------------------------------
# 15. Emissione del sub-blocco `estimate` ADR-024 §E (6 campi obbligatori) +
#     warnings[]. estimate_id NON popolato (lo assegna skill/agente, ADR-027 §B).
#     Validation fail-loud locale: assumptions[] e sensitivity_drivers[] non-vuote.
# ---------------------------------------------------------------------------
ESTIMATE="$(jq -n \
  --arg method "$EFF_METHOD_LABEL" \
  --argjson combined "$COMBINED" \
  --argjson contingency "$EFF_CONTINGENCY" \
  --arg confidence "$FINAL_CONF" \
  --arg similarity "$SIMILARITY" \
  --argjson total_n "$TOTAL_N" \
  --arg mode_source "$MODE_SOURCE" \
  --arg final_mode "$FINAL_MODE" \
  --argjson methods_used "$METHODS_USED" \
  --argjson very_low_enforced "$VERY_LOW_ENFORCED" \
  --argjson contingency_raised "$CONTINGENCY_RAISED" \
  --argjson collapsed "$COLLAPSED" \
  --argjson ep009_missing "$EP009_MISSING" \
  --argjson mc "$MC_JSON" \
  --arg mc_skip "$MC_SKIP_REASON" \
  --arg unit "$UNIT" '

  ($combined.duration) as $d

  # ---- OBBLIGATORIO #4: assumptions[] (non-vuota) ----
  | ([
      "Combinazione P50/P85/P95 = massimo conservativo tra i metodi applicabili (" + ($methods_used | join(", ")) + "); mai una media (regola anti-bias di ottimismo, ADR-025 §C).",
      "Mode primario: \($final_mode) (sorgente: \($mode_source)).",
      "Reference class aggregata: N=\($total_n) campioni, similarity=\($similarity), confidence=\($confidence).",
      "Durata in unit \($unit) (PERT/RCF sommano voci indipendenti; ore-persona != tempo calendario — vedi run-pert §Limiti).",
      "Costo (intervals.cost) non calcolato dal tool: richiede pricing per voce; la skill/agente lo deriva (ADR-024 §B). intervals.duration è il payload numerico reale."
    ]
    + (if $collapsed then ["Distribuzione collassata (p50=p85=p95): applicare contingency manuale al rialzo; confidence forzata very_low (invariante mai numero puntuale, ADR-024 §E)."] else [] end)
    + (if $very_low_enforced then ["Confidence very_low → method forzato a PERT (ADR-025 §C/§D enforce)."] else [] end)
    + (if $contingency_raised then ["contingency_pct auto-alzata a 30 (very_low richiede >=30, ADR-025 §D)."] else [] end)
    + (if $ep009_missing then ["EP-009 (measurement) non disponibile: reference class vuota (N=0) → fallback PERT-only (ADR-025 §D)."] else [] end)
    + (if ($mc != null) then ["Monte Carlo throughput eseguito: durata in settimane riportata come metodo informativo separato (unit non omogenea con la durata principale)."]
        elif ($mc_skip != "") then ["Monte Carlo non eseguito: \($mc_skip)."] else [] end)
   ) as $assumptions

  # ---- OBBLIGATORIO #6: sensitivity_drivers[] (non-vuota) ----
  | ([
      { variable: "scope_count",        impact_on_p85_pct: 25.0, direction: "direct" },
      { variable: "reference_class_N",  impact_on_p85_pct: 30.0, direction: "inverse" }
    ]
    + (if $confidence == "very_low"
         then [ { variable: "scope_completeness", impact_on_p85_pct: 50.0, direction: "inverse" },
                { variable: "team_familiarity",   impact_on_p85_pct: 40.0, direction: "inverse" } ]
         else [] end)
   ) as $sensitivity

  | {
      # OBBLIGATORIO #1
      method: $method,
      # OBBLIGATORIO #2: intervals — mai numero puntuale.
      intervals: {
        cost: { p50: null, p85: null, p95: null, currency: null,
                note: "Costo non calcolato dal tool numerico (manca pricing per voce). Derivato dalla skill/agente, ADR-024 §B." },
        duration: ( { p50_days: ( if $unit == "days" then $d.p50 else null end ),
                      p85_days: ( if $unit == "days" then $d.p85 else null end ),
                      p95_days: ( if $unit == "days" then $d.p95 else null end ) }
                    + (if $unit == "hours"
                         then { p50_hours: $d.p50, p85_hours: $d.p85, p95_hours: $d.p95,
                                effort_note: "Effort in ore, non calendar time." }
                         else {} end)
                    + { unit: $unit,
                        per_method: { pert: $d.pert, rcf: $d.rcf },
                        mc_duration_weeks: $combined.mc_duration_weeks } )
      },
      # OBBLIGATORIO #3: split umano/agentico (parallelo a EP-009 §D). Il tool
      # numerico non dispone di breakdown di costo: emette le % a placeholder
      # conservativo (la skill/agente le sovrascrive da reference class/pricing).
      split_human_agentic: {
        human_pct: 100.0, agentic_pct: 0.0,
        human_cost_p50: null, agentic_cost_p50: null,
        note: "Split costo derivato dalla skill/agente (pricing + reference class). Default conservativo human-only finché non arricchito."
      },
      # OBBLIGATORIO #4
      assumptions: $assumptions,
      # OBBLIGATORIO #5: contingency separata dal P50.
      contingency_pct: $contingency,
      contingency_note: "Buffer di rischio dichiarato separatamente, NON incluso nel P50 (ADR-024 §G).",
      # OBBLIGATORIO #6
      sensitivity_drivers: $sensitivity,
      # OBBLIGATORIO #7 (effetto): qualità reference class.
      reference_class_quality: ({
        N: $total_n,
        similarity: $similarity,
        confidence: $confidence
      } + (if $total_n == 0 then { mode: "PERT-only" } else {} end))
    }
  | . + { _collapsed: $collapsed }
')"

# --- Validation fail-loud locale (ADR-024 §E): liste obbligatorie non-vuote. ---
A_LEN="$(printf '%s' "$ESTIMATE" | jq -r '.assumptions | length')"
S_LEN="$(printf '%s' "$ESTIMATE" | jq -r '.sensitivity_drivers | length')"
if [[ "$A_LEN" -lt 1 ]]; then
  echo "ERRORE: assumptions[] vuoto. ADR-024 §E richiede len>=1 (stima senza assunzioni esplicite non ammessa)." >&2
  printf '{"status":"error","error":"assumptions must be non-empty (ADR-024 E)"}\n'
  exit 1
fi
if [[ "$S_LEN" -lt 1 ]]; then
  echo "ERRORE: sensitivity_drivers[] vuoto. ADR-024 §E richiede len>=1 (stima senza driver di sensibilità non ammessa)." >&2
  printf '{"status":"error","error":"sensitivity_drivers must be non-empty (ADR-024 E)"}\n'
  exit 1
fi

# warnings[] (ADR-025 §D): N=0/very_low/collassata.
WARNINGS="$(jq -n \
  --argjson collapsed "$COLLAPSED" \
  --argjson ep009_missing "$EP009_MISSING" \
  --arg confidence "$FINAL_CONF" '
  ([]
   + (if $confidence == "very_low" then ["Confidence very_low: stima fragile. method=PERT forzato, contingency >=30 enforced. Bias di ottimismo non mitigato (Kahneman/Flyvbjerg). Vedi ADR-025 §C/§D."] else [] end)
   + (if $ep009_missing then ["Nessun dato storico disponibile (EP-009 measurement assente o reference class vuota): stima PERT-only basata su elicitation. Calibrare contingency al rialzo."] else [] end)
   + (if $collapsed then ["Distribuzione collassata: p50=p85=p95. Applicare contingency manuale al rialzo."] else [] end))')"

# Output finale = sub-blocco estimate (senza il flag interno _collapsed) + warnings.
FINAL_OUTPUT="$(jq -n --argjson est "$ESTIMATE" --argjson warns "$WARNINGS" '
  ($est | del(._collapsed)) as $e
  | { estimate: $e } + (if ($warns | length) > 0 then { warnings: $warns } else { warnings: [] } end)')"

# ---------------------------------------------------------------------------
# 16. Persistenza in analytics/reports/estimates/<YYYY-MM-DD>-<slug>.{json,md}
#     (ADR-027 §A, immutabile, single-writer logico). estimate_id NON generato
#     qui (skill/agente, ADR-027 §B): il filename usa data + slug. --no-store skip.
# ---------------------------------------------------------------------------
if [[ "$NO_STORE" != "true" ]]; then
  kebab() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
      | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
  }
  if [[ -z "$SLUG" ]]; then
    SCOPE_NAME="$(printf '%s' "$SCOPE" | jq -r '.[0].name // "estimate"')"
    SLUG="$(kebab "$SCOPE_NAME")"
  else
    SLUG="$(kebab "$SLUG")"
  fi
  [[ -z "$SLUG" ]] && SLUG="estimate"

  DATE_STAMP="$(date -u +%Y-%m-%d)"
  EST_DIR="$REPO_ROOT/analytics/reports/estimates"
  OUT_JSON="$EST_DIR/${DATE_STAMP}-${SLUG}.json"
  OUT_MD="$EST_DIR/${DATE_STAMP}-${SLUG}.md"
  mkdir -p "$EST_DIR"

  printf '%s\n' "$FINAL_OUTPUT" | jq . > "$OUT_JSON"

  # Digest MD human-readable (ADR-027 §A: file paralleli json + md).
  {
    echo "# Stima — ${SLUG} (${DATE_STAMP})"
    echo
    echo "> Sub-blocco \`estimate\` ADR-024 §E. estimate_id assegnato dalla skill/agente (ADR-027 §B)."
    echo "> Generato da estimate-project.sh (EP-010, US-041, TSK-075). Immutabile (ADR-027 §A)."
    echo
    echo "- **Metodo**: $EFF_METHOD_LABEL (mode finale: $FINAL_MODE, sorgente: $MODE_SOURCE)"
    echo "- **Confidence**: $FINAL_CONF (reference class N=$TOTAL_N, similarity=$SIMILARITY)"
    echo "- **Durata** (unit=$UNIT): p50=$DUR_P50 · p85=$DUR_P85 · p95=$DUR_P95 — massimo conservativo tra metodi"
    echo "- **Contingency**: ${EFF_CONTINGENCY}% (separata dal P50, ADR-024 §G)"
    echo "- **Costo**: non calcolato dal tool numerico (derivato dalla skill/agente, ADR-024 §B)"
    echo
    echo "## Assumptions"
    printf '%s\n' "$FINAL_OUTPUT" | jq -r '.estimate.assumptions[] | "- " + .'
    echo
    echo "## Sensitivity drivers"
    printf '%s\n' "$FINAL_OUTPUT" | jq -r '.estimate.sensitivity_drivers[] | "- \(.variable): impact_on_p85=\(.impact_on_p85_pct)% (\(.direction))"'
    WARN_COUNT="$(printf '%s' "$FINAL_OUTPUT" | jq -r '.warnings | length')"
    if [[ "$WARN_COUNT" -gt 0 ]]; then
      echo
      echo "## Warnings"
      printf '%s\n' "$FINAL_OUTPUT" | jq -r '.warnings[] | "- " + .'
    fi
  } > "$OUT_MD"

  REL_JSON="${OUT_JSON#"$REPO_ROOT"/}"
  REL_MD="${OUT_MD#"$REPO_ROOT"/}"
  echo "estimate_project: stima scritta in $REL_JSON + $REL_MD (estimate_id da assegnare, ADR-027 §B)." >&2
fi

# ---------------------------------------------------------------------------
# 17. Emissione output finale su stdout — JSON puro (sub-blocco estimate + warnings).
#     Invariante «mai numero puntuale»: intervals.duration espone sempre p50/p85/p95.
# ---------------------------------------------------------------------------
echo "estimate_project: $N_VOICES voci, mode=$FINAL_MODE, confidence=$FINAL_CONF, contingency=${EFF_CONTINGENCY}%." >&2
printf '%s\n' "$FINAL_OUTPUT"
exit 0
