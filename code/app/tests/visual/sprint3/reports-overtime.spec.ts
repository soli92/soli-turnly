/**
 * tests/visual/sprint3/reports-overtime.spec.ts — Visual regression report straordinari (TSK-030).
 *
 * Cattura la pagina /admin/reports/overtime (TSK-027) con tabella e grafici.
 * Maschera i valori numerici dei grafici per screenshot stabili.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Report straordinari — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — report straordinari', async ({ page }) => {
    await page.goto('/admin/reports/overtime');
    await page.waitForLoadState('networkidle');
    // Maschera valori numerici nei grafici (possono variare col tempo)
    await page.evaluate(() => {
      // Nasconde canvas o SVG dei grafici per screenshot stabili
      document.querySelectorAll('canvas, svg text, [class*="recharts-text"]').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('reports-overtime-desktop-light.png', {
      maxDiffPixels: 80,
    });
  });

  test('desktop dark — report straordinari', async ({ page }) => {
    await page.goto('/admin/reports/overtime');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('canvas, svg text, [class*="recharts-text"]').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    // Aspetta che le animazioni Recharts/SVG si stabilizzino
    await page.waitForSelector('.recharts-surface, svg', { state: 'visible' }).catch(() => {});
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        })
    );
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('reports-overtime-desktop-dark.png', { maxDiffPixels: 80 });
  });

  test('mobile light — report straordinari', async ({ page }) => {
    await page.goto('/admin/reports/overtime');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 5);
    }
    await expect(page).toHaveScreenshot('reports-overtime-mobile-light.png', { maxDiffPixels: 80 });
  });
});
