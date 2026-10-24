// tools/fit-bg.py — นโยบายซ่อมภาพอัตโนมัติ v3 (docs/design/templates-v3.md §8)
// ต้องมี python3 + numpy + Pillow + scipy (เครื่องที่ไม่มีจะข้ามทั้งชุด)
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { analyzeBg } from '../../tools/check-bg.mjs';
import { synthBg } from '../helpers/synth-bg.mjs';

const hasPy = spawnSync('python3', ['-c', 'import numpy, PIL, scipy'], { stdio: 'ignore' }).status === 0;
const T = 180_000;

function fit(src, dst, scene) {
  const args = ['tools/fit-bg.py', src, dst, ...(scene ? ['--scene', scene] : [])];
  const r = spawnSync('python3', args, { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

describe.skipIf(!hasPy)('fit-bg v3 (§8)', () => {
  const dir = mkdtempSync(`${tmpdir()}/fitbg-`);

  it('side-L: สถานที่ล้ำ gutter 40 px → ย่อ+feather แล้วผ่าน check-bg ทุกข้อ (สถานที่ยังอยู่ในคอลัมน์)', async () => {
    const src = `${dir}/l.png`, dst = `${dir}/l-out.png`;
    writeFileSync(src, await synthBg({ scene: 'side-L', intrude: 40 }));
    expect((await analyzeBg(src, { scene: 'side-L' })).checks.find(c => c.name === 'gutter_clean').ok).toBe(false);
    const r = fit(src, dst, 'side-L');
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/ย่อ 0\.\d\d/);
    const q = await analyzeBg(dst, { scene: 'side-L' });
    expect(q.checks.filter(c => !c.ok)).toEqual([]);
    expect(q.metrics.landmarkRows).toBeGreaterThanOrEqual(300);
  }, T);

  it('side-R ใช้สูตรเดียวกันแบบกลับด้าน', async () => {
    const src = `${dir}/r.png`, dst = `${dir}/r-out.png`;
    writeFileSync(src, await synthBg({ scene: 'side-R', intrude: 40 }));
    const r = fit(src, dst, 'side-R');
    expect(r.code, r.out).toBe(0);
    expect((await analyzeBg(dst, { scene: 'side-R' })).ok).toBe(true);
  }, T);

  it('ขอบแข็งกว้างเกินเพดาน s 0.70 → exit 1 และไม่บันทึกไฟล์ (ต้องสร้างใหม่)', async () => {
    const src = `${dir}/w.png`, dst = `${dir}/w-out.png`;
    // อาคารสี่เหลี่ยมทึบกว้าง 0–760 (ย่อ 0.70 + เลื่อน 40 ยังเกิน 352)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
      <rect width="1024" height="1536" fill="#f3eefb"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 60}" y="700" width="56" height="680" fill="${i % 2 ? '#5a2a9a' : '#d9a93a'}"/>`).join('')}
      <rect y="1380" width="1024" height="156" fill="#3a1566"/></svg>`;
    writeFileSync(src, await sharp(Buffer.from(svg)).png().toBuffer());
    const r = fit(src, dst, 'side-L');
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/สร้างใหม่/);
    expect(existsSync(dst)).toBe(false);
  }, T);

  it('bottom: ยอดสูงเกิน (y 700) → ย่อ uniform จนยอด ≥ 895 โดยไม่ยืดฟ้า', async () => {
    const src = `${dir}/b.png`, dst = `${dir}/b-out.png`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
      <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1fc"/><stop offset="1" stop-color="#ece4f7"/></linearGradient></defs>
      <rect width="1024" height="1536" fill="url(#s)"/>
      ${Array.from({ length: 9 }, (_, i) => { const w = 300 - i * 28, y = 1380 - (i + 1) * 70; return `<rect x="${512 - w / 2}" y="${y}" width="${w}" height="71" fill="${i % 2 ? '#d9a93a' : '#5a2a9a'}"/>`; }).join('')}
      <polygon points="490,750 534,750 512,700" fill="#d9a93a"/>
      <rect y="1380" width="1024" height="156" fill="#3a1566"/></svg>`;
    writeFileSync(src, await sharp(Buffer.from(svg)).png().toBuffer());
    expect((await analyzeBg(src)).landmark_top_y).toBeLessThan(760);
    const r = fit(src, dst, 'bottom');
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/ย่อ 0\.\d\d/);
    expect(r.out).not.toMatch(/ยืดฟ้า|shift_down/);
    const q = await analyzeBg(dst, { v3: true });
    expect(q.checks.filter(c => !c.ok)).toEqual([]);
  }, T);

  it('ล้างเขียว: ใบเขียว → อำพัน, teal → น้ำเงิน, olive เข้ม → บรอนซ์; ฟ้า/ม่วง/ขาวไม่เปลี่ยน', () => {
    const py = `
import importlib.util, json, numpy as np
spec = importlib.util.spec_from_file_location('f', 'tools/fit-bg.py'); f = importlib.util.module_from_spec(spec); spec.loader.exec_module(f)
px = np.array([[[60, 160, 60], [70, 170, 165], [110, 100, 30], [200, 220, 250], [120, 60, 170], [250, 250, 250]]], np.float32)
out, _ = f.degreen(px)
h, s, v = f._rgb_to_hsv(out)
print(json.dumps({'h': h[0].round(1).tolist(), 'same': [bool(np.abs(out[0, i] - px[0, i]).max() < 0.5) for i in range(6)]}))`;
    const r = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8' }));
    expect(r.h[0]).toBeGreaterThan(25); expect(r.h[0]).toBeLessThan(50);    // เขียว → อำพัน
    expect(r.h[1]).toBeGreaterThan(195); expect(r.h[1]).toBeLessThan(230);  // teal → น้ำเงิน
    expect(r.h[2]).toBeLessThan(42);                                         // olive → บรอนซ์
    expect(r.same.slice(3)).toEqual([true, true, true]);
  }, T);

  it('ไม่ระบุ --scene = ทางเดิม (v2) — ไม่ล้างเขียว/ไม่ย่อ', async () => {
    const src = `${dir}/v2.png`, dst = `${dir}/v2-out.png`;
    writeFileSync(src, await synthBg({ scene: 'bottom' }));
    const r = fit(src, dst);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/ล้างเขียว|ย่อ/);
  }, T);
});
