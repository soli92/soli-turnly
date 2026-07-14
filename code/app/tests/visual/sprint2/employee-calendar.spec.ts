/**
 * tests/visual/sprint2/employee-calendar.spec.ts — Visual regression calendario dipendente (TSK-030).
 *
 * Acceptance Criteria TSK-030:
 *   - Pagina employee calendar (mobile 375px): nessun overflow orizzontale visibile
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Calendario dipendente — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  test('desktop light — calendario mese', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    // Attende che il calendario react-big-calendar sia renderizzato
    const calendar = page.locator('.rbc-calendar');
    if ((await calendar.count()) > 0) {
      await calendar.waitFor({ state: 'visible', timeout: 10_000 });
    }
    // Maschera data corrente (header) per stabilità cross-giorno
    await page.evaluate(() => {
      document.querySelectorAll('.rbc-toolbar-label').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('employee-calendar-desktop-light.png', {
      maxDiffPixels: 50,
    });
  });

  test('desktop dark — calendario mese', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('.rbc-toolbar-label').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('employee-calendar-desktop-dark.png', {
      maxDiffPixels: 50,
    });
  });

  /**
   * AC TSK-030: nessun overflow orizzontale su mobile 375px.
   */
  test('mobile light — nessun overflow orizzontale', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');

    // Verifica nessun overflow orizzontale (AC esplicito TSK-030) — solo su viewport mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 2);
    }

    // Screenshot: deve mostrare il calendario senza overflow
    await page.evaluate(() => {
      document.querySelectorAll('.rbc-toolbar-label').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('employee-calendar-mobile-light.png', {
      maxDiffPixels: 50,
    });
  });
});
