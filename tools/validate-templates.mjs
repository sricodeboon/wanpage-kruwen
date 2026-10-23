#!/usr/bin/env node
// ตรวจ site/templates.json ทุกแบบ: schemaVersion, validateTemplate (layout.js), ไฟล์ webp/thumb มีจริงและขนาดถูก
// ใช้: node tools/validate-templates.mjs   (exit 1 ถ้าผิด)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mergeTemplate, validateTemplate } from '../site/js/layout.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const cfg = JSON.parse(fs.readFileSync(path.join(SITE, 'templates.json'), 'utf8'));
let bad = 0;
const fail = (id, msg) => { bad++; console.error(`FAIL ${id}: ${msg}`); };

if (cfg.schemaVersion !== 1) fail('(file)', `schemaVersion ต้องเป็น 1 (ได้ ${cfg.schemaVersion})`);
const ids = new Set();
for (const t of cfg.templates || []) {
  if (ids.has(t.id)) fail(t.id, 'id ซ้ำ');
  ids.add(t.id);
  const before = bad;
  const r = mergeTemplate(cfg.common, t);
  const v = validateTemplate(r);
  v.errors.forEach(e => fail(t.id, e));
  for (const [key, w, h, cap] of [['file', 1536, 2304, 450 * 1024], ['thumb', 240, 360, 15 * 1024]]) {
    const f = path.join(SITE, t[key] || '');
    if (!t[key] || !fs.existsSync(f)) { fail(t.id, `ไม่พบไฟล์ ${key}: ${t[key]}`); continue; }
    const size = fs.statSync(f).size;
    if (size > cap) fail(t.id, `${key} ใหญ่เกิน ${cap} ไบต์ (${size})`);
    const m = await sharp(f).metadata();
    if (m.format !== 'webp' || m.width !== w || m.height !== h) fail(t.id, `${key} ต้องเป็น webp ${w}×${h} (ได้ ${m.format} ${m.width}×${m.height})`);
  }
  if (bad === before) console.log(`ok   ${t.id}${t.active === false ? ' (ปิดอยู่)' : ''}`);
}
if (bad) { console.error(`${bad} ข้อผิดพลาด`); process.exit(1); }
console.log(`ผ่านทั้ง ${cfg.templates.length} แบบ`);
