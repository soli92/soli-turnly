/**
 * tests/visual/sprint2/employee-new-request.spec.ts — Visual regression wizard nuova richiesta (TSK-030).
 *
 * Cattura lo step 1 del wizard (selezione tipo) — step 2+ dipende da selezione
 * e non è deterministico senza ulteriore fixture.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Wizard nuova richiesta — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  test('desktop light — step 1 selezione tipo', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('load');
    // Attende il selector dei tipi
    await page.getByTestId('request-type-radio-absence').waitFor({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('new-request-step1-desktop-light.png', {
      maxDiffPixels: 50,
    });
  });

  test('desktop dark — step 1', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('load');
    await page.getByTestId('request-type-radio-absence').waitFor({ timeout: 10_000 });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('new-request-step1-desktop-dark.png', {
      maxDiffPixels: 50,
    });
  });

  test('desktop light — step 2 assenza (dopo selezione tipo)', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('load');
    await page.getByTestId('request-type-radio-absence').click();
    await page.getByTestId('type-selector-next-btn').click();
    // Step 2 caricato — attende il form assenza (CSR state change, non c'è network request)
    await page.waitForSelector('[data-testid="absence-form-next-btn"]', { timeout: 12_000 });
    await expect(page).toHaveScreenshot('new-request-step2-absence-desktop-light.png', {
      maxDiffPixels: 50,
    });
  });

  test('mobile light — step 1', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForLoadState('load');
    await page.getByTestId('request-type-radio-absence').waitFor({ timeout: 10_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 2);
    }
    await expect(page).toHaveScreenshot('new-request-step1-mobile-light.png', {
      maxDiffPixels: 50,
    });
  });
});
