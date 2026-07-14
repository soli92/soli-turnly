/**
 * tests/visual/sprint3/notifications.spec.ts — Visual regression centro notifiche (TSK-030).
 *
 * Cattura la pagina /notifications (TSK-028) con le notifiche del dipendente.
 * Maschera timestamp e testi variabili per screenshot deterministici.
 */

import { test, expect } from '../fixtures/visual-db';

test.describe('Centro notifiche — visual', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  test('desktop light — centro notifiche', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    // Maschera timestamp per stabilità
    await page.evaluate(() => {
      document.querySelectorAll('time, [class*="text-xs"][class*="muted"]').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('notifications-desktop-light.png', { maxDiffPixels: 50 });
  });

  test('desktop dark — centro notifiche', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.querySelectorAll('time').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('notifications-desktop-dark.png', { maxDiffPixels: 50 });
  });

  test('mobile light — centro notifiche', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = page.viewportSize();
    if (vp && vp.width <= 500) {
      expect(overflow).toBeLessThanOrEqual(vp.width + 2);
    }
    await expect(page).toHaveScreenshot('notifications-mobile-light.png', { maxDiffPixels: 50 });
  });

  // Notifiche lato admin (badge non lette)
  test('desktop light — notifiche admin', async ({ page, context }) => {
    await context.clearCookies();
    // Usa sessione admin
    const adminAuthPath = 'tests/e2e/.auth/admin.json';
    const fs = await import('fs');
    if (fs.existsSync(adminAuthPath)) {
      await context.addCookies(JSON.parse(fs.readFileSync(adminAuthPath, 'utf-8')).cookies ?? []);
    }
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.querySelectorAll('time').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await expect(page).toHaveScreenshot('notifications-admin-desktop-light.png', {
      maxDiffPixels: 50,
    });
  });
});
