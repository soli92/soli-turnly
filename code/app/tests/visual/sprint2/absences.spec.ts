/**
 * tests/visual/sprint2/absences.spec.ts — Visual regression form assenze (TSK-030).
 *
 * Cattura il form di registrazione assenza (stato vuoto) e la sezione lista assenze esistenti.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Registrazione assenze — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — form vuoto', async ({ page }) => {
    await page.goto('/admin/absences');
    await page.waitForLoadState('load');
    await expect(page.getByRole('heading', { name: /Registra nuova assenza/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('absences-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — form vuoto', async ({ page }) => {
    await page.goto('/admin/absences');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('absences-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — form vuoto', async ({ page }) => {
    await page.goto('/admin/absences');
    await page.waitForLoadState('load');
    await expect(page).toHaveScreenshot('absences-mobile-light.png', { maxDiffPixels: 50 });
  });
});
