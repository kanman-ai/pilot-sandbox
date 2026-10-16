/**
 * Playwright config for acceptance specs under .kanman/acceptance/<KEY>/.
 * The app must already be running at BASE_URL (docker compose in CI and in kanman's clean room).
 * Traces, screenshots and video are always recorded, because they are the proof artifacts.
 * Tag a spec @mutates-state if it changes data other specs read; it then runs after all others.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.kanman/acceptance',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mutates-state/ },
    // Specs tagged @mutates-state change data in the one shared in-memory app.
    // They run only after every other spec has finished, so they cannot break them.
    {
      name: 'chromium-mutating',
      use: { ...devices['Desktop Chrome'] },
      grep: /@mutates-state/,
      dependencies: ['chromium'],
    },
  ],
})
