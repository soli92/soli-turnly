#!/usr/bin/env bash
# =============================================================================
# extract_design_tokens.sh — tool deterministico extract_design_tokens (EP-008, ADR-063 §D)
# =============================================================================
#
# Parte della capability UX/UI Review (EP-008), allineata al pattern
# [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica deterministica, no LLM).
# La skill `design-tokens-extraction` e l'agente `ux-ui-reviewer` lo richiamano
# per raccogliere i token CSS computati dal DOM — questo file NON giudica: emette JSON puro.
#
# Backing eseguibile per il tool `extract_design_tokens` dichiarato in `ux-ui-reviewer.md`.
# Risolve la root cause #1 di ADR-063 §Contesto (tool_uses: 0 da assenza di backing
# eseguibile). Fail-loud su dipendenze mancanti: nessun degrado silenzioso (ADR-063 §A).
#
# Tecnica: Playwright apre il target, inietta JS che legge le CSS custom properties
# computate dal DOM (:root e varianti). Estrae variabili con namespace DS (`--sd-*`,
# `--color-*`, `--spacing-*`, `--radius-*`, `--font-*`, `--shadow-*`, `--motion-*`).
# Se il namespace non è noto a priori, estrae TUTTE le custom properties e lascia al
# calling agent la classificazione.
#
# ADR refs: ADR-063 §D (backing eseguibile), ADR-063 §A (fail-loud),
#           ADR-008 (Playwright via Bash, no MCP).
# Wiki: wiki/concepts/ux-ui-review-capability.md  [[ux-ui-review-capability]]
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --target <string>   URL http/https della pagina da ispezionare
#   --out <file>        file di output JSON (default: stdout)
#
# CONTRATTO OUTPUT (JSON)
#   { target, tokens: { "<property-name>": "<computed-value>", ... } }
#
# EXIT CODES
#   0  estrazione completata (tokens può essere {} se il target non usa custom properties)
#   1  errore tecnico (prerequisito mancante, target non raggiungibile, ecc.)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
TARGET=""
OUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"; shift 2 ;;
    --out)
      OUT_FILE="${2:-}"; shift 2 ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'. Uso: extract_design_tokens.sh --target <url> [--out <file>]" >&2
      exit 1 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "ERRORE: --target è obbligatorio. Uso: extract_design_tokens.sh --target <url> [--out <file>]" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud, nessun degrado silenzioso (ADR-063 §A+§D)
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null; then
  echo "Tool extract_design_tokens richiede Node.js: non trovato." >&2
  echo "Installare Node.js (https://nodejs.org) e riprovare. (ADR-063 §D)" >&2
  exit 1
fi

if ! npx playwright --version >/dev/null 2>&1; then
  echo "Tool extract_design_tokens richiede Playwright: non trovato o non configurato." >&2
  echo "Eseguire: npm i -D @playwright/test && npx playwright install chromium" >&2
  echo "Verificare la disponibilità dei tool / l'ambiente (ADR-063 §D)." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Estrazione CSS custom properties via Playwright (snippet Node inline)
#    Legge le custom properties computate su :root e su document.documentElement.
#    Namespace DS riconosciuti: --sd-*, --color-*, --spacing-*, --radius-*,
#    --font-*, --shadow-*, --motion-*, --z-*, --size-*, --border-*.
#    Estrae anche tutte le proprietà non in namespace noto (complete_dump = true).
# ---------------------------------------------------------------------------
TARGET="$TARGET" OUT_FILE="$OUT_FILE" node <<'NODE'
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.env.TARGET;
const outFile = process.env.OUT_FILE || '';

// Namespace DS attesi (pattern prefix): estesi dall'ADR-018 schema EP-008 soli-boy.
const DS_PREFIXES = ['--sd-', '--color-', '--spacing-', '--radius-', '--font-',
                     '--shadow-', '--motion-', '--z-', '--size-', '--border-'];

function toUrl(t) {
  if (/^https?:\/\//i.test(t)) return t;
  return 'file://' + path.resolve(t);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(toUrl(target), { waitUntil: 'load', timeout: 30000 });

    // Inietta JS per leggere le custom properties computate dal DOM.
    const tokens = await page.evaluate((dsPrefixes) => {
      const result = {};
      const styles = document.styleSheets;
      const seen = new Set();

      // Metodo 1: scansione CSSStyleSheet rules
      for (const sheet of styles) {
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        for (const rule of rules || []) {
          if (rule.style) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (prop.startsWith('--') && !seen.has(prop)) {
                seen.add(prop);
                const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
                result[prop] = value || rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        }
      }

      // Metodo 2: computed style su documentElement (cattura variabili non in regole esplicite)
      const computed = getComputedStyle(document.documentElement);
      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        if (prop.startsWith('--') && !seen.has(prop)) {
          seen.add(prop);
          result[prop] = computed.getPropertyValue(prop).trim();
        }
      }

      return result;
    }, DS_PREFIXES);

    // Separa token DS da altri (per tracciabilità)
    const dsTokens = {};
    const otherTokens = {};
    for (const [k, v] of Object.entries(tokens)) {
      if (DS_PREFIXES.some(p => k.startsWith(p))) {
        dsTokens[k] = v;
      } else {
        otherTokens[k] = v;
      }
    }

    const result = {
      target,
      // Token in namespace DS noti — primo cittadino per check_design_system_conformance.sh
      tokens: dsTokens,
      // Token extra-namespace (utili per indagine manuale)
      tokens_other: otherTokens,
      ds_prefixes_checked: DS_PREFIXES,
    };

    const json = JSON.stringify(result, null, 2) + '\n';
    if (outFile) {
      fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
      fs.writeFileSync(path.resolve(outFile), json, 'utf8');
    } else {
      process.stdout.write(json);
    }

    await browser.close();
    process.exit(0);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    process.stderr.write('ERRORE tecnico durante l\'estrazione dei token: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }
})();
NODE
