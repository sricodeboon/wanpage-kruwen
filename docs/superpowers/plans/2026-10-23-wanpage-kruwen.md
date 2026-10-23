# วันเพจครูเวร Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บแอปมือถือฟรีให้ครูเวร 11 โรงเรียน ตชด. สร้างภาพ "วันเพจ" PNG 1536×2304 จากรูป 4 ภาพ + ครูเวร 1–3 คน + พื้นหลังของจังหวัด แล้วแชร์เข้ากลุ่ม LINE ในแตะเดียว พร้อมเก็บสำเนาลง Google Drive เบื้องหลัง

**Architecture:** หน้าเว็บ static (HTML + vanilla JS ES modules, ไม่มี build step/framework/runtime dependency) บน GitHub Pages วาดภาพด้วย `<canvas>` บนเครื่องผู้ใช้; ข้อมูลโรงเรียน/ครูอ่านจาก Google Sheet (gviz CSV → published CSV → snapshot.json) ผ่าน localStorage cache; Apps Script web app ทำหน้าที่ `doPost` รับ PNG ลง Drive แบบ fire-and-forget ผ่านคิว IndexedDB — ครูเวรไม่เคยรอ Apps Script

**Tech Stack:** HTML/CSS/JS (ES2020 modules) · Canvas 2D · Web Share API · IndexedDB · Google Apps Script (V8) · Google Sheet/Drive · GitHub Pages + Actions · dev only: vitest, fake-indexeddb, playwright, pixelmatch, pngjs, sharp

**Spec:** `docs/superpowers/specs/2026-10-23-wanpage-kruwen-design-v2.md` — **หัวข้อ 17 มีผลเหนือหัวข้ออื่นที่ขัดกัน** · ภาพหน้าจอที่ครูอนุมัติ: `docs/mockup/index.html` · ภาพผลลัพธ์ที่ครูอนุมัติ: `assets/reference/onepage-b-2026-10-23.png` (เก็บในเครื่องครูแจ็กเท่านั้น ไม่อยู่ใน git เพราะมีเบอร์โทรจริง) (HTML: `assets/reference/onepage-b-prototype.html`)

## Global Constraints

- ไม่มี build step, ไม่มี framework, ไม่มี dependency ตอนรัน — ทุกไฟล์ใน `site/` เสิร์ฟตรง (spec 2.2 ข้อ 6)
- ภาพผลลัพธ์ **1536×2304 PNG**; พิกัดแม่แบบเขียนเป็นหน่วยออกแบบ **1024×1536** แล้ว `ctx.scale(1.5,1.5)`; พรีวิวใช้ฟังก์ชันเดียวกันที่ scale 0.25 (spec 8.2)
- ฟอนต์ **Kanit 500 + 700 เท่านั้น** self-host ใน `site/assets/fonts/` (subset thai `U+0E00-0E7F,U+200B,U+2013,U+2014` และ latin `U+0020-007E,U+00A0`); รอฟอนต์โหลดก่อนวาด ไม่มาใน 3 วิ = ไม่วาด (spec 8.4)
- ทุกไฟล์ที่ canvas วาด (พื้นหลัง ตรา ฟอนต์) อยู่ origin เดียวกับหน้าเว็บ (spec 2.2 ข้อ 2)
- สี UI: `--p1:#3b1470 --p2:#5b2a9e --p3:#7d4bc4 --gold:#d9a93a --gold2:#f6d983 --paper:#f7f3fc` การ์ดขาว ขอบ 1px `#e4dbf3` radius 16 · ฟอนต์ฐาน 18 px · เป้าแตะ ≥ 52 px · **ห้ามแถบสีขอบซ้าย** · **ห้ามสีเขียวใน UI** (ยกเว้นปุ่มแชร์ LINE `#06c755` ตามภาพ mockup และชุดมาสคอตในพื้นหลัง) · ธีมสว่างเท่านั้น
- ข้อความทุกตัวบนภาพวาดด้วย `fillText` ทั้งสตริง ไม่ใช้ `letterSpacing` และ `ctx.filter` (spec 8.2)
- ไม่เก็บรูปถ่ายต้นฉบับ/รูปย่อที่ไหนเลย นอกจาก memory; Blob เดียวที่ลง IndexedDB = PNG ที่เสร็จแล้ว (spec 6.7, 8.1 ข้อ 7)
- ชื่อไฟล์ `วันเพจ_{short_name}_{YYYY-MM-DD}_{HHmm}.png` (ค.ศ. + เวลาไทย) (spec 4.8)
- วันที่บนภาพ: `"{d} {เดือนเต็ม} พ.ศ. {ค.ศ.+543}"` เลขอารบิก; วันนี้คำนวณด้วยเขตเวลา `Asia/Bangkok`
- พื้นหลังกรองตามจังหวัด: `schools.province` ∈ `np|sn|mdh` ต้องตรงกับ `templates[].province` (spec 17.2)
- เลย์เอาต์รูปต่อแม่แบบ: `photo_layout` ∈ `1+3 | 2x2 | 2+2` ค่าเริ่มต้น `1+3` (spec 17.1)
- log ของ Apps Script อยู่ใน Spreadsheet ส่วนตัวแยก (`LOG_SHEET_ID`) ไม่ใช่แท็บใน Sheet สาธารณะ (spec 17.1)
- ถ้อยคำที่ครูเวรเห็นใช้ตารางใน spec 7.7 ตามตัวอักษร
- commit ทุกครั้งเป็นชื่อผู้ใช้ในรีโปเท่านั้น — **ห้ามใส่บรรทัด Co-Authored-By / Generated with** (กติกาของครูแจ็ก)
- ภาษาในโค้ด: ชื่อตัวแปร/ฟังก์ชันอังกฤษ; ข้อความ UI และคอมเมนต์อธิบายเจตนาภาษาไทยได้

## Review Focus

1. **กด "ส่งเข้า LINE" สองครั้งเร็ว ๆ หรือกดใหม่หลังยกเลิกแชร์** → ต้องได้ไฟล์ใน Drive ไฟล์เดียว (report_id เดิม, คิวไม่ส่งซ้อน) — ทดสอบใน Task 9 (`drainQueue` ล็อกไม่ให้รันซ้อน) และ Task 10 (`dup` จาก report_id)
2. **เปิดครั้งแรกแบบไม่มีเน็ตและไม่มี cache** → ใช้ snapshot ได้ เห็นชื่อครูแต่ไม่มีเบอร์ ปุ่มรายงานบอก "ต่อเน็ตเพื่อโหลดเบอร์โทรครั้งแรก" — ทดสอบใน Task 3 (`loadData` คืน `source:'snapshot'`, `phonesMissing:true`) และ Task 8 (ข้อความปุ่ม)
3. **โรงเรียนที่ไม่มีครู active หรือจังหวัดที่ยังไม่มีแม่แบบ active** → ฟอร์มแสดงข้อความ ไม่พัง ไม่มีปุ่มรายงานที่กดได้ — ทดสอบใน Task 3 (`buildModel`) และ Task 8 (`validateForm`)
4. **รูปที่ decode ไม่ได้ (HEIC บน Android, ไฟล์ไม่ใช่ภาพ)** → ข้อความ "รูปนี้เปิดไม่ได้ ลองเลือกรูปอื่นหรือถ่ายใหม่" ช่องนั้นยังว่าง ช่องอื่นไม่หาย — ทดสอบใน Task 6 (`processPhoto` reject `DecodeError`) และ Task 8
5. **เวลา 00:00–07:00 ไทย (= วันก่อนหน้าใน UTC)** → วันที่บนภาพ ชื่อไฟล์ และ `report_date` เป็นวันไทย; Apps Script ยอมรับ report_date ที่ห่างวันไทยไม่เกิน 7 วัน — ทดสอบใน Task 2 (`todayBangkok`) และ Task 10 (`validatePayload`)

---

## File Structure

```
site/                        เผยแพร่บน Pages
  index.html                 หน้าครูเวร (หน้าเดียว)
  admin.html                 หน้าผู้ดูแล (Task 12)
  styles.css
  app.js                     bootstrap + state + ผูก UI
  js/thaidate.js             วันที่ไทย (pure)
  js/csv.js                  parser CSV + แปลงแถว (pure)
  js/data.js                 โหลดข้อมูล 3 ชั้น + buildModel
  js/layout.js               merge แม่แบบ, fitText, computeLayout, validateTemplate (pure)
  js/render.js               renderOnePage + helpers canvas
  js/icons.js                Path2D ไอคอน 12 + หมุด + โทรศัพท์
  js/photos.js               เลือกไฟล์ → ย่อ → JPEG blob
  js/fonts.js                FontFace + ensureFonts
  js/share.js                LINE UA, canShare, share, download
  js/upload.js               payload, คิว IndexedDB, drainQueue
  js/form.js                 validateForm (pure) — ข้อความปุ่มรายงาน
  config.json  templates.json  data/snapshot.json
  assets/bg/  assets/bg/thumb/  assets/logos/  assets/fonts/  icons/  manifest.webmanifest
apps-script/ Code.gs Validate.gs Upload.gs Audit.gs TestData.gs appsscript.json
tools/ make-bg.mjs check-bg.mjs validate-templates.mjs snapshot.mjs goldens.mjs subset-fonts.sh smoke-upload.sh
tests/unit/*.test.mjs  tests/golden/{fixtures,expected}/  tests/helpers/
.github/workflows/ pages.yml tests.yml snapshot.yml
docs/ RUNBOOK.md CHANGELOG.md bg-qa.md device-qa.md phase0-results.md sheet-template/*.csv
```

ความรับผิดชอบ: โมดูลใน `js/` ที่เป็น pure (thaidate, csv, layout, form) ทดสอบใน Node ตรง ๆ; โมดูลที่แตะเบราว์เซอร์ (render, photos, fonts, share, upload) รับ dependency เป็นพารามิเตอร์ (fetchFn, storage, idb, ctx) เพื่อให้ทดสอบด้วย stub ได้

---

### Task 1: โครงรีโปและชุดทดสอบ

**Files:**
- Create: `package.json`, `vitest.config.mjs`, `.gitignore`, `site/index.html` (โครงว่าง), `site/config.json`, `tests/unit/smoke.test.mjs`, `docs/CHANGELOG.md`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run serve` (`npx http-server site -p 8080 -c-1` หรือ `python3 -m http.server -d site 8080`)
- Produces: `site/config.json` keys: `app_version` (int, เริ่ม 1), `sheet_id`, `sheet_csv_gviz` (template string มี `{sheet}`), `sheet_csv_published` (object tab→url), `upload_url`, `app_key`, `archive_mime` (`image/png`), `csv_timeout_ms` (6000), `upload_timeout_ms` (90000)

- [ ] **Step 1:** `package.json` `"type":"module"`, devDependencies: `vitest`, `fake-indexeddb`, `playwright`, `pixelmatch`, `pngjs`, `sharp`; scripts `test`, `serve`, `goldens`, `goldens:update`, `validate`
- [ ] **Step 2:** `.gitignore`: `node_modules/`, `assets/backgrounds/*.png`, `assets/refs/*.jpg`, `.clasp.json`, `test-results/`
- [ ] **Step 3:** `tests/unit/smoke.test.mjs` อ่าน `site/config.json` แล้ว assert มีทุก key ข้างบน และ `app_version` เป็นจำนวนเต็ม ≥ 1
- [ ] **Step 4:** Run `npm install && npm test` → Expected: 1 passed
- [ ] **Step 5:** Commit `chore: scaffold repo, vitest, config`

---

### Task 2: วันที่ไทย (`thaidate.js`)

**Files:**
- Create: `site/js/thaidate.js`, `tests/unit/thaidate.test.mjs`

**Interfaces:**
- Produces:
  - `todayBangkok(now?: Date) -> string` (`YYYY-MM-DD`)
  - `formatThaiDate(iso: string) -> string` → `"23 ตุลาคม พ.ศ. 2569"`
  - `thaiWeekday(iso: string) -> string` → `"พฤหัสบดี"`
  - `stampHHmm(now?: Date) -> string` (เวลาไทย `"0742"`)
  - `addDaysISO(iso: string, n: number) -> string`
  - `daysBetweenISO(a: string, b: string) -> number`

- [ ] **Step 1: Write the failing tests**

```js
import { todayBangkok, formatThaiDate, thaiWeekday, stampHHmm, addDaysISO, daysBetweenISO } from '../../site/js/thaidate.js';
test('formats spec example', () => expect(formatThaiDate('2026-10-23')).toBe('23 ตุลาคม พ.ศ. 2569'));
test('all 12 months', () => expect(['01','02','03','04','05','06','07','08','09','10','11','12'].map(m=>formatThaiDate(`2026-${m}-01`).split(' ')[1]))
  .toEqual(['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']));
test('weekday', () => expect(thaiWeekday('2026-10-23')).toBe('พฤหัสบดี'));
test('23:30 UTC is next day in Bangkok', () => expect(todayBangkok(new Date('2026-10-22T23:30:00Z'))).toBe('2026-10-23'));
test('16:59 UTC still same day', () => expect(todayBangkok(new Date('2026-10-23T16:59:00Z'))).toBe('2026-10-23'));
test('stamp Bangkok time', () => expect(stampHHmm(new Date('2026-10-23T00:42:00Z'))).toBe('0742'));
test('leap day', () => expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29'));
test('days between', () => expect(daysBetweenISO('2026-10-16','2026-10-23')).toBe(7));
```

- [ ] **Step 2:** Run `npx vitest run tests/unit/thaidate.test.mjs` → FAIL (module not found)
- [ ] **Step 3:** Implement — วันนี้/เวลาด้วย `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',...})`; คำนวณวันจาก ISO ด้วย `Date.UTC` (ไม่พึ่ง timezone เครื่อง)
- [ ] **Step 4:** Run → PASS 8
- [ ] **Step 5:** Commit `feat: thai date helpers`

---

### Task 3: CSV + โหลดข้อมูล (`csv.js`, `data.js`)

**Files:**
- Create: `site/js/csv.js`, `site/js/data.js`, `site/data/snapshot.json` (ข้อมูลช่างกลฯ 8 ไม่มีเบอร์), `docs/sheet-template/{schools,teachers,photo_labels,settings}.csv`, `tests/unit/csv.test.mjs`, `tests/unit/data.test.mjs`

**Interfaces:**
- Produces (csv.js):
  - `parseCSV(text: string) -> string[][]` (RFC4180: quoted comma, `""`, CRLF, BOM)
  - `rowsToObjects(rows: string[][]) -> object[]` (แถว 1 = หัว, ข้ามแถวที่ช่องแรกขึ้นต้น `#`, อ้างตามชื่อหัว)
  - `parseBool(v) -> boolean` (`TRUE/true/1/ใช่` = true)
  - `normalizePhone(s) -> string` (10 หลักล้วน → `xxx-xxx-xxxx`; อื่นคืนตามเดิม trim)
- Produces (data.js):
  - `buildModel(raw: {schools, teachers, photo_labels, settings}) -> Model` where `Model = { schools: School[] (active, เรียง sort_order), teachersBySchool: Record<id, Teacher[]> (active, เรียง), labels: Label[], settings: Record<string,string>, phonesMissing: boolean }`
  - `School = {school_id, short_name, name_full, address, province, logo_file, default_bg, sort_order}`; `Teacher = {teacher_id, school_id, display_name, phone}`; `Label = {label, icon}`
  - `loadData({config, storage, fetchFn, now, snapshot}) -> Promise<{model: Model, source: 'cache'|'fresh'|'snapshot', stale: boolean}>` — คืน cache ทันทีถ้าอายุ < 7 วัน แล้ว refresh เบื้องหลังผ่าน `refreshData()`; ไม่มี cache → fetch (timeout `config.csv_timeout_ms`) → ล้ม → snapshot
  - `refreshData({config, storage, fetchFn}) -> Promise<Model|null>` เขียน `wp.data` ใน storage
- Consumes: ไม่มี

- [ ] **Step 1: Write failing tests**
  - `csv.test.mjs`: `parseCSV('a,"b,c","d""e"\r\n1,2,3')` → `[['a','b,c','d"e'],['1','2','3']]`; BOM ถูกตัด; `rowsToObjects` ข้ามแถว `#คำอธิบาย`; `normalizePhone('0812345678')==='081-234-5678'`; `normalizePhone(' 02-123 ')==='02-123'`; `parseBool('ใช่')===true`, `parseBool('FALSE')===false`
  - `data.test.mjs`:
    - `buildModel` ตัดครู `active=FALSE` และครูที่ `school_id` ไม่มีใน schools; เรียงตาม sort_order
    - `buildModel` ของโรงเรียนไม่มีครู active → `teachersBySchool[id]` เป็น `[]` (ไม่ throw)
    - `loadData` มี cache อายุ 2 วัน → `source:'cache'` และไม่ await fetch
    - `loadData` ไม่มี cache + fetch reject → `source:'snapshot'`, `model.phonesMissing === true`
    - `loadData` ไม่มี cache + fetch ได้ CSV → `source:'fresh'` และเขียน `wp.data`
    - gviz ตอบ `Content-Type` ไม่ใช่ `text/csv` → ลอง published URL
- [ ] **Step 2:** Run `npx vitest run tests/unit/csv.test.mjs tests/unit/data.test.mjs` → FAIL
- [ ] **Step 3:** Implement ตาม Interfaces; `fetchFn` และ `storage` (interface เดียวกับ `localStorage`) ฉีดเข้ามา; ใช้ `AbortController` สำหรับ timeout
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** สร้าง `docs/sheet-template/*.csv` ตามคอลัมน์ spec 6.1–6.4 + คอลัมน์ `province` (schools); `photo_labels.csv` ใส่ค่าเริ่มต้น 10 แถวจาก spec 6.3; `snapshot.json` = ผลของ `buildModel` จากข้อมูลช่างกลฯ 8 โดยลบ `phone`
- [ ] **Step 6:** Commit `feat: csv parser and 3-tier data loading`

---

### Task 4: เลย์เอาต์และแม่แบบ (`layout.js`, `templates.json`)

**Files:**
- Create: `site/js/layout.js`, `site/templates.json`, `tests/unit/layout.test.mjs`, `tests/helpers/measure.mjs`

**Interfaces:**
- Produces:
  - `mergeTemplate(common, tpl) -> ResolvedTemplate` (deep-merge `tpl.overrides` ทับ `common`; คงฟิลด์ `id, version, province, palette, landmark, band, photo_layout, file, thumb`)
  - `fitText(measure, text, {maxW, font, minFont, weight}) -> {font: number, lines: string[]}` — ลดทีละ 1 จนพอดี; ถึง `minFont` แล้วยังเกิน → แบ่ง 2 บรรทัดที่ช่องว่างใกล้กลางที่สุด (ไม่มีช่องว่าง → แบ่งครึ่งตามจำนวนตัวอักษรนอกสระ/วรรณยุกต์)
  - `photoRects(resolved) -> Rect[4]` ตาม `photo_layout` (`1+3`: main + 3 small; `2x2`: 4 ช่องเท่ากัน; `2+2`: 2 ช่องสูงบน + 2 ช่องล่าง) โดยขอบล่างสุดของรูปต้อง ≤ `landmark.y − 16` (ย่อความสูงช่องล่างก่อน แล้วช่องบนถึง `minMainH`)
  - `computeLayout(resolved, model, measure) -> Layout` โดย `Layout = {logo, title:{rect,font,lines}, school:{rect,font,lines}, address:{rect,font,lines}, dy, photos: Rect[4], labels: ({rect,font,text,icon}|null)[4], duty:{rect, variant, header:{font,y}, cols:[{name:{font,lines,y}, phone:{font,y}|null}]}}`
  - `validateTemplate(resolved) -> {ok: boolean, errors: string[]}` — ตรวจ: rect ทุกตัวอยู่ใน 1024×1536; รูปล่างสุด + 16 ≤ `landmark.y`; `1536 − duty.bottom − 134 ≥ band.top_y − 4`; `photo_layout` ถูกค่า; `province` ∈ `np|sn|mdh`
  - `filterTemplates(templates, province) -> ResolvedTemplate[]` (active + จังหวัดตรง)
- Consumes: **RenderModel** `{school: School, title: string, dateISO: string, teachers: {display_name, phone}[], photos: ({label, icon}|null)[4]}` — app.js สร้างจาก `Model` (Task 3) + state; Task 5 ใช้ shape เดียวกัน
- ค่าตายตัวจาก spec 8.2/8.3/11.5 ใส่ใน `templates.json.common` (ห้าม hard-code ใน layout.js): logo `{top:12,maxH:132,maxW:320}` · title `{x:92,y:152,w:840,h:76,font:39,minFont:30}` · school `{x:150,y:240,w:724,h:54,font:28,minFont:22,twoLineH:80,twoLineDy:26}` · address `{y:304,h:36,font:24,minFont:19,twoLineH:64,twoLineDy:28}` · photos main `{x:46,y:352,w:932,h:282}` small `{y:650,h:230,w:297,xs:[46,363.5,681]}` radius 22 border 6 minMainH 240 minSmallH 170 · label `{h:42,font:21,minFont:17,mainH:46,mainFont:23}` · duty bottom 22, variants 1 `{x:170,w:684,h:104}` 2 `{x:120,w:784,h:118}` 3 `{x:70,w:884,h:120}`
- `templates.json.templates[0]` = np-01 ตาม spec 11.5 + `"province":"np"`, `"photo_layout":"1+3"`; แม่แบบอื่นเพิ่มใน Task 13

- [ ] **Step 1: Write failing tests** (`measure` stub = `text.length × 0.55 × font`)
  - `mergeTemplate` กับ `overrides:{photos:{small:{h:200}}}` → small.h 200, main.h คงเดิม
  - `fitText` ชื่อโรงเรียนเต็ม 60 ตัวที่ maxW 684 → `lines.length===2`, `font===22`
  - `computeLayout` ชื่อโรงเรียน 2 บรรทัด → `dy===26` และ `photos[0].y===352+26`
  - ครู 1/2/3 คน → `duty.variant` 1/2/3 และ `duty.rect.x` 170/120/70
  - ครู 3 คน ชื่อยาว 32 ตัว → ชื่อลดถึง 17 แล้วแยกยศ/ชื่อเป็น 2 บรรทัด, `duty.rect.h===134`
  - ครูไม่มีเบอร์ → `cols[i].phone===null`
  - `photoRects` ทั้ง `1+3`, `2x2`, `2+2` คืน 4 rect ไม่ซ้อนกันและอยู่เหนือ `landmark.y − 16`
  - `landmark.y` ต่ำเกินจนช่องล่าง < 170 และ main < 240 → `validateTemplate(...).ok===false`
  - `validateTemplate(np-01)` → ok; `filterTemplates(all,'sn')` ไม่มี np-01
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement ตาม Interfaces
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: template merge, text fitting, layout and validation`

---

### Task 5: วาดภาพ (`render.js`, `icons.js`)

**Files:**
- Create: `site/js/render.js`, `site/js/icons.js`, `tests/unit/render.test.mjs`, `tests/helpers/fake-ctx.mjs`

**Interfaces:**
- Consumes: `computeLayout`, `mergeTemplate` (Task 4)
- Produces:
  - `renderOnePage(ctx, model, resolved, scale, assets) -> void` — `assets = {bg: CanvasImageSource, logo: CanvasImageSource, photos: CanvasImageSource[4]}` (เรียก `ctx.scale(scale,scale)` เอง; ลำดับวาดตาม spec 8.2)
  - `setShadow(ctx, scale, x, y, blur, color) -> void` (คูณ x/y/blur ด้วย scale), `clearShadow(ctx)`
  - `canvasToBlob(canvas, type, quality?) -> Promise<Blob>` (`convertToBlob` ถ้าเป็น OffscreenCanvas, ไม่งั้น `toBlob`)
  - `createCanvas(w, h) -> OffscreenCanvas|HTMLCanvasElement`
  - `drawCover(ctx, img, rect, focalY) -> void` (cover + clip ด้วย roundRect; focalY 0.5)
  - `ICONS: Record<'building'|'field'|'farm'|'canteen'|'classroom'|'flag'|'walkway'|'library'|'kitchen'|'toilet'|'fence'|'camera'|'pin'|'phone', string /*SVG path d, viewBox 24*/>`
- ใช้ RenderModel จาก Task 4

- [ ] **Step 1: Write failing tests** ด้วย fake ctx ที่บันทึกการเรียก
  - เรียก `scale(1.5,1.5)` ครั้งเดียวเมื่อ scale 1.5
  - ข้อความหัวกล่องครูเวร = `"ครูเวรประจำวันที่ " + formatThaiDate(dateISO)` ถูก `fillText` ทั้งสตริงครั้งเดียว
  - `setShadow(ctx,1.5,0,6,10,c)` → `shadowOffsetY===9`, `shadowBlur===15`
  - ไม่มีการตั้ง `ctx.letterSpacing` หรือ `ctx.filter`
  - ลำดับ `drawImage`: bg ก่อน logo ก่อนรูป
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement; สไตล์ของแต่ละส่วนตาม spec 8.2/8.3 (ไล่สี p3→p1, ขอบ gold, วงขาว, เงา) อ่านสีจาก `resolved.palette`
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** สร้าง `tests/golden/render-np01.html` ที่วาดด้วยข้อมูลวันนี้ (ช่างกลฯ 8, รูปจาก `docs/mockup/p1..p4.jpg`, ครู 1 คน) แล้วเปิดด้วย Chrome headless เทียบด้วยตาว่าใกล้ `assets/reference/onepage-b-2026-10-23.png` (เก็บในเครื่องครูแจ็กเท่านั้น ไม่อยู่ใน git เพราะมีเบอร์โทรจริง) (ต่างได้เรื่องฟอนต์ Kanit และ 4 รูป) — บันทึกภาพไว้ `docs/render-check-np01.png`
- [ ] **Step 6:** Commit `feat: canvas renderer and icons`

---

### Task 6: รูปและฟอนต์ (`photos.js`, `fonts.js`, ไฟล์ฟอนต์)

**Files:**
- Create: `site/js/photos.js`, `site/js/fonts.js`, `tools/subset-fonts.sh`, `site/assets/fonts/kanit-{500,700}-{thai,latin}.woff2`, `tests/unit/photos.test.mjs`, `tests/unit/fonts.test.mjs`

**Interfaces:**
- Produces:
  - `processPhoto(file: File, {maxSide=1600, quality=0.85, deps}) -> Promise<{blob: Blob, w: number, h: number}>` — reject `Error` ที่ `name==='DecodeError'` เมื่อไฟล์ไม่ใช่ภาพหรือ decode ไม่ได้; ลำดับ fallback: `createImageBitmap(file,{resizeWidth/Height, resizeQuality:'medium', imageOrientation:'from-image'})` → TypeError → `createImageBitmap(file,{resizeWidth/Height})` → ล้ม → `<img>` + `decode()` + canvas; `bitmap.close()` ทุกเส้นทาง; ไม่ upscale
  - `processPhotosSequential(files: File[], onEach(i, result|error)) -> Promise<void>` (ทีละไฟล์ คั่น `setTimeout 0`)
  - `ensureFonts({timeoutMs=3000, fontFaceSet=document.fonts}) -> Promise<boolean>` — `load('700 39px Kanit','รายงานภาพ ปิ่น กู้')` + `load('500 24px Kanit','ที่อยู่ ญาติ ฐิติ')` แล้ว `check` ทั้งคู่
- `deps` = `{createImageBitmap, createCanvas, canvasToBlob, loadImage}` ฉีดได้เพื่อทดสอบ

- [ ] **Step 1: Write failing tests**
  - `file.type='application/pdf'` → reject `DecodeError`
  - `createImageBitmap` ครั้งแรก throw TypeError → เรียกครั้งที่สองโดยไม่มี `imageOrientation`
  - ภาพ 4000×3000 → ขนาดที่ขอ resize = 1600×1200; ภาพ 800×600 → ไม่ resize
  - `close()` ถูกเรียกเมื่อสำเร็จและเมื่อ encode ล้ม
  - `ensureFonts` กับ fontFaceSet ที่ `check` คืน false → resolve `false` ภายใน timeout
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** `tools/subset-fonts.sh` ดาวน์โหลด Kanit (OFL) จาก google/fonts GitHub แล้ว `pyftsubset` ตาม unicode-range ใน Global Constraints ออก woff2 4 ไฟล์ — รัน แล้วตรวจแต่ละไฟล์ ≤ 40 KB
- [ ] **Step 6:** Commit `feat: photo downscale pipeline and font loader`

---

### Task 7: แชร์ (`share.js`)

**Files:**
- Create: `site/js/share.js`, `tests/unit/share.test.mjs`

**Interfaces:**
- Produces:
  - `isLineInApp(ua: string) -> boolean` (`/ Line\//i`)
  - `externalBrowserUrl(href: string) -> string` (เพิ่ม/คง `openExternalBrowser=1`)
  - `canShareFile(file, nav=navigator) -> boolean`
  - `sharePng(file, {title, text}, nav=navigator) -> Promise<'shared'|'aborted'|'failed'>` (ไม่ส่ง `url`)
  - `downloadFile(file, doc=document) -> void` (`<a download>`)
  - `isIOS(ua) -> boolean` (สำหรับข้อความ "กดค้างที่รูป")
  - `buildShareText(template: string, {short_name, date_th}) -> string`

- [ ] **Step 1: Write failing tests** — UA LINE Android/iOS = true, Chrome = false; `externalBrowserUrl('https://x/?s=a')` → มี `s=a&openExternalBrowser=1`; ไม่เพิ่มซ้ำ; `sharePng` เมื่อ share reject `AbortError` → `'aborted'`, reject อื่น → `'failed'`, resolve → `'shared'`; payload ที่ส่งเข้า `share` ไม่มี key `url`; `buildShareText('วันเพจ {short_name} {date_th}',{short_name:'ช่างกล8',date_th:'23 ตุลาคม พ.ศ. 2569'})`
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: web share and LINE in-app helpers`

---

### Task 8: หน้าครูเวร (`index.html`, `styles.css`, `app.js`, `form.js`)

**Files:**
- Create: `site/index.html`, `site/styles.css`, `site/app.js`, `site/js/form.js`, `site/manifest.webmanifest`, `site/icons/icon-192.png`, `site/icons/icon-512.png`, `site/assets/logos/changkon8.v1.webp`, `tests/unit/form.test.mjs`, `tests/e2e/flow.spec.mjs`

**Interfaces:**
- Consumes: ทุกโมดูล Task 2–7
- Produces (form.js):
  - `validateForm(state, model) -> {ok: boolean, message: string, target: 'teachers'|'photos'|'background'|null}` — ข้อความตาม spec 7.7: ไม่มีครู → `"เลือกครูเวรอย่างน้อย 1 คน"`; รูปขาด n → `"เลือกรูปอีก {n} ภาพ"`; `model.phonesMissing` → `"ต่อเน็ตเพื่อโหลดเบอร์โทรครั้งแรก"`; โรงเรียนไม่มีครู active → `"ยังไม่มีรายชื่อครูของโรงเรียนนี้ ช่วยแจ้งครูแจ็ก"`; จังหวัดไม่มีแม่แบบ → `"ยังไม่มีพื้นหลังของจังหวัดนี้ ช่วยแจ้งครูแจ็ก"`
  - `toggleTeacher(selected: string[], id: string) -> {selected: string[], error: string|null}` (สูงสุด 3, เกิน → `"เลือกได้ไม่เกิน 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน"`)
  - `dateGuard(iso, todayISO) -> {ok, warn: 'ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง'|null}` (ห้ามอนาคต, ย้อนได้ ≤ 7 วัน)
- `state` = `{schoolId, dateISO, selectedTeacherIds: string[], photos: ({blob,w,h,label,icon}|null)[4], bgId}`
- localStorage keys: `wp.school`, `wp.bg.{school}`, `wp.teachers.{school}`, `wp.lastReport.{school}`, `wp.clientId`, `wp.lowPower`

- [ ] **Step 1: Write failing tests** (`form.test.mjs`) ครอบคลุมทุกข้อความข้างบน, `toggleTeacher` คนที่ 4 ถูกปฏิเสธ, เอาออกแล้วเพิ่มได้, `dateGuard` วันพรุ่งนี้ ok=false, ย้อน 8 วัน ok=false, ย้อน 1 วัน warn
- [ ] **Step 2:** Run → FAIL; implement `form.js`; Run → PASS
- [ ] **Step 3:** สร้าง `index.html` + `styles.css` ตาม `docs/mockup/index.html` และ spec 7.0–7.6: หัวโรงเรียน (ล็อกจาก `?s=`, ลิงก์ "เปลี่ยน"), ส่วน ① วันที่ + การ์ดติ๊กครู (เลขลำดับในวงกลม, ชิป "ใช้ชุดเดิม"), ส่วน ② ช่องรูปตาม `photo_layout` ของแม่แบบที่เลือก (`<input type=file accept="image/*">` ไม่ใส่ `capture`; ช่องแรก `multiple`) + ป้ายชื่อ bottom sheet, ส่วน ③ พรีวิวสด 256×384 + แถว thumb ของจังหวัด, ปุ่ม sticky "สร้างภาพรายงาน", `<dialog>` ยืนยัน (ภาพ + สรุป 3 บรรทัด + "ส่งเข้า LINE"/"บันทึกรูปลงเครื่อง"/"แก้ไข"), หน้า "ส่งแล้ว", แถบ LINE in-app
- [ ] **Step 4:** `app.js` ผูก state machine `boot → data → form → rendering → confirm → sharing → done`; พรีวิว debounce 150 ms; guard เครื่องช้า (วาด > 250 ms ติด 3 ครั้ง → โหมด "แตะเพื่อดูตัวอย่าง", `requestIdleCallback` fallback `setTimeout(fn,50)`); กดรายงาน: `ensureFonts` → render 1.5 → `canvasToBlob('image/png')` → `File` ชื่อตาม Global Constraints → `report_id = crypto.randomUUID()` → `enqueue` (Task 9) → dialog; ปุ่มแชร์เรียก `startUpload` แล้ว `sharePng` ใน click handler เดียว
- [ ] **Step 5:** `tests/e2e/flow.spec.mjs` (Playwright, Chromium, serve `site/`) — เปิด `/?s=changkon8` ด้วย fetch ถูก route ไป snapshot+CSV fixture → ติ๊กครู 1 → set 4 ไฟล์จาก `tests/golden/fixtures/` → เลือก np-01 → กดสร้าง → dialog แสดง `<img>` ที่ naturalWidth 1536 และ naturalHeight 2304 → ข้อความสรุปมี "ส.ต.ท.รัชเดช ศรีแก้ว"
- [ ] **Step 6:** Run `npx playwright test tests/e2e/flow.spec.mjs` → PASS
- [ ] **Step 7:** Commit `feat: duty teacher page end-to-end`

---

### Task 9: คิวอัปโหลด (`upload.js`)

**Files:**
- Create: `site/js/upload.js`, `tests/unit/upload.test.mjs`

**Interfaces:**
- Produces:
  - `buildPayload(report, config, b64) -> object` ตาม spec 10.2 (keys: `v, app_key, report_id, school_id, report_date, teacher_ids, teacher_names, template_id, template_version, app_version, file_name, mime, data_b64, ua`) — **ไม่มี key อื่น**
  - `openQueue(idbFactory=indexedDB) -> Promise<Queue>`; `Queue = {add(item), all(), put(item), remove(report_id), prune({maxItems:10, maxAgeDays:7, now})}` (DB `wanpage`, store `pending`, key `report_id`)
  - `enqueue(queue, report) -> Promise<void>` (report = `{report_id, created, school_id, report_date, teacher_ids, teacher_names, template_id, template_version, file_name, mime, blob}`; ตั้ง `attempts:0, next_try:0`)
  - `classifyResponse(json) -> 'done'|'retry'|'drop'|'jpeg'` — `ok:true` หรือ `dup:true` → done; `BAD_KEY|DISABLED|INVALID|RATE_LIMIT|UNKNOWN_SCHOOL` → drop; `TOO_LARGE` → jpeg; `DRIVE_ERROR` → retry
  - `nextTryAt(attempts, now) -> number` (0 → now, 1 → now+30 s, 2 → now+5 min, ≥3 → `Infinity` = รอเปิดแอปครั้งถัดไป)
  - `drainQueue({queue, fetchFn, config, settings, now, onStatus}) -> Promise<{sent, failed, dropped}>` — ทีละรายการ เก่าสุดก่อน; มี lock ในโมดูล: เรียกซ้อนขณะรันอยู่ → คืน promise เดิม; `settings.upload_enabled` false → ไม่ยิง `onStatus('disabled')`; attempts ≥ 8 หรือ อายุ > 7 วัน → ลบ + `onStatus('gave_up', item)`
  - `startUpload(deps) -> void` (เรียก `drainQueue` ไม่ await)
  - `installTriggers(deps, win=window, doc=document) -> void` (online, visibilitychange→visible)

- [ ] **Step 1: Write failing tests** (fake-indexeddb + mock fetch)
  - payload keys ตรงรายการเป๊ะ (`Object.keys(...).sort()`)
  - network error → item ยังอยู่, `attempts===1`, `next_try === now+30000`
  - `ok:false, error:'BAD_KEY'` → item ถูกลบ, ไม่ retry
  - `dup:true` → ลบ = สำเร็จ
  - `TOO_LARGE` → ส่งใหม่ครั้งเดียวด้วย `mime:'image/jpeg'` และ `file_name` ลงท้าย `.jpg` (blob ผ่าน `toJpeg` ที่ฉีดเข้ามา)
  - เรียก `drainQueue` 2 ครั้งพร้อมกัน → fetch ถูกเรียกครั้งเดียวต่อ item (Review Focus 1)
  - `prune` เหลือ ≤ 10 รายการ และลบรายการอายุ > 7 วัน
- [ ] **Step 2:** Run → FAIL; **Step 3:** Implement (base64 ด้วย `FileReader.readAsDataURL` ใน browser / `Buffer` path ใน test ผ่าน deps); **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: IndexedDB upload queue with retry and dedup`

---

### Task 10: Apps Script ตัวรับไฟล์

**Files:**
- Create: `apps-script/appsscript.json`, `apps-script/Code.gs` (doPost/doGet/setup), `apps-script/Validate.gs` (pure), `apps-script/Upload.gs` (Drive/log/rate limit), `apps-script/Audit.gs`, `apps-script/TestData.gs`, `tests/unit/apps-script-validate.test.mjs`, `tests/helpers/load-gs.mjs`, `tools/smoke-upload.sh`

**Interfaces:**
- Produces (Validate.gs — ไม่เรียก API ของ GAS, โหลดใน Node ผ่าน `vm` ด้วย `load-gs.mjs`):
  - `validatePayload(p, props, todayISO, schoolIds) -> {ok:true}|{ok:false, error, message}` ตาม spec 10.3 ข้อ 1–4 (regex ชื่อไฟล์ `^วันเพจ_[^/\\:*?"<>|]{1,12}_\d{4}-\d{2}-\d{2}_\d{4}\.(png|jpg)$`, UUID, report_date ห่างวันนี้ไทย ≤ 7 และไม่อนาคต, `data_b64.length ≤ MAX_BYTES×1.37` → `TOO_LARGE`)
  - `checkImageHeader(bytes: number[], mime) -> boolean` (PNG magic `89 50 4E 47 0D 0A 1A 0A` + IHDR กว้าง 1536 สูง 2304; JPEG `FF D8 FF`)
  - `rateKeys(schoolId, todayISO, nowMinute) -> string[]`
- Produces (Code.gs): `doPost(e)`, `doGet(e)` (`?action=health|status`), `setup()` (ตรวจ properties, สร้าง trigger `dailyAudit` 06:00)
- Script Properties: `SHEET_ID, LOG_SHEET_ID, ROOT_FOLDER_ID, APP_KEY, APP_KEY_PREV, UPLOAD_ENABLED=true, MAX_PER_SCHOOL_PER_DAY=8, MAX_TOTAL_PER_DAY=100, MAX_PER_MINUTE=6, MAX_BYTES=12000000, ALERT_EMAIL=dev.nathom@gmail.com, ARCHIVE_ALLOWED_MIME=image/png,image/jpeg, RETENTION_DAYS=0, VERSION`
- หลังบันทึกสำเร็จ: append log ใน `LOG_SHEET_ID` + เขียน `today_count`, `last_report_ts` ของโรงเรียนกลับแท็บ `schools` (ใต้ `LockService`) — ไม่ใช้สูตรอ้าง log
- `appsscript.json`: `timeZone: Asia/Bangkok`, webapp `ANYONE_ANONYMOUS / USER_DEPLOYING`, scopes drive, spreadsheets, script.send_mail, script.scriptapp

- [ ] **Step 1: Write failing tests** (`apps-script-validate.test.mjs`) — key ผิด → `BAD_KEY`; `APP_KEY_PREV` ผ่าน; school ไม่อยู่ในรายการ → `UNKNOWN_SCHOOL`; report_date พรุ่งนี้ / 8 วันก่อน → `INVALID`; ชื่อไฟล์มี `/` → `INVALID`; ขนาดเกิน → `TOO_LARGE`; PNG header 1536×2304 → true, 1024×1536 → false; JPEG magic → true
- [ ] **Step 2:** Run → FAIL; **Step 3:** Implement Validate.gs; **Step 4:** Run → PASS
- [ ] **Step 5:** Implement Code.gs/Upload.gs/Audit.gs ตาม spec 10.3–10.4 (dedup ด้วย CacheService 6 ชม. แล้ว TextFinder ใน log; rate limit ใต้ lock; โฟลเดอร์ตาม `short_name`; `createFile` + `setDescription(JSON meta)`; exception ที่มี `quota|storage` → อีเมล ≤ 1/ชม.) และ `TestData.gs` ฟังก์ชัน `test_doPost_valid`, `test_rejects_badKey`, `test_rateLimit`, `test_pngHeader`, `test_dedup` ที่รันจาก editor
- [ ] **Step 6:** `tools/smoke-upload.sh <exec_url> <app_key>` สร้าง PNG 1536×2304 ด้วย `node -e` (sharp) → payload → `curl -sL -H 'Content-Type: text/plain' --data-binary @payload.json` → exit 0 เมื่อพบ `"ok":true`
- [ ] **Step 7:** Commit `feat: apps script uploader with validation, rate limit, audit`

---

### Task 11: เครื่องมือพื้นหลังและแม่แบบ

**Files:**
- Create: `tools/make-bg.mjs`, `tools/check-bg.mjs`, `tools/validate-templates.mjs`, `tools/goldens.mjs`, `tests/golden/fixtures/` (ตรา, รูป 4 ใบ: แนวนอน/แนวตั้ง/สี่เหลี่ยม/EXIF หมุน), `docs/bg-qa.md`

**Interfaces:**
- `node tools/make-bg.mjs <src.png> <id> [--version 1]` → `site/assets/bg/<id>.v<version>.webp` (1536×2304, lanczos3, q82, ≤ 450 KB) + `site/assets/bg/thumb/<id>.v<version>.webp` (240×360, ≤ 15 KB)
- `node tools/check-bg.mjs <png> [--json]` → พิมพ์ผลแต่ละเกณฑ์ spec 11.2 (สัดส่วน 2:3, โซนกลาง 15–59% สว่างเฉลี่ย ≥ 215 std ≤ 14, แถบล่าง y ≥ 90% สว่างเฉลี่ย ≤ 120, สัดส่วนพิกเซลเขียว hue 75–165° sat ≥ .25 ≤ 8% ทั้งภาพ, `landmark_top_y` คาด) exit 1 ถ้าไม่ผ่าน — เกณฑ์ตัวเลขอยู่ในค่าคงที่บนสุดของไฟล์ ปรับให้ np-01 ผ่านพอดีแล้วบันทึกใน `docs/bg-qa.md`
- `node tools/validate-templates.mjs` → ใช้ `validateTemplate` จาก `site/js/layout.js` กับทุกแม่แบบ + ตรวจไฟล์ webp มีจริงและ 1536×2304; exit 1 ถ้าผิด
- `node tools/goldens.mjs [--update] [--approve <id>]` → Playwright เปิด `tests/golden/harness.html` (import `render.js`) วาดทุกแม่แบบ active × ครู 1/2/3 + 3 เคสขอบ (ป้ายยาว, ที่อยู่ 2 บรรทัด, ไม่มีเบอร์) → `tests/golden/expected/<id>-<n>.png`; โหมดเทียบใช้ pixelmatch threshold 0.1 ต่าง ≤ 0.5% และสร้าง `docs/goldens/index.html` รวมภาพไว้ให้ครูดู

- [ ] **Step 1:** เขียน `tests/unit/check-bg.test.mjs`: np-01 (จาก `assets/reference/bg-01-phrathat-naga.png`) → ผ่าน; ภาพเทียมสีเขียวทั้งภาพ → ไม่ผ่านเกณฑ์เขียว; ภาพเทียมที่มีวัตถุที่ y 40% → `landmark_top_y` < 904
- [ ] **Step 2:** Run → FAIL; **Step 3:** Implement 4 เครื่องมือ; **Step 4:** Run → PASS
- [ ] **Step 5:** `node tools/make-bg.mjs assets/reference/bg-01-phrathat-naga.png np-01` แล้ว `node tools/validate-templates.mjs` → exit 0; `node tools/goldens.mjs --update` สร้างภาพ np-01 3 ภาพ
- [ ] **Step 6:** Commit `feat: background pipeline, template validator, golden images`

---

### Task 12: หน้าผู้ดูแล (`admin.html`)

**Files:**
- Create: `site/admin.html`, `site/js/admin.js`, `site/js/qr.js` (QR encoder ขนาดเล็กเขียนเองหรือ vendored MIT ≤ 12 KB พร้อม LICENSE header)

**Interfaces:**
- Consumes: `loadData`, `mergeTemplate`, `filterTemplates`, `validateTemplate`, `renderOnePage`
- ฟีเจอร์: (1) ตรวจข้อมูล — ตารางโรงเรียน/ครู พร้อมคำเตือน (โรงเรียนไม่มีครู, province ผิด, logo ไม่มีไฟล์, เบอร์ไม่ครบ 10 หลัก) (2) ลิงก์ปักหมุด — ข้อความปักหมุดพร้อมลิงก์ `https://sricodeboon.github.io/wanpage-kruwen/?s={id}&openExternalBrowser=1` ทั้ง 11 + QR + ปุ่มคัดลอก (3) พรีวิวแม่แบบ — เลือกจังหวัด แสดงทุกแม่แบบด้วยข้อมูลตัวอย่าง (4) โหมดวัด — วางพื้นหลัง + กรอบ overlay คลิก 2 จุด ได้ JSON `landmark` และ `band.top_y` (5) health — เรียก `upload_url?action=health` แสดงพื้นที่ Drive
- `<meta name=robots content=noindex>` ไม่ลิงก์จาก index.html

- [ ] **Step 1:** เขียน `tests/e2e/admin.spec.mjs`: เปิด admin.html ด้วย fixture → แท็บลิงก์มี 1 ลิงก์ต่อโรงเรียนที่ลงท้าย `openExternalBrowser=1`; โรงเรียนที่ไม่มีครูแสดงคำเตือน
- [ ] **Step 2:** Run → FAIL; **Step 3:** Implement; **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: admin page with links, QR, template preview, measure mode`

---

### Task 13: พื้นหลัง 30 แบบ + มาสคอต (งานคู่ขนาน ใช้บัญชี AI ของครู)

ทำได้ทุกเมื่อ ไม่บล็อก Task อื่น (แอปใช้ np-01 ระหว่างพัฒนา) — โควตา Gemini/ChatGPT ของครูจำกัดต่อรอบ ให้ทำเป็นรอบ ๆ

**Files:**
- Create/Modify: `assets/mascots/mascot-sheet-v2.png`, `assets/refs/*` + `CREDITS.tsv`, `assets/backgrounds/{np,sn,mdh}-NN.png`, `assets/backgrounds/PROMPTS.md` (เขียนใหม่ตาม spec 17.2), `site/assets/bg/*.webp`, `site/templates.json`, `docs/bg-qa.md`

- [ ] **Step 1:** มาสคอต v2 ใน Gemini (แชต "Thai BPP School Mascot Design Sheet"): ครู ตชด. ชาย/หญิง **ชุดเขียวมะกอกเข้ม + ตราช้างบนแขนเสื้อ/เบเร่ต์ ไม่มีตัวอักษร** + นักเรียนชาย/หญิงชุดเดิม → บันทึก `assets/mascots/mascot-sheet-v2.png` → ให้ครูแจ็กอนุมัติก่อนใช้
- [ ] **Step 2:** เขียน `PROMPTS.md` ใหม่: prompt ฐาน spec 11.3 (+ บรรทัดมาสคอต: "the 4 mascots from the attached sheet stand small in the bottom-left and bottom-right corners, never covering the landmark or the bottom band") + บรีฟ 30 แบบจากรายชื่อสถานที่ spec 17.2 โดยแต่ละแบบรวมจุดเด่นจริงของจังหวัด (เช่น np: พระธาตุพนม + พญานาค + สะพานแห่งที่ 3 + ทิวเขาหินปูนฝั่งลาว)
- [ ] **Step 3:** หาภาพอ้างอิงจริงที่ยังขาด (Wikimedia Commons ก่อน; ไม่มีให้บันทึกว่า "ใช้ความรู้ของโมเดล" ใน `bg-qa.md`) บันทึกเครดิตใน `assets/refs/CREDITS.tsv`
- [ ] **Step 4:** สร้างทีละแบบใน Gemini โดยแนบภาพอ้างอิง + mascot sheet → บันทึก `assets/backgrounds/<id>.png` → `node tools/check-bg.mjs` → ไม่ผ่าน = สร้างใหม่ (สูงสุด 3 รอบ/แบบ)
- [ ] **Step 5:** แบบที่ผ่าน: `make-bg.mjs` → วัดใน admin.html โหมดวัด → เพิ่ม object ใน `templates.json` (`province`, `photo_layout` ที่วางแล้วสวยที่สุดกับภาพนั้น, `palette`, `landmark`, `band`) → `validate-templates.mjs` ผ่าน
- [ ] **Step 6:** `node tools/goldens.mjs --update` → ส่ง `docs/goldens/index.html` ให้ครูแจ็กอนุมัติทีละแบบ → ใส่ `approvedAt` และ `active:true` เฉพาะแบบที่อนุมัติ
- [ ] **Step 7:** Commit ต่อจังหวัด `feat(bg): nakhon phanom set` / `sakon nakhon set` / `mukdahan set`

---

### Task 14: CI, Pages, snapshot และเอกสาร

**Files:**
- Create: `.github/workflows/tests.yml`, `.github/workflows/pages.yml`, `.github/workflows/snapshot.yml`, `tools/snapshot.mjs`, `docs/RUNBOOK.md`, `docs/device-qa.md`, `docs/phase0-results.md`

**Interfaces:**
- `tests.yml`: ทุก push/PR → `npm ci`, `npm test`, `node tools/validate-templates.mjs`, `npx playwright install --with-deps chromium`, `node tools/goldens.mjs` (เทียบ golden เฉพาะใน CI ubuntu; เครื่อง dev เตือนอย่างเดียวที่ 2%)
- `pages.yml`: push `main` → `actions/upload-pages-artifact` path `site` → `actions/deploy-pages`
- `snapshot.yml`: cron `0 20 * * 0` (= จันทร์ 03:00 ไทย) + `workflow_dispatch` → `node tools/snapshot.mjs` (อ่าน gviz ด้วย Actions variable `SHEET_ID`, ลบ `phone`) → commit ถ้าเปลี่ยน
- `RUNBOOK.md` = ตาราง spec 12 + ขั้น deploy spec 14 (ปรับ: log แยกไฟล์, province, ผู้ติดตั้งคือ Claude ใน Chrome)

- [ ] **Step 1:** `tests/unit/snapshot.test.mjs`: `toSnapshot(model)` ไม่มี key `phone` ในครูทุกคน
- [ ] **Step 2:** Run → FAIL; **Step 3:** Implement `tools/snapshot.mjs` (export `toSnapshot`) และ 3 workflow; **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `ci: tests, pages deploy, weekly snapshot; docs: runbook`

---

### Task 15: ติดตั้งบนบัญชีจริง (Claude ทำใน Chrome ที่ครูล็อกอิน)

ทำหลัง Task 1–12 ผ่าน และ Task 14 พร้อม · ทุกขั้นที่ต้องกดยืนยันสิทธิ์ OAuth ของ Google ให้ครูแจ็กกดเอง · ห้ามกรอกรหัสผ่าน

- [ ] **Step 1: Google Sheet** "วันเพจครูเวร-ข้อมูล" จาก `docs/sheet-template/*.csv` (4 แท็บ) + ข้อมูลช่างกลฯ 8 → แชร์ "ทุกคนที่มีลิงก์: ดู" · Spreadsheet ส่วนตัว "วันเพจครูเวร-log" (แท็บ `log` หัวคอลัมน์ spec 6.5) ไม่แชร์
- [ ] **Step 2: Google Form** "ข้อมูลโรงเรียน วันเพจครูเวร" (ชื่อเต็ม ชื่อย่อ ที่อยู่ จังหวัด รายชื่อครู+ยศ+เบอร์ อัปโหลดตรา) ผูกคำตอบลง Sheet แท็บ `form_responses` (ไม่อ่านจากเว็บ) — ส่งลิงก์ฟอร์มให้ครูแจ็กโพสต์เอง
- [ ] **Step 3: Drive** โฟลเดอร์ "วันเพจครูเวร" → จด id
- [ ] **Step 4: Apps Script** โปรเจกต์ "wanpage-uploader" วาง `apps-script/*` → ตั้ง Script Properties (APP_KEY = `wp_2026_` + `openssl rand -hex 8`) → ครูกด Run `setup()` อนุญาตสิทธิ์ → Deploy Web app (Me / Anyone) → จด `/exec` → `tools/smoke-upload.sh` → `ok:true` และไฟล์ทดสอบอยู่ในโฟลเดอร์
- [ ] **Step 5: GitHub** สร้างรีโป public `sricodeboon/wanpage-kruwen` → ใส่ค่าใน `site/config.json` → push → Settings → Pages: Source GitHub Actions → variable `SHEET_ID` → รอ `pages.yml` เขียว → เปิด `https://sricodeboon.github.io/wanpage-kruwen/?s=changkon8` ใน Chrome บน Mac ผ่าน flow จนได้ dialog ยืนยัน
- [ ] **Step 6:** บันทึก URL/ID ทั้งหมด (ไม่ใส่ APP_KEY) ใน `docs/RUNBOOK.md` → Commit `docs: record deployment ids`

---

### Task 16: ทดสอบบนมือถือจริงกับครูแจ็ก (Phase 0 + device QA)

ต้องใช้มือถือของครู — Claude เตรียมรายการและบันทึกผล

- [ ] **Step 1:** ส่งเช็กลิสต์ T-00..T-04 (spec 13.1) ให้ครูแจ็กทำบน Android + iPhone: แชร์ PNG เข้ากลุ่ม LINE ทดสอบ, เปิดลิงก์จากในกลุ่ม (openExternalBrowser), รูปแนวตั้งจาก iPhone ไม่กลับหัว, เลือก 4 รูป 12 MP ไม่ค้าง, ปิดเน็ตก่อนแชร์แล้วเปิดใหม่ → Drive ได้ 1 ไฟล์
- [ ] **Step 2:** บันทึกผลใน `docs/phase0-results.md` + `docs/device-qa.md`; ข้อที่ไม่ผ่าน → เปิด task แก้ (เช่น CORS อ่าน response ไม่ได้ → เปิดโหมด `no-cors` + `?action=status` ใน `upload.js` ตาม spec 10.1)
- [ ] **Step 3:** ทดลองใช้จริงที่ช่างกลฯ 8 3 วัน → ครูแจ็กยืนยัน → admin.html ข้อความปักหมุด 11 โรงเรียน (หลังข้อมูลจาก Google Form ครบ)
- [ ] **Step 4:** Commit `docs: device QA results`
