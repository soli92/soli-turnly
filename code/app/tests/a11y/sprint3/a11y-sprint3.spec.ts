/**
 * tests/a11y/sprint3/a11y-sprint3.spec.ts — A11y WCAG 2.2 AA — Sprint 3 (TSK-030).
 *
 * Esegue axe-core su tutte le pagine Sprint 3:
 *   - /availability (TSK-025)
 *   - /admin/swap (TSK-026)
 *   - /admin/reports/overtime (TSK-027)
 *   - /notifications (TSK-028)
 *   - /requests/new con tipi: absence, shift_swap, new_shift, modify_shift
 *
 * Acceptance Criteria TSK-030:
 *   - 0 violazioni critical su tutte le pagine Sprint 3
 *   - Nessuna violazione "color-contrast" sull'intera suite
 *   - factory.config.yaml: a11y.fail_ci_on: critical
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Configurazione axe
// ---------------------------------------------------------------------------

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] as const;

// ---------------------------------------------------------------------------
// Pagine Sprint 3 — employee routes
// ---------------------------------------------------------------------------

const employeePagesSprint3 = [
  { name: 'availability', path: '/availability' },
  { name: 'notifications', path: '/notifications' },
  { name: 'new-request-absence', path: '/requests/new' },
] as const;

// ---------------------------------------------------------------------------
// Pagine Sprint 3 — admin routes
// ---------------------------------------------------------------------------

const adminPagesSprint3 = [
  { name: 'swap-admin', path: '/admin/swap' },
  { name: 'reports-overtime', path: '/admin/reports/overtime' },
  { name: 'notifications-admin', path: '/notifications' },
] as const;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildViolationSummary(
  violations: Array<{
    impact?: string | null;
    id: string;
    description: string;
    nodes: unknown[];
    helpUrl: string;
  }>
): string {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.description} (${v.nodes.length} node(s)) — ${v.helpUrl}`
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// Suite employee — Sprint 3
// ---------------------------------------------------------------------------

test.describe('A11y WCAG 2.2 AA — Sprint 3 — Employee routes', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  for (const { name, path } of employeePagesSprint3) {
    test(`${name} — zero violazioni critical`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

      const blocking = results.violations.filter((v) => v.impact === 'critical');

      if (blocking.length > 0) {
        const summary = buildViolationSummary(blocking);
        expect.soft(blocking, `Violazioni a11y su ${path} (employee):\n${summary}`).toHaveLength(0);
      }

      expect(blocking).toHaveLength(0);
    });
  }

  // Wizard nuova richiesta — step 2 per tutti i tipi (Sprint 3: 4 tipi)
  test('wizard-step2-shift_swap — zero violazioni critical', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('networkidle');

    // Seleziona tipo scambio turno
    const swapRadio = page.getByTestId('request-type-radio-shift_swap');
    if ((await swapRadio.count()) > 0) {
      await swapRadio.click();
      await page.getByTestId('type-selector-next-btn').click();
      await page.waitForLoadState('networkidle');
    }

    const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

    const blocking = results.violations.filter((v) => v.impact === 'critical');

    if (blocking.length > 0) {
      const summary = buildViolationSummary(blocking);
      expect
        .soft(blocking, `Violazioni a11y su /requests/new step shift_swap:\n${summary}`)
        .toHaveLength(0);
    }

    expect(blocking).toHaveLength(0);
  });

  test('wizard-step2-new_shift — zero violazioni critical', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('networkidle');

    const newShiftRadio = page.getByTestId('request-type-radio-new_shift');
    if ((await newShiftRadio.count()) > 0) {
      await newShiftRadio.click();
      await page.getByTestId('type-selector-next-btn').click();
      await page.waitForLoadState('networkidle');
    }

    const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

    const blocking = results.violations.filter((v) => v.impact === 'critical');

    expect(blocking).toHaveLength(0);
  });

  test('wizard-step2-modify_shift — zero violazioni critical', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('networkidle');

    const modifyRadio = page.getByTestId('request-type-radio-modify_shift');
    if ((await modifyRadio.count()) > 0) {
      await modifyRadio.click();
      await page.getByTestId('type-selector-next-btn').click();
      await page.waitForLoadState('networkidle');
    }

    const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

    const blocking = results.violations.filter((v) => v.impact === 'critical');

    expect(blocking).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite admin — Sprint 3
// ---------------------------------------------------------------------------

test.describe('A11y WCAG 2.2 AA — Sprint 3 — Admin routes', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  for (const { name, path } of adminPagesSprint3) {
    test(`${name} — zero violazioni critical`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

      const blocking = results.violations.filter((v) => v.impact === 'critical');

      if (blocking.length > 0) {
        const summary = buildViolationSummary(blocking);
        expect.soft(blocking, `Violazioni a11y su ${path} (admin):\n${summary}`).toHaveLength(0);
      }

      expect(blocking).toHaveLength(0);
    });
  }

  // Swap admin: verifica anche tab "Coda scambi" se presente
  test('swap-admin — tab coda scambi — zero violazioni', async ({ page }) => {
    await page.goto('/admin/swap');
    await page.waitForLoadState('networkidle');

    // Naviga al tab coda scambi se presente
    const queueTab = page
      .getByRole('tab', { name: /Coda scambi|Scambi in attesa/i })
      .or(page.getByRole('button', { name: /Coda scambi/i }));
    if ((await queueTab.count()) > 0) {
      await queueTab.first().click();
      await page.waitForLoadState('networkidle');
    }

    const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

    const blocking = results.violations.filter((v) => v.impact === 'critical');

    expect(blocking).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Verifica specifica: color-contrast — Sprint 3 (AC TSK-030) — employee
// ---------------------------------------------------------------------------

test.describe('A11y — color-contrast Sprint 3 — Employee', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  test('availability — nessuna violazione color-contrast', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    expect(
      contrastViolations,
      `Violazioni color-contrast su /availability: ${contrastViolations.map((v) => v.description).join(', ')}`
    ).toHaveLength(0);
  });

  test('notifications — nessuna violazione color-contrast', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    expect(
      contrastViolations,
      `Violazioni color-contrast su /notifications: ${contrastViolations.map((v) => v.description).join(', ')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Verifica specifica: color-contrast — Sprint 3 (AC TSK-030) — admin
// ---------------------------------------------------------------------------

test.describe('A11y — color-contrast Sprint 3 — Admin', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('reports-overtime — nessuna violazione color-contrast', async ({ page }) => {
    await page.goto('/admin/reports/overtime');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    expect(
      contrastViolations,
      `Violazioni color-contrast su /admin/reports/overtime: ${contrastViolations.map((v) => v.description).join(', ')}`
    ).toHaveLength(0);
  });

  test('swap-admin — nessuna violazione color-contrast', async ({ page }) => {
    await page.goto('/admin/swap');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    expect(
      contrastViolations,
      `Violazioni color-contrast su /admin/swap: ${contrastViolations.map((v) => v.description).join(', ')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test negativo: il test FALLISCE se ci sono violazioni critical
// ---------------------------------------------------------------------------

test.describe('A11y Sprint 3 — verifica negativa (axe attivo)', () => {
  test('axe-core rileva violazioni su elemento intenzionalmente non accessibile', async ({
    page,
  }) => {
    // Pagina con violazioni note: button senza nome accessibile + immagine senza alt
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="it">
        <body>
          <!-- violazione: button senza nome accessibile (wcag2a) -->
          <button></button>
          <!-- violazione: immagine senza alt (wcag2a) -->
          <img src="/missing.png">
        </body>
      </html>
    `);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a']).analyze();

    // axe deve aver trovato almeno una violazione
    expect(results.violations.length).toBeGreaterThan(0);
  });
});
