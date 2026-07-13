import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('credenziali errate → messaggio generico (RF-A CA1)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('[type="submit"]');
    await expect(page.getByText('Credenziali non valide')).toBeVisible();
    await expect(page.getByText('email non trovata')).not.toBeVisible();
    await expect(page.getByText('password errata')).not.toBeVisible();
  });

  test('login admin → redirect /admin/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@turnly.dev');
    await page.fill('[name="password"]', 'Admin123!');
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);
  });
});
