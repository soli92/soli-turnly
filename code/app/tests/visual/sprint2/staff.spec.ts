/**
 * tests/visual/sprint2/staff.spec.ts — Visual regression anagrafica dipendenti (TSK-030).
 *
 * Verifica layout tabella dipendenti desktop e mobile, temi light/dark.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Anagrafica dipendenti — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — lista dipendenti', async ({ page }) => {
    await page.goto('/admin/staff');
    await page.waitForLoadState('networkidle');
    // Attende tabella desktop o layout mobile alternativo (hidden md:block su mobile)
    await page
      .waitForSelector('[data-testid="staff-table-container"], [data-testid="staff-list-mobile"]', {
        timeout: 10_000,
      })
      .catch(() => {});
    await expect(page).toHaveScreenshot('staff-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — lista dipendenti', async ({ page }) => {
    await page.goto('/admin/staff');
    await page.waitForLoadState('networkidle');
    await page
      .waitForSelector('[data-testid="staff-table-container"], [data-testid="staff-list-mobile"]', {
        timeout: 10_000,
      })
      .catch(() => {});
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('staff-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — lista dipendenti', async ({ page }) => {
    await page.goto('/admin/staff');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('staff-mobile-light.png', { maxDiffPixels: 50 });
  });
});
