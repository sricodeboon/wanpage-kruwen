#!/usr/bin/env node
// แปลงต้นฉบับพื้นหลัง 2:3 -> site/assets/bg/<id>.v<version>.webp (1536×2304) + thumb (240×360)
// ใช้: node tools/make-bg.mjs <src.png> <id> [--version 1]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FULL = 450 * 1024, MAX_THUMB = 15 * 1024;

// ลดคุณภาพทีละ 4 จนไฟล์ไม่เกินเพดาน (เริ่มที่ q ที่กำหนด)
async function encode(pipeline, q, max) {
  for (let quality = q; quality >= 40; quality -= 4) {
    const buf = await pipeline.clone().webp({ quality, effort: 6 }).toBuffer();
    if (buf.length <= max) return { buf, quality };
  }
  throw new Error(`ไม่สามารถบีบให้ ≤ ${max} ไบต์`);
}

const args = process.argv.slice(2);
const vi = args.indexOf('--version');
const version = vi >= 0 ? Number(args[vi + 1]) : 1;
const oi0 = args.indexOf('--out');
const pos = args.filter((a, i) => !a.startsWith('--') && (vi < 0 || i !== vi + 1) && (oi0 < 0 || i !== oi0 + 1));
const [src, id] = pos;
if (!src || !id || !Number.isInteger(version) || version < 1) {
  console.error('ใช้: node tools/make-bg.mjs <src.png> <id> [--version 1] [--out <dir>]');
  process.exit(2);
}
const meta = await sharp(src).metadata();
if (Math.abs(meta.width / meta.height - 2 / 3) > 0.01 * (2 / 3)) {
  console.error(`สัดส่วน ${meta.width}×${meta.height} ไม่ใช่ 2:3`);
  process.exit(1);
}
const oi = args.indexOf('--out');
const outDir = oi >= 0 ? path.resolve(args[oi + 1]) : path.join(ROOT, 'site/assets/bg');
// ครอปกลางให้ได้ 2:3 พอดีก่อนย่อ (ภาพที่คลาดไม่เกิน 1%)
const cw = Math.min(meta.width, Math.floor(meta.height * 2 / 3));
const ch = Math.min(meta.height, Math.floor(meta.width * 3 / 2));
const crop = { left: Math.floor((meta.width - cw) / 2), top: Math.floor((meta.height - ch) / 2), width: cw, height: ch };
fs.mkdirSync(path.join(outDir, 'thumb'), { recursive: true });
const base = sharp(src).removeAlpha().extract(crop);
const full = await encode(base.clone().resize(1536, 2304, { fit: 'fill', kernel: 'lanczos3' }), 82, MAX_FULL);
const thumb = await encode(base.clone().resize(240, 360, { fit: 'fill', kernel: 'lanczos3' }), 82, MAX_THUMB);
const fFull = path.join(outDir, `${id}.v${version}.webp`);
const fThumb = path.join(outDir, 'thumb', `${id}.v${version}.webp`);
fs.writeFileSync(fFull, full.buf);
fs.writeFileSync(fThumb, thumb.buf);
console.log(`${path.relative(ROOT, fFull)}  ${full.buf.length} B (q${full.quality})`);
console.log(`${path.relative(ROOT, fThumb)}  ${thumb.buf.length} B (q${thumb.quality})`);
