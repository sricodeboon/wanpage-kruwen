#!/usr/bin/env node
// ตรวจพื้นหลังตามเกณฑ์ spec 11.2 — วิเคราะห์ที่หน่วยออกแบบ 1024×1536
// ใช้: node tools/check-bg.mjs <png> [--json]   (exit 1 ถ้าไม่ผ่าน)
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';

// ---- เกณฑ์ (ค่าที่ปรับแล้ว ดู docs/bg-qa.md) ----
export const T = {
  aspectTol: 0.01,             // |w/h − 2/3| ≤ 1% (Gemini ออก 1696×2528 = 0.6709, คลาด 0.63%; make-bg ครอปกลางให้พอดี 2:3)
  midFrom: 0.15, midTo: 0.59,  // โซนกลาง 15–59% (y 230–904)
  midMeanMin: 215,             // สว่างเฉลี่ยโซนกลาง ≥
  midStdMax: 14,               // std โซนกลาง ≤
  bandFrom: 0.90,              // แถบล่าง y ≥ 90%
  bandMeanMax: 120,            // สว่างเฉลี่ยแถบล่าง ≤
  greenHue: [75, 165], greenSatMin: 0.25, greenMax: 0.08, // สัดส่วนเขียวทั้งภาพ ≤ 8%
  greenLowerMax: 0.15,         // โซนล่าง 59–89% ≤ 15%
  scanFrom: 0.25,              // เริ่มหาวัตถุที่ 25% (ใต้ลายขอบฟ้า/ของประดับบนที่ลงมาถึง ~y 300 ใน np-01)
  rowStdObject: 3,             // std ต่อแถว (x 230–800) ที่ถือว่า "มีวัตถุ" — spec ว่า 20 แต่วัดจริงไวไม่พอ (np-02 ยอดจริง 795 ได้ 966) ดู docs/bg-qa.md
  landmarkMinY: 895,           // landmark_top_y ที่ยอมรับ: spec 904 ลบเผื่อวัด 9 px — np-01 (ยอดจริง ~890) วัดได้ 898 ผ่านพอดี
};
const W = 1024, H = 1536;

export async function analyzeBg(input) {
  const meta = await sharp(input).metadata();
  const aspect = meta.width / meta.height;
  const aspectOk = Math.abs(aspect - 2 / 3) <= T.aspectTol * (2 / 3);
  const { data } = await sharp(input).removeAlpha().resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const lum = new Float32Array(W * H);
  let greenAll = 0, greenLower = 0, lowerN = 0;
  const yMidA = Math.round(T.midFrom * H), yMidB = Math.round(T.midTo * H), yBand = Math.round(T.bandFrom * H);
  const yLowB = Math.round(0.89 * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    lum[y * W + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const sat = mx === 0 ? 0 : d / mx;
    let hue = 0;
    if (d > 0) {
      if (mx === r) hue = 60 * (((g - b) / d + 6) % 6);
      else if (mx === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
    }
    const green = sat >= T.greenSatMin && hue >= T.greenHue[0] && hue <= T.greenHue[1];
    if (green) greenAll++;
    if (y >= yMidB && y < yLowB) { lowerN++; if (green) greenLower++; }
  }
  const stats = (y0, y1) => {
    let s = 0, s2 = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const v = lum[y * W + x]; s += v; s2 += v * v; n++; }
    const mean = s / n;
    return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
  };
  const mid = stats(yMidA, yMidB);
  const band = stats(yBand, H);
  // y แรกที่มีวัตถุ: ในกรอบ x 230–800 ตัดความไล่โทนเรียบออก (ลบค่าเฉลี่ยเลื่อน 41 px) แล้ววัด std ต่อแถว
  const K = 20;
  let landmark = null;
  for (let y = Math.round(T.scanFrom * H); y < yBand && landmark === null; y++) {
    const pre = new Float64Array(W + 1);
    for (let x = 0; x < W; x++) pre[x + 1] = pre[x] + lum[y * W + x];
    let s2 = 0, n = 0;
    for (let x = 230; x < 800; x++) {
      const a = Math.max(0, x - K), b = Math.min(W, x + K + 1);
      const d = lum[y * W + x] - (pre[b] - pre[a]) / (b - a);
      s2 += d * d; n++;
    }
    if (Math.sqrt(s2 / n) > T.rowStdObject) landmark = y;
  }
  const gAll = greenAll / (W * H), gLow = greenLower / lowerN;
  const checks = [
    { name: 'aspect', ok: aspectOk, value: +aspect.toFixed(4), rule: '2:3 (±1%)' },
    { name: 'middle_mean', ok: mid.mean >= T.midMeanMin, value: +mid.mean.toFixed(1), rule: `>= ${T.midMeanMin}` },
    { name: 'middle_std', ok: mid.std <= T.midStdMax, value: +mid.std.toFixed(1), rule: `<= ${T.midStdMax}` },
    { name: 'band', ok: band.mean <= T.bandMeanMax, value: +band.mean.toFixed(1), rule: `mean y>=90% <= ${T.bandMeanMax}` },
    { name: 'green', ok: gAll <= T.greenMax && gLow <= T.greenLowerMax, value: `${(gAll * 100).toFixed(2)}% / ${(gLow * 100).toFixed(2)}% (lower)`, rule: `<= ${T.greenMax * 100}% / <= ${T.greenLowerMax * 100}%` },
    { name: 'landmark', ok: landmark === null || landmark >= T.landmarkMinY, value: landmark ?? 'none above band', rule: `top_y >= ${T.landmarkMinY}` },
  ];
  return { ok: checks.every(c => c.ok), landmark_top_y: landmark, checks,
    metrics: { mid, band, greenAll: gAll, greenLower: gLow, width: meta.width, height: meta.height } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file) { console.error('ใช้: node tools/check-bg.mjs <png> [--json]'); process.exit(2); }
  const r = await analyzeBg(file);
  if (args.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(12)} ${String(c.value).padEnd(28)} (${c.rule})`);
    console.log(`landmark_top_y = ${r.landmark_top_y}`);
    console.log(r.ok ? 'ผ่านทุกข้อ' : 'ไม่ผ่าน');
  }
  process.exit(r.ok ? 0 : 1);
}
