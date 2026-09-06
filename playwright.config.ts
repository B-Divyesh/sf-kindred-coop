import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/mock-billing.mjs',
      url: 'http://127.0.0.1:9191/api/v1/products/kindred-coop/verify?license=ready',
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: "VITE_BILLING_BASE='http://127.0.0.1:9191' npm run build && BILLING_BASE='http://127.0.0.1:9191' DATABASE_URL='sqlite://kindred-e2e.db?mode=rwc' cargo run",
      url: 'http://127.0.0.1:8080/health',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
