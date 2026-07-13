#!/usr/bin/env python3
"""
harvest-session-tokens.py — raccoglie il token-usage REALE da un transcript Claude Code
(JSONL) e lo registra nell'event store via record-event.sh. È il "pezzo mancante" che
rende operativa la cattura token (EP-009/EP-013): l'hook payload NON contiene i token,
ma il transcript JSONL sì (campo message.usage).

USO:
  # da CLI (backfill):
  harvest-session-tokens.py <transcript.jsonl> [--project <id>] [--dry-run]
  # da hook Claude Code (Stop/SessionEnd): legge il JSON del hook da stdin e ne estrae transcript_path
  echo '<hook-json>' | harvest-session-tokens.py --from-hook [--dry-run]

COSA FA (deterministico, no LLM):
  - parse del JSONL; per ogni riga type=assistant con message.usage, somma i 4 token-kind
    aggregando per (model, isSidechain). isSidechain=true → sub-agent; false → main thread.
  - emette UN evento per (model, scope) via record-event.sh --event '<json>' (single-writer R.G5).
  - idempotente: ts = timestamp ultimo messaggio del gruppo; task_id stabile = session+scope+model
    → re-run non duplica (record-event.sh dedup su sha256(task_id|state|ts)).

LIMITI (onesti):
  - il transcript espone i token per MESSAGGIO, non per TSK: l'aggregazione è per sessione/scope,
    non per task_id del kanban. Granularità per-TSK richiederebbe correlare i marker develop.
  - il costo si calcola con compute-agentic-cost.sh SOLO se il `model` è in analytics/pricing.yaml.
"""
import sys, json, subprocess, os, datetime, argparse, pathlib

HERE = pathlib.Path(__file__).resolve().parent
RECORD = HERE / "record-event.sh"

def parse_transcript(path):
    """Ritorna dict: (model, scope) -> {input,output,cache_read,cache_write, msgs, last_ts}."""
    agg = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("type") != "assistant":
                continue
            msg = d.get("message") or {}
            usage = msg.get("usage") or {}
            if not usage:
                continue
            model = msg.get("model") or "unknown"
            scope = "subagent" if d.get("isSidechain") else "main"
            ts = d.get("timestamp") or ""
            k = (model, scope)
            a = agg.setdefault(k, {"input": 0, "output": 0, "cache_read": 0,
                                   "cache_write": 0, "msgs": 0, "last_ts": ""})
            a["input"]       += int(usage.get("input_tokens", 0) or 0)
            a["output"]      += int(usage.get("output_tokens", 0) or 0)
            a["cache_read"]  += int(usage.get("cache_read_input_tokens", 0) or 0)
            a["cache_write"] += int(usage.get("cache_creation_input_tokens", 0) or 0)
            a["msgs"]        += 1
            if ts > a["last_ts"]:
                a["last_ts"] = ts
    return agg

def to_iso_z(ts):
    """Normalizza a ISO-8601 UTC con Z (lo schema lo richiede)."""
    if not ts:
        return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        t = ts.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(t).astimezone(datetime.timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return ts

def build_event(session_id, model, scope, a, project_id):
    return {
        "task_id": f"session:{session_id[:8]}:{scope}:{model}",
        "project_id": project_id,
        "actor_type": "agent",
        "actor_id": f"claude-code:{scope}",
        "task_type": "session-aggregate",
        "state": "finished",
        "ts": to_iso_z(a["last_ts"]),
        "tokens": {
            "input": a["input"], "output": a["output"],
            "cache_read": a["cache_read"], "cache_write": a["cache_write"],
        },
        "model": model,
        "tool_calls": [],
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript", nargs="?", help="path al transcript JSONL")
    ap.add_argument("--from-hook", action="store_true", help="leggi hook-json da stdin, estrai transcript_path")
    ap.add_argument("--project", default=None, help="project_id (default: nome cwd)")
    ap.add_argument("--dry-run", action="store_true", help="stampa eventi, non li registra")
    args = ap.parse_args()

    transcript = args.transcript
    if args.from_hook:
        try:
            hook = json.load(sys.stdin)
            transcript = hook.get("transcript_path") or transcript
        except (json.JSONDecodeError, ValueError):
            transcript = None  # fail-open: prova il fallback sotto
        # Fallback: alcuni hook (es. SessionEnd) potrebbero non esporre transcript_path
        # → individua il transcript più recente per la cwd corrente.
        if not transcript or not os.path.exists(transcript):
            mangled = os.getcwd().replace("/", "-").replace(".", "-")
            pdir = os.path.expanduser(f"~/.claude/projects/{mangled}")
            try:
                cand = sorted(pathlib.Path(pdir).glob("*.jsonl"),
                              key=lambda p: p.stat().st_mtime, reverse=True)
                transcript = str(cand[0]) if cand else transcript
            except OSError:
                pass
    if not transcript or not os.path.exists(transcript):
        print(json.dumps({"status": "skip", "reason": f"transcript non trovato: {transcript}"}))
        return 0

    project_id = args.project or os.path.basename(os.getcwd())
    session_id = pathlib.Path(transcript).stem
    agg = parse_transcript(transcript)
    if not agg:
        print(json.dumps({"status": "skip", "reason": "nessun record usage nel transcript"}))
        return 0

    results = []
    for (model, scope), a in sorted(agg.items()):
        ev = build_event(session_id, model, scope, a, project_id)
        if args.dry_run:
            results.append({"event": ev, "recorded": False})
            continue
        try:
            p = subprocess.run([str(RECORD), "--event", json.dumps(ev)],
                               capture_output=True, text=True, timeout=30)
            ok = p.returncode == 0
            results.append({"task_id": ev["task_id"], "tokens": ev["tokens"],
                            "model": model, "recorded": ok,
                            "stdout": p.stdout.strip()[:200]})
        except Exception as e:  # noqa: BLE001 — fail-open osservatore
            results.append({"task_id": ev["task_id"], "recorded": False, "error": str(e)})

    print(json.dumps({"status": "ok", "transcript": transcript,
                      "groups": len(agg), "results": results}, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
