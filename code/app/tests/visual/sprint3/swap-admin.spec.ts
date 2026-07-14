/**
 * tests/visual/sprint3/swap-admin.spec.ts — Visual regression pagina swap admin (TSK-030).
 *
 * Acceptance Criteria TSK-030:
 *   - Screenshot mostra i due pannelli di selezione affiancati (desktop)
 *     o in colonna (mobile)
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Swap admin — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  /**
   * AC TSK-030: desktop mostra i due pannelli affiancati.
   */
  test('desktop light — due pannelli affiancati', async ({ page }) => {
    await page.goto('/admin/swap');
    await page.waitForLoadState('networkidle');
    // Maschera timestamp per screenshot stabili
    await page.evaluate(() => {
      document.querySelectorAll('time').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('swap-admin-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — due pannelli affiancati', async ({ page }) => {
    await page.goto('/admin/swap');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('time').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('swap-admin-desktop-dark.png', { maxDiffPixels: 50 });
  });

  /**
   * AC TSK-030: mobile mostra pannelli in colonna (non affiancati).
   */
  test('mobile light — pannelli in colonna', async ({ page }) => {
    await page.goto('/admin/swap');
    await page.waitForLoadState('networkidle');

    // Verifica nessun overflow orizzontale — solo su viewport mobile
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 5);
    }

    await expect(page).toHaveScreenshot('swap-admin-mobile-light.png', { maxDiffPixels: 50 });
  });
});
