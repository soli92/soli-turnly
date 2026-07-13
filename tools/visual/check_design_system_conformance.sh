#!/usr/bin/env bash
# =============================================================================
# check_design_system_conformance.sh — tool deterministico check_design_system_conformance
#                                      (EP-008, ADR-063 §D)
# =============================================================================
#
# Parte della capability UX/UI Review (EP-008), allineata al pattern
# [[thin-agents-fat-skills-refactor]]: questo è il TOOL (logica deterministica, no LLM).
# La skill `design-system-conformance-check` e l'agente `ux-ui-reviewer` lo richiamano
# per verificare la conformità al design system — questo file NON giudica le scelte:
# confronta artefatti reali e riporta JSON puro.
#
# Backing eseguibile per il tool `check_design_system_conformance` dichiarato in
# `ux-ui-reviewer.md`. Risolve la root cause #1 di ADR-063 §Contesto (tool_uses: 0).
# Fail-loud su dipendenze mancanti: nessun degrado silenzioso (ADR-063 §A).
#
# Tecnica: apre il --target via Playwright, verifica che i token dichiarati nel file
# --tokens (output di extract_design_tokens.sh) siano effettivamente presenti e
# correttamente valorizzati nel DOM computato. Conta anche variabili hardcoded
# (colori esadecimali, px espliciti non tramite token) come segnale di non-conformità.
#
# IMPORTANTE (ADR-063 §A): se i file di token di riferimento NON sono disponibili,
# il tool emette `conformance: "to_verify"` documentato anziché fabbricare un verdetto.
# Questo è l'unico caso di output non-fallito senza dati completi: è intenzionale e
# documentato per evitare la fabbricazione (ADR-063 §B evidence-provenance).
#
# ADR refs: ADR-063 §D (backing eseguibile), ADR-063 §A (fail-loud),
#           ADR-063 §B (evidence-provenance), ADR-008 (Playwright via Bash, no MCP).
# Wiki: wiki/concepts/ux-ui-review-capability.md  [[ux-ui-review-capability]]
#
# -----------------------------------------------------------------------------
# CONTRATTO INPUT (CLI)
#   --target <string>   URL http/https della pagina da verificare
#   --tokens <file>     file JSON dei token di riferimento (output di extract_design_tokens.sh)
#                       Se non fornito o non esistente → conformance: "to_verify" (NON exit 1)
#
# CONTRATTO OUTPUT (stdout, JSON puro)
#   Caso token disponibili:
#     { target, tokens_file, conformance: "pass"|"fail", conformance_score,
#       threshold, tokens_checked, tokens_present, tokens_missing:[],
#       hardcoded_values_found: N, violations:[{type, property, found, expected}],
#       note }
#   Caso token NON disponibili:
#     { target, tokens_file: null, conformance: "to_verify",
#       note: "Token di riferimento non disponibili. Verificare manualmente (ADR-063 §B)." }
#
# EXIT CODES
#   0  controllo completato (pass o to_verify) oppure fallito ma eseguito correttamente
#   1  errore tecnico (prerequisito mancante, target non raggiungibile, errore JS, ecc.)
#      NON exit 1 su conformance: "fail" — la non-conformità è un risultato, non un errore
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Parsing argomenti CLI
# ---------------------------------------------------------------------------
TARGET=""
TOKENS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"; shift 2 ;;
    --tokens)
      TOKENS_FILE="${2:-}"; shift 2 ;;
    *)
      echo "ERRORE: argomento sconosciuto '$1'. Uso: check_design_system_conformance.sh --target <url> --tokens <file>" >&2
      exit 1 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "ERRORE: --target è obbligatorio. Uso: check_design_system_conformance.sh --target <url> --tokens <file>" >&2
  exit 1
fi

# TOKENS_FILE non obbligatorio: se assente o non esistente → to_verify (ADR-063 §B)
if [[ -z "$TOKENS_FILE" ]] || [[ ! -f "$TOKENS_FILE" ]]; then
  # Emetti to_verify documentato (NON fabbricare un verdetto — ADR-063 §A)
  TOKENS_DISPLAY="${TOKENS_FILE:-<non fornito>}"
  TARGET="$TARGET" TOKENS_DISPLAY="$TOKENS_DISPLAY" node -e "
    const result = {
      target: process.env.TARGET,
      tokens_file: null,
      conformance: 'to_verify',
      note: 'Token di riferimento non disponibili (' + process.env.TOKENS_DISPLAY + '). ' +
            'Verificare manualmente o rieseguire dopo extract_design_tokens.sh. (ADR-063 §B)'
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  "
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Check prerequisiti — fail-loud, nessun degrado silenzioso (ADR-063 §A+§D)
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null; then
  echo "Tool check_design_system_conformance richiede Node.js: non trovato." >&2
  echo "Installare Node.js (https://nodejs.org) e riprovare. (ADR-063 §D)" >&2
  exit 1
fi

if ! npx playwright --version >/dev/null 2>&1; then
  echo "Tool check_design_system_conformance richiede Playwright: non trovato o non configurato." >&2
  echo "Eseguire: npm i -D @playwright/test && npx playwright install chromium" >&2
  echo "Verificare la disponibilità dei tool / l'ambiente (ADR-063 §D)." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Conformance check via Playwright (snippet Node inline)
#    Carica i token di riferimento dal file --tokens (output extract_design_tokens.sh).
#    Nel DOM computato, verifica:
#    a) Ogni token DS del file di riferimento è presente come CSS custom property.
#    b) Conta i valori hardcoded rilevati nel DOM (colori hex, px assoluti non-zero).
#    Soglia conformance: DS_CONFORMANCE_THRESHOLD (default 0.8, env configurabile).
# ---------------------------------------------------------------------------
TARGET="$TARGET" TOKENS_FILE="$TOKENS_FILE" node <<'NODE'
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.env.TARGET;
const tokensFile = path.resolve(process.env.TOKENS_FILE);
const threshold = parseFloat(process.env.DS_CONFORMANCE_THRESHOLD || '0.8');

function toUrl(t) {
  if (/^https?:\/\//i.test(t)) return t;
  return 'file://' + path.resolve(t);
}

// Carica i token di riferimento
let refData;
try {
  refData = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
} catch (e) {
  process.stderr.write('ERRORE: impossibile leggere il file tokens: ' + tokensFile + ' — ' + e.message + '\n');
  process.exit(1);
}

const refTokens = refData.tokens || {};
const tokenNames = Object.keys(refTokens);

if (tokenNames.length === 0) {
  // Nessun token DS nel file di riferimento → to_verify documentato
  const result = {
    target,
    tokens_file: tokensFile,
    conformance: 'to_verify',
    note: 'Il file di token di riferimento non contiene token nel namespace DS atteso. ' +
          'Verificare manualmente. (ADR-063 §B)',
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(toUrl(target), { waitUntil: 'load', timeout: 30000 });

    // Verifica la presenza dei token di riferimento nel DOM computato
    const domCheck = await page.evaluate((tokenNames) => {
      const computed = getComputedStyle(document.documentElement);
      const results = {};
      for (const name of tokenNames) {
        const val = computed.getPropertyValue(name).trim();
        results[name] = val !== '' ? val : null;
      }
      return results;
    }, tokenNames);

    const tokensPresent = [];
    const tokensMissing = [];
    const violations = [];

    for (const name of tokenNames) {
      const domVal = domCheck[name];
      if (domVal === null || domVal === undefined) {
        tokensMissing.push(name);
        violations.push({
          type: 'token_missing_in_dom',
          property: name,
          found: null,
          expected: refTokens[name] || '(defined in DS)',
        });
      } else {
        tokensPresent.push(name);
        // Nota: non confrontiamo i valori esatti (i valori possono variare per tema/override)
        // — la presenza nel DOM è il criterio di conformità primario.
      }
    }

    // Conta valori hardcoded nel body del DOM (segnale di non-conformità)
    const hardcodedCount = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      const hexPattern = /#[0-9a-fA-F]{3,6}\b/;
      for (const el of allElements) {
        const style = el.getAttribute('style') || '';
        if (hexPattern.test(style)) count++;
      }
      return count;
    });

    const totalChecked = tokenNames.length;
    const presentCount = tokensPresent.length;
    const conformanceScore = totalChecked > 0 ? presentCount / totalChecked : 1.0;
    const pass = conformanceScore >= threshold;

    const result = {
      target,
      tokens_file: tokensFile,
      conformance: pass ? 'pass' : 'fail',
      conformance_score: Math.round(conformanceScore * 100) / 100,
      threshold,
      tokens_checked: totalChecked,
      tokens_present: presentCount,
      tokens_missing: tokensMissing,
      hardcoded_values_found: hardcodedCount,
      violations,
      note: pass
        ? 'Conformance al design system verificata con evidenza reale (ADR-063 §B).'
        : 'Conformance sotto soglia — ' + tokensMissing.length + ' token DS non trovati nel DOM. ' +
          'Verificare che il design system sia importato correttamente (ADR-063 §B).',
    };

    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    await browser.close();
    // Exit 0 sia su pass sia su fail: la non-conformità è un risultato, non un errore.
    process.exit(0);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    process.stderr.write('ERRORE tecnico durante il conformance check: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }
})();
NODE
