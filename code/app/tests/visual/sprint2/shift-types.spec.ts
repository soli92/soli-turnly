/**
 * tests/visual/sprint2/shift-types.spec.ts — Visual regression tipologie turno (TSK-030).
 *
 * Verifica layout pagina /admin/shift-types con lista tipologie presenti nel seed.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Tipologie turno — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — lista tipologie', async ({ page }) => {
    await page.goto('/admin/shift-types');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('shift-types-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — lista tipologie', async ({ page }) => {
    await page.goto('/admin/shift-types');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('shift-types-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — lista tipologie', async ({ page }) => {
    await page.goto('/admin/shift-types');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('shift-types-mobile-light.png', { maxDiffPixels: 50 });
  });
});
