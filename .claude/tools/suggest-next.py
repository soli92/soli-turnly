#!/usr/bin/env python3
"""
suggest-next.py — Runtime Contextual Suggestions hook (EP-033, v2.24 + EP-035 rule)
Invocato da .claude/settings.json hooks.Stop dopo certi comandi.
Opera fuori dal contesto LLM: regole statiche, deterministico, nessuna chiamata API.

Adapter note: questo hook e' specifico di Claude Code (.claude/settings.json).
In Cursor/Aider: adattare al meccanismo di hook post-comando del rispettivo adapter.
L'adapter Cursor puo' usare un .cursorrules post-command hook; Aider non ha hook Stop
nativi — valutare un wrapper shell che invochi questo script dopo ogni sessione aider.

Usage:
  python3 suggest-next.py --command=/dev [--dry-run]

  --command   nome del comando appena eseguito (es. /dev, /lint, /run, /review)
  --dry-run   stampa le regole valutate su stderr, nessun output suggerito (debug)

Changelog:
  v2.24       EP-033 regole base (a11y, ux-ui-review, semantic-drift-scan, premortem, analytics)
  EP-035      Aggiunta Regola EP-035: TSK FE + design-spec senza prototipo recente → /prototype
"""

import sys
import os
import re
import argparse
from pathlib import Path
from datetime import datetime, timedelta


def find_project_root():
    """Risale dal cwd finche' trova una directory contenente .claude/."""
    current = Path(os.getcwd()).resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".claude").is_dir():
            return candidate
    return None


def read_log_tail(log_path, n=100):
    """Legge le ultime n righe di wiki/log.md. Restituisce stringa o '' se assente."""
    try:
        p = Path(log_path)
        if not p.exists():
            return ""
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(lines[-n:])
    except Exception:
        return ""


def read_config_flags(config_path):
    """
    Parsing YAML manuale di factory.config.yaml per le chiavi rilevanti.
    Restituisce dict con chiavi booleane; default False se file assente o chiave assente.
    """
    flags = {
        "a11y_enabled": False,
        "ux_ui_enabled": False,
        "visual_oracle_enabled": False,
        "code_quality_enabled": False,
        "analytics_enabled": False,
        # EP-035: Prototype Generation Layer
        "prototyping_enabled": False,
    }
    try:
        p = Path(config_path)
        if not p.exists():
            return flags
        text = p.read_text(encoding="utf-8", errors="replace")
        if re.search(r"^\s*enabled:\s*true", text, re.MULTILINE):
            # Contextual per-section detection
            pass
        if re.search(r"a11y\s*:\s*\n(?:.*\n)*?\s*enabled:\s*true", text) or \
           re.search(r"a11y\.enabled:\s*true", text):
            flags["a11y_enabled"] = True
        if re.search(r"ux_ui\s*:\s*\n(?:.*\n)*?\s*enabled:\s*true", text) or \
           re.search(r"ux_ui\.enabled:\s*true", text):
            flags["ux_ui_enabled"] = True
        if re.search(r"visual_oracle\s*:\s*\n(?:.*\n)*?\s*enabled:\s*true", text) or \
           re.search(r"fe_correctness\.visual_oracle\.enabled:\s*true", text):
            flags["visual_oracle_enabled"] = True
        if re.search(r"code_quality\s*:\s*\n(?:.*\n)*?\s*enabled:\s*true", text) or \
           re.search(r"code_quality\.enabled:\s*true", text):
            flags["code_quality_enabled"] = True
        if re.search(r"analytics\s*:\s*\n(?:.*\n)*?\s*enabled:\s*true", text) or \
           re.search(r"analytics\.measurement\.enabled:\s*true", text):
            flags["analytics_enabled"] = True
        # EP-035: rileva prototyping.enabled: true
        # Il blocco prototyping: come chiave top-level puo' essere assente (backward compat — silently skip).
        # NOTA: la ricerca esclude i commenti YAML (righe che iniziano con #).
        # Pattern: blocco "prototyping:" top-level seguito da "enabled: true" su riga non-commento.
        # Fallback: voce "prototyping.enabled: true" come chiave dot-notation (non nei commenti).
        _text_no_comments = "\n".join(
            line for line in text.splitlines()
            if not line.lstrip().startswith("#")
        )
        if re.search(r"^prototyping\s*:\s*$", _text_no_comments, re.MULTILINE) and \
           re.search(r"prototyping\s*:\s*\n(?:.*\n)*?\s*enabled:\s*true", _text_no_comments):
            flags["prototyping_enabled"] = True
        elif re.search(r"^prototyping\.enabled:\s*true\s*$", _text_no_comments, re.MULTILINE):
            flags["prototyping_enabled"] = True
    except Exception:
        pass
    return flags


def has_recent_prototype_in_log(log_tail, us_id, days=7):
    """
    Regola EP-035 — deduplication.
    Restituisce True se wiki/log.md contiene un'entry PROTOTYPE_GENERATED
    per us_id negli ultimi `days` giorni.
    Pattern cercato: riga con PROTOTYPE_GENERATED + us_id (case-insensitive)
    entro la finestra temporale.
    Se us_id e' None/vuoto, non puo' deduplicare → assume nessun prototipo recente.
    """
    if not us_id:
        return False
    try:
        cutoff = datetime.utcnow().date() - timedelta(days=days)
        # Cerca entry con data + PROTOTYPE_GENERATED + us_id
        # Formato log: ## YYYY-MM-DD HH:MM — prototype <id>
        # oppure riga con marker PROTOTYPE_GENERATED: ...
        date_pattern = re.compile(r"##\s+(\d{4}-\d{2}-\d{2})")
        prototype_pattern = re.compile(
            r"PROTOTYPE_GENERATED|prototype\s+" + re.escape(us_id),
            re.IGNORECASE,
        )
        us_pattern = re.compile(re.escape(us_id), re.IGNORECASE)

        lines = log_tail.splitlines()
        current_date = None
        for line in lines:
            date_match = date_pattern.search(line)
            if date_match:
                try:
                    current_date = datetime.strptime(date_match.group(1), "%Y-%m-%d").date()
                except ValueError:
                    current_date = None
            # Controlla se questa riga contiene PROTOTYPE_GENERATED + us_id
            if current_date and current_date >= cutoff:
                if prototype_pattern.search(line) and us_pattern.search(line):
                    return True
        return False
    except Exception:
        return False


def has_design_spec_for_us(root, us_id):
    """
    Regola EP-035 — verifica presenza di design-spec.
    Cerca:
      1. output/designs/{us_id}-spec.md (pattern esplicito EP-035)
      2. wiki/sources/*{us_id}* con pattern 'design' o 'spec' nel nome
      3. management/kanban/**/{us_id}**/design-spec.md (prossimita' dir US)
    Restituisce True se almeno uno dei path esiste.
    Se us_id e' None/vuoto → False (non puo' cercare).
    """
    if not us_id:
        return False
    try:
        us_id_lower = us_id.lower()

        # 1. output/designs/{us_id}-spec.md
        candidate1 = root / "output" / "designs" / f"{us_id}-spec.md"
        if candidate1.exists():
            return True

        # 2. wiki/sources/*{us_id}* con 'design' o 'spec' nel nome file
        wiki_sources = root / "wiki" / "sources"
        if wiki_sources.is_dir():
            for f in wiki_sources.iterdir():
                fname = f.name.lower()
                if us_id_lower in fname and ("design" in fname or "spec" in fname):
                    return True

        # 3. management/kanban/**/{us_id}*/design-spec.md
        kanban_root = root / "management" / "kanban"
        if kanban_root.is_dir():
            for ep_dir in kanban_root.iterdir():
                if not ep_dir.is_dir():
                    continue
                for us_dir in ep_dir.iterdir():
                    if not us_dir.is_dir():
                        continue
                    if us_id_lower in us_dir.name.lower():
                        spec_candidate = us_dir / "design-spec.md"
                        if spec_candidate.exists():
                            return True

        return False
    except Exception:
        return False


def extract_us_id_from_log(log_tail):
    """
    Estrae l'us_id dall'ultima entry di log che menziona un layer fe.
    Cerca pattern 'US-NNN' nelle vicinanze di 'layer: fe' o 'layer=fe'.
    Restituisce il primo us_id trovato o None.
    """
    try:
        # Cerca le ultime righe che menzionano FE
        fe_section = ""
        lines = log_tail.splitlines()
        # Cerca l'ultima sezione ## che contiene layer fe
        current_section_lines = []
        last_fe_section_lines = []
        for line in lines:
            if line.startswith("## "):
                # nuova sezione: salva quella precedente se era FE
                section_text = "\n".join(current_section_lines)
                if re.search(r"layer:\s*fe\b|layer=fe\b|TSK.*\bfe\b", section_text, re.IGNORECASE):
                    last_fe_section_lines = current_section_lines[:]
                current_section_lines = [line]
            else:
                current_section_lines.append(line)
        # Controlla anche l'ultima sezione accumulata
        section_text = "\n".join(current_section_lines)
        if re.search(r"layer:\s*fe\b|layer=fe\b|TSK.*\bfe\b", section_text, re.IGNORECASE):
            last_fe_section_lines = current_section_lines[:]

        if last_fe_section_lines:
            section_text = "\n".join(last_fe_section_lines)
            m = re.search(r"\b(US-\d+)\b", section_text)
            if m:
                return m.group(1)
        return None
    except Exception:
        return None


def command_installed(root, cmd_name):
    """
    Verifica se .claude/commands/<cmd_name>.md esiste.
    cmd_name deve essere senza slash (es. 'a11y', 'semantic-drift-scan').
    """
    try:
        cmd_file = root / ".claude" / "commands" / f"{cmd_name}.md"
        return cmd_file.exists()
    except Exception:
        return False


def evaluate_rules(command, log_tail, flags, root):
    """
    Applica le regole statiche per il comando ricevuto.
    Restituisce lista di stringhe di suggerimento (prefisso '💡' aggiunto dal caller).
    """
    suggestions = []
    cmd = command.lstrip("/")

    # --- /dev rules ---
    if cmd == "dev":
        # Individua se l'ultima entry di log riguarda un TSK FE
        fe_in_log = bool(
            re.search(r"layer:\s*fe\b|layer=fe\b|TSK.*\bfe\b", log_tail, re.IGNORECASE)
        )
        if fe_in_log:
            # Regola 1: suggerisci /a11y se non gia' nel log per questa US
            a11y_in_log = bool(re.search(r"/a11y\b|a11y.*done|a11y.*completat", log_tail, re.IGNORECASE))
            if not a11y_in_log and command_installed(root, "a11y"):
                suggestions.append("Considera /a11y: TSK FE completato.")
            # Regola 2: suggerisci /ux-ui-review se non gia' nel log
            ux_in_log = bool(re.search(r"/ux-ui-review\b|ux-ui-review.*done|ux.ui.*review.*completat", log_tail, re.IGNORECASE))
            if not ux_in_log and command_installed(root, "ux-ui-review"):
                suggestions.append("Considera /ux-ui-review: componenti UI prodotti.")
            # Regola EP-035: suggerisci /prototype se prototyping abilitato,
            # la US ha design-spec ma nessun prototipo recente in wiki/log.md
            # Backward compat: se prototyping: non presente in config → skip silenzioso
            if flags.get("prototyping_enabled", False) and command_installed(root, "prototype"):
                us_id = extract_us_id_from_log(log_tail)
                has_spec = has_design_spec_for_us(root, us_id)
                has_proto = has_recent_prototype_in_log(log_tail, us_id, days=7)
                if has_spec and not has_proto:
                    us_label = us_id if us_id else "<US-id>"
                    suggestions.append(
                        f"Suggerimento EP-035: {us_label} ha spec ma nessun prototipo recente"
                        f" → considera /prototype {us_label}"
                    )

    # --- /lint rules ---
    elif cmd == "lint":
        # Regola 3: staleness nel log
        staleness_in_log = bool(re.search(r"staleness|WARNING staleness", log_tail, re.IGNORECASE))
        if staleness_in_log and command_installed(root, "semantic-drift-scan"):
            suggestions.append("Considera /semantic-drift-scan: il lint segnala staleness.")

    # --- /run rules ---
    elif cmd == "run":
        # Regola 4: epic aperta senza premortem
        # Cerca pattern "status: open" associato a epic (EP-NNN) senza "premortem" nelle vicinanze
        epic_open = re.findall(r"(EP-\d+).*status:\s*open|status:\s*open.*(EP-\d+)", log_tail, re.IGNORECASE)
        premortem_in_log = bool(re.search(r"premortem", log_tail, re.IGNORECASE))
        if epic_open and not premortem_in_log and command_installed(root, "premortem"):
            # Estrai il primo epic id trovato
            epic_id = ""
            for m in epic_open:
                epic_id = m[0] if m[0] else m[1]
                if epic_id:
                    break
            if epic_id:
                suggestions.append(f"Considera /premortem {epic_id}: epic aperta senza premortem.")
            else:
                suggestions.append("Considera /premortem <epic-id>: epic aperta senza premortem.")

    # --- /review rules ---
    elif cmd == "review":
        # Regola 5: ultima entry "pass" + >=3 TSK done nella settimana corrente
        pass_in_log = bool(re.search(r"\bpass\b", log_tail, re.IGNORECASE))
        if pass_in_log:
            # Conta le entry "done" nella settimana corrente
            today = datetime.utcnow().date()
            week_start = today - timedelta(days=today.weekday())
            week_pattern = re.compile(
                r"\[(\d{4}-\d{2}-\d{2})[^\]]*\].*\bdone\b", re.IGNORECASE
            )
            done_this_week = 0
            for m in week_pattern.finditer(log_tail):
                try:
                    entry_date = datetime.strptime(m.group(1), "%Y-%m-%d").date()
                    if entry_date >= week_start:
                        done_this_week += 1
                except ValueError:
                    pass
            if done_this_week >= 3 and command_installed(root, "analytics"):
                suggestions.append(
                    "Considera /analytics: settimana produttiva — un report costi potrebbe essere utile."
                )

    return suggestions


def main():
    parser = argparse.ArgumentParser(
        description="suggest-next.py — Runtime Contextual Suggestions (EP-033, v2.24)"
    )
    parser.add_argument(
        "--command",
        required=True,
        help="Nome del comando appena eseguito (es. /dev, /lint, /run, /review)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Stampa le regole valutate su stderr, nessun output suggerito (debug)",
    )
    args = parser.parse_args()

    root = find_project_root()
    if root is None:
        sys.exit(0)

    log_path = root / "wiki" / "log.md"
    config_path = root / "factory.config.yaml"

    log_tail = read_log_tail(log_path, n=100)
    flags = read_config_flags(config_path)

    if args.dry_run:
        print(f"[dry-run] command={args.command}", file=sys.stderr)
        print(f"[dry-run] root={root}", file=sys.stderr)
        print(f"[dry-run] log_tail_len={len(log_tail)}", file=sys.stderr)
        print(f"[dry-run] flags={flags}", file=sys.stderr)

    suggestions = evaluate_rules(args.command, log_tail, flags, root)

    if args.dry_run:
        print(f"[dry-run] suggestions={suggestions}", file=sys.stderr)
        sys.exit(0)

    for s in suggestions:
        print(f"\U0001F4A1 {s}")

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
