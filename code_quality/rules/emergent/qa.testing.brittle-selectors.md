---
rule_id: qa.testing.brittle-selectors
title: "Evitare waitForTimeout/networkidle e selettori basati su classi utility"
tier: emergent
status: candidate
severity: low
stack: [typescript, playwright]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-024]
---

## Rationale

La documentazione Playwright scoraggia esplicitamente:
- `page.waitForTimeout(ms)` — attese fisse che rendono i test lenti e flaky; usare le
  web-first assertion con auto-waiting.
- `waitForLoadState('networkidle')` — DISCOURAGED; usare asserzioni sullo stato UI.
- Selettori legati a classi CSS di presentazione (es. `p.text-3xl`,
  `[class*="text-sm"][class*="font-medium"]`) — si rompono a ogni restyling e non
  esprimono intento; preferire `getByRole`/`getByTestId`/`getByLabel`.

## Detection

- `waitForTimeout(`, `waitForLoadState('networkidle')`.
- `locator('[class*=...]')` o `.text-3xl`-style come hook di localizzazione.

## Remediation

- Sostituire le attese fisse con `expect(locator).toBeVisible()/toHaveText()` ecc.
- Assegnare `data-testid` stabili agli elementi da localizzare (es. il contatore
  inbox) e selezionarli per testid/role.
