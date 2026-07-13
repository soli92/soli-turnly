#!/usr/bin/env bash
# =============================================================================
# a11y-scan.sh — tool deterministico run_a11y_scan (EP-007, US-025, TSK-034)
# =============================================================================
#
# Parte della capability Accessibility Testing (EP-007), istanza del pattern
# [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica deterministica, no LLM).
# La skill `accessibility-testing-protocol` (US-024) e l'agente `a11y-specialist`
# (US-026) lo richiamano per nome — questo file NON ragiona e NON dichiara
# conformità: emette solo JSON puro su stdout.
#
# PATTERN.md §3 — operazione opzionale «Accessibility Scan».
# Wiki: wiki/concepts/accessibility-testing-capability.md  [[accessibility-testing-capability]]
# Runbook setup: wiki/runbooks/accessibility-testing-runbook.md §Setup dipendenze
# ADR: ADR-014 (3 modalità d'uso, no owner unico), ADR-016 §G (regola di neutralità),
#      ADR-008 (Playwright via Bash, no MCP — riusa l'install di EP-005).
#
# Formato implementativo: Bash (zero-setup, preferito) che pilota Playwright +
# axe-playwright via uno snippet Node inline. Opzione alternativa documentata:
# un equivalente `.claude/tools/a11y-scan.ts` con lo stesso contratto CLI/JSON
# può sostituire questo file in host già TypeScript-first (la logica è identica;
# la scelta del formato è a discrezione del progetto host — ADR-014 §Conseguenze).
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --target <string>            URL http/https | percorso file build | dir di build
#   --standard <string>          default "wcag22aa"
#   --include-interactive        flag booleano, default false (check tastiera/focus/reflow)
#
# CONTRATTO OUTPUT (stdout, JSON puro)
#   { target, standard, summary{critical,major,minor,manual_checks},
#     automated_findings[{id,severity,wcag,location,description,suggested_fix}],
#     manual_checks[{wcag,item,status}], positive_findings[] }
#
# EXIT CODES
#   0  scan completata (anche con findings a11y: i findings non sono errori tecnici)
#   1  errore tecnico (prerequisito mancante, target non raggiungibile, ecc.)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
TARGET=""
STANDARD="wcag22aa"
INCLUDE_INTERACTIVE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"; shift 2 ;;
    --standard)
      STANDARD="${2:-wcag22aa}"; shift 2 ;;
    --include-interactive)
      INCLUDE_INTERACTIVE="true"; shift ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'. Uso: a11y-scan.sh --target <url|path> [--standard wcag22aa] [--include-interactive]" >&2
      exit 1 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "ERRORE: --target è obbligatorio. Uso: a11y-scan.sh --target <url|path> [--standard wcag22aa] [--include-interactive]" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud, nessun degrado silenzioso (ADR-008 §Rationale 5)
# ---------------------------------------------------------------------------
if ! npx playwright --version >/dev/null 2>&1; then
  echo "Tool run_a11y_scan richiede Playwright + axe-playwright. Eseguire: npm i -D @playwright/test axe-playwright && npx playwright install chromium. Vedi wiki/runbooks/accessibility-testing-runbook.md §Setup dipendenze." >&2
  exit 1
fi

# axe-playwright deve essere risolvibile da node_modules (fail-loud separato)
if ! node -e "require.resolve('axe-playwright')" >/dev/null 2>&1; then
  echo "Tool run_a11y_scan richiede Playwright + axe-playwright. Eseguire: npm i -D @playwright/test axe-playwright && npx playwright install chromium. Vedi wiki/runbooks/accessibility-testing-runbook.md §Setup dipendenze." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Esecuzione scan via Playwright + axe-playwright (snippet Node inline)
#    Configurazione axe: runOnly tag = ["wcag2a","wcag2aa","wcag21aa","wcag22aa"]
#    Mappa l'output axe → schema standard JSON di US-025.
#    Invariante (ADR-016 §G): manual_checks MAI vuoto → default injection di
#    { wcag:"1.3.1", item:"Verify semantic structure end-to-end", status:"to_verify" }.
#    Il tool NON dichiara conformità: nessuna stringa "compliant"/"conforme" nell'output.
# ---------------------------------------------------------------------------
TARGET="$TARGET" STANDARD="$STANDARD" INCLUDE_INTERACTIVE="$INCLUDE_INTERACTIVE" node <<'NODE'
const { chromium } = require('playwright');
const { injectAxe, getViolations } = require('axe-playwright');

const target = process.env.TARGET;
const standard = process.env.STANDARD || 'wcag22aa';
const includeInteractive = process.env.INCLUDE_INTERACTIVE === 'true';

// Normalizza il target → URL navigabile da Playwright.
// URL http/https → as-is; path file/dir locale → file:// (l'host risolve la build).
function toUrl(t) {
  if (/^https?:\/\//i.test(t)) return t;
  const path = require('path');
  return 'file://' + path.resolve(t);
}

// axe severity (impact) → tassonomia Critical/Major/Minor di US-025/US-024.
function mapSeverity(impact) {
  switch (impact) {
    case 'critical': return 'Critical';
    case 'serious':  return 'Major';
    case 'moderate': return 'Minor';
    case 'minor':    return 'Minor';
    default:         return 'Minor';
  }
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(toUrl(target), { waitUntil: 'load', timeout: 30000 });
    await injectAxe(page);

    const axeOptions = {
      axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } },
    };
    const violations = await getViolations(page, undefined, axeOptions);

    const automated_findings = [];
    const summary = { critical: 0, major: 0, minor: 0, manual_checks: 0 };

    for (const v of violations) {
      const severity = mapSeverity(v.impact);
      if (severity === 'Critical') summary.critical++;
      else if (severity === 'Major') summary.major++;
      else summary.minor++;
      const wcag = (v.tags.find(t => /^wcag\d/.test(t)) || '').replace(/^wcag/, '') || 'n/a';
      for (const node of (v.nodes.length ? v.nodes : [{ target: ['(document)'] }])) {
        automated_findings.push({
          id: v.id,
          severity,
          wcag,
          location: Array.isArray(node.target) ? node.target.join(' ') : String(node.target),
          description: v.help || v.description || v.id,
          suggested_fix: v.helpUrl ? `Vedi: ${v.helpUrl}` : 'Consultare la documentazione WCAG del criterio.',
        });
      }
    }

    // Manual checks: criteri WCAG 2.2 AA non automatizzabili.
    const manual_checks = [
      { wcag: '1.3.1', item: 'Verify semantic structure end-to-end', status: 'to_verify' },
      { wcag: '1.4.3', item: 'Verify color is not the only means of conveying information', status: 'to_verify' },
    ];
    if (includeInteractive) {
      manual_checks.push(
        { wcag: '2.1.1', item: 'Verify all functionality is operable via keyboard only', status: 'to_verify' },
        { wcag: '2.4.3', item: 'Verify focus order is logical and predictable', status: 'to_verify' },
        { wcag: '1.4.10', item: 'Verify content reflows without loss at 320px width', status: 'to_verify' },
      );
    }
    // Invariante ADR-016 §G: manual_checks mai vuoto.
    if (manual_checks.length === 0) {
      manual_checks.push({ wcag: '1.3.1', item: 'Verify semantic structure end-to-end', status: 'to_verify' });
    }
    summary.manual_checks = manual_checks.length;

    const result = {
      target,
      standard,
      summary,
      automated_findings,
      manual_checks,
      positive_findings: [],
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    await browser.close();
    process.exit(0);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    process.stderr.write('ERRORE tecnico durante lo scan a11y: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }
})();
NODE
