// e2e: หน้าผู้ดูแล — ตรวจข้อมูล ลิงก์ปักหมุด พรีวิวแม่แบบ โหมดวัด health
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const csv = (tab) => readFileSync(`${root}docs/sheet-template/${tab}.csv`, 'utf8');

async function routeSheets(page) {
  await page.route(/docs\.google\.com\/spreadsheets\//, (route) => {
    const tab = new URL(route.request().url()).searchParams.get('sheet');
    let body = csv(tab);
    // เพิ่มโรงเรียนที่ไม่มีครู (จังหวัดผิด + ไม่มีไฟล์ตรา) และครูเบอร์ไม่ครบ
    if (tab === 'schools') {
      body += 'lonely,เหงา,โรงเรียนเหงา,ที่อยู่,xx,nofile.webp,np-01,2,TRUE,,,\n';
      // ยังไม่มีตรา (_default) + ชื่อย่อยาวเกิน 12 หน่วย (สระ/วรรณยุกต์นับด้วย)
      body += 'noemblem,บ้านหนองน้ำใสสะอาด,โรงเรียนไร้ตรา,ที่อยู่,np,_default.v1.webp,np-01,3,TRUE,,,\n';
    }
    if (tab === 'teachers') body += 'changkon8-09,changkon8,ครูเบอร์สั้น,0812,9,TRUE\n';
    route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body });
  });
}

test('links tab: one openExternalBrowser link per school + pin message', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await routeSheets(page);
  await page.goto('/admin.html');
  await page.locator('#tab-links').click();
  const links = page.locator('#linkList a.lnk');
  await expect(links).toHaveCount(3);
  for (const a of await links.all()) expect(await a.getAttribute('href')).toMatch(/\?s=[a-z0-9_]+&openExternalBrowser=1$/);
  expect(await links.first().getAttribute('href')).toBe('https://sricodeboon.github.io/wanpage-kruwen/?s=changkon8&openExternalBrowser=1');
  await expect(page.locator('#linkList canvas')).toHaveCount(3);
  const msg = await page.locator('#pinMsg').inputValue();
  expect(msg.split('\n')[0]).toBe('วันเพจครูเวร — แตะลิงก์โรงเรียนของตัวเอง');
  expect(msg).toContain('• โรงเรียนเหงา: https://sricodeboon.github.io/wanpage-kruwen/?s=lonely&openExternalBrowser=1');
  expect(msg.trim().split('\n').pop()).toBe('ถ้ากดแชร์ไม่ขึ้น ให้กด ⋮ แล้วเลือก เปิดในเบราว์เซอร์');
  expect(errors).toEqual([]);
});

test('check tab warns about school without teachers, bad province, missing logo, short phone', async ({ page }) => {
  await routeSheets(page);
  await page.goto('/admin.html');
  const w = page.locator('#warnList');
  await expect(w).toContainText('โรงเรียนเหงา');
  await expect(w).toContainText('ไม่มีครู');
  await expect(w).toContainText('province');
  await expect(w).toContainText('logo');
  await expect(w).toContainText('ครูเบอร์สั้น');
  await expect(w).toContainText('โรงเรียนไร้ตรา: ยังไม่มีไฟล์ตรา');
  await expect(w).toContainText('short_name "บ้านหนองน้ำใสสะอาด" ยาว 18 ตัว (เกิน 12)');
  await expect(w).not.toContainText('ช่างกลปทุมวันอนุสรณ์ 8: ยังไม่มีไฟล์ตรา');
  await expect(page.locator('#dataTable')).toContainText('ช่างกล8');
});

test('health shows not-configured message when upload_url is empty', async ({ page }) => {
  await routeSheets(page);
  await page.goto('/admin.html');
  await page.locator('#tab-health').click();
  await expect(page.locator('#healthOut')).toContainText('ยังไม่ได้ตั้งค่า upload_url');
});

test('preview tab renders every template of a province; measure mode outputs JSON', async ({ page }) => {
  await routeSheets(page);
  await page.goto('/admin.html');
  await page.locator('#tab-preview').click();
  await page.locator('#pvProvince').selectOption('np');
  await expect(page.locator('#pvGrid canvas')).toHaveCount(1, { timeout: 20000 });
  await page.locator('#tab-measure').click();
  await page.locator('#msTemplate').selectOption('np-01');
  const stage = page.locator('#msCanvas');
  await expect(stage).toBeVisible();
  await expect.poll(() => stage.evaluate((c) => c.width)).toBe(512);
  await stage.scrollIntoViewIfNeeded();
  const b = await stage.boundingBox();
  for (const [fx, fy] of [[0.25, 0.5], [0.75, 0.9], [0.5, 0.95]]) {
    await stage.click({ position: { x: b.width * fx, y: b.height * fy } });
  }
  const out = JSON.parse(await page.locator('#msOut').inputValue());
  expect(out.landmark.x).toBeGreaterThan(200);
  expect(out.landmark.x).toBeLessThan(300);
  expect(out.landmark.w).toBeGreaterThan(400);
  expect(out.band.top_y).toBeGreaterThan(1400);
});
