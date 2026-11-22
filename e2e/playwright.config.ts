import { defineConfig, devices } from '@playwright/test';

// Ports of their own, so a run never meets `mise run dev` on 3000 and 5173.
const apiOrigin = 'http://127.0.0.1:3100';
const webOrigin = 'http://localhost:5273';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Every run starts both processes itself and fails when a port is taken.
  // That is what makes each run begin with an empty server.
  webServer: [
    {
      name: 'server',
      command: 'node src/main.ts',
      cwd: '../server',
      env: { PORT: '3100' },
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
    },
    {
      name: 'web',
      command: 'pnpm exec vite --port 5273 --strictPort',
      cwd: '../web',
      env: { API_ORIGIN: apiOrigin },
      url: webOrigin,
      reuseExistingServer: false,
    },
  ],
});
