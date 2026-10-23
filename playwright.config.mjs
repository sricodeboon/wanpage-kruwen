import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 60000,
  retries: 0,
  workers: 1, // ไฟล์ e2e ใช้พอร์ต/สถานะร่วมกัน รันทีละไฟล์
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    ...devices['Pixel 7'],
    browserName: 'chromium',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
  },
  webServer: {
    command: 'node tools/static-server.mjs site 8080 127.0.0.1',
    url: 'http://127.0.0.1:8080/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
