// Critical path 5/5 — Admin approve (Command Authority Suite + approval workflow).
const { test, expect } = require('@playwright/test');
const { loginAndGoto } = require('../helpers/auth');

test.describe('Critical Path: Admin Approve', () => {
  test('admin reaches the Command Authority Suite dashboard', async ({ page, baseURL }) => {
    await loginAndGoto(page, baseURL, 'admin', '/admin');

    await expect(page.getByTestId('admin-stats-grid')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('admin-tabs-nav').first()).toBeVisible();
  });

  test('admin can create an approval-chain request end-to-end', async ({ page, baseURL }) => {
    await loginAndGoto(page, baseURL, 'admin', '/approvals');

    await page.getByTestId('create-approval-btn').click();
    await expect(page.getByTestId('create-form')).toBeVisible();

    await page.getByTestId('doc-name-input').fill(`E2E Approval ${Date.now()}`);
    await page.getByTestId('approver-email-0').fill('approver@notarychain.com');
    await page.getByTestId('submit-approval').click();

    // On success the create form closes and the create button is shown again.
    await expect(page.getByTestId('create-form')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId('create-approval-btn')).toBeVisible();
  });
});
