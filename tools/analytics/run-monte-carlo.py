#!/usr/bin/env python3
# =============================================================================
# run-monte-carlo.py — tool deterministico run_monte_carlo (EP-010, US-041, TSK-073)
# =============================================================================
#
# Parte della capability Task Analytics & Cost/Time Estimation (EP-010), istanza
# del pattern [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica numerica
# deterministica, no ragionamento LLM). Esegue il Monte Carlo throughput forecast
# (§Metodo 3): per `iterations` run campiona il throughput settimanale dalla
# distribuzione storica fino a coprire il backlog, raccoglie `weeks_needed` ed
# emette i percentili p50/p85/p95 della durata. Il tool NON sceglie la
# metodologia: la skill (US-040) / agente (US-043) o `force_method` decidono
# se/quando invocarlo; qui si fa solo il calcolo.
#
# PATTERN.md §3 — operazione canonica opzionale «Monte Carlo Throughput».
# Wiki: wiki/concepts/task-analytics-cost-estimation-capability.md
#       [[task-analytics-cost-estimation-capability]] §Stima enterprise (faccia
#       previsionale), §Output obbligatorio di ogni stima.
#       wiki/syntheses/task-analytics-estimation-methods.md §Metodo 3.
# ADR-026 — Monte Carlo runtime: Python + numpy come DEFAULT (performance:
#           10k simulazioni vectorizzate in <1s). §A runtime, §B fail-loud su
#           numpy/python mancante con install command esatto, §F `--seed` per
#           riproducibilità (metadata.seed sempre presente), §G backward compat.
#
# INVARIANTE «mai numero puntuale»: l'output espone SEMPRE percentili p50/p85/p95
# (mai un valore atteso singolo come primario, mai `mean`/`average`/`media`). Le
# durate sono distribuzioni a coda lunga: la media inganna.
#
# FAIL-LOUD (ADR-026 §B): se `import numpy` fallisce → exit 2 + messaggio
# canonico verbatim su stderr con `pip install` esatto. Nessun silent fallback.
#
# OPT-IN / R.P3: tool è no-op a capability spenta. La presenza/assenza del file
# non produce ERROR di lint; l'invocazione senza input obbligatori fa fail-loud.
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --throughput-samples '<JSON list>'  distribuzione storica throughput (task/sett),
#                                       es. '[1,2,3,2,4]'. Required.
#   --backlog <int>                     numero di task da completare. Required, >0.
#   --iterations <int>                  default 10000.
#   --week-count-cap <int>              guardia anti-loop infinito, default 520 (10 anni).
#   --seed <int>                        opzionale; se assente → random da os.urandom.
#                                       Stesso seed + stesso input → output byte-identico.
#   --config <path>                     default "factory.config.yaml" (per no-op check).
#
# CONTRATTO OUTPUT (stdout, JSON puro) — schema ADR-026 §A / TSK-073:
#   { iterations, backlog,
#     percentiles: { duration_weeks: {p50, p85, p95} },
#     distribution: { histogram: [{week, count}], bins: [...] },
#     metadata: { runtime, numpy, duration_ms, seed } }
#
# EXIT CODES: 0 ok | 1 input non valido / no-op gate | 2 dipendenza mancante (numpy).
# =============================================================================

import sys
import os
import json
import time
import argparse

# --- Fail-loud numpy (ADR-026 §B) — prima riga effettiva di runtime --------
try:
    import numpy as np
except ImportError:
    sys.stderr.write(
        "ERROR: numpy non installato. Monte Carlo runtime richiede numpy >=1.24.\n"
        "\n"
        "Install:\n"
        "  pip install 'numpy>=1.24'        # globale (sconsigliato per factory)\n"
        "  # OPPURE (raccomandato — venv dedicato):\n"
        "  python3 -m venv .factory-venv/analytics\n"
        "  source .factory-venv/analytics/bin/activate\n"
        "  pip install 'numpy>=1.24'\n"
        "\n"
        "Vedi ADR-026 §B per dettaglio.\n"
    )
    sys.exit(2)


def _die(msg, code=1):
    sys.stderr.write(msg.rstrip("\n") + "\n")
    sys.exit(code)


def _check_no_op(config_path):
    """R.P3 / ADR-026 §G: no-op a capability spenta.

    Se factory.config.yaml è presente e analytics.estimation.enabled è
    esplicitamente false, il tool è no-op (non simula). Parsing minimale e
    tollerante: se il file/blocco manca o è illeggibile, NON blocchiamo
    (l'invocazione esplicita = volontà esplicita; il gate vero vive nella skill).
    """
    if not config_path or not os.path.isfile(config_path):
        return  # nessun config → non possiamo provare disabilitazione, procedi
    try:
        with open(config_path, "r", encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return
    enabled = None
    in_analytics = in_estimation = False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()
        if indent == 0:
            in_analytics = stripped.startswith("analytics:")
            in_estimation = False
            continue
        if in_analytics and stripped.startswith("estimation:"):
            in_estimation = True
            continue
        if in_analytics and in_estimation and stripped.startswith("enabled:"):
            val = stripped.split(":", 1)[1].strip().lower()
            enabled = val in ("true", "yes", "on", "1")
            break
        # uscito dal blocco estimation se incontriamo una chiave a indent <= estimation level
        if in_estimation and indent <= 2 and not stripped.startswith("enabled:"):
            in_estimation = False
    if enabled is False:
        _die(
            "Monte Carlo no-op: analytics.estimation.enabled=false in "
            f"{config_path}. Attivare la capability (analytics.estimation.enabled: true) "
            "o invocare con un config diverso. Vedi ADR-026 §G / R.P3.",
            code=1,
        )


def simulate(throughput_samples, backlog, iterations, week_count_cap, rng):
    """Monte Carlo throughput forecast vectorizzato (synthesis §Metodo 3).

    Per ciascuna delle `iterations` run, campiona il throughput settimana per
    settimana dalla distribuzione storica fino a `tasks_completed >= backlog`,
    raccogliendo `weeks_needed`. Vectorizzato per blocchi di settimane.
    """
    samples = np.asarray(throughput_samples, dtype=np.float64)
    completed = np.zeros(iterations, dtype=np.float64)
    weeks_needed = np.zeros(iterations, dtype=np.int64)
    done = np.zeros(iterations, dtype=bool)

    week = 0
    while not done.all() and week < week_count_cap:
        week += 1
        draws = rng.choice(samples, size=iterations)
        completed = np.where(done, completed, completed + draws)
        newly_done = (~done) & (completed >= backlog)
        weeks_needed = np.where(newly_done, week, weeks_needed)
        done = done | newly_done

    # Iterazioni che non hanno raggiunto il backlog entro il cap: assegna il cap
    # (segnala throughput insufficiente; coda destra realistica, mai underestimate).
    weeks_needed = np.where(done, weeks_needed, week_count_cap)
    return weeks_needed


def main():
    parser = argparse.ArgumentParser(
        prog="run-monte-carlo.py",
        description="Monte Carlo throughput forecast (EP-010, US-041, ADR-026). "
                    "Output JSON su stdout. Invariante: sempre percentili, mai puntuale.",
    )
    parser.add_argument("--throughput-samples", required=True,
                        help="Distribuzione storica throughput come JSON list, es. '[1,2,3,2,4]'.")
    parser.add_argument("--backlog", required=True, type=int,
                        help="Numero di task da completare (>0).")
    parser.add_argument("--iterations", type=int, default=10000,
                        help="Numero di simulazioni (default 10000).")
    parser.add_argument("--week-count-cap", type=int, default=520,
                        help="Guardia anti-loop: settimane massime per run (default 520).")
    parser.add_argument("--seed", type=int, default=None,
                        help="Seed per riproducibilità; default random da os.urandom.")
    parser.add_argument("--config", default="factory.config.yaml",
                        help="Path config per no-op check (default factory.config.yaml).")
    args = parser.parse_args()

    # No-op gate (R.P3 / ADR-026 §G) prima di qualunque calcolo.
    _check_no_op(args.config)

    # --- Validazione input (fail-loud) -------------------------------------
    try:
        throughput = json.loads(args.throughput_samples)
    except json.JSONDecodeError as exc:
        _die(f"ERROR: --throughput-samples non è JSON valido: {exc}. "
             "Atteso una lista, es. '[1,2,3,2,4]'.")
    if not isinstance(throughput, list) or not throughput:
        _die("ERROR: --throughput-samples deve essere una lista non vuota di numeri, "
             "es. '[1,2,3,2,4]'.")
    try:
        throughput = [float(x) for x in throughput]
    except (TypeError, ValueError):
        _die("ERROR: --throughput-samples deve contenere solo numeri.")
    if any(x < 0 for x in throughput):
        _die("ERROR: --throughput-samples non può contenere valori negativi.")
    if all(x == 0 for x in throughput):
        _die("ERROR: --throughput-samples tutto a zero: throughput nullo, backlog mai "
             "completabile. Fornire una distribuzione storica con almeno un valore > 0.")
    if args.backlog <= 0:
        _die("ERROR: --backlog deve essere un intero positivo (> 0).")
    if args.iterations <= 0:
        _die("ERROR: --iterations deve essere un intero positivo (> 0).")
    if args.week_count_cap <= 0:
        _die("ERROR: --week-count-cap deve essere un intero positivo (> 0).")

    # --- Seed: sempre presente in metadata (ADR-026 §F) --------------------
    if args.seed is None:
        seed = int.from_bytes(os.urandom(4), "big")
    else:
        seed = int(args.seed)
    rng = np.random.default_rng(seed)

    # --- Simulazione -------------------------------------------------------
    start = time.perf_counter()
    weeks_needed = simulate(throughput, args.backlog, args.iterations,
                            args.week_count_cap, rng)
    duration_ms = int(round((time.perf_counter() - start) * 1000))

    # --- Percentili (invariante: p50/p85/p95, mai mean) --------------------
    p50, p85, p95 = (int(round(v)) for v in
                     np.percentile(weeks_needed, [50, 85, 95], method="linear"))

    # --- Histogram (settimana → conteggio) ---------------------------------
    max_week = int(weeks_needed.max())
    counts = np.bincount(weeks_needed, minlength=max_week + 1)
    histogram = [{"week": int(w), "count": int(counts[w])}
                 for w in range(1, max_week + 1) if counts[w] > 0]
    bins = [h["week"] for h in histogram]

    result = {
        "iterations": args.iterations,
        "backlog": args.backlog,
        "percentiles": {
            "duration_weeks": {"p50": p50, "p85": p85, "p95": p95}
        },
        "distribution": {
            "histogram": histogram,
            "bins": bins,
        },
        "metadata": {
            "runtime": "python-%d.%d.%d" % sys.version_info[:3],
            "numpy": np.__version__,
            "duration_ms": duration_ms,
            "seed": seed,
        },
    }

    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
