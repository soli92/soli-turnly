/**
 * tests/visual/sprint2/dashboard.spec.ts — Visual regression dashboard admin (TSK-030).
 *
 * Viewport desktop (1280px) e mobile (375px) × temi light/dark.
 * Screenshot baseline: tests/visual/__snapshots__/desktop/ o /mobile/
 *
 * Acceptance Criteria coperti:
 *   - AC TSK-030: screenshot desktop light generato con almeno una KPI card visibile
 *   - AC TSK-030: nessun overflow orizzontale su mobile
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Dashboard admin — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  // --------------------------------------------------------------------------
  // Desktop light
  // --------------------------------------------------------------------------

  test('desktop light', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('load');
    // Rimuove aree dinamiche (timestamp, notifiche badge count) per screenshot stabili
    await page.evaluate(() => {
      // Nasconde eventuali badge count dinamici che potrebbero fluttuare
      document.querySelectorAll('[data-testid="kpi-inbox-badge"] p.text-3xl').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('dashboard-desktop-light.png', { maxDiffPixels: 50 });
  });

  // --------------------------------------------------------------------------
  // Desktop dark
  // --------------------------------------------------------------------------

  test('desktop dark', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('[data-testid="kpi-inbox-badge"] p.text-3xl').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('dashboard-desktop-dark.png', { maxDiffPixels: 50 });
  });

  // --------------------------------------------------------------------------
  // Mobile light
  // --------------------------------------------------------------------------

  test('mobile light', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('load');
    // Nessun overflow orizzontale (AC TSK-030) — solo su viewport mobile
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 2);
    }
    await expect(page).toHaveScreenshot('dashboard-mobile-light.png', { maxDiffPixels: 50 });
  });

  // --------------------------------------------------------------------------
  // Mobile dark
  // --------------------------------------------------------------------------

  test('mobile dark', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('dashboard-mobile-dark.png', { maxDiffPixels: 50 });
  });
});
