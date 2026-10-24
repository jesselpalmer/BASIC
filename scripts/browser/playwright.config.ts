import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '**/*.e2e.ts',
  outputDir: resolve(root, 'test-results'),
  timeout: 15000,
  expect: {timeout: 5000},
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    // Optional local browser path for environments that cannot download Playwright's binary.
    launchOptions: process.env.BASIC_BROWSER_EXECUTABLE
      ? {executablePath: process.env.BASIC_BROWSER_EXECUTABLE}
      : {},
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run serve:playground',
    cwd: root,
    env: {BASIC_PLAYGROUND_PORT: '4173'},
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
