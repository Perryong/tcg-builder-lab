import { defineConfig } from '@playwright/test';
const preview=process.env.PLAYWRIGHT_PREVIEW==='1';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  use: { baseURL: preview?'http://127.0.0.1:5180/tcg-builder-lab/':'http://127.0.0.1:5180/', viewport:{width:1440,height:1000}, launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}, screenshot:'only-on-failure' },
  reporter: 'list',
  webServer: {command:`npm run ${preview?'preview':'dev'} -- ${preview?'--base=/tcg-builder-lab/ ':''}--port 5180 --strictPort`,url:preview?'http://127.0.0.1:5180/tcg-builder-lab/':'http://127.0.0.1:5180/',reuseExistingServer:!process.env.CI}
});
