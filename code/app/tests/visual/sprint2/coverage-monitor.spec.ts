/**
 * tests/visual/sprint2/coverage-monitor.spec.ts — Visual regression monitor copertura (TSK-030).
 *
 * Acceptance Criteria TSK-030:
 *   - Screenshot cattura la cella sotto-coperta con sfondo rosso (se presente nel seed)
 *   - Tab "Monitor copertura" attivo nello screenshot
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Monitor copertura — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('desktop light — tab Monitor attivo', async ({ page }) => {
    await page.goto('/admin/coverage');
    await page.waitForLoadState('networkidle');

    // Attiva tab Monitor
    const monitorTab = page.getByRole('tab', { name: /Monitor copertura/i });
    if ((await monitorTab.count()) > 0) {
      await monitorTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    await expect(page).toHaveScreenshot('coverage-monitor-desktop-light.png', {
      maxDiffPixels: 50,
    });
  });

  test('desktop light — tab Setup fabbisogni', async ({ page }) => {
    await page.goto('/admin/coverage');
    await page.waitForLoadState('networkidle');

    const setupTab = page.getByRole('tab', { name: /Setup fabbisogni/i });
    if ((await setupTab.count()) > 0) {
      await setupTab.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page).toHaveScreenshot('coverage-setup-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — Monitor copertura', async ({ page }) => {
    await page.goto('/admin/coverage');
    await page.waitForLoadState('networkidle');

    const monitorTab = page.getByRole('tab', { name: /Monitor copertura/i });
    if ((await monitorTab.count()) > 0) {
      await monitorTab.click();
      await page.waitForTimeout(500);
    }

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('coverage-monitor-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — pagina coverage', async ({ page }) => {
    await page.goto('/admin/coverage');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('coverage-mobile-light.png', { maxDiffPixels: 50 });
  });
});
