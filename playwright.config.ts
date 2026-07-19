import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shots are written deterministically, one worker keeps it stable
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Playwright defaults to en-US; most e2e specs assert Czech UI strings.
    // e2e/english.spec.ts overrides this per-test via test.use({ locale }).
    locale: 'cs-CZ',
    trace: 'on-first-retry',
    // The PWA service worker would serve /data/* from its own fetch path,
    // bypassing page.route() mocks mid-test. Not what e2e is testing.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Sandboxes with a system Chromium and no playwright-managed download:
        // PW_CHROMIUM=/path/to/chromium npx playwright test
        ...(process.env.PW_CHROMIUM
          ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
