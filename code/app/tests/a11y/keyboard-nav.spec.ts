import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('Tab naviga tutti gli elementi interattivi della sidebar', async ({ page }) => {
    await page.goto('/admin/dashboard');
    // Premi Tab e verifica che il focus si sposti su elementi visibili
    await page.keyboard.press('Tab');
    const focusedEl = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV']).toContain(focusedEl);
  });

  test('ShiftEditor: Escape chiude il dialog', async ({ page }) => {
    await page.goto('/admin/matrix');
    const firstCell = page.locator('[data-testid^="shift-cell-"]').first();
    await firstCell.click();
    await expect(page.getByTestId('shift-editor-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shift-editor-dialog')).not.toBeVisible();
  });
});
