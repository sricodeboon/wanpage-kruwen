// e2e ห้ามยิงไปตัวรับไฟล์จริง: ทุกเทสต์ใช้ config ที่ upload_url/app_key ว่าง
// (เทสต์ที่ route config.json เองภายหลังจะทับ route นี้ — Playwright ใช้ route ที่ลงทะเบียนล่าสุด)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

export async function routeTestConfig(page) {
  const cfg = JSON.parse(readFileSync(`${root}site/config.json`, 'utf8'));
  cfg.upload_url = '';
  cfg.app_key = '';
  await page.route('**/config.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cfg) }));
}
