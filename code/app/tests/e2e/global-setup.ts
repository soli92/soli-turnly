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
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

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
  await employeePage.waitForURL('**/calendar');
  await employeeContext.storageState({ path: path.join(authDir, 'employee.json') });
  await employeeContext.close();

  // ------------------------------------------------------------------
  // Setup sessione collega (lucia.verdi) — usata da T-REQ-03 / T-SEC-08
  // Pre-creata qui per evitare latenza on-demand nel fixture sprint2-db.
  // ------------------------------------------------------------------
  const colleagueContext = await browser.newContext();
  const colleaguePage = await colleagueContext.newPage();

  await colleaguePage.goto(`${baseURL}/login`);
  await colleaguePage.fill('[name="email"]', 'lucia.verdi@turnly.dev');
  await colleaguePage.fill('[name="password"]', 'Employee123!');
  await colleaguePage.click('[type="submit"]');
  await colleaguePage.waitForURL('**/calendar', { timeout: 30_000 });
  await colleagueContext.storageState({ path: path.join(authDir, 'colleague.json') });
  await colleagueContext.close();

  await browser.close();
}

export default globalSetup;
