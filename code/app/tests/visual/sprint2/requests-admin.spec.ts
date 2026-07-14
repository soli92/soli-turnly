/**
 * tests/visual/sprint2/requests-admin.spec.ts — Visual regression coda approvazioni (TSK-030).
 *
 * Cattura inbox richieste lato admin: lista pannelli ApprovalPanel e vista dettaglio.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Coda approvazioni admin — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — lista richieste', async ({ page }) => {
    await page.goto('/admin/requests');
    await page.waitForLoadState('networkidle');
    // Maschera i timestamp per stabilità
    await page.evaluate(() => {
      document
        .querySelectorAll('time, [data-testid*="date"], [class*="text-xs text-muted"]')
        .forEach((el) => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
    });
    await expect(page).toHaveScreenshot('requests-admin-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — lista richieste', async ({ page }) => {
    await page.goto('/admin/requests');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('time, [data-testid*="date"]').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('requests-admin-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — lista richieste', async ({ page }) => {
    await page.goto('/admin/requests');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('requests-admin-mobile-light.png', { maxDiffPixels: 50 });
  });
});
