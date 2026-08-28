import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: "DATABASE_URL='sqlite://kindred-e2e.db?mode=rwc' cargo run",
    url: 'http://127.0.0.1:8080/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
