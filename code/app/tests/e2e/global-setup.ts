/**
 * tests/e2e/global-setup.ts — Setup globale autenticazione Playwright (TSK-010).
 *
 * Eseguito UNA VOLTA prima di tutti i test (globalSetup in playwright.config.ts).
 * Salva gli storageState per admin e dipendente in tests/e2e/.auth/.
 *
 * Credenziali (da db/seed.ts):
 *   Admin:    admin@turnly.dev      / Admin123!
 *   Employee: mario.rossi@turnly.dev / Employee123!
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';

async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  // Assicura che la directory .auth esista
  const authDir = path.join(__dirname, '.auth');
  await mkdir(authDir, { recursive: true });

  const browser = await chromium.launch();

  // ------------------------------------------------------------------
  // Setup sessione admin
  // ------------------------------------------------------------------
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto(`${baseURL}/login`);
  await adminPage.fill('[name="email"]', 'admin@turnly.dev');
  await adminPage.fill('[name="password"]', 'Admin123!');
  await adminPage.click('[type="submit"]');
  // Attende redirect a /admin/dashboard (middleware di ruolo)
  await adminPage.waitForURL('**/admin/dashboard');
  await adminContext.storageState({ path: path.join(authDir, 'admin.json') });
  await adminContext.close();

  // ------------------------------------------------------------------
  // Setup sessione dipendente (mario.rossi)
  // ------------------------------------------------------------------
  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();

  await employeePage.goto(`${baseURL}/login`);
  await employeePage.fill('[name="email"]', 'mario.rossi@turnly.dev');
  await employeePage.fill('[name="password"]', 'Employee123!');
  await employeePage.click('[type="submit"]');
  // Attende redirect a /calendar (middleware di ruolo per employee)
  await employeePage.waitForURL('**/calendar');
  await employeeContext.storageState({ path: path.join(authDir, 'employee.json') });
  await employeeContext.close();

  await browser.close();
}

export default globalSetup;
