// Shared auth + setup helpers for the E2E suite.
const { expect } = require('@playwright/test');

const CREDENTIALS = {
  client: {
    email: process.env.E2E_CLIENT_EMAIL || 'demo@test.com',
    password: process.env.E2E_CLIENT_PASSWORD || 'Demo123!',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@notarychain.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin123!',
  },
};

// Log in via the API and return the access token. Faster + less flaky than UI login.
// (Still works because the backend dual-reads the Authorization: Bearer header.)
async function apiLogin(request, baseURL, role = 'client') {
  const { email, password } = CREDENTIALS[role];
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `login for ${email} should succeed`).toBeTruthy();
  const body = await res.json();
  expect(body.access_token, 'login should return an access_token').toBeTruthy();
  return body.access_token;
}

// Log in through the PAGE's browser context so the httpOnly auth cookie is stored,
// then navigate. `page.request` shares the cookie jar with the page context.
async function loginAndGoto(page, baseURL, role = 'client', route = '/dashboard') {
  const { email, password } = CREDENTIALS[role];
  const res = await page.request.post(`${baseURL}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `cookie login for ${email} should succeed`).toBeTruthy();
  await page.goto(route, { waitUntil: 'domcontentloaded' });
}

// Dismiss the onboarding tour overlay if it is present (it can intercept clicks).
async function dismissTourIfPresent(page) {
  try {
    const skip = page.getByText('Skip tour', { exact: false }).first();
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skip.click({ force: true });
    }
  } catch (_e) { /* no tour shown — fine */ }
}

module.exports = { CREDENTIALS, apiLogin, loginAndGoto, dismissTourIfPresent };
