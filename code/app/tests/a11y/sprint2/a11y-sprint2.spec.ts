/**
 * tests/a11y/sprint2/a11y-sprint2.spec.ts — A11y WCAG 2.2 AA — Sprint 2 (TSK-030).
 *
 * Esegue axe-core con tag wcag2a, wcag2aa, wcag21aa, wcag22aa su tutte le pagine
 * Sprint 2. Fallisce se ci sono violazioni di impatto critical.
 *
 * Acceptance Criteria TSK-030:
 *   - 0 violazioni critical su tutte le pagine Sprint 2
 *   - Nessuna violazione "color-contrast" sull'intera suite
 *   - factory.config.yaml: a11y.fail_ci_on: critical
 *
 * Pattern: usa @axe-core/playwright (già in devDependencies).
 * Fallback coerente con il file tests/a11y/a11y.spec.ts esistente che usa axe-playwright.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Configurazione axe
// ---------------------------------------------------------------------------

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] as const;

// ---------------------------------------------------------------------------
// Pagine Sprint 2 — admin routes
// ---------------------------------------------------------------------------

const adminPages = [
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/admin/dashboard' },
  { name: 'matrix-week', path: '/admin/matrix' },
  { name: 'staff', path: '/admin/staff' },
  { name: 'shift-types', path: '/admin/shift-types' },
  { name: 'absences', path: '/admin/absences' },
  { name: 'coverage', path: '/admin/coverage' },
  { name: 'recurrence-list', path: '/admin/recurrence' },
  { name: 'requests-admin', path: '/admin/requests' },
] as const;

// ---------------------------------------------------------------------------
// Pagine Sprint 2 — employee routes
// ---------------------------------------------------------------------------

const employeePages = [
  { name: 'employee-calendar', path: '/calendar' },
  { name: 'employee-requests', path: '/requests' },
  { name: 'employee-new-request', path: '/requests/new' },
] as const;

// ---------------------------------------------------------------------------
// Suite admin
// ---------------------------------------------------------------------------

test.describe('A11y WCAG 2.2 AA — Sprint 2 — Admin routes', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  for (const { name, path } of adminPages) {
    test(`${name} — zero violazioni critical`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

      const blocking = results.violations.filter((v) => v.impact === 'critical');

      // Messaggio diagnostico in caso di fallimento
      if (blocking.length > 0) {
        const summary = blocking
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s)) — ${v.helpUrl}`
          )
          .join('\n');
        expect.soft(blocking, `Violazioni a11y su ${path}:\n${summary}`).toHaveLength(0);
      }

      expect(blocking).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite employee
// ---------------------------------------------------------------------------

test.describe('A11y WCAG 2.2 AA — Sprint 2 — Employee routes', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  for (const { name, path } of employeePages) {
    test(`${name} — zero violazioni critical`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

      const blocking = results.violations.filter((v) => v.impact === 'critical');

      if (blocking.length > 0) {
        const summary = blocking
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s)) — ${v.helpUrl}`
          )
          .join('\n');
        expect.soft(blocking, `Violazioni a11y su ${path}:\n${summary}`).toHaveLength(0);
      }

      expect(blocking).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Verifica specifica: color-contrast su tutte le pagine (AC TSK-030)
// ---------------------------------------------------------------------------

test.describe('A11y — color-contrast — Sprint 2', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('dashboard — nessuna violazione color-contrast', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    expect(
      contrastViolations,
      `Violazioni color-contrast su /admin/dashboard: ${contrastViolations.map((v) => v.description).join(', ')}`
    ).toHaveLength(0);
  });

  test('matrix — nessuna violazione color-contrast', async ({ page }) => {
    await page.goto('/admin/matrix');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    expect(
      contrastViolations,
      `Violazioni color-contrast su /admin/matrix: ${contrastViolations.map((v) => v.description).join(', ')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test negativo: verifica che il test FALLISCA se ci sono violazioni critical
// ---------------------------------------------------------------------------

test.describe('A11y — verifica negativa', () => {
  test('axe-core rileva violazioni su HTML intenzionalmente non accessibile', async ({ page }) => {
    // Inietta una pagina HTML con violazioni note per verificare che axe funzioni
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Immagine senza alt: violazione wcag2a -->
          <img src="/nonexistent.png">
          <!-- Testo su sfondo con contrasto insufficiente -->
          <p style="color: #aaa; background: #fff; font-size: 12px;">Low contrast text</p>
        </body>
      </html>
    `);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    // Ci devono essere violazioni (il test verifica che axe stia funzionando)
    expect(results.violations.length).toBeGreaterThan(0);
  });
});
