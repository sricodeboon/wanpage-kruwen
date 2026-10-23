import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { analyzeBg } from '../../tools/check-bg.mjs';

const W = 1024, H = 1536;
// ภาพเทียม: พื้นอ่อนเรียบ + แถบล่างเข้ม (ผ่านทุกเกณฑ์) แล้วแต่งทับตามเคส
async function synth({ fill = { r: 240, g: 232, b: 250 }, band = { r: 40, g: 20, b: 80 }, extra = [] } = {}) {
  const layers = [
    { input: await sharp({ create: { width: W, height: H - 1380, channels: 3, background: band } }).png().toBuffer(), left: 0, top: 1380 },
    ...extra,
  ];
  return sharp({ create: { width: W, height: H, channels: 3, background: fill } }).composite(layers).png().toBuffer();
}

describe('check-bg', () => {
  it('np-01 ต้นแบบที่ครูอนุมัติ ผ่านทุกเกณฑ์', async () => {
    const r = await analyzeBg('assets/reference/bg-01-phrathat-naga.png');
    expect(r.checks.filter(c => !c.ok)).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.landmark_top_y).toBeGreaterThan(800);
  });
  it('ภาพเทียมที่สะอาด ผ่าน', async () => {
    const r = await analyzeBg(await synth());
    expect(r.ok).toBe(true);
  });
  it('ภาพเขียวทั้งภาพ ไม่ผ่านเกณฑ์เขียว', async () => {
    const r = await analyzeBg(await synth({ fill: { r: 150, g: 235, b: 150 } }));
    const g = r.checks.find(c => c.name === 'green');
    expect(g.ok).toBe(false);
    expect(r.ok).toBe(false);
  });
  it('วัตถุที่ y 40% -> landmark_top_y < 904 และไม่ผ่าน', async () => {
    const obj = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 60, g: 30, b: 120 } } }).png().toBuffer();
    const r = await analyzeBg(await synth({ extra: [{ input: obj, left: 360, top: Math.round(H * 0.4) }] }));
    expect(r.landmark_top_y).toBeLessThan(904);
    expect(r.ok).toBe(false);
  });
  it('สัดส่วนไม่ใช่ 2:3 ไม่ผ่าน', async () => {
    const buf = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#eee' } }).png().toBuffer();
    const r = await analyzeBg(buf);
    expect(r.checks.find(c => c.name === 'aspect').ok).toBe(false);
  });
  it('แถบล่างสว่าง ไม่ผ่าน', async () => {
    const r = await analyzeBg(await synth({ band: { r: 230, g: 230, b: 240 } }));
    expect(r.checks.find(c => c.name === 'band').ok).toBe(false);
  });
});

describe('ภาพ Gemini 1696×2528 และ make-bg', () => {
  it('1696×2528 ผ่านเกณฑ์สัดส่วน', async () => {
    const buf = await sharp({ create: { width: 1696, height: 2528, channels: 3, background: { r: 240, g: 232, b: 250 } } }).png().toBuffer();
    const r = await analyzeBg(buf);
    expect(r.checks.find(c => c.name === 'aspect').ok).toBe(true);
  });
  it('make-bg ส่งออก 1536×2304 พอดี (ครอปกลาง) + thumb 240×360', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { execFileSync } = await import('node:child_process');
    const dir = mkdtempSync(`${tmpdir()}/mkbg-`);
    const src = `${dir}/src.png`;
    writeFileSync(src, await sharp({ create: { width: 1696, height: 2528, channels: 3, background: { r: 200, g: 180, b: 230 } } }).png().toBuffer());
    execFileSync('node', ['tools/make-bg.mjs', src, 'zz-test', '--out', `${dir}/out`]);
    const m = await sharp(`${dir}/out/zz-test.v1.webp`).metadata();
    const t = await sharp(`${dir}/out/thumb/zz-test.v1.webp`).metadata();
    expect([m.width, m.height, t.width, t.height]).toEqual([1536, 2304, 240, 360]);
  });
});
