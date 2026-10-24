import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { measure } from '../helpers/measure.mjs';
import {
  mergeTemplate, fitText, photoRects, computeLayout, validateTemplate, filterTemplates, splitRank, wordBoundaries, LAYOUTS,
} from '../../site/js/layout.js';

const ALL = JSON.parse(readFileSync(new URL('../../site/templates.json', import.meta.url), 'utf8'));
const NP01 = ALL.templates.find(t => t.id === 'np-01');
const resolved = (over = {}, tplPatch = {}) => mergeTemplate(ALL.common, { ...NP01, ...tplPatch, overrides: over });

const school = (name = 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8') => ({
  school_id: 'cg8', short_name: 'ช่างกลฯ 8', name_full: name,
  address: 'บ้านโนนอุดมดี ต.ดอนเตย อ.นาทม จ.นครพนม 48140', province: 'np',
  logo_file: 'cg8.png', default_bg: 'np-01', sort_order: 1,
});
const model = (patch = {}) => ({
  school: school(), title: 'รายงานภาพบรรยากาศและบริบทโรงเรียน', dateISO: '2026-10-23',
  teachers: [{ display_name: 'ส.ต.ท.รัชเดช ศรีแก้ว', phone: '081-234-5678' }],
  photos: [{ label: 'ภาพรวม', icon: 'school' }, { label: 'สนามกีฬา', icon: 'field' }, null, null],
  ...patch,
});

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('mergeTemplate', () => {
  it('deep-merges overrides over common', () => {
    const r = resolved({ photos: { small: { h: 200 } } });
    expect(r.photos.small.h).toBe(200);
    expect(r.photos.main.h).toBe(282);
    expect(r.photos.small.xs).toEqual([46, 363.5, 681]);
    expect(ALL.common.photos.small.h).toBe(230); // ไม่แก้ common เดิม
  });
  it('keeps template fields', () => {
    const r = resolved();
    for (const k of ['id', 'version', 'province', 'palette', 'landmark', 'band', 'photo_layout', 'file', 'thumb']) {
      expect(r[k]).toEqual(NP01[k]);
    }
  });
  it('palette override merges into template palette', () => {
    const r = resolved({ palette: { pillBg: '#ffffff' } });
    expect(r.palette.pillBg).toBe('#ffffff');
    expect(r.palette.p1).toBe('#3b1470');
  });
  it('photo_layout defaults to 1+3', () => {
    const { photo_layout, ...rest } = NP01;
    expect(mergeTemplate(ALL.common, rest).photo_layout).toBe('1+3');
  });
});

describe('fitText', () => {
  it('keeps font when it fits', () => {
    expect(fitText(measure, 'สั้น', { maxW: 684, font: 28, minFont: 22 })).toEqual({ font: 28, lines: ['สั้น'] });
  });
  it('reduces by 1 until fits', () => {
    // 50 ตัว × 0.55 × f ≤ 684 → f ≤ 24.87 → 24
    const r = fitText(measure, 'ก'.repeat(50), { maxW: 684, font: 28, minFont: 22 });
    expect(r).toEqual({ font: 24, lines: ['ก'.repeat(50)] });
  });
  it('full school name 60 chars at maxW 684 → 2 lines at 22, split at space nearest middle', () => {
    const text = 'ก'.repeat(28) + ' ' + 'ข'.repeat(10) + ' ' + 'ค'.repeat(20); // 60 ตัว
    const r = fitText(measure, text, { maxW: 684, font: 28, minFont: 22 });
    expect(r.lines.length).toBe(2);
    expect(r.font).toBe(22);
    expect(r.lines).toEqual(['ก'.repeat(28), 'ข'.repeat(10) + ' ' + 'ค'.repeat(20)]);
  });
  it('no space → split near middle but never before a combining mark', () => {
    const text = 'ก' + 'กี'.repeat(39) + 'ก'; // 80 ตัว ตำแหน่งกลาง (40) เป็นสระ ี
    expect(text[40]).toBe('ี');
    const r = fitText(measure, text, { maxW: 300, font: 28, minFont: 22 });
    expect(r.lines.length).toBe(2);
    expect(r.lines.join('')).toBe(text);
    expect(r.lines[0].length).toBe(39);
    expect(r.lines[1][0]).toBe('ก');
  });
  it('sample school name: space split rejected when a half overflows → balanced split, both lines fit', () => {
    const text = 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8';
    const opts = { maxW: 400, font: 28, minFont: 22 };
    const r = fitText(measure, text, opts);
    expect(r.font).toBe(22);
    expect(r.lines.length).toBe(2);
    expect(r.lines.join('').replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''));
    for (const l of r.lines) expect(measure(l, 22)).toBeLessThanOrEqual(400);
    expect(r.lines[1]).not.toBe('8');
    const marks = /^[\u0E30\u0E31\u0E32-\u0E3A\u0E45\u0E47-\u0E4E]/u;
    expect(marks.test(r.lines[1])).toBe(false);
    expect(/[\u0E40-\u0E44]$/u.test(r.lines[0])).toBe(false);
  });
  it('sample school name breaks only at a Thai word boundary (Intl.Segmenter)', () => {
    const text = 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8';
    const r = fitText(measure, text, { maxW: 400, font: 28, minFont: 22 });
    expect(r.lines.length).toBe(2);
    const seg = new Intl.Segmenter('th', { granularity: 'word' });
    const bounds = new Set([...seg.segment(text)].map(s => s.index));
    expect(bounds.has(r.lines[0].length)).toBe(true);
    expect(text.startsWith(r.lines[0])).toBe(true);
    expect(r.lines[0]).toBe('โรงเรียนตำรวจตระเวนชายแดน');
    for (const l of r.lines) expect(measure(l, 22)).toBeLessThanOrEqual(400);
    expect(wordBoundaries(text)).toContain(r.lines[0].length);
  });
  it('segmenter: null → character-balance fallback still works', () => {
    const text = 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8';
    const r = fitText(measure, text, { maxW: 400, font: 28, minFont: 22, segmenter: null });
    expect(r.lines).toEqual(['โรงเรียนตำรวจตระเวนชายแด', 'นช่างกลปทุมวันอนุสรณ์ 8']);
    expect(wordBoundaries(text, null)).toEqual([]);
  });
  it('no word boundary fits → character fallback', () => {
    const text = 'ก' + 'กี'.repeat(39) + 'ก';
    const fake = { segment: () => [{ index: 0, segment: text }] };
    const r = fitText(measure, text, { maxW: 300, font: 28, minFont: 22, segmenter: fake });
    expect(r.lines[0].length).toBe(39);
  });
  it('maxLines 1 never splits', () => {
    const r = fitText(measure, 'ก'.repeat(100), { maxW: 300, font: 28, minFont: 22, maxLines: 1 });
    expect(r).toEqual({ font: 22, lines: ['ก'.repeat(100)] });
  });
});

describe('splitRank', () => {
  it('splits dotted rank prefix', () => expect(splitRank('ส.ต.ท.รัชเดช ศรีแก้ว')).toEqual(['ส.ต.ท.', 'รัชเดช ศรีแก้ว']));
  it('rank followed by space', () => expect(splitRank('จ.ส.อ. สมชาย ใจดี')).toEqual(['จ.ส.อ.', 'สมชาย ใจดี']));
  it('name starting with leading vowel เ keeps whole rank', () => expect(splitRank('ส.ต.ท.เอกชัย ใจดี')).toEqual(['ส.ต.ท.', 'เอกชัย ใจดี']));
  it('name starting with leading vowel ไ keeps whole rank', () => expect(splitRank('ร.ต.อ.ไพโรจน์ มั่นคง')).toEqual(['ร.ต.อ.', 'ไพโรจน์ มั่นคง']));
  it('no rank → first space', () => expect(splitRank('นางสมศรี มีสุข')).toEqual(['นางสมศรี', 'มีสุข']));
});

describe('computeLayout', () => {
  it('one-line school → dy 0, photos at template y', () => {
    const L = computeLayout(resolved(), model({ school: school('โรงเรียนสั้น') }), measure);
    expect(L.dy).toBe(0);
    expect(L.school.lines.length).toBe(1);
    expect(L.photos[0].y).toBe(352);
  });
  it('two-line school → dy 26 and photos shift', () => {
    const L = computeLayout(resolved(), model({ school: school('ก'.repeat(29) + ' ' + 'ข'.repeat(30)) }), measure);
    expect(L.school.lines.length).toBe(2);
    expect(L.school.rect.h).toBe(80);
    expect(L.dy).toBe(26);
    expect(L.address.rect.y).toBe(304 + 26);
    expect(L.photos[0].y).toBe(352 + 26);
    expect(L.photos[1].y).toBe(650 + 26);
    expect(L.photos[1].y + L.photos[1].h + 16).toBeLessThanOrEqual(890);
  });
  it('two-line address adds 28 more', () => {
    const s = { ...school('ก'.repeat(29) + ' ' + 'ข'.repeat(30)), address: 'ก'.repeat(50) + ' ' + 'ข'.repeat(50) };
    const L = computeLayout(resolved(), model({ school: s }), measure);
    expect(L.address.lines.length).toBe(2);
    expect(L.address.rect.h).toBe(64);
    expect(L.dy).toBe(54);
  });
  it.each([[1, 170, 684, 104], [2, 120, 784, 118], [3, 70, 884, 120]])('%i teachers → variant/x', (n, x, w, h) => {
    const teachers = Array.from({ length: n }, (_, i) => ({ display_name: `ครู${i}`, phone: '0812345678' }));
    const L = computeLayout(resolved(), model({ teachers }), measure);
    expect(L.duty.variant).toBe(n);
    expect(L.duty.rect).toEqual({ x, y: 1536 - 22 - h, w, h });
    expect(L.duty.cols.length).toBe(n);
  });
  it('duty header width uses Thai date text', () => {
    const L = computeLayout(resolved(), model(), measure);
    expect(L.duty.header.text).toBe('ครูเวรประจำวันที่ 23 ตุลาคม พ.ศ. 2569');
    expect(L.duty.header.font).toBe(26);
    expect(L.duty.header.y).toBe(L.duty.rect.y + 28);
  });
  it('3 teachers with 32-char names → font 17, rank/name split, h 134', () => {
    const long = 'ส.ต.ท.รัชเดช ศรีแก้ว' + 'ก'.repeat(12); // 32 ตัว
    expect(long.length).toBe(32);
    const teachers = [long, long, long].map(display_name => ({ display_name, phone: '0812345678' }));
    const L = computeLayout(resolved(), model({ teachers }), measure);
    expect(L.duty.variant).toBe(3);
    expect(L.duty.rect.h).toBe(134);
    expect(L.duty.rect.y).toBe(1536 - 22 - 134);
    const c = L.duty.cols[0];
    expect(c.name.font).toBe(17);
    expect(c.name.lines).toEqual(['ส.ต.ท.', 'รัชเดช ศรีแก้ว' + 'ก'.repeat(12)]);
    expect(c.name.y).toEqual([L.duty.rect.y + 52, L.duty.rect.y + 76]);
    expect(c.phone.y).toBe(L.duty.rect.y + 104);
  });
  it('teacher without phone → phone null', () => {
    const teachers = [{ display_name: 'ครูหนึ่ง', phone: '' }, { display_name: 'ครูสอง', phone: '0812345678' }];
    const L = computeLayout(resolved(), model({ teachers }), measure);
    expect(L.duty.cols[0].phone).toBeNull();
    expect(L.duty.cols[1].phone).not.toBeNull();
  });
  it('1 teacher long name+phone → shrink then two lines (h 126)', () => {
    const teachers = [{ display_name: 'ก'.repeat(40), phone: '081-234-5678' }];
    const L = computeLayout(resolved(), model({ teachers }), measure);
    expect(L.duty.rect.h).toBe(126);
    expect(L.duty.cols[0].name.y).toBe(L.duty.rect.y + 66);
    expect(L.duty.cols[0].phone.y).toBe(L.duty.rect.y + 102);
  });
  it('1 teacher long name without phone → stays one row, phone null', () => {
    const L = computeLayout(resolved(), model({ teachers: [{ display_name: 'ก'.repeat(60), phone: '' }] }), measure);
    expect(L.duty.rect.h).toBe(104);
    expect(L.duty.cols[0].phone).toBeNull();
    expect(L.duty.cols[0].name.font).toBe(22);
  });
  it('labels: null for empty slot, rect inside photo, main uses larger label', () => {
    const L = computeLayout(resolved(), model(), measure);
    expect(L.labels[2]).toBeNull();
    expect(L.labels[0].rect.h).toBe(46);
    expect(L.labels[0].font).toBe(23);
    const l1 = L.labels[1], p1 = L.photos[1];
    expect(l1.rect.h).toBe(42);
    expect(l1.rect.x).toBe(p1.x + 14);
    expect(l1.rect.y + l1.rect.h).toBe(p1.y + p1.h - 14);
    expect(l1.text).toBe('สนามกีฬา');
    expect(l1.icon).toBe('field');
  });
  it('label too long → truncated with …', () => {
    const photos = [null, { label: 'ก'.repeat(60), icon: 'x' }, null, null];
    const L = computeLayout(resolved(), model({ photos }), measure);
    expect(L.labels[1].font).toBe(17);
    expect(L.labels[1].text.endsWith('…')).toBe(true);
    expect(L.labels[1].rect.w).toBeLessThanOrEqual(L.photos[1].w - 28);
  });
});

describe('photoRects', () => {
  it.each(['1+3', '2x2', '2+2'])('%s → 4 non-overlapping rects above landmark', (layout) => {
    const r = resolved({}, { photo_layout: layout });
    const rects = photoRects(r);
    expect(rects.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(rects[i].x).toBeGreaterThanOrEqual(46);
      expect(rects[i].x + rects[i].w).toBeLessThanOrEqual(978.0001);
      expect(rects[i].y + rects[i].h).toBeLessThanOrEqual(r.landmark.y - 16);
      for (let j = i + 1; j < 4; j++) expect(overlaps(rects[i], rects[j])).toBe(false);
    }
    expect(validateTemplate(r).ok).toBe(true);
  });
  it('1+3 np-01 small height auto-shrinks to 224', () => {
    const rects = photoRects(resolved());
    expect(rects[0]).toEqual({ x: 46, y: 352, w: 932, h: 282 });
    expect(rects.slice(1).map(r => [r.x, r.y, r.w, r.h])).toEqual([[46, 650, 297, 224], [363.5, 650, 297, 224], [681, 650, 297, 224]]);
  });
  it('2x2 equal cells; 2+2 top row taller', () => {
    const a = photoRects(resolved({}, { photo_layout: '2x2' }));
    expect(a.every(r => r.w === a[0].w && r.h === a[0].h)).toBe(true);
    const b = photoRects(resolved({}, { photo_layout: '2+2' }));
    expect(b[0].h).toBeGreaterThan(b[2].h);
    expect(b[0].y).toBe(352);
  });
  it('1+3 shrinks main before failing', () => {
    const rects = photoRects(resolved({}, { landmark: { x: 300, y: 830, w: 460, h: 500 } }));
    expect(rects[1].h).toBe(170);
    expect(rects[0].h).toBe(282 - 6);
    expect(rects[1].y).toBe(650 - 6);
  });
});

describe('validateTemplate', () => {
  it('np-01 ok', () => expect(validateTemplate(resolved())).toEqual({ ok: true, errors: [] }));
  it.each(['1+3', '2x2', '2+2'])('landmark too high → %s fails', (layout) => {
    const r = resolved({}, { photo_layout: layout, landmark: { x: 300, y: 700, w: 460, h: 600 } });
    expect(validateTemplate(r).ok).toBe(false);
  });
  it('bad photo_layout / province fail', () => {
    expect(validateTemplate(resolved({}, { photo_layout: '3x1' })).ok).toBe(false);
    expect(validateTemplate(resolved({}, { province: 'bkk' })).ok).toBe(false);
  });
  it('band too thin for duty box fails', () => {
    expect(validateTemplate(resolved({}, { band: { top_y: 1400 } })).ok).toBe(false);
  });
  it('rect outside canvas fails', () => {
    expect(validateTemplate(resolved({ photos: { main: { w: 1000 } } })).ok).toBe(false);
  });
});

describe('validateTemplate at max dy', () => {
  it('1+3 landmark.y 840 ok at dy 0 but fails at dy 54', () => {
    const r = resolved({}, { landmark: { x: 300, y: 840, w: 460, h: 500 } });
    const rects = photoRects(r, 0);
    expect(rects[1].h).toBeGreaterThanOrEqual(170);
    const v = validateTemplate(r);
    expect(v.ok).toBe(false);
    expect(v.errors.every(e => e.startsWith('dy 54'))).toBe(true);
  });
  it('np-01 still ok at dy 54 for every photo_layout', () => {
    for (const photo_layout of ['1+3', '2x2', '2+2']) expect(validateTemplate(resolved({}, { photo_layout })).ok).toBe(true);
  });
  it('computeLayout reports geometry warnings instead of hiding them', () => {
    const r = resolved({}, { landmark: { x: 300, y: 840, w: 460, h: 500 } });
    const s = { ...school('ก'.repeat(29) + ' ' + 'ข'.repeat(30)), address: 'ก'.repeat(50) + ' ' + 'ข'.repeat(50) };
    const L = computeLayout(r, model({ school: s }), measure);
    expect(L.dy).toBe(54);
    expect(L.warnings.length).toBeGreaterThan(0);
    expect(computeLayout(resolved(), model(), measure).warnings).toEqual([]);
  });
});

describe('filterTemplates', () => {
  it('filters by province and active', () => {
    expect(filterTemplates(ALL, 'sn').some(t => t.id === 'np-01')).toBe(false);
    expect(filterTemplates(ALL, 'np').map(t => t.id)).toContain('np-01');
    const hidden = { ...ALL, templates: [{ ...NP01, active: false }] };
    expect(filterTemplates(hidden, 'np')).toEqual([]);
  });
});

describe('เลย์เอาต์รูปหลากหลาย (3+1 / Z / mosaic / L1R3)', () => {
  const NEW = ['3+1', 'Z', 'mosaic-L', 'mosaic-R', 'L1R3', 'R1L3'];
  const area = q => q.w * q.h;
  const byId = id => ALL.templates.find(t => t.id === id);
  const lowLandmark = { x: 403, y: 980, w: 220, h: 400 }; // แบบ np-07 (L1R3/R1L3 ต้องการโซน ≥ 551)
  const tplFor = lay => (lay === 'L1R3' || lay === 'R1L3' ? { photo_layout: lay, landmark: lowLandmark } : { photo_layout: lay });
  const check = (r, dy) => {
    const P = r.photos, q = photoRects(r, dy);
    expect(q.length).toBe(4);
    q.forEach((a, i) => {
      expect(a.x).toBeGreaterThanOrEqual(46);
      expect(a.x + a.w).toBeLessThanOrEqual(978.0001);
      expect(a.y).toBeGreaterThanOrEqual(352 + dy);
      expect(a.y + a.h).toBeLessThanOrEqual(r.landmark.y - 16 + 1e-6);
      expect(a.h).toBeGreaterThanOrEqual(i === 0 ? P.minMainH : P.minSmallH);
      if (i > 0) { expect(a.w).toBeGreaterThanOrEqual(P.minSmallW); expect(area(a)).toBeLessThanOrEqual(area(q[0]) + 1e-6); }
      for (let j = i + 1; j < 4; j++) expect(overlaps(a, q[j])).toBe(false);
    });
    return q;
  };
  it('LAYOUTS มีครบ 9 แบบ', () => expect(LAYOUTS).toEqual(['1+3', '3+1', '2+2', '2x2', 'Z', 'mosaic-L', 'mosaic-R', 'L1R3', 'R1L3']));
  it.each(NEW)('%s → 4 ช่อง ไม่ทับกัน อยู่เหนือ landmark ขนาดขั้นต่ำ รูปหลักใหญ่สุด (dy 0 และ 54)', (lay) => {
    const r = resolved({}, tplFor(lay));
    check(r, 0); check(r, 54);
    expect(validateTemplate(r)).toEqual({ ok: true, errors: [] });
  });
  it('3+1: รูปเล็ก 3 ช่องบน รูปหลักเต็มกว้างล่าง', () => {
    const q = photoRects(resolved({}, { photo_layout: '3+1' }));
    expect(q[0]).toMatchObject({ x: 46, w: 932 });
    expect(q.slice(1).every(a => a.y === 352 && a.y + a.h < q[0].y)).toBe(true);
  });
  it('Z: รูปหลักซ้ายบน ช่องใหญ่ล่างอยู่ขวา', () => {
    const q = photoRects(resolved({}, { photo_layout: 'Z' }));
    expect(q[0]).toMatchObject({ x: 46, y: 352, w: 611 });
    expect(q[3].x + q[3].w).toBeCloseTo(978);
    expect(q[3].w).toBe(611);
  });
  it('mosaic-L หลักซ้าย / mosaic-R หลักขวา', () => {
    const l = photoRects(resolved({}, { photo_layout: 'mosaic-L' })), rr = photoRects(resolved({}, { photo_layout: 'mosaic-R' }));
    expect(l[0].x).toBe(46);
    expect(rr[0].x + rr[0].w).toBeCloseTo(978);
    expect(rr[1].x).toBe(46);
  });
  it('L1R3/R1L3 ใช้ความสูงเต็มถึง landmark−16 และรูปเล็ก 3 ช่องซ้อนแนวตั้ง', () => {
    const q = photoRects(resolved({}, tplFor('L1R3')));
    expect(q[0]).toEqual({ x: 46, y: 352, w: 611.5, h: 612 });
    expect(q.slice(1).every(a => a.x === 678 && a.w === 300)).toBe(true);
    expect(q[3].y + q[3].h).toBeCloseTo(964);
    const m = photoRects(resolved({}, tplFor('R1L3')));
    expect(m[0].x + m[0].w).toBeCloseTo(978);
    expect(m.slice(1).every(a => a.x === 46)).toBe(true);
  });
  it.each(['L1R3', 'R1L3'])('%s บน landmark สูง (np-01 890) ไม่ผ่าน validateTemplate', (lay) => {
    const v = validateTemplate(resolved({}, { photo_layout: lay }));
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('551'))).toBe(true);
  });
  it.each(NEW.filter(l => !l.endsWith('3')))('%s landmark สูงเกิน → ไม่ผ่าน', (lay) => {
    expect(validateTemplate(resolved({}, { photo_layout: lay, landmark: { x: 300, y: 700, w: 460, h: 600 } })).ok).toBe(false);
  });
  it('validateTemplate จับรูปทับกันได้', () => {
    const v = validateTemplate(resolved({ photos: { small: { xs: [46, 200, 681] } } }));
    expect(v.errors.some(e => e.includes('ทับกัน'))).toBe(true);
  });
  it('ป้ายใหญ่ = ช่อง 0 ทุกเลย์เอาต์ที่รูปหลักกว้าง ≥ 600; 2x2/2+2 ใช้ป้ายปกติ', () => {
    for (const lay of LAYOUTS) {
      const L = computeLayout(resolved({}, tplFor(lay)), model(), measure);
      expect(L.labels[0].rect.h).toBe(L.photos[0].w >= 600 ? 46 : 42);
      expect(L.labels[1].rect.h).toBe(42);
      if (lay === '2x2' || lay === '2+2') expect(L.labels[0].rect.h).toBe(42);
    }
  });
  it('แม่แบบจริงทั้ง 30 แบบผ่าน validateTemplate และใช้ครบทุกเลย์เอาต์', () => {
    const used = new Set();
    for (const t of ALL.templates) {
      expect(validateTemplate(mergeTemplate(ALL.common, t)).errors).toEqual([]);
      used.add(t.photo_layout);
    }
    expect([...used].sort()).toEqual([...LAYOUTS].sort());
  });
  it('แม่แบบติดกันในจังหวัดเดียวกันใช้เลย์เอาต์ไม่ซ้ำกัน', () => {
    for (const p of ['np', 'sn', 'mdh']) {
      const list = ALL.templates.filter(t => t.province === p);
      expect(list.length).toBeGreaterThan(1);
      for (let i = 1; i < list.length; i++) expect(list[i].photo_layout, `${list[i - 1].id} → ${list[i].id}`).not.toBe(list[i - 1].photo_layout);
    }
  });
  it('รูปหลักไม่อยู่ฝั่งเดียวกับ landmark ที่ชิดข้าง (mosaic)', () => {
    for (const id of ['np-03', 'np-09', 'sn-05', 'sn-07', 'mdh-04', 'mdh-10']) {
      const t = byId(id), q = photoRects(mergeTemplate(ALL.common, t));
      const lmMid = t.landmark.x + t.landmark.w / 2, mainMid = q[0].x + q[0].w / 2;
      expect(Math.sign(lmMid - 512), id).not.toBe(Math.sign(mainMid - 512));
    }
  });
});
