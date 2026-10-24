#!/usr/bin/env node
// ตรวจพื้นหลังตามเกณฑ์ spec 11.2 — วิเคราะห์ที่หน่วยออกแบบ 1024×1536
// ใช้: node tools/check-bg.mjs <png> [--json]   (exit 1 ถ้าไม่ผ่าน)
//      node tools/check-bg.mjs [<png>] --id np-11      ฉาก/ชุด v3 อ่านจาก site/templates.json
//                                                      (ไม่ระบุไฟล์: ชุด v3 = assets/backgrounds/v3/<id>.png ถ้ามี ไม่งั้น v3/raw/<id>.png;
//                                                       แม่แบบเดิมที่ไม่มี scene = site/<file>; ไม่มีไฟล์ → บอกพาธที่ต้องมี exit 2)
//      node tools/check-bg.mjs <png> --scene side-L    ฉาก bottom (ค่าเริ่มต้น) | side-L | side-R — เกณฑ์ docs/design/templates-v3.md §2.1
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
// ---- เกณฑ์ฉาก side (v3) — กรอบเป็นหน่วยออกแบบ [x0, x1) / [y0, y1) ----
export const TS = {
  header: [[230, 794, 230, 300], [60, 964, 300, 400]], // ส่วนหัวใต้ตรา เว้นดอกไม้ 2 มุมบน: [x0, x1, y0, y1]
  photoY: [352, 1360],                 // คอลัมน์รูป
  gutterY: [400, 1360], gutterRowMax: 3, gutterCleanMin: 0.97, // แถวที่ std ≤ 3 ต้อง ≥ 97%
  landmarkY: [420, 1300], landmarkRowsMin: 300, landmarkMinY: 390, // คอลัมน์สถานที่ต้องมีวัตถุ ≥ 300 แถว
  columnY: [400, 1380],                // คอลัมน์สถานที่ (ใช้นับสีเขียว ≤ greenLowerMax)
  ornament: [352, 672, 12, 144], ornamentMeanMin: 215, // หลังตรา: ดอกไม้มุมต้องไม่ชนตรา (บังคับเฉพาะชุด v3)
};
export const SIDES = {
  'side-L': { photo: [424, 978], gutter: [400, 470], frame: [40, 380], column: [0, 400] },
  'side-R': { photo: [46, 600], gutter: [554, 624], frame: [644, 984], column: [624, 1024] },
};
export const SCENES = ['bottom', ...Object.keys(SIDES)];
const W = 1024, H = 1536;

// scene: 'bottom' (ค่าเริ่มต้น = เกณฑ์เดิมทุกตัวเลข) | 'side-L' | 'side-R'
// v3: แม่แบบชุด v3 (มีฟิลด์ scene) — เพิ่มเกณฑ์ ornament; ฉาก side บังคับเสมอ
export async function analyzeBg(input, { scene = 'bottom', v3 = false } = {}) {
  if (!SCENES.includes(scene)) throw new Error(`scene "${scene}" ไม่ถูกต้อง (${SCENES.join(' | ')})`);
  const S = SIDES[scene];
  let greenColumn = 0;
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
    if (S && green && x >= S.column[0] && x < S.column[1] && y >= TS.columnY[0] && y < TS.columnY[1]) greenColumn++;
  }
  const stats = (y0, y1) => {
    let s = 0, s2 = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const v = lum[y * W + x]; s += v; s2 += v * v; n++; }
    const mean = s / n;
    return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
  };
  const band = stats(yBand, H);
  const ornament = v3 || S ? statsRects(lum, [TS.ornament]) : null;
  const ornamentCheck = () => ({ name: 'ornament', ok: ornament.mean >= TS.ornamentMeanMin, value: +ornament.mean.toFixed(1), rule: `mean x ${TS.ornament[0]}–${TS.ornament[1]} y ${TS.ornament[2]}–${TS.ornament[3]} >= ${TS.ornamentMeanMin}` });
  if (S) return analyzeSide({ lum, S, scene, aspect, aspectOk, band, ornament, ornamentCheck, greenAll, greenColumn, yBand, meta });
  const mid = stats(yMidA, yMidB);
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
  if (v3) checks.push(ornamentCheck());
  return { ok: checks.every(c => c.ok), landmark_top_y: landmark, checks,
    metrics: { mid, band, greenAll: gAll, greenLower: gLow, width: meta.width, height: meta.height } };
}

// ค่าเฉลี่ย/std ความสว่างรวมหลายกรอบ [x0, x1, y0, y1]
function statsRects(lum, rects) {
  let s = 0, s2 = 0, n = 0;
  for (const [x0, x1, y0, y1] of rects) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = lum[y * W + x]; s += v; s2 += v * v; n++; }
  }
  const mean = s / n;
  return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
}

// std ต่อแถวหลังลบค่าเฉลี่ยเลื่อน ±20 px — หน้าต่างเลื่อนตัดอยู่ในกรอบ [x0, x1) (ขอบสถานที่นอกกรอบไม่ปนเข้ามา)
function rowDev(lum, y, x0, x1, K = 20) {
  const pre = new Float64Array(x1 - x0 + 1);
  for (let x = x0; x < x1; x++) pre[x - x0 + 1] = pre[x - x0] + lum[y * W + x];
  let s2 = 0;
  for (let x = x0; x < x1; x++) {
    const a = Math.max(x0, x - K) - x0, b = Math.min(x1, x + K + 1) - x0;
    const d = lum[y * W + x] - (pre[b] - pre[a]) / (b - a);
    s2 += d * d;
  }
  return Math.sqrt(s2 / (x1 - x0));
}

function analyzeSide({ lum, S, scene, aspect, aspectOk, band, ornament, ornamentCheck, greenAll, greenColumn, yBand, meta }) {
  const header = statsRects(lum, TS.header);
  const photo = statsRects(lum, [[S.photo[0], S.photo[1], TS.photoY[0], TS.photoY[1]]]);
  let clean = 0;
  for (let y = TS.gutterY[0]; y < TS.gutterY[1]; y++) if (rowDev(lum, y, S.gutter[0], S.gutter[1]) <= TS.gutterRowMax) clean++;
  const gutterClean = clean / (TS.gutterY[1] - TS.gutterY[0]);
  let landmark = null, rows = 0;
  for (let y = Math.round(T.scanFrom * H); y < yBand; y++) {
    const obj = rowDev(lum, y, S.frame[0], S.frame[1]) > T.rowStdObject;
    if (obj && landmark === null) landmark = y;
    if (obj && y >= TS.landmarkY[0] && y < TS.landmarkY[1]) rows++;
  }
  const gAll = greenAll / (W * H);
  const gCol = greenColumn / ((S.column[1] - S.column[0]) * (TS.columnY[1] - TS.columnY[0]));
  const zone = (name, z, where) => ({ name, ok: z.mean >= T.midMeanMin && z.std <= T.midStdMax,
    value: `mean ${z.mean.toFixed(1)} / std ${z.std.toFixed(1)}`, rule: `${where}: mean >= ${T.midMeanMin}, std <= ${T.midStdMax}` });
  const checks = [
    { name: 'aspect', ok: aspectOk, value: +aspect.toFixed(4), rule: '2:3 (±1%)' },
    zone('header_zone', header, 'x 230–794 y 230–300 + x 60–964 y 300–400'),
    zone('photo_zone', photo, `x ${S.photo[0]}–${S.photo[1]} y ${TS.photoY[0]}–${TS.photoY[1]}`),
    { name: 'gutter_clean', ok: gutterClean >= TS.gutterCleanMin, value: `${(gutterClean * 100).toFixed(1)}%`,
      rule: `x ${S.gutter[0]}–${S.gutter[1]}: แถว std <= ${TS.gutterRowMax} >= ${TS.gutterCleanMin * 100}%` },
    { name: 'landmark', ok: rows >= TS.landmarkRowsMin && (landmark === null || landmark >= TS.landmarkMinY),
      value: `top ${landmark ?? 'none'} / ${rows} แถว`, rule: `x ${S.frame[0]}–${S.frame[1]}: top_y >= ${TS.landmarkMinY}, มีวัตถุ >= ${TS.landmarkRowsMin} แถว (y ${TS.landmarkY[0]}–${TS.landmarkY[1]})` },
    { name: 'band', ok: band.mean <= T.bandMeanMax, value: +band.mean.toFixed(1), rule: `mean y>=90% <= ${T.bandMeanMax}` },
    { name: 'green', ok: gAll <= T.greenMax && gCol <= T.greenLowerMax, value: `${(gAll * 100).toFixed(2)}% / ${(gCol * 100).toFixed(2)}% (column)`, rule: `<= ${T.greenMax * 100}% / <= ${T.greenLowerMax * 100}%` },
    ornamentCheck(),
  ];
  return { ok: checks.every(c => c.ok), scene, landmark_top_y: landmark, checks,
    metrics: { header, photo, band, gutterClean, landmarkRows: rows, ornament, greenAll: gAll, greenColumn: gCol, width: meta.width, height: meta.height } };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --id <id> → { scene, v3, file, candidates } จาก site/templates.json (v3 = แม่แบบที่มีฟิลด์ scene)
// file = ไฟล์แรกใน candidates ที่มีอยู่ หรือ null (ยังไม่มีภาพ)
export function optionsForId(id) {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/templates.json'), 'utf8'));
  const t = cfg.templates.find(x => x.id === id);
  if (!t) throw new Error(`ไม่พบแม่แบบ ${id}`);
  const v3 = t.scene !== undefined;
  const candidates = v3
    ? [`assets/backgrounds/v3/${id}.png`, `assets/backgrounds/v3/raw/${id}.png`].map(f => path.join(ROOT, f))
    : [path.join(ROOT, 'site', t.file)];
  return { scene: t.scene || 'bottom', v3, file: candidates.find(f => fs.existsSync(f)) ?? null, candidates };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const id = opt('--id'), sceneArg = opt('--scene');
  const valueIdx = new Set(['--id', '--scene'].map(k => args.indexOf(k)).filter(i => i >= 0).map(i => i + 1));
  let byId = null;
  try { byId = id ? optionsForId(id) : null; } catch (e) { console.error(e.message); process.exit(2); }
  const given = args.find((a, i) => !a.startsWith('--') && !valueIdx.has(i));
  const file = given || byId?.file;
  if (!file) {
    if (byId) console.error(`ยังไม่มีภาพของ ${id} — ต้องมีไฟล์ใดไฟล์หนึ่ง:\n${byId.candidates.map(f => '  ' + path.relative(process.cwd(), f)).join('\n')}`);
    else console.error('ใช้: node tools/check-bg.mjs <png> [--json] [--scene bottom|side-L|side-R] [--id <id>]');
    process.exit(2);
  }
  if (!fs.existsSync(file)) { console.error(`ไม่พบไฟล์ ${file}`); process.exit(2); }
  const scene = sceneArg || byId?.scene || 'bottom';
  const v3 = byId ? byId.v3 : scene !== 'bottom';
  if (id || sceneArg) console.log(`${path.relative(process.cwd(), path.resolve(file))} · scene ${scene}${v3 ? ' · v3' : ''}`);
  const r = await analyzeBg(file, { scene, v3 });
  if (args.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(12)} ${String(c.value).padEnd(28)} (${c.rule})`);
    console.log(`landmark_top_y = ${r.landmark_top_y}`);
    console.log(r.ok ? 'ผ่านทุกข้อ' : 'ไม่ผ่าน');
  }
  process.exit(r.ok ? 0 : 1);
}
