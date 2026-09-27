import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5180', viewport:{width:1440,height:1000}, launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}, screenshot:'only-on-failure' },
  reporter: 'list',
  webServer: {command:'npm run dev -- --port 5180 --strictPort',url:'http://127.0.0.1:5180',reuseExistingServer:!process.env.CI}
});
