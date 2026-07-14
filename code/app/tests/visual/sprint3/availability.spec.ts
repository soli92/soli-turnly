/**
 * tests/visual/sprint3/availability.spec.ts — Visual regression disponibilità dipendente (TSK-030).
 *
 * Cattura la pagina /availability (TSK-025) con il calendario disponibilità
 * del dipendente.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Disponibilità dipendente — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  test('desktop light — calendario disponibilità', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    // Maschera intestazione mese (dipende dalla data corrente)
    await page.evaluate(() => {
      document.querySelectorAll('.rbc-toolbar-label, [class*="month-label"], h2').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('availability-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — calendario disponibilità', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('.rbc-toolbar-label, [class*="month-label"], h2').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('availability-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — disponibilità', async ({ page }) => {
    await page.goto('/availability');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 2);
    }
    await expect(page).toHaveScreenshot('availability-mobile-light.png', { maxDiffPixels: 50 });
  });
});
