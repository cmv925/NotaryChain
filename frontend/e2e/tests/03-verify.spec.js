// Critical path 3/5 — Public Verify (/verify), no auth required.
const { test, expect } = require('@playwright/test');

test.describe('Critical Path: Public Verify', () => {
  test('verifying an unknown hash renders a deterministic result', async ({ page }) => {
    await page.goto('/verify', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('public-verify-page')).toBeVisible();

    // A random 64-hex hash that will not exist → expect a "not found" result state.
    const randomHash = Array.from({ length: 64 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

    await page.getByTestId('document-hash-input').fill(randomHash);
    await page.getByTestId('verify-hash-btn').click();

    // A random hash won't exist → the "Not Found" result card must appear.
    await expect(page.getByTestId('document-not-found')).toBeVisible({ timeout: 30_000 });
  });

  test('verify page exposes certificate and notary lookup tabs', async ({ page }) => {
    await page.goto('/verify', { waitUntil: 'domcontentloaded' });
    // Tab switchers are buttons (tab-<key>); their content cards render on activation.
    await expect(page.getByTestId('tab-certificate')).toBeVisible();
    await expect(page.getByTestId('tab-notary')).toBeVisible();

    await page.getByTestId('tab-certificate').click();
    await expect(page.getByTestId('certificate-tab')).toBeVisible();

    await page.getByTestId('tab-notary').click();
    await expect(page.getByTestId('notary-tab')).toBeVisible();
  });
});
