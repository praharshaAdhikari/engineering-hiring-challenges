import { defineConfig, devices } from '@playwright/test';

// The app under test lives one directory up, in ../app. Playwright starts it for us
// (see `webServer` below), resetting the database first so every run begins from the
// same seeded state the README documents. Point at an already-running instance with
// BASE_URL=... to skip that.
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';

// Keep the SQLite file off the repo's filesystem. This checkout may sit on a FUSE mount
// (NTFS/exFAT), where POSIX file locking is unreliable and node:sqlite blocks forever on
// "database is locked". A native filesystem (tmpfs here) makes reset+start instant.
// Override with DB_PATH=... if /tmp is not writable.
const DB_PATH = process.env.DB_PATH ?? '/tmp/sabhaghar-qa.sqlite';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // the app is one shared SQLite file; keep runs deterministic
  workers: 1, // a concurrency suite must own the server; parallel files would add noise
  forbidOnly: !!process.env.CI,
  retries: 0, // a race-condition test that passes on retry would be lying
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Reset-then-start, so the suite owns its state. Skipped when BASE_URL points elsewhere.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run reset && npm start',
        cwd: '../app',
        env: { ...process.env, DB_PATH },
        url: 'http://localhost:4000/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
