// Playwright E2E config for NotaryChain critical-path smoke suite.
// Base URL resolution order:
//   1. E2E_BASE_URL (CI override)
//   2. REACT_APP_BACKEND_URL from frontend/.env (the deployed/preview origin)
const path = require('path');
const fs = require('fs');
const { defineConfig, devices } = require('@playwright/test');

function readBackendUrl() {
  if (process.env.E2E_BASE_URL) return process.env.E2E_BASE_URL;
  if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    const txt = fs.readFileSync(envPath, 'utf8');
    const m = txt.match(/^REACT_APP_BACKEND_URL=(.+)$/m);
    if (m) return m[1].trim();
  } catch (_e) { /* ignore */ }
  return 'http://localhost:3000';
}

const BASE_URL = readBackendUrl();

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Block the app's service worker — its auto-reload-on-update logic interrupts
    // programmatic navigation and makes E2E runs non-deterministic.
    serviceWorkers: 'block',
    // Grant camera/mic so the Enhanced KBA selfie step does not block (uses a fake device).
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
