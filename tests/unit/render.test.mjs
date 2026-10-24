import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createFakeCtx } from '../helpers/fake-ctx.mjs';
import { mergeTemplate } from '../../site/js/layout.js';
import { formatThaiDate } from '../../site/js/thaidate.js';
import { renderOnePage, setShadow, clearShadow, drawCover, canvasToBlob, ICONS } from '../../site/js/render.js';
import { ICONS as ICON_SET } from '../../site/js/icons.js';

const ALL = JSON.parse(readFileSync(new URL('../../site/templates.json', import.meta.url), 'utf8'));
const resolved = mergeTemplate(ALL.common, ALL.templates.find(t => t.id === 'np-01'));

const img = (id, w = 800, h = 600) => ({ id, width: w, height: h });
const assets = () => ({ bg: img('bg', 1024, 1536), logo: img('logo', 300, 300), photos: [img('p0'), img('p1'), img('p2'), img('p3')] });
const model = (patch = {}) => ({
  school: { name_full: 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8', address: 'บ้านโนนอุดมดี ต.ดอนเตย อ.นาทม จ.นครพนม 48140' },
  title: 'รายงานภาพบรรยากาศและบริบทโรงเรียน', dateISO: '2026-10-23',
  teachers: [{ display_name: 'ส.ต.ท.รัชเดช ศรีแก้ว', phone: '081-234-5678' }],
  photos: [{ label: 'อาคารเรียน', icon: 'building' }, { label: 'สนามกีฬา', icon: 'field' }, { label: 'แปลงเกษตร', icon: 'farm' }, null],
  ...patch,
});

const render = (m = model(), scale = 1.5, a = assets()) => {
  const ctx = createFakeCtx();
  renderOnePage(ctx, m, resolved, scale, a);
  return ctx;
};

describe('renderOnePage', () => {
  it('เรียก scale(1.5,1.5) ครั้งเดียว', () => {
    const ctx = render();
    const sc = ctx.calls.filter(c => c.name === 'scale');
    expect(sc).toHaveLength(1);
    expect(sc[0].args).toEqual([1.5, 1.5]);
  });

  it('หัวกล่องครูเวรถูก fillText ทั้งสตริงครั้งเดียว', () => {
    const ctx = render();
    const header = 'ครูเวรประจำวันที่ ' + formatThaiDate('2026-10-23');
    const hits = ctx.calls.filter(c => c.name === 'fillText' && c.args[0] === header);
    expect(hits).toHaveLength(1);
    expect(ctx.calls.some(c => c.name === 'fillText' && c.args[0] !== header && header.includes(c.args[0]) && c.args[0].length > 3 && c.args[0].startsWith('ครูเวร'))).toBe(false);
  });

  it('วาดชื่อเรื่อง ชื่อโรงเรียน ที่อยู่ ชื่อครู และเบอร์ เป็นสตริงเต็ม', () => {
    const ctx = render();
    const texts = ctx.calls.filter(c => c.name === 'fillText').map(c => c.args[0]);
    const m = model();
    expect(texts).toContain(m.title);
    expect(texts).toContain(m.school.name_full);
    expect(texts).toContain(m.school.address);
    expect(texts).toContain('ส.ต.ท.รัชเดช ศรีแก้ว');
    expect(texts).toContain('081-234-5678');
    expect(texts).toContain('อาคารเรียน');
  });

  it('ไม่ตั้ง letterSpacing หรือ filter', () => {
    const ctx = render();
    expect(ctx.sets.some(s => s.name === 'letterSpacing' || s.name === 'filter')).toBe(false);
  });

  it('ลำดับ drawImage: bg → logo → รูป', () => {
    const ctx = render();
    const ids = ctx.calls.filter(c => c.name === 'drawImage').map(c => c.args[0].id);
    expect(ids[0]).toBe('bg');
    expect(ids[1]).toBe('logo');
    expect(ids.slice(2)).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('โรงเรียนที่ยังไม่มีตรา (logo null): ไม่วาดตรา เลย์เอาต์ส่วนอื่นเหมือนเดิม', () => {
    const a = assets(); a.logo = null;
    const ctx = render(model(), 1.5, a);
    const ids = ctx.calls.filter(c => c.name === 'drawImage').map(c => c.args[0].id);
    expect(ids).toEqual(['bg', 'p0', 'p1', 'p2', 'p3']);
    const texts = (c) => c.calls.filter(x => x.name === 'fillText').map(x => [x.args[0], x.args[1], x.args[2]]);
    expect(texts(ctx)).toEqual(texts(render()));
  });

  it('ใช้ฟอนต์ Kanit กับทุก fillText และรีเซ็ตเงาหลังวาด', () => {
    const ctx = render();
    for (const c of ctx.calls.filter(c => c.name === 'fillText')) expect(c.font).toMatch(/px Kanit/);
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.shadowColor).toBe('rgba(0,0,0,0)');
  });

  it('ข้ามรูปที่ไม่มี (null) โดยไม่พัง', () => {
    const a = assets();
    a.photos[2] = null;
    const ctx = render(model(), 0.25, a);
    const ids = ctx.calls.filter(c => c.name === 'drawImage').map(c => c.args[0].id);
    expect(ids).toEqual(['bg', 'logo', 'p0', 'p1', 'p3']);
    expect(ctx.calls.find(c => c.name === 'scale').args).toEqual([0.25, 0.25]);
  });

  it('ครู 3 คนวาดเส้นคั่นและชื่อครบ', () => {
    const teachers = [
      { display_name: 'ส.ต.ท.รัชเดช ศรีแก้ว', phone: '081-234-5678' },
      { display_name: 'ด.ต.สมชาย ใจดี', phone: '081-111-2222' },
      { display_name: 'ครูมาลี ดีงาม', phone: '' },
    ];
    const ctx = render(model({ teachers }));
    const texts = ctx.calls.filter(c => c.name === 'fillText').map(c => c.args[0]);
    for (const t of teachers) expect(texts).toContain(t.display_name);
    expect(texts).not.toContain('');
  });
});

describe('setShadow / clearShadow', () => {
  it('คูณ offset/blur ด้วย scale', () => {
    const ctx = createFakeCtx();
    setShadow(ctx, 1.5, 0, 6, 10, '#3b147055');
    expect(ctx.shadowOffsetX).toBe(0);
    expect(ctx.shadowOffsetY).toBe(9);
    expect(ctx.shadowBlur).toBe(15);
    expect(ctx.shadowColor).toBe('#3b147055');
    clearShadow(ctx);
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.shadowOffsetY).toBe(0);
  });
});

describe('drawCover', () => {
  it('cover: ครอบเต็มกรอบ รักษาสัดส่วน และ clip', () => {
    const ctx = createFakeCtx();
    drawCover(ctx, img('x', 1000, 1000), { x: 10, y: 20, w: 400, h: 200 }, 0.5);
    const d = ctx.calls.find(c => c.name === 'drawImage');
    // ภาพจัตุรัส → ครอบกว้าง 400: ตัดส่วนกลางแนวตั้ง sx 0, sy 250, sw 1000, sh 500
    expect(d.args.slice(1)).toEqual([0, 250, 1000, 500, 10, 20, 400, 200]);
    expect(ctx.calls.some(c => c.name === 'clip')).toBe(true);
  });
  it('กรอบต้นทางไม่เกินขอบภาพ แม้ทศนิยมเพี้ยน (Safari ไม่วาดถ้าเกิน)', () => {
    // ภาพ 800×600 ลงกรอบ 920×270: 920 / (920 / 800) = 800.0000000000001 → sx ติดลบ
    for (const [w, h, rw, rh] of [[800, 600, 920, 270], [803, 1070, 920, 270], [1600, 1200, 1380, 405]]) {
      const ctx = createFakeCtx();
      drawCover(ctx, img('x', w, h), { x: 0, y: 0, w: rw, h: rh }, 0.45);
      const [, sx, sy, sw, sh] = ctx.calls.find(c => c.name === 'drawImage').args;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx + sw).toBeLessThanOrEqual(w);
      expect(sy + sh).toBeLessThanOrEqual(h);
    }
  });
});

describe('canvasToBlob', () => {
  it('ใช้ convertToBlob ถ้ามี', async () => {
    const blob = { b: 1 };
    const c = { convertToBlob: async opt => ({ ...blob, opt }) };
    const r = await canvasToBlob(c, 'image/png');
    expect(r.opt).toEqual({ type: 'image/png' });
  });
  it('ไม่งั้นใช้ toBlob', async () => {
    const c = { toBlob: (cb, type, q) => cb({ type, q }) };
    expect(await canvasToBlob(c, 'image/jpeg', 0.9)).toEqual({ type: 'image/jpeg', q: 0.9 });
  });
});

describe('ICONS', () => {
  it('มีครบทุกชื่อและเป็น path d', () => {
    const names = ['building', 'field', 'farm', 'canteen', 'classroom', 'flag', 'walkway', 'library', 'kitchen', 'toilet', 'fence', 'camera', 'pin', 'phone'];
    for (const n of names) {
      expect(typeof ICON_SET[n]).toBe('string');
      expect(ICON_SET[n]).toMatch(/^M/);
    }
    expect(ICONS).toBe(ICON_SET);
  });
});
