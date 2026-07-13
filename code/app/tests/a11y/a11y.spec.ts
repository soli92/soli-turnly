import { test, expect } from '@playwright/test';
import { checkA11y, injectAxe } from 'axe-playwright';

const adminRoutes = [
  '/login',
  '/admin/dashboard',
  '/admin/matrix',
  '/admin/users',
  '/admin/users/new',
  '/admin/requests',
];

const employeeRoutes = [
  '/calendar',
  '/requests',
  '/requests/new',
  '/profile',
];

const axeOptions = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
  },
};

test.describe('A11y WCAG 2.2 AA — Admin routes', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  for (const route of adminRoutes) {
    test(`${route} — zero violazioni`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await injectAxe(page);
      await checkA11y(page, undefined, {
        axeOptions,
        detailedReport: true,
      });
    });
  }
});

test.describe('A11y WCAG 2.2 AA — Employee routes', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' });

  for (const route of employeeRoutes) {
    test(`${route} — zero violazioni`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await injectAxe(page);
      await checkA11y(page, undefined, {
        axeOptions,
        detailedReport: true,
      });
    });
  }
});
