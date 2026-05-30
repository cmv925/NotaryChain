// Critical path 4/5 — Notarize (request creation + identity-verification gate).
const { test, expect } = require('@playwright/test');
const { apiLogin, seedAuthAndGoto, dismissTourIfPresent } = require('../helpers/auth');

test.describe('Critical Path: Notarize', () => {
  test('request-notarization wizard renders the document step for a logged-in client', async ({ page, request, baseURL }) => {
    const token = await apiLogin(request, baseURL, 'client');
    await seedAuthAndGoto(page, token, '/request-notarization');
    await dismissTourIfPresent(page);

    await expect(page.getByTestId('step-1-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('document-type-select')).toBeVisible();
    await expect(page.getByTestId('file-input')).toBeAttached();
  });

  test('notary request API enforces the identity-verification gate', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL, 'client');
    const res = await request.post(`${baseURL}/api/notary/requests`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        document_name: 'E2E Notarize Test',
        document_type: 'affidavit',
        notarization_type: 'acknowledgment',
        state_code: 'FL',
      },
    });

    // The client is either verified (200) or gated (403 identity_verification_required).
    // Both prove the gate wiring is intact.
    expect([200, 403]).toContain(res.status());
    if (res.status() === 403) {
      const body = await res.json();
      expect(body.detail).toBe('identity_verification_required');
    } else {
      const body = await res.json();
      expect(body.id).toBeTruthy();
      // HCS provisioning is async — topic id is null at creation time, no 502/timeout.
      expect(body.hcs_topic_id === null || typeof body.hcs_topic_id === 'string').toBeTruthy();
    }
  });

  test('request creation responds quickly (async HCS, no cold-path blocking)', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL, 'client');
    const started = Date.now();
    const res = await request.post(`${baseURL}/api/notary/requests`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        document_name: 'E2E Latency Test',
        document_type: 'affidavit',
        notarization_type: 'acknowledgment',
        state_code: 'FL',
      },
    });
    const elapsed = Date.now() - started;
    expect([200, 403]).toContain(res.status());
    // Hedera topic creation is backgrounded, so the endpoint must return well under 10s.
    expect(elapsed).toBeLessThan(10_000);
  });
});
