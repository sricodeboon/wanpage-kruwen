// e2e: หน้ามือถือกระชับ + มาสคอต (docs/design/logo-ux-v1.md E8 / F)
// ข้อมูล = ครูจริงจาก snapshot (ช่างกลฯ 8 มี 14 คน) ส่งผ่าน Sheet CSV จำลอง → ไม่มีป้าย "ข้อมูลสำรอง" มาเพิ่มความสูง
import { test, expect, devices } from '@playwright/test';
import { routeTestConfig } from './test-config.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const snap = JSON.parse(readFileSync(`${root}site/data/snapshot.json`, 'utf8'));
const staff = snap.teachersBySchool.changkon8;

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvOf = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
const TABS = {
  schools: csvOf(['school_id', 'short_name', 'name_full', 'address', 'province', 'logo_file', 'default_bg', 'sort_order', 'active'],
    snap.schools.map((s) => ({ ...s, active: 'TRUE' }))),
  teachers: csvOf(['teacher_id', 'school_id', 'display_name', 'phone', 'sort_order', 'active'],
    Object.values(snap.teachersBySchool).flatMap((list) => list.map((t, k) => ({ ...t, sort_order: k + 1, active: 'TRUE' })))),
  settings: csvOf(['key', 'value'], Object.entries(snap.settings).map(([key, value]) => ({ key, value }))),
  photo_labels: csvOf(['label', 'icon', 'sort_order', 'active'], snap.labels.map((l, k) => ({ ...l, sort_order: k + 1, active: 'TRUE' }))),
};

test.beforeEach(async ({ page }) => {
  await routeTestConfig(page);
  await page.route(/docs\.google\.com\/spreadsheets\//, (route) => {
    const tab = new URL(route.request().url()).searchParams.get('sheet');
    route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: TABS[tab] ?? '' });
  });
});

const scrollH = (page) => page.evaluate(() => document.documentElement.scrollHeight);

async function open(page, sid = 'changkon8') {
  await page.goto(`/?s=${sid}`);
  await expect(page.locator('.t')).toHaveCount(snap.teachersBySchool[sid].length);
  await expect(page.locator('#dataBadge')).toBeHidden();
  await expect(page.locator('#boot')).toBeHidden();
}

test('Pixel 7: page fits ~1.3 screens, collapses to one screen after "next"', async ({ page }) => {
  await open(page);
  expect(staff.length).toBeGreaterThan(8);
  expect(await scrollH(page)).toBeLessThanOrEqual(1150);
  const head = await page.locator('.app-head').boundingBox();
  expect(head.height).toBeLessThanOrEqual(72);
  expect((await page.locator('#secTeachers').boundingBox()).height).toBeLessThanOrEqual(420);

  await page.locator('.t').first().click();
  await page.locator('#nextPhotos').click();
  await expect(page.locator('#teacherSummary')).toBeVisible();
  await expect(page.locator('#teacherSummary')).toContainText('ครูเวร:');
  await expect(page.locator('#teacherList')).toBeHidden();
  expect(await scrollH(page)).toBeLessThanOrEqual(850);
  const edit = await page.locator('#editTeachers').boundingBox();
  expect(edit.height).toBeGreaterThanOrEqual(52);

  // แก้ไข → ขยายกลับ ครูที่เลือกยังติ๊กอยู่
  await page.locator('#editTeachers').click();
  await expect(page.locator('#teacherSummary')).toBeHidden();
  await expect(page.locator('.t').first()).toHaveAttribute('aria-checked', 'true');
});

test('"more teachers" toggles the folded names (order unchanged)', async ({ page }) => {
  await open(page);
  const more = page.locator('#moreTeachers');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toHaveText(`ดูครูอีก ${staff.length - 8} คน ▾`);
  await expect(page.locator('.t').nth(7)).toBeVisible();
  await expect(page.locator('.t').nth(staff.length - 1)).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.t').nth(staff.length - 1)).toBeVisible();
  const names = await page.locator('.t .t-name').allTextContents();
  expect(names).toEqual(staff.map((t) => t.display_name));
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.t').nth(staff.length - 1)).toBeHidden();
});

test('reduced motion: no running animations, no blinking eyes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('.app-head .brand-blink')).toBeHidden();
  await page.locator('.t').first().click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('a saved duty set past the 8th teacher opens the folded list', async ({ page }) => {
  const late = staff[staff.length - 1].teacher_id;
  await page.addInitScript((id) => localStorage.setItem('wp.teachers.changkon8', JSON.stringify([id])), late);
  await open(page);
  await expect(page.locator('#teacherList')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#moreTeachers')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`.t[data-id="${late}"]`)).toBeVisible();
});

test('mascot assets + icons are served and the header coin is animated only on the form', async ({ page }) => {
  await open(page);
  for (const src of ['assets/brand/kruwan-bust.png', 'assets/brand/kruwan-wave.png', 'assets/brand/kruwan-thumb.png', 'icons/icon-512-maskable.png', 'icons/favicon-48.png', 'icons/icon-180.png']) {
    expect((await page.request.get(`/${src}`)).status(), src).toBe(200);
  }
  const anim = await page.locator('.app-head .brand-mascot').evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('breathe');
  // แท็บซ่อน → หยุด
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.locator('.app-head .brand-mascot').evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
});

// ชื่อทุกคำอยู่บรรทัดเดียว (ไม่ถูกตัดกลางคำ) และไม่มีชื่อถูก clamp หาย
async function expectNamesWhole(page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.t .t-name')].flatMap((el) => {
    const line = parseFloat(getComputedStyle(el).lineHeight);
    const out = [];
    const words = el.querySelectorAll('.w');
    if (words.length && words[words.length - 1].getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 1) out.push(`clamped: ${el.textContent}`);
    for (const w of words) if (w.getBoundingClientRect().height > line * 1.5) out.push(`split: ${w.textContent}`);
    return out;
  }));
  expect(bad).toEqual([]);
}

test('summary shows given names (no rank/title, not the surname)', async ({ page }) => {
  await open(page);
  await page.locator('#moreTeachers').click();
  await page.locator('.t').nth(4).click(); // ด.ต.หญิงดารินทร์ อินทิแสง
  await page.locator('.t').nth(11).click(); // นางสาวจิราวรรณ ชอบพวงดึ
  await page.locator('#nextPhotos').click();
  await expect(page.locator('#teacherSummary')).toContainText('ครูเวร: ดารินทร์, จิราวรรณ ·');
  expect((await page.locator('#secTeachers').boundingBox()).height).toBeLessThanOrEqual(72);
});

test('collapsed summary still says "not today" for a past date', async ({ page }) => {
  await open(page);
  await page.locator('#editDate').click();
  await page.locator('#dateSheet .sheet-item', { hasText: 'เมื่อวาน' }).click();
  await page.locator('.t').first().click();
  await page.locator('#nextPhotos').click();
  await expect(page.locator('#teacherSummary')).toContainText('ไม่ใช่วันนี้');
});

test('names wrap only between words and are never clamped away (Pixel 7)', async ({ page }) => {
  for (const sid of ['changkon8', 'cocknis']) {
    await open(page, sid);
    await page.locator('#moreTeachers').click();
    await expectNamesWhole(page);
  }
});

test('a picked teacher past the 8th stays visible after "collapse"', async ({ page }) => {
  await open(page);
  const more = page.locator('#moreTeachers');
  await more.click();
  const late = page.locator('.t').nth(13);
  await late.click();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(late).toBeVisible();
  await expect(late).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.t').nth(12)).toBeHidden();
  await expect(page.locator('#teacherCount')).toHaveText('เลือกแล้ว 1/3 คน');
});

test('"use saved set" after a manual collapse re-opens the list', async ({ page }) => {
  const late = staff[staff.length - 1].teacher_id;
  await page.addInitScript((id) => localStorage.setItem('wp.teachers.changkon8', JSON.stringify([id])), late);
  await open(page);
  await page.locator('#moreTeachers').click(); // ย่อรายชื่อ
  await expect(page.locator('#moreTeachers')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#reuseChip').click();
  await expect(page.locator(`.t[data-id="${late}"]`)).toBeVisible();
  await expect(page.locator(`.t[data-id="${late}"]`)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#moreTeachers')).toHaveAttribute('aria-expanded', 'true');
});

test('small schools: no "more" button when ≤ 8 teachers, 9 folds one', async ({ page }) => {
  await open(page, 'nasamakkhi');
  await expect(page.locator('#moreTeachers')).toBeHidden();
  expect(await scrollH(page)).toBeLessThanOrEqual(1100);
  await open(page, 'hatsaipe');
  await expect(page.locator('#moreTeachers')).toHaveText('ดูครูอีก 1 คน ▾'); // 9 คน → ยังพับ 1 คน
  expect(await scrollH(page)).toBeLessThanOrEqual(1150);
});

test('page opened in a background tab starts paused', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await open(page);
  await expect(page.locator('html')).toHaveClass(/\bpaused\b/);
});

test('splash gives way to the retry box when app.js never runs', async ({ page }) => {
  await page.route(/\/js\/form\.js/, (route) => route.fulfill({ status: 404, body: '' }));
  await page.clock.install();
  await page.goto('/?s=changkon8');
  await expect(page.locator('#boot')).toBeVisible();
  await page.clock.runFor(12500);
  await expect(page.locator('#boot')).toBeHidden();
  await expect(page.locator('#loadFail')).toBeVisible();
});

test.describe('iPhone SE', () => {
  const se = devices['iPhone SE'];
  test.use({ viewport: { width: 375, height: 667 }, userAgent: se.userAgent, deviceScaleFactor: se.deviceScaleFactor, isMobile: true, hasTouch: true });
  test('page height stays under 1250px', async ({ page }) => {
    await open(page);
    expect(await scrollH(page)).toBeLessThanOrEqual(1250);
  });
  test('names wrap only between words and are never clamped away', async ({ page }) => {
    for (const sid of ['changkon8', 'cocknis']) {
      await open(page, sid);
      await page.locator('#moreTeachers').click();
      await expectNamesWhole(page);
    }
  });
});
