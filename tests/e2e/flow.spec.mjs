// e2e: ครูเวรเปิดลิงก์โรงเรียน → ติ๊กครู → ใส่รูป 4 ภาพ → เลือกพื้นหลัง → สร้างภาพ → หน้ายืนยัน
import { test, expect } from '@playwright/test';
import { routeTestConfig } from './test-config.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test.beforeEach(async ({ page }) => { await routeTestConfig(page); });

const root = fileURLToPath(new URL('../../', import.meta.url));
const csv = (tab) => readFileSync(`${root}docs/sheet-template/${tab}.csv`, 'utf8');
const fixtures = [1, 2, 3, 4].map((n) => `${root}tests/golden/fixtures/photo${n}.jpg`);

async function routeSheets(page) {
  // แทน Google Sheet ด้วย CSV ตัวอย่าง (เบอร์ตัวอย่าง 081-234-5678)
  await page.route(/docs\.google\.com\/spreadsheets\//, (route) => {
    const tab = new URL(route.request().url()).searchParams.get('sheet');
    route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: csv(tab) });
  });
}

test('duty teacher flow produces a 1536x2304 report', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await routeSheets(page);
  await page.goto('/?s=changkon8');

  await expect(page.locator('#schoolName')).toContainText('ช่างกลปทุมวันอนุสรณ์ 8');
  await expect(page.locator('#changeSchool')).toBeVisible();

  const teacher = page.locator('.t', { hasText: 'ส.ต.ท.รัชเดช ศรีแก้ว' });
  await expect(teacher).toContainText('081-234-5678');
  await teacher.click();
  await expect(teacher).toHaveAttribute('aria-checked', 'true');
  await expect(teacher.locator('.ck')).toHaveText('1');

  await page.locator('#photoGrid input[type=file][data-index="0"]').setInputFiles(fixtures);
  await expect(page.locator('#photoGrid .slot.filled')).toHaveCount(4, { timeout: 20000 });

  const bg = page.locator('#bgList [data-bg="np-01"]');
  await bg.click();
  await expect(bg).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#cta')).not.toHaveClass(/off/);

  await page.locator('#cta').click();
  const dialog = page.locator('#confirm');
  await expect(dialog).toBeVisible({ timeout: 30000 });
  const img = page.locator('#confirmImg');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBe(1536);
  expect(await img.evaluate((el) => el.naturalHeight)).toBe(2304);
  await expect(page.locator('#sumTeachers')).toContainText('ส.ต.ท.รัชเดช ศรีแก้ว');
  await expect(dialog).toContainText('ส.ต.ท.รัชเดช ศรีแก้ว');
  expect(errors).toEqual([]);
});

test('report button explains what is missing', async ({ page }) => {
  await routeSheets(page);
  await page.goto('/?s=changkon8');
  await expect(page.locator('#ctaMsg')).toHaveText('เลือกครูเวรอย่างน้อย 1 คน');
  // ปุ่มที่ยังกดไม่ได้ต้องอ่านออก: contrast ≥ 4.5:1
  await expect(page.locator('#cta')).toHaveClass(/off/);
  const ratio = await page.locator('#cta').evaluate((el) => {
    const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cs = getComputedStyle(el);
    const a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  await page.locator('.t').first().click();
  await expect(page.locator('#ctaMsg')).toHaveText('เลือกรูปอีก 4 ภาพ');
  for (const n of [1, 2]) await page.locator('.t').nth(n).click();
  const fourth = page.locator('.t').nth(3);
  await expect(fourth).toHaveAttribute('aria-disabled', 'true');
  await fourth.click({ force: true }); // ยังแตะได้ (aria-disabled) เพื่อบอกเหตุผล
  await expect(fourth).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#teacherMsg')).toHaveText('เลือกได้ไม่เกิน 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน');
});

async function fillAndCreate(page) {
  await page.locator('.t').first().click();
  await page.locator('#photoGrid input[type=file][data-index="0"]').setInputFiles(fixtures);
  await expect(page.locator('#photoGrid .slot.filled')).toHaveCount(4, { timeout: 20000 });
  await page.locator('#cta').click();
  await expect(page.locator('#confirm')).toBeVisible({ timeout: 30000 });
}

test('blocked localStorage + offline still boots from the snapshot', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.route(/docs\.google\.com\/spreadsheets\//, (route) => route.abort());
  await page.goto('/?s=changkon8');
  await expect(page.locator('#dataBadge')).toHaveText('ใช้ข้อมูลสำรอง (ไม่ได้ต่อเน็ต)');
  await expect(page.locator('.t')).toHaveCount(4);
  await page.locator('.t').first().click();
  await expect(page.locator('.t').first()).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#ctaMsg')).toHaveText('เลือกรูปอีก 4 ภาพ');
  expect(errors).toEqual([]);
});

test('save button is purple (not LINE green) when file sharing is unavailable', async ({ page }) => {
  await page.addInitScript(() => { navigator.canShare = () => false; });
  await routeSheets(page);
  await page.goto('/?s=changkon8');
  await fillAndCreate(page);
  await expect(page.locator('#shareBtn')).toBeHidden();
  await expect(page.locator('#saveBtn')).toHaveClass(/\bbtn-primary\b/);
  await expect(page.locator('#saveBtn')).not.toHaveClass(/\bbtn-line\b/);
  const bg = await page.locator('#saveBtn').evaluate((el) => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor);
  expect(bg).not.toContain('6, 199, 85');
  await expect(page.locator('#chromeBox')).toBeVisible();
});

test('tap targets are at least 52px (label chips 48px)', async ({ page }) => {
  await routeSheets(page);
  await page.goto('/?s=changkon8');
  await page.locator('.t').first().click();
  await page.locator('#photoGrid input[type=file][data-index="0"]').setInputFiles(fixtures);
  await expect(page.locator('#photoGrid .slot.filled')).toHaveCount(4, { timeout: 20000 });
  for (const sel of ['#changeSchool', '#editDate', '#bigPreviewBtn', '.t >> nth=0', '#cta']) {
    const b = await page.locator(sel).boundingBox();
    expect(b.height, sel).toBeGreaterThanOrEqual(52);
    expect(b.width, sel).toBeGreaterThanOrEqual(52);
  }
  // ป้ายชื่อรูป: พื้นที่แตะจริงคือ ::before สูง 48px (ไม่กินช่องรูปเล็กเกือบทั้งช่อง)
  const hit = await page.locator('.slot[data-index="1"] .lbl').evaluate((el) => {
    const cs = getComputedStyle(el, '::before');
    return [parseFloat(cs.height), parseFloat(cs.width)];
  });
  expect(hit[0]).toBeGreaterThanOrEqual(48);
  expect(hit[1]).toBeGreaterThanOrEqual(48);
  const slot = await page.locator('.slot[data-index="1"]').boundingBox();
  expect(hit[0] / slot.height, 'พื้นที่แตะป้ายต้องไม่กินช่องรูปเล็กเกินครึ่ง').toBeLessThanOrEqual(0.6);
  // แตะเหนือป้าย (ยังอยู่ในพื้นที่ 48px) ต้องเปิดแผ่นป้ายชื่อ
  const lb = await page.locator('.slot[data-index="1"] .lbl').boundingBox();
  await page.mouse.click(lb.x + 4, lb.y + lb.height - 40);
  await expect(page.locator('#labelSheet')).toBeVisible();
  await page.locator('#labelCancel').click();
  // แตะส่วนบนของช่องรูปเล็ก (เหนือพื้นที่ป้าย) ต้องเปิดเมนูรูป ไม่ใช่แผ่นป้ายชื่อ
  await page.mouse.click(slot.x + slot.width / 2, slot.y + 12);
  await expect(page.locator('#slotSheet')).toBeVisible();
  await expect(page.locator('#labelSheet')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#slotSheet')).toBeHidden();
  await fillCheckEdit(page);
});

async function fillCheckEdit(page) {
  await page.locator('#cta').click();
  await expect(page.locator('#confirm')).toBeVisible({ timeout: 30000 });
  const e = await page.locator('#editBtn').boundingBox();
  expect(e.height).toBeGreaterThanOrEqual(52);
  const r = await page.locator('#saveBtn').boundingBox();
  expect(r.height).toBeGreaterThanOrEqual(52);
}

test('config.json + templates.json down: no reload loop, load-failure message with retry', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let navs = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs++; });
  let templatesDown = true;
  await page.route('**/config.json', (route) => route.fulfill({ status: 500, body: 'x' }));
  await page.route('**/templates.json', (route) => (templatesDown ? route.fulfill({ status: 503, body: 'x' }) : route.continue()));
  // ข้อมูล Sheet ในเครื่องสั่ง min_app_version สูง — ถ้าไม่ข้ามการตรวจจะ reload
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('wp.data', JSON.stringify({
      fetched_at: Date.now(), schools: [{ school_id: 'changkon8', short_name: 'ช่างกล8', name_full: 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8', province: 'np', logo_file: 'changkon8.v1.webp', active: 'TRUE', sort_order: '1' }],
      teachers: [{ teacher_id: 't1', school_id: 'changkon8', display_name: 'ครูทดสอบ', phone: '0812345678', active: 'TRUE', sort_order: '1' }],
      labels: [], settings: [{ key: 'min_app_version', value: '99' }],
    }));
  });
  await page.route(/docs\.google\.com\/spreadsheets\//, (route) => route.abort());
  await page.goto('/?s=changkon8');
  await expect(page.locator('.t')).toHaveCount(1);
  await expect(page.locator('#bgMsg')).toHaveText('ยังโหลดรายการพื้นหลังไม่ได้ ต่ออินเทอร์เน็ตแล้วแตะ ลองใหม่');
  await expect(page.locator('#retryTemplates')).toBeVisible();
  await page.locator('.t').first().click();
  await expect(page.locator('#ctaMsg')).toHaveText('ยังโหลดรายการพื้นหลังไม่ได้ ต่ออินเทอร์เน็ตแล้วแตะ ลองใหม่');
  await page.waitForTimeout(500);
  expect(navs).toBe(1);
  templatesDown = false;
  await page.locator('#retryTemplates').click();
  await expect(page.locator('#bgList [data-bg]').first()).toBeVisible();
  await expect(page.locator('#bgMsg')).toBeHidden();
  await expect(page.locator('#retryTemplates')).toBeHidden();
  await expect(page.locator('#ctaMsg')).toHaveText('เลือกรูปอีก 4 ภาพ');
  expect(errors).toEqual([]);
});

test('final report is not produced without the background or the logo', async ({ page }) => {
  await routeSheets(page);
  let bgDown = true, logoDown = false;
  await page.route('**/assets/bg/np-01.v1.webp', (route) => (bgDown ? route.abort() : route.continue()));
  await page.route('**/assets/logos/changkon8.v1.webp', (route) => (logoDown ? route.abort() : route.continue()));
  const fill = async () => {
    await page.goto('/?s=changkon8');
    await page.locator('.t').first().click();
    await page.locator('#photoGrid input[type=file][data-index="0"]').setInputFiles(fixtures);
    await expect(page.locator('#photoGrid .slot.filled')).toHaveCount(4, { timeout: 20000 });
    await page.locator('#bgList [data-bg="np-01"]').click();
  };
  await fill();
  await page.locator('#cta').click();
  await expect(page.locator('#ctaMsg')).toHaveText('ยังโหลดพื้นหลังไม่ได้ ลองใหม่');
  await expect(page.locator('#confirm')).toBeHidden();
  bgDown = false; // ลองใหม่ได้ (ผลที่ล้มไม่ถูกจำ)
  await page.locator('#cta').click();
  await expect(page.locator('#confirm')).toBeVisible({ timeout: 30000 });

  logoDown = true; // โหลดหน้าใหม่ ตรายังไม่เคยมา
  await fill();
  await page.locator('#cta').click();
  await expect(page.locator('#ctaMsg')).toHaveText('ยังโหลดตราโรงเรียนไม่ได้ ลองใหม่');
  await expect(page.locator('#confirm')).toBeHidden();
});

test.describe('LINE in-app browser (Android)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Line/13.5.0' });
  test('save shows the long-press overlay instead of claiming the file was saved', async ({ page }) => {
    await page.addInitScript(() => { navigator.canShare = () => false; });
    await routeSheets(page);
    await page.goto('/?s=changkon8');
    await fillAndCreate(page);
    await page.locator('#saveBtn').click();
    await expect(page.locator('#iosSave')).toBeVisible();
    await expect(page.locator('#confirmMsg')).toBeHidden();
    await expect(page.locator('body')).not.toContainText('บันทึกรูปลงเครื่องแล้ว');
  });
});

test('a back-dated report does not show "sent today"', async ({ page }) => {
  await page.addInitScript(() => { navigator.canShare = () => true; navigator.share = async () => {}; });
  await routeSheets(page);
  await page.goto('/?s=changkon8');
  await page.locator('#editDate').click();
  const iso = await page.locator('#dateInput').getAttribute('min');
  await page.locator('#dateInput').fill(iso);
  await page.locator('#dateInput').dispatchEvent('change');
  await expect(page.locator('#notTodayBadge')).toBeVisible();
  await fillAndCreate(page);
  await page.locator('#shareBtn').click();
  await expect(page.locator('#doneView')).toBeVisible();
  await page.locator('#again').click();
  await expect(page.locator('#formView')).toBeVisible();
  await expect(page.locator('#sentToday')).toBeHidden();
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('wp.lastReport.changkon8')));
  expect(rec.date).toBe(iso);
});
