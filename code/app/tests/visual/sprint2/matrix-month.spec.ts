/**
 * tests/visual/sprint2/matrix-month.spec.ts — Visual regression matrice turni mese (TSK-030).
 *
 * Naviga alla vista mensile della matrice (se il selector è presente),
 * altrimenti usa l'URL diretto con parametro ?view=month.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Matrice turni — vista mese — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — vista mese', async ({ page }) => {
    // Prova prima via URL param, poi tramite UI switch
    await page.goto('/admin/matrix?view=month');
    await page.waitForLoadState('load');

    // Se il param non è supportato, cerca lo switch view nel toolbar
    const monthBtn = page
      .getByRole('button', { name: /Mese/i })
      .or(page.getByRole('tab', { name: /Mese/i }));
    if ((await monthBtn.count()) > 0) {
      await monthBtn.first().click();
      await page.waitForLoadState('load');
    }

    await expect(page).toHaveScreenshot('matrix-month-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — vista mese', async ({ page }) => {
    await page.goto('/admin/matrix?view=month');
    await page.waitForLoadState('load');

    const monthBtn = page
      .getByRole('button', { name: /Mese/i })
      .or(page.getByRole('tab', { name: /Mese/i }));
    if ((await monthBtn.count()) > 0) {
      await monthBtn.first().click();
      await page.waitForLoadState('load');
    }

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('matrix-month-desktop-dark.png', { maxDiffPixels: 50 });
  });
});
