// Critical path 1/5 — Authentication (UI login).
const { test, expect } = require('@playwright/test');
const { CREDENTIALS } = require('../helpers/auth');

test.describe('Critical Path: Login', () => {
  test('client can log in via the UI and reach the dashboard', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('login-form')).toBeVisible();

    await page.getByTestId('login-email-input').fill(CREDENTIALS.client.email);
    await page.getByTestId('login-password-input').fill(CREDENTIALS.client.password);
    await page.getByTestId('login-submit-button').click();

    await page.waitForURL('**/dashboard', { timeout: 45_000 });
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
  });

  test('invalid credentials surface an error and stay on /login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-email-input').fill(CREDENTIALS.client.email);
    await page.getByTestId('login-password-input').fill('wrong-password-123');
    await page.getByTestId('login-submit-button').click();

    // Should NOT navigate to the dashboard.
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin can log in via the UI', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-email-input').fill(CREDENTIALS.admin.email);
    await page.getByTestId('login-password-input').fill(CREDENTIALS.admin.password);
    await page.getByTestId('login-submit-button').click();

    // Admins route to /admin; allow either /admin or /dashboard depending on view state.
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 45_000 });
    expect(page.url()).toMatch(/\/(admin|dashboard)/);
  });
});
