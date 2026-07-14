/**
 * tests/visual/sprint2/employee-requests.spec.ts — Visual regression lista richieste dipendente (TSK-030).
 *
 * Cattura la pagina /requests del dipendente con le card delle richieste.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Lista richieste dipendente — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  test('desktop light — lista richieste', async ({ page }) => {
    await page.goto('/requests');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    // Maschera timestamp per screenshot deterministico
    await page.evaluate(() => {
      document.querySelectorAll('time, [class*="text-xs"][class*="text-muted"]').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('employee-requests-desktop-light.png', {
      maxDiffPixels: 50,
    });
  });

  test('desktop dark — lista richieste', async ({ page }) => {
    await page.goto('/requests');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('time').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('employee-requests-desktop-dark.png', {
      maxDiffPixels: 50,
    });
  });

  test('mobile light — lista richieste', async ({ page }) => {
    await page.goto('/requests');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 2);
    }
    await expect(page).toHaveScreenshot('employee-requests-mobile-light.png', {
      maxDiffPixels: 50,
    });
  });
});
