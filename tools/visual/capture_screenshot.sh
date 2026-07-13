#!/usr/bin/env bash
# =============================================================================
# capture_screenshot.sh — tool deterministico capture_screenshot (EP-008, ADR-063 §D)
# =============================================================================
#
# Parte della capability UX/UI Review (EP-008), allineata al pattern
# [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica deterministica, no LLM).
# La skill `screenshot-capture-protocol` e l'agente `ux-ui-reviewer` lo richiamano
# per raccogliere evidenza visiva reale — questo file NON giudica: emette solo JSON puro.
#
# Backing eseguibile per il tool `capture_screenshot` dichiarato in `ux-ui-reviewer.md`.
# Risolve la root cause #1 di ADR-063 §Contesto (tool_uses: 0 da assenza di backing
# eseguibile). Fail-loud su dipendenze mancanti: nessun degrado silenzioso (ADR-063 §A).
#
# ADR refs: ADR-063 §D (backing eseguibile), ADR-063 §A (fail-loud),
#           ADR-008 (Playwright via Bash, no MCP).
# Wiki: wiki/concepts/ux-ui-review-capability.md  [[ux-ui-review-capability]]
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --target <string>              URL http/https | percorso file
#   --viewports <string>           viewport da catturare, csv (default "desktop,mobile")
#                                  valori riconosciuti: desktop (1280x800), mobile (375x812),
#                                  tablet (768x1024), custom WxH (es. "1440x900")
#   --out <dir>                    directory di output (default: directory corrente)
#
# CONTRATTO OUTPUT (stdout, JSON puro)
#   { target, screenshots:[{viewport, width, height, path}] }
#
# EXIT CODES
#   0  cattura completata
#   1  errore tecnico (prerequisito mancante, target non raggiungibile, ecc.)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
TARGET=""
VIEWPORTS="desktop,mobile"
OUT_DIR="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"; shift 2 ;;
    --viewports)
      VIEWPORTS="${2:-desktop,mobile}"; shift 2 ;;
    --out)
      OUT_DIR="${2:-.}"; shift 2 ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'. Uso: capture_screenshot.sh --target <url|path> [--viewports desktop,mobile] [--out <dir>]" >&2
      exit 1 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "ERRORE: --target è obbligatorio. Uso: capture_screenshot.sh --target <url|path> [--viewports desktop,mobile] [--out <dir>]" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud, nessun degrado silenzioso (ADR-063 §A+§D)
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null; then
  echo "Tool capture_screenshot richiede Node.js: non trovato." >&2
  echo "Installare Node.js (https://nodejs.org) e riprovare. (ADR-063 §D)" >&2
  exit 1
fi

if ! npx playwright --version >/dev/null 2>&1; then
  echo "Tool capture_screenshot richiede Playwright: non trovato o non configurato." >&2
  echo "Eseguire: npm i -D @playwright/test && npx playwright install chromium" >&2
  echo "Verificare la disponibilità dei tool / l'ambiente di render (ADR-063 §D)." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Creazione directory di output
# ---------------------------------------------------------------------------
mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# 4. Cattura screenshot multi-viewport via Playwright (snippet Node inline)
#    Mappa viewport presets → dimensioni; supporta formato custom WxH.
#    Output: JSON puro con array screenshots.
# ---------------------------------------------------------------------------
TARGET="$TARGET" VIEWPORTS="$VIEWPORTS" OUT_DIR="$OUT_DIR" node <<'NODE'
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const target = process.env.TARGET;
const viewportsStr = process.env.VIEWPORTS || 'desktop,mobile';
const outDir = path.resolve(process.env.OUT_DIR || '.');

// Preset viewport → { width, height }
const VIEWPORT_PRESETS = {
  desktop: { width: 1280, height: 800 },
  mobile:  { width: 375,  height: 812 },
  tablet:  { width: 768,  height: 1024 },
};

function parseViewport(v) {
  if (VIEWPORT_PRESETS[v]) return { name: v, ...VIEWPORT_PRESETS[v] };
  // Custom WxH
  const m = v.match(/^(\d+)x(\d+)$/);
  if (m) return { name: v, width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
  process.stderr.write('ERRORE: viewport non riconosciuto: ' + v + '. Valori accettati: desktop, mobile, tablet, WxH (es. 1440x900)\n');
  process.exit(1);
}

function toUrl(t) {
  if (/^https?:\/\//i.test(t)) return t;
  return 'file://' + path.resolve(t);
}

function safeName(s) {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

const viewports = viewportsStr.split(',').map(v => v.trim()).filter(Boolean).map(parseViewport);

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const screenshots = [];

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.goto(toUrl(target), { waitUntil: 'load', timeout: 30000 });

      const ts = Date.now();
      const filename = `screenshot_${safeName(vp.name)}_${ts}.png`;
      const filepath = path.join(outDir, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      await context.close();

      screenshots.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        path: filepath,
      });
    }

    const result = { target, screenshots };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    await browser.close();
    process.exit(0);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    process.stderr.write('ERRORE tecnico durante la cattura screenshot: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }
})();
NODE
