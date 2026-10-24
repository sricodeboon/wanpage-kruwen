#!/usr/bin/env node
// Golden image: วาดทุกแม่แบบ active × ครู 1/2/3 + 3 เคสขอบ ผ่าน Playwright Chromium (tests/golden/harness.html)
//   node tools/goldens.mjs               เทียบกับ tests/golden/expected (pixelmatch threshold 0.1, ต่าง ≤ 0.5%)
//                                        linux (CI) = เข้ม exit 1 ถ้าต่าง; เครื่องอื่น (mac) = เตือนอย่างเดียว exit 0
//   node tools/goldens.mjs --strict      บังคับเข้มทุกเครื่อง
//   node tools/goldens.mjs --update      เขียนทับ expected
//   node tools/goldens.mjs --approve <id> ตั้ง approvedAt ของแม่แบบเป็นวันนี้ (เวลาไทย) — แก้เฉพาะบรรทัดนั้น คงรูปแบบไฟล์เดิม
//   node tools/goldens.mjs --only np-11,sn-13   เฉพาะแม่แบบที่ระบุ (ใช้ร่วมกับ --update ได้ — ไม่แตะ expected ของ id อื่น)
//   node tools/goldens.mjs --include-inactive   วาดแม่แบบที่ปิดอยู่ด้วย (เช่น ชุด v3 ก่อนภาพจริงมา) เป็นภาพพรีวิวใน tests/golden/actual
//                                              ไม่เทียบ/ไม่เขียน expected; ไม่มีไฟล์พื้นหลัง → ใช้ภาพทดแทน tests/golden/fixtures/v3/placeholder-<scene>.png
// รันเต็ม (ไม่มี --only/--include-inactive) สร้าง docs/goldens/index.html ให้ครูดู (ไฟล์ที่ commit — ต้องมีครบทุกแม่แบบ active)
// รันบางส่วน เขียนหน้าดูที่ tests/golden/actual/index.html แทน (ไม่ทับ docs/goldens/index.html) — ก่อน commit ให้รัน npm run goldens เต็มอีกรอบ
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { casesFor, LOGO_FILE, PHOTO_FILES } from '../tests/golden/cases.mjs';
import { isStrict, goldenExitCode } from './golden-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = path.join(ROOT, 'tests/golden/expected');
const ACTUAL = path.join(ROOT, 'tests/golden/actual');
const INDEX = path.join(ROOT, 'docs/goldens/index.html');
const PARTIAL_INDEX = path.join(ACTUAL, 'index.html');
const W = 1536, H = 2304;
const THRESHOLD = 0.1, MAX_DIFF = 0.005;

const args = process.argv.slice(2);
const update = args.includes('--update');
// golden ชุดจริงสร้างบน ubuntu (workflow goldens-update) — ฟอนต์/การลบรอยหยักต่างกันข้ามระบบ จึงเข้มเฉพาะ linux
const strict = isStrict(args);
const ai = args.indexOf('--approve');
const approveId = ai >= 0 ? args[ai + 1] : null;
const includeInactive = args.includes('--include-inactive');
const oi = args.indexOf('--only');
const only = oi >= 0 ? new Set(String(args[oi + 1] || '').split(',').filter(Boolean)) : null;

const TEMPLATES = path.join(ROOT, 'site/templates.json');

if (approveId) {
  const data = JSON.parse(fs.readFileSync(TEMPLATES, 'utf8'));
  const t = data.templates.find(x => x.id === approveId);
  if (!t) { console.error(`ไม่พบแม่แบบ ${approveId}`); process.exit(2); }
  t.approvedAt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  // แทนเฉพาะค่า approvedAt ของแม่แบบนี้ในข้อความเดิม (ห้าม stringify ทั้งไฟล์ — จะทำลายรูปแบบจัดวาง)
  const src = fs.readFileSync(TEMPLATES, 'utf8');
  const fail = why => { console.error(`แก้ approvedAt ของ ${approveId} ไม่ได้ (${why}) — แก้ site/templates.json ด้วยมือ`); process.exit(2); };
  const idAt = src.indexOf(`"id": "${approveId}"`);
  if (idAt < 0) fail(`ไม่พบข้อความ "id": "${approveId}" — รูปแบบจัดวางต่างจากที่คาด`);
  const at = src.indexOf('"approvedAt":', idAt);
  const m = at < 0 ? null : /^"approvedAt": *(null|"[^"]*")/.exec(src.slice(at));
  if (!m) fail('ไม่พบ approvedAt ถัดจาก id');
  const next = src.slice(0, at) + `"approvedAt": "${t.approvedAt}"` + src.slice(at + m[0].length);
  // ผลลัพธ์ต้องต่างจากเดิมเฉพาะ approvedAt ของแม่แบบนี้ — แม่แบบอื่น/common ต้องเท่าเดิมทุกค่า
  const parsed = JSON.parse(next);
  if (JSON.stringify(parsed) !== JSON.stringify(data)) fail('ไฟล์ที่แก้แล้วต่างจากที่ตั้งใจ (โดนแม่แบบอื่น)');
  fs.writeFileSync(TEMPLATES, next);
  console.log(`approvedAt ของ ${approveId} = ${t.approvedAt}`);
  process.exit(0);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
// เซิร์ฟเวอร์ static รากรีโป (ให้ทั้ง site/ และ tests/ เข้าถึงได้)
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const cfg = JSON.parse(fs.readFileSync(TEMPLATES, 'utf8'));
const pick = t => !only || only.has(t.id);
const active = cfg.templates.filter(t => t.active !== false).filter(pick);
// แม่แบบที่ปิดอยู่ = พรีวิวเท่านั้น (ไม่มี expected) — พื้นหลังยังไม่มี → ภาพทดแทนตามฉาก
const inactive = includeInactive ? cfg.templates.filter(t => t.active === false).filter(pick) : [];
const previewIds = new Set(inactive.map(t => t.id));
const bgFor = t => (fs.existsSync(path.join(ROOT, 'site', t.file || '')) ? undefined : `tests/golden/fixtures/v3/placeholder-${t.scene || 'bottom'}.png`);
const shown = [...active, ...inactive];
const cases = shown.flatMap(t => casesFor(t.id).map(c => (previewIds.has(t.id) ? { ...c, bg: bgFor(t), preview: true } : c)));
if (only && !shown.length) { console.error(`--only ไม่ตรงแม่แบบใด: ${[...only].join(',')}`); process.exit(2); }

fs.mkdirSync(EXPECTED, { recursive: true });
fs.rmSync(ACTUAL, { recursive: true, force: true });
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 500, height: 700 }, deviceScaleFactor: 1, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  for (const c of cases) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    const job = { tpl: c.tpl, model: c.model, logo: LOGO_FILE, photos: PHOTO_FILES, bg: c.bg };
    await page.goto(`${base}/tests/golden/harness.html#${encodeURIComponent(JSON.stringify(job))}`);
    await page.waitForFunction(() => document.body.dataset.done || document.body.dataset.error, null, { timeout: 30000 });
    const err = await page.evaluate(() => document.body.dataset.error);
    if (err || errs.length) { results.push({ ...c, status: 'error', note: err || errs.join('; ') }); await page.close(); console.log(`ERROR ${c.name}: ${err || errs}`); continue; }
    const dataUrl = await page.evaluate(() => window.__png);
    await page.close();
    const actual = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (c.preview) {
      fs.mkdirSync(ACTUAL, { recursive: true });
      fs.writeFileSync(path.join(ACTUAL, `${c.name}.png`), actual);
      results.push({ ...c, status: 'preview', note: c.bg ? 'ภาพทดแทน' : '' });
      console.log(`PREVIEW ${c.name} -> tests/golden/actual/${c.name}.png${c.bg ? ' (ภาพทดแทน)' : ''}`);
      continue;
    }
    const file = path.join(EXPECTED, `${c.name}.png`);
    if (update) {
      // บีบ PNG แบบไม่สูญเสีย ให้ไฟล์ที่ commit เล็กลง
      fs.writeFileSync(file, await sharp(actual).png({ compressionLevel: 9, effort: 10 }).toBuffer());
      results.push({ ...c, status: 'updated' });
      console.log(`UPDATE ${c.name}`);
      continue;
    }
    if (!fs.existsSync(file)) {
      results.push({ ...c, status: 'fail', note: 'ไม่มี golden' });
      console.log(`FAIL missing golden: ${c.name} — run npm run goldens:update`);
      continue;
    }
    const a = await sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const e = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.info.width !== W || a.info.height !== H || e.info.width !== W || e.info.height !== H) {
      results.push({ ...c, status: 'fail', note: 'ขนาดภาพไม่ใช่ 1536×2304' }); console.log(`FAIL ${c.name}: ขนาดผิด`); continue;
    }
    const diff = Buffer.alloc(W * H * 4);
    const n = pixelmatch(e.data, a.data, diff, W, H, { threshold: THRESHOLD });
    const ratio = n / (W * H);
    if (ratio > MAX_DIFF) {
      fs.mkdirSync(ACTUAL, { recursive: true });
      fs.writeFileSync(path.join(ACTUAL, `${c.name}.png`), actual);
      fs.writeFileSync(path.join(ACTUAL, `${c.name}.diff.png`), await sharp(diff, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
      results.push({ ...c, status: 'fail', note: `ต่าง ${(ratio * 100).toFixed(3)}% (> ${MAX_DIFF * 100}%)` });
      console.log(`FAIL ${c.name}: ต่าง ${(ratio * 100).toFixed(3)}% -> tests/golden/actual/${c.name}.diff.png`);
    } else {
      results.push({ ...c, status: 'pass', note: `ต่าง ${(ratio * 100).toFixed(3)}%` });
      console.log(`PASS ${c.name} (ต่าง ${(ratio * 100).toFixed(3)}%)`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

// ---- หน้าให้ครูดู/อนุมัติ ----
const partial = Boolean(only) || includeInactive;
const indexFile = partial ? PARTIAL_INDEX : INDEX;
const imgBase = dir => path.relative(path.dirname(indexFile), path.join(ROOT, 'tests/golden', dir)).split(path.sep).join('/');
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sections = shown.map(t => {
  const dir = imgBase(previewIds.has(t.id) ? 'actual' : 'expected') || '.';
  const rows = results.filter(r => r.tpl === t.id).map(r => `
    <figure><a href="${dir}/${r.name}.png"><img loading="lazy" src="${dir}/${r.name}.png" alt="${esc(r.title)}" width="288" height="432"></a>
    <figcaption>${esc(r.title)}<br><small>${r.status}${r.note ? ' · ' + esc(r.note) : ''}</small></figcaption></figure>`).join('');
  return `<section><h2>${esc(t.id)} · ${esc(t.name)} <small>${t.approvedAt ? 'อนุมัติ ' + esc(t.approvedAt) : 'ยังไม่อนุมัติ'}</small></h2><div class="grid">${rows}</div>
  <p>อนุมัติ: <code>node tools/goldens.mjs --approve ${esc(t.id)}</code></p></section>`;
}).join('\n');
fs.mkdirSync(path.dirname(indexFile), { recursive: true });
fs.writeFileSync(indexFile, `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Golden images - วันเพจครูเวร</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:16px;background:#f7f3fc;color:#3b1470}h2 small{font-weight:400;color:#5b2a9e}
.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;background:#fff;border:1px solid #e4dbf3;border-radius:16px;padding:12px}
img{display:block;border-radius:8px;max-width:100%;height:auto}figcaption{margin-top:8px;font-size:14px;max-width:288px}code{background:#fff;padding:2px 6px;border-radius:6px}</style></head>
<body><h1>Golden images</h1><p>ภาพมาตรฐานที่ใช้เทียบทุกครั้งที่แก้ตัววาด — คลิกภาพเพื่อดูขนาดเต็ม 1536×2304 (สร้างโดย tools/goldens.mjs)</p>
${sections}
</body></html>
`);

const failed = results.filter(r => r.status === 'fail').length;
const errored = results.filter(r => r.status === 'error').length; // วาดไม่สำเร็จ = พังจริง ไม่ขึ้นกับระบบ
console.log(`${results.length} ภาพ, ต่างจาก golden ${failed}, วาดไม่สำเร็จ ${errored}`);
console.log(`หน้าดูภาพ: ${path.relative(ROOT, indexFile)}${partial ? ' (รันบางส่วน — ไม่แตะ docs/goldens/index.html; ก่อน commit รัน npm run goldens เต็ม)' : ''}`);
if (failed && !strict) {
  console.warn(`WARN: ภาพต่างจาก golden ${failed} ภาพ บน ${process.platform} — เตือนอย่างเดียว (CI linux คือผู้ตัดสิน; ใช้ --strict เพื่อให้ล้ม)`);
}
process.exit(goldenExitCode({ failed, errored, strict }));
