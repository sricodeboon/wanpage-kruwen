#!/usr/bin/env node
// ตอน deploy: ต่อ ?v=<รุ่น> ท้าย import/สคริปต์/สไตล์ทุกไฟล์ใน <dir> ให้เบราว์เซอร์/LINE โหลดโค้ดใหม่ทันที
// (GitHub Pages ตั้ง cache 10 นาทีแก้ไม่ได้ และ module ที่ import ต่อกันจะค้างตัวเก่าปนตัวใหม่)
//   node tools/stamp-version.mjs site <version>
import fs from 'node:fs';
import path from 'node:path';

export function stamp(text, v) {
  const q = (u) => (/^(https?:)?\/\//.test(u) || u.includes('?') ? u : `${u}?v=${v}`);
  return text
    .replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+\.js)(['"])/g, (_, a, u, b) => a + q(u) + b)
    .replace(/(\bimport\(\s*['"])(\.{1,2}\/[^'"]+\.js)(['"])/g, (_, a, u, b) => a + q(u) + b)
    .replace(/(<script\b[^>]*\bsrc=")([^"]+\.js)(")/g, (_, a, u, b) => a + q(u) + b)
    .replace(/(<link\b[^>]*\bhref=")([^"]+\.css)(")/g, (_, a, u, b) => a + q(u) + b);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'assets') walk(p, out); }
    else if (/\.(m?js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, v] = process.argv.slice(2);
  if (!dir || !v) { console.error('ใช้: node tools/stamp-version.mjs <dir> <version>'); process.exit(2); }
  let n = 0;
  for (const f of walk(dir)) {
    const s = fs.readFileSync(f, 'utf8'), t = stamp(s, v);
    if (t !== s) { fs.writeFileSync(f, t); n++; }
  }
  console.log(`stamp ?v=${v}: ${n} ไฟล์`);
}
