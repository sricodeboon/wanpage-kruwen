// ป้ายชื่อรูปของฉาก side (v3) วัดด้วยฟอนต์ Kanit จริงใน Chromium — ตัวแทน measure ใน vitest วัดไทยกว้างเกินจริง
// ช่องคู่ C1+2+1/C2+2 กว้าง 266.75 → ป้ายมาตรฐาน 4 ป้ายต้องไม่ถูกตัดด้วย "…" ทั้งกรณีปกติ (dy 0) และชื่อ+ที่อยู่ 2 บรรทัด (dy 54)
import { test, expect } from '@playwright/test';
import { routeTestConfig } from './test-config.mjs';
import { casesFor, PHOTOS } from '../golden/cases.mjs';

test.beforeEach(async ({ page }) => { await routeTestConfig(page); });

test('side templates: the 4 standard photo labels are not cut with "…" (dy 0 and 54)', async ({ page }) => {
  await page.route('**/__blank.html', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="th"><head><meta charset="utf-8"><link rel="stylesheet" href="fonts.css"></head><body></body></html>' }));
  await page.goto('/__blank.html');
  const [normal, twoLine] = ['np-11-1', 'np-11-e2'].map((n) => casesFor('np-11').find((c) => c.name === n).model);
  twoLine.photos = PHOTOS.map((p) => ({ ...p }));
  // ฟอนต์จริงแคบกว่าตัวแทน: ที่อยู่ของเคส e2 พอดีบรรทัดเดียว (dy 26) — ต่อให้ยาวจนขึ้น 2 บรรทัด ได้ dy มากสุด 54
  twoLine.school = { ...twoLine.school, address: `${twoLine.school.address} ${twoLine.school.address}` };
  const out = await page.evaluate(async ({ normal, twoLine }) => {
    const { mergeTemplate, computeLayout } = await import('/js/layout.js');
    const { ensureFonts } = await import('/js/fonts.js');
    if (!(await ensureFonts({ timeoutMs: 5000 }))) throw new Error('ฟอนต์ Kanit ไม่พร้อม');
    const all = await (await fetch('/templates.json')).json();
    const ctx = document.createElement('canvas').getContext('2d');
    const measure = (s, px, weight = 700) => { ctx.font = `${weight} ${px}px Kanit`; return ctx.measureText(String(s)).width; };
    const rows = [];
    for (const t of all.templates.filter((x) => x.scene === 'side-L' || x.scene === 'side-R')) {
      const r = mergeTemplate(all.common, t);
      for (const model of [normal, twoLine]) {
        const L = computeLayout(r, model, measure);
        rows.push({ id: t.id, dy: L.dy, labels: L.labels.map((l) => l && { text: l.text, font: l.font, right: l.rect.x + l.rect.w }),
          photos: L.photos.map((p) => ({ x: p.x, w: p.w })) });
      }
    }
    return rows;
  }, { normal, twoLine });
  expect(out.length).toBe(18 * 2);
  expect([...new Set(out.map((r) => r.dy))].sort()).toEqual([0, 54]);
  for (const r of out) {
    r.labels.forEach((l, i) => {
      const where = `${r.id} dy ${r.dy} ช่อง ${i}`;
      expect(l.text, where).toBe(PHOTOS[i].label);
      expect(l.text.endsWith('…'), where).toBe(false);
      expect(l.right, where).toBeLessThanOrEqual(r.photos[i].x + r.photos[i].w - 14 + 1e-6); // ป้ายอยู่ในช่องรูป
    });
  }
});
