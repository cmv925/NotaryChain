// Critical path 2/5 — Quick Seal (client-side SHA-256 + seal preview at /demo).
const { test, expect } = require('@playwright/test');

test.describe('Critical Path: Quick Seal', () => {
  test('uploading a file computes a SHA-256 hash', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('qs-file-input')).toBeAttached();

    await page.getByTestId('qs-file-input').setInputFiles({
      name: 'e2e-sample.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(`NotaryChain E2E quick seal ${Date.now()}`),
    });

    // After hashing, the copy-hash control becomes available.
    await expect(page.getByTestId('qs-copy-hash')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('qs-download-btn')).toBeVisible();
  });
});
