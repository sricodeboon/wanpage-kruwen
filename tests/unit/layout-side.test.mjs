// แม่แบบชุด v3: ฉาก side-L / side-R (สถานที่เต็มคอลัมน์ข้าง รูปอยู่คอลัมน์แคบ) — spec docs/design/templates-v3.md
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as layout from '../../site/js/layout.js';
import { analyzeBg } from '../../tools/check-bg.mjs';
import { layoutSnapshot } from '../helpers/layout-snapshot.mjs';
import { synthBg } from '../helpers/synth-bg.mjs';

const { mergeTemplate, photoRects, validateTemplate, filterTemplates, SCENES, SIDE_LAYOUTS } = layout;
const ALL = JSON.parse(readFileSync(new URL('../../site/templates.json', import.meta.url), 'utf8'));
const SNAP = JSON.parse(readFileSync(new URL('./fixtures/layout-v2.json', import.meta.url), 'utf8'));
const CHECK_V2 = JSON.parse(readFileSync(new URL('./fixtures/check-bg-v2.json', import.meta.url), 'utf8'));
const byId = id => ALL.templates.find(t => t.id === id);
const V3 = ALL.templates.filter(t => /-(1[1-9]|20)$/.test(t.id));
const OLD = ALL.templates.filter(t => !V3.includes(t));

const LANDMARK = { 'side-L': { x: 0, y: 400, w: 400, h: 980 }, 'side-R': { x: 624, y: 400, w: 400, h: 980 } };
// แม่แบบ side จากฐาน np-11 เปลี่ยนฉาก/เลย์เอาต์/แถบคลื่นได้
const side = (scene, photo_layout, patch = {}, overrides = {}) =>
  mergeTemplate(ALL.common, { ...byId('np-11'), scene, photo_layout, landmark: LANDMARK[scene], ...patch, overrides });

const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
const area = q => q.w * q.h;
const round = q => q.map(r => ({ x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) }));

describe('ฉาก side: เรขาคณิต C1+2+1 / C2+2', () => {
  const combos = SCENES.filter(s => s !== 'bottom').flatMap(s => SIDE_LAYOUTS.map(l => [s, l]));
  it.each(combos.flatMap(([s, l]) => [[s, l, 0], [s, l, 54]]))('%s %s dy %i → 4 ช่องในคอลัมน์ ไม่ทับกัน ขนาดขั้นต่ำ เหนือแถบคลื่น', (scene, lay, dy) => {
    const r = side(scene, lay);
    const P = r.photos, S = r.side, lm = r.landmark;
    const colX0 = scene === 'side-L' ? lm.x + lm.w + S.gutter : lm.x - S.gutter - S.colW;
    const q = photoRects(r, dy);
    expect(q.length).toBe(4);
    q.forEach((a, i) => {
      expect(a.x).toBeGreaterThanOrEqual(colX0 - 1e-6);
      expect(a.x + a.w).toBeLessThanOrEqual(colX0 + S.colW + 1e-6);
      expect(overlaps(a, lm)).toBe(false);
      expect(a.y).toBeGreaterThanOrEqual(352 + dy);
      expect(a.y + a.h).toBeLessThanOrEqual(r.band.top_y - 16 + 1e-6);
      expect(a.w).toBeGreaterThanOrEqual(P.minSmallW);
      expect(a.h).toBeGreaterThanOrEqual(i === 0 ? P.minMainH : P.minSmallH);
      if (i > 0) expect(area(a)).toBeLessThanOrEqual(area(q[0]) + 1e-6);
      for (let j = i + 1; j < 4; j++) expect(overlaps(a, q[j])).toBe(false);
    });
    expect(validateTemplate(r)).toEqual({ ok: true, errors: [] });
  });

  // ตัวเลขใน spec §1.3 คิดจาก band.top_y 1375 (H 1007) จึงใช้ band 1375 ที่นี่ — แม่แบบจริง 30 แบบใช้ band 1380
  // (H 1012 → 369/262/340, ขอบล่างคอลัมน์ 1364) ซึ่งเทสต์ "ทุกแบบผ่าน validateTemplate" ครอบไว้
  it('C1+2+1 ตัวเลขตาม spec §1.3 (band 1375: dy 0 → 367/261/338, dy 54 → 347/246/319)', () => {
    const r = side('side-L', 'C1+2+1', { band: { top_y: 1375 } });
    const h = dy => { const q = photoRects(r, dy); return [q[0].h, q[1].h, q[3].h]; };
    expect(h(0)).toEqual([367, 261, 338]);
    expect(h(54)).toEqual([347, 246, 319]);
    const q = photoRects(r, 0);
    expect(q[0]).toEqual({ x: 424, y: 352, w: 554, h: 367 });
    expect(q[1].w).toBe(266.75);
    expect(q[2].x + q[2].w).toBe(978);
    expect(q[3].y + q[3].h).toBe(1375 - 16);
  });

  it('C2+2 แถวไม่เกิน 420 ชิดบน ช่องเท่ากัน', () => {
    const q = photoRects(side('side-R', 'C2+2', { band: { top_y: 1375 } }), 0);
    expect(q.map(a => a.h)).toEqual([420, 420, 420, 420]);
    expect(q.map(a => a.w)).toEqual([266.75, 266.75, 266.75, 266.75]);
    expect(q[0]).toMatchObject({ x: 46, y: 352 });
    expect(q[3].y + q[3].h).toBe(352 + 860.5);
  });

  it.each(SIDE_LAYOUTS.flatMap(l => [[l, 0], [l, 26], [l, 54]]))('side-R สะท้อน side-L (%s dy %i): x ของ R = 1024 − (x + w) ของ L', (lay, dy) => {
    const L = photoRects(side('side-L', lay), dy), R = photoRects(side('side-R', lay), dy);
    // ลำดับช่องคงซ้าย→ขวา: ช่องคู่สลับกันในกระจก
    const mirror = L.map(a => ({ ...a, x: 1024 - (a.x + a.w) }));
    const key = a => `${a.y.toFixed(3)}:${a.x.toFixed(3)}`;
    expect(round(R).sort((a, b) => key(a).localeCompare(key(b)))).toEqual(round(mirror).sort((a, b) => key(a).localeCompare(key(b))));
    if (lay === 'C1+2+1') expect(R[0]).toEqual(mirror[0]); // รูปหลักเต็มคอลัมน์อยู่ตำแหน่งกระจกเดียวกัน
    else expect(R[0]).toMatchObject({ x: 46, y: L[0].y }); // C2+2: ช่อง 0 = บนซ้ายเสมอ
  });

  it('overrides.side ปรับคอลัมน์รายแบบได้ (สถานที่กว้าง 410 → colW 544)', () => {
    const r = side('side-L', 'C1+2+1', { landmark: { x: 0, y: 400, w: 410, h: 980 } }, { side: { colW: 544 } });
    const q = photoRects(r, 0);
    expect(q[0].x).toBe(434);
    expect(q[0].x + q[0].w).toBe(978);
    expect(validateTemplate(r).ok).toBe(true);
  });
  it('ตัวอย่าง spec §1.4 (กว้าง 420 → colW 534) ช่องคู่กว้าง 256.75 < minSmallW 260 → validate จับได้', () => {
    const r = side('side-L', 'C1+2+1', { landmark: { x: 0, y: 400, w: 420, h: 980 } }, { side: { colW: 534 } });
    expect(photoRects(r, 0)[0].x).toBe(444);
    const v = validateTemplate(r);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('dy 0: รูป 1 กว้าง 256.75 < 260');
  });
});

describe('validateTemplate: กฎฉาก (spec §1.5)', () => {
  const np01 = (patch = {}) => mergeTemplate(ALL.common, { ...byId('np-01'), ...patch });
  it.each(SIDE_LAYOUTS)('ฉาก bottom + %s → ไม่ผ่าน (ไม่ throw)', (lay) => {
    const v = validateTemplate(np01({ photo_layout: lay }));
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('ใช้ได้เฉพาะฉาก side'))).toBe(true);
  });
  it.each(['1+3', '2+2', 'Z'])('ฉาก side-L + %s → ไม่ผ่าน', (lay) => {
    const v = validateTemplate(side('side-L', lay));
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('ต้องใช้ C1+2+1/C2+2'))).toBe(true);
  });
  it('scene ไม่รู้จัก → ไม่ผ่าน', () => {
    expect(validateTemplate(side('side-L', 'C1+2+1', { scene: 'top' })).errors.some(e => e.includes('scene "top"'))).toBe(true);
  });
  it('landmark.y < 394 (ทับที่อยู่ 2 บรรทัด) → ไม่ผ่าน', () => {
    const v = validateTemplate(side('side-L', 'C1+2+1', { landmark: { x: 0, y: 380, w: 400, h: 1000 } }));
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('landmark.y 380 < 394'))).toBe(true);
    expect(validateTemplate(side('side-L', 'C1+2+1', { landmark: { x: 0, y: 394, w: 400, h: 986 } })).ok).toBe(true);
    const high = validateTemplate(side('side-R', 'C2+2', { landmark: { x: 624, y: 300, w: 400, h: 1080 } }));
    expect(high.errors).toEqual(expect.arrayContaining(['landmark.y 300 < 394 (ทับที่อยู่ 2 บรรทัด)', 'landmark ทับ school', 'landmark ทับ address']));
  });
  it('landmark ทับคอลัมน์รูป (gutter ติดลบ) → ไม่ผ่าน ทั้งซ้ายและขวา', () => {
    for (const scene of ['side-L', 'side-R']) {
      const v = validateTemplate(side(scene, 'C1+2+1', {}, { side: { gutter: -10 } }));
      expect(v.ok, scene).toBe(false);
      expect(v.errors.some(e => e.includes('ทับสถานที่')), scene).toBe(true);
    }
  });
  it('เลย์เอาต์ที่ใช้พิกัดตายตัว (1+3) บนฉาก side → รูปล้ำคอลัมน์สถานที่', () => {
    for (const scene of ['side-L', 'side-R']) {
      const v = validateTemplate(side(scene, '1+3'));
      expect(v.errors.some(e => e.includes('ล้ำคอลัมน์สถานที่')), scene).toBe(true);
    }
  });
  it('รูปยาวเกินลงไปทับแถบคลื่น → ไม่ผ่าน', () => {
    const v = validateTemplate(side('side-R', 'C1+2+1', {}, { side: { ratioC1: { main: 0.6, pair: 0.5 } } }));
    expect(v.errors.some(e => e.includes('ทับแถบคลื่น'))).toBe(true);
  });
  it('พื้นที่ไม่พอ → รายงาน error ไม่ซ่อน (dy 54)', () => {
    const v = validateTemplate(side('side-L', 'C1+2+1', {}, { side: { ratioC1: { main: 0.2, pair: 0.6 } } }));
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('ไม่พอ'))).toBe(true);
  });
});

describe('validateTemplate: ขอบกระดาษ / คอลัมน์สถานที่ (ฉาก side)', () => {
  it('overrides.side แก้ไม่ครบ (สถานที่กว้าง 440 แต่ colW เดิม 554) → รูปเลยขอบกระดาษ 978', () => {
    const r = side('side-L', 'C1+2+1', { landmark: { x: 0, y: 400, w: 440, h: 980 } });
    expect(photoRects(r, 0)[0].x + photoRects(r, 0)[0].w).toBe(1018);
    const v = validateTemplate(r);
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('เลยขอบกระดาษ 46–978'))).toBe(true);
  });
  it('side-R เลยขอบซ้าย 46 → ไม่ผ่าน', () => {
    const v = validateTemplate(side('side-R', 'C2+2', { landmark: { x: 584, y: 400, w: 440, h: 980 } }));
    expect(v.errors.some(e => e.includes('เลยขอบกระดาษ'))).toBe(true);
  });
  it('สถานที่ยาวลงไปทับกล่องครูเวร (ล่าง > band.top_y + 4) → ไม่ผ่าน', () => {
    const v = validateTemplate(side('side-L', 'C1+2+1', { landmark: { x: 0, y: 400, w: 400, h: 1130 } }));
    expect(v.errors).toContain('landmark ล่าง 1530 > band.top_y+4 1384 (ทับกล่องครูเวร)');
    expect(validateTemplate(side('side-L', 'C1+2+1', { landmark: { x: 0, y: 400, w: 400, h: 984 } })).ok).toBe(true);
  });
  it('คอลัมน์สถานที่ต้องชิดขอบฝั่งของฉาก', () => {
    expect(validateTemplate(side('side-L', 'C1+2+1', { landmark: { x: 10, y: 400, w: 390, h: 980 } })).errors)
      .toContain('side-L: landmark.x ต้องเป็น 0 (ได้ 10)');
    expect(validateTemplate(side('side-R', 'C1+2+1', { landmark: { x: 624, y: 400, w: 380, h: 980 } })).errors)
      .toContain('side-R: landmark.x+w ต้องเป็น 1024 (ได้ 1004)');
  });
  it('ไม่ระบุ landmark → ใช้ common.side.landmark ชิดขอบฝั่งฉาก; ฉาก bottom ไม่ได้ค่านี้', () => {
    const noLm = scene => { const t = { ...byId('np-11'), scene, photo_layout: 'C2+2' }; delete t.landmark; return mergeTemplate(ALL.common, t); };
    expect(noLm('side-L').landmark).toEqual(LANDMARK['side-L']);
    expect(noLm('side-R').landmark).toEqual(LANDMARK['side-R']);
    expect(validateTemplate(noLm('side-R')).ok).toBe(true);
    const bottom = { ...byId('np-01') }; delete bottom.landmark;
    expect(mergeTemplate(ALL.common, bottom).landmark).toBeUndefined();
  });
  it('ไม่มี common.side → รายงาน error ไม่ throw และไม่ผ่านเงียบ', () => {
    const r = side('side-L', 'C1+2+1');
    delete r.side;
    const v = validateTemplate(r);
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('ไม่มี common.side'))).toBe(true);
  });
});

describe('ป้ายชื่อรูปฉาก side (common.side.label)', () => {
  const measure = (text, font) => String(text).length * 0.55 * font; // ตัวแทนเดียวกับ tests/helpers/measure.mjs
  const model = label => ({ school: { name_full: 'โรงเรียน', address: '' }, title: 'รายงาน', dateISO: '2026-10-23', teachers: [],
    photos: [{ label: 'อาคารเรียน' }, { label }, { label: 'ก' }, { label: 'ก' }] });
  it('ช่องคู่ 266.75 ลดฟอนต์ได้ถึง side.label.minFont 15 ก่อนตัด "…" (ป้ายมาตรฐานจริงวัดด้วย Kanit ใน e2e side-labels)', () => {
    const label = 'ก'.repeat(20); // 20 × 0.55 × 15 = 165 ≤ 174.75 แต่ที่ 17 = 187 > 174.75
    const L = layout.computeLayout(side('side-L', 'C1+2+1'), model(label), measure);
    expect(L.photos[1].w).toBe(266.75);
    expect(L.labels[1]).toMatchObject({ text: label, font: 15 });
    expect(ALL.common.side.label.minFont).toBe(15);
    expect(ALL.common.label.minFont).toBe(17); // แม่แบบเดิมใช้ค่าเดิม (snapshot ด้านล่างยืนยันทุกตัวเลข)
  });
});

describe('templates.json ชุด v3', () => {
  it('มี 30 แบบใหม่ np/sn/mdh-11..20 ครบ เปิดได้เฉพาะแบบที่ครูอนุมัติภาพแล้ว (ผู้ใช้ไม่เห็นแบบที่รอภาพ)', () => {
    expect(V3.map(t => t.id).sort()).toEqual(['np', 'sn', 'mdh'].flatMap(p => Array.from({ length: 10 }, (_, i) => `${p}-${i + 11}`)).sort());
    for (const t of V3) {
      if (t.active) {
        expect(t.approvedAt, t.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(existsSync(`${new URL('../../site/', import.meta.url).pathname}${t.file}`), t.id).toBe(true);
      } else {
        expect(t.approvedAt, t.id).toBeNull();
      }
    }
    for (const p of ['np', 'sn', 'mdh']) {
      const shown = filterTemplates(ALL, p).filter(t => V3.some(v => v.id === t.id));
      expect(shown.every(t => t.active), p).toBe(true);
    }
  });
  it('ทุกแบบผ่าน validateTemplate; ฉากต่อจังหวัด ล่าง 4 / L 3 / R 3 และ landmark ตรงฝั่ง', () => {
    for (const t of ALL.templates) expect(validateTemplate(mergeTemplate(ALL.common, t)).errors, t.id).toEqual([]);
    for (const p of ['np', 'sn', 'mdh']) {
      const list = V3.filter(t => t.province === p);
      const n = s => list.filter(t => t.scene === s).length;
      expect([n('bottom'), n('side-L'), n('side-R')], p).toEqual([4, 3, 3]);
    }
    for (const t of V3.filter(t => t.scene !== 'bottom')) expect(t.landmark).toMatchObject(LANDMARK[t.scene]);
  });
  it('palette v3 ไม่มีเขียว (hue p1–p3 นอก 75–165°) และสูตรค่าร่วม pillText/dutyTop', () => {
    const hue = hex => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d) return null;
      if (mx === r) return 60 * (((g - b) / d + 6) % 6);
      if (mx === g) return 60 * ((b - r) / d + 2);
      return 60 * ((r - g) / d + 4);
    };
    for (const t of V3) {
      const P = t.palette;
      for (const k of ['p1', 'p2', 'p3']) {
        const h = hue(P[k]);
        expect(h === null || h < 75 || h > 165, `${t.id} ${k} ${P[k]} hue ${h}`).toBe(true);
      }
      expect(P.pillText).toBe(P.p1);
      expect(P.dutyTop).toBe(P.p2 + 'f2');
      expect(P.dutyBottom.endsWith('f5')).toBe(true);
      expect([P.gold, P.gold2, P.pillBg]).toEqual(['#d9a93a', '#f6d983', '#ffffffd9']);
    }
  });
  it('mergeTemplate: scene ไม่มี → bottom; มี → คงไว้', () => {
    expect(mergeTemplate(ALL.common, byId('np-01')).scene).toBe('bottom');
    expect(mergeTemplate(ALL.common, byId('np-13')).scene).toBe('side-R');
  });
});

describe('แม่แบบเดิม 30 แบบไม่เปลี่ยนแม้ตัวเลขเดียว', () => {
  it('มีครบ 30 แบบใน snapshot', () => expect(Object.keys(SNAP).sort()).toEqual(OLD.map(t => t.id).sort()));
  it('computeLayout × 6 เคส golden + photoRects dy 0/26/28/54 + validateTemplate เท่ากับ layout-v2.json (deep equal)', () => {
    expect(layoutSnapshot(ALL, layout, OLD.map(t => t.id))).toEqual(SNAP);
  });
});

describe('check-bg ฉาก side', () => {
  it.each(['side-L', 'side-R'])('ภาพสังเคราะห์ %s ที่ถูกต้อง → ผ่านทุกเกณฑ์', async (scene) => {
    const r = await analyzeBg(await synthBg({ scene }), { scene });
    expect(r.checks.filter(c => !c.ok)).toEqual([]);
    expect(r.checks.map(c => c.name)).toEqual(['aspect', 'header_zone', 'photo_zone', 'gutter_clean', 'landmark', 'band', 'green', 'ornament']);
    expect(r.metrics.landmarkRows).toBeGreaterThanOrEqual(300);
  });
  it.each(['side-L', 'side-R'])('%s สถานที่ล้ำ gutter 60 px → gutter_clean ตก', async (scene) => {
    const r = await analyzeBg(await synthBg({ scene, intrude: 60 }), { scene });
    expect(r.checks.find(c => c.name === 'gutter_clean').ok).toBe(false);
    expect(r.ok).toBe(false);
  });
  it('ภาพฝั่งผิด (สถานที่ซ้ายแต่ตรวจเป็น side-R) → ไม่ผ่าน', async () => {
    const r = await analyzeBg(await synthBg({ scene: 'side-L' }), { scene: 'side-R' });
    expect(r.ok).toBe(false);
  });
  it('คอลัมน์สถานที่ว่าง → landmark ตก', async () => {
    const r = await analyzeBg(await synthBg({ scene: 'side-L', empty: true }), { scene: 'side-L' });
    const c = r.checks.find(x => x.name === 'landmark');
    expect(c.ok).toBe(false);
    expect(r.metrics.landmarkRows).toBeLessThan(300);
  });
  it('ดอกไม้มุมชนตรา → ornament ตก', async () => {
    const sharp = (await import('sharp')).default;
    const blob = await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 90, g: 40, b: 140 } } }).png().toBuffer();
    const img = await sharp(await synthBg({ scene: 'side-R' })).composite([{ input: blob, left: 420, top: 30 }]).png().toBuffer();
    const r = await analyzeBg(img, { scene: 'side-R' });
    expect(r.checks.find(c => c.name === 'ornament').ok).toBe(false);
  });
  it('ภาพ bottom เดิม (np-01) ให้ค่าเท่าเดิมทุกตัวเลข (ค่าที่บันทึกก่อนเพิ่มฉาก side)', async () => {
    for (const [file, before] of Object.entries(CHECK_V2)) {
      expect(JSON.parse(JSON.stringify(await analyzeBg(file))), file).toEqual(before);
      expect(JSON.parse(JSON.stringify(await analyzeBg(file, { scene: 'bottom' }))), file).toEqual(before);
    }
  });
  it('bottom + v3 เพิ่มเกณฑ์ ornament ต่อท้ายเท่านั้น', async () => {
    const [file, before] = Object.entries(CHECK_V2)[0];
    const r = JSON.parse(JSON.stringify(await analyzeBg(file, { scene: 'bottom', v3: true })));
    expect(r.checks.slice(0, -1)).toEqual(before.checks);
    expect(r.checks.at(-1).name).toBe('ornament');
  });
  it('scene ไม่ถูกต้อง → throw', async () => {
    await expect(analyzeBg(await synthBg(), { scene: 'top' })).rejects.toThrow('scene');
  });
});
