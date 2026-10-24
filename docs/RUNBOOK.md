# RUNBOOK — งานผู้ดูแลวันเพจครูเวร

ตัวแปรที่ยังไม่มีค่า (กรอกหลังติดตั้งจริง): `<SHEET_ID>` · `<LOG_SHEET_ID>` · `<ROOT_FOLDER_ID>` · `<EXEC_URL>` · `<APP_KEY>`

## 1. งานประจำ

| งาน | วิธี | มีผล |
|---|---|---|
| เพิ่ม/แก้/ปิดครู, เบอร์, ที่อยู่, ป้ายรูป | แก้ Sheet (มือถือได้) + บวก `data_version` ใน `settings` | ครั้งถัดไปที่ครูเวรเปิดแอปแบบมีเน็ต (gviz ทันที; published ≤ 5 นาที) |
| เพิ่มโรงเรียน | แถวใน `schools` (ใส่ `province` = `np`/`sn`/`mdh` ให้ตรงกับพื้นหลัง) + อัปโหลด `site/assets/logos/{id}.v1.webp` ผ่าน GitHub web | Pages build 1–2 นาที |
| เปลี่ยนตรา | ไฟล์ชื่อใหม่ `.v2.webp` + แก้ `logo_file` | ทันทีหลัง build |
| เพิ่ม/เปลี่ยนพื้นหลัง | ทำตาม spec 11.6 → commit webp + `templates.json` + บวก `app_version` | หลัง build |
| แจ้งข่าว/ปิดระบบชั่วคราว | `settings.notice_text` / `upload_enabled` = FALSE | ≤ 5 นาที |
| key หลุด/ไฟล์แปลก | หมุน key (หัวข้อ 4), ลบไฟล์ใน Drive, ดู log ใน `<LOG_SHEET_ID>` | 10 นาที |
| Drive ใกล้เต็ม (อีเมล 80%) | เลือก: ลบปีเก่า / ตั้ง `RETENTION_DAYS` / แก้ `site/config.json` `"archive_mime": "image/jpeg"` (สำเนา Drive เป็น JPEG q0.9 `.jpg`; รูปที่ครูเวรแชร์เข้า LINE ยังเป็น PNG) + บวก `app_version` | หลัง build |
| แก้ Apps Script | editor หรือ `clasp push` → Manage deployments → Edit → New version (URL เดิม) → `tools/smoke-upload.sh` | 3 นาที |
| ใครยังไม่ส่งวันนี้ | `schools.today_count` / `last_report_ts` (Apps Script เขียนกลับ) / อีเมลสรุป | — |
| สร้าง snapshot ด้วยมือ | Actions → snapshot → Run workflow (commit + deploy Pages ให้อัตโนมัติถ้าไฟล์เปลี่ยน; หรือรันในเครื่อง `SHEET_ID=<SHEET_ID> node tools/snapshot.mjs` แล้ว push เอง) | 3 นาที |
| ย้ายโฮสต์ | Cloudflare Pages ชี้รีโปเดียวกัน โฟลเดอร์ `site` → แจ้งลิงก์ใหม่ | 15 นาที |
| ลิงก์+QR สำหรับปักหมุด | เปิด `admin.html` บนเว็บ → "ลิงก์ 11 โรงเรียน" (ลิงก์และ QR ของแต่ละโรงเรียนมาจากหน้านี้ ไม่ต้องสร้างเอง) | — |

เวอร์ชัน: `site/config.json.app_version` (จำนวนเต็ม) บวกทุก deploy · `docs/CHANGELOG.md` · git tag · Apps Script `VERSION` ตอบใน health · `settings.min_app_version` บังคับ reload เมื่อแก้สำคัญ

## 2. Deploy ครั้งแรก

ผู้ติดตั้ง = Claude ทำใน Chrome ที่ครูแจ็กล็อกอินอยู่ ขั้นยืนยันสิทธิ์ OAuth ของ Google ครูแจ็กกดเอง

### A. Google
1. สร้าง Sheet "วันเพจครูเวร-ข้อมูล" จาก `docs/sheet-template/*.csv` (4 แท็บ schools/teachers/photo_labels/settings; แถวข้อมูลเริ่มแถว 3; `schools` มีคอลัมน์ `province`) กรอก 11 โรงเรียน+ครู → แชร์ "ทุกคนที่มีลิงก์: ดู" → จด `<SHEET_ID>` (ถ้า T-02 ต้องใช้ ให้เผยแพร่เป็น CSV ทีละแท็บ ห้ามเลือกทั้งเอกสาร)
   - **ก่อนวาง CSV** ทุกแท็บทั้ง 4 แท็บ: เลือกทั้งแผ่น (มุมซ้ายบน) → Format → Number → **Plain text** แล้วค่อยวาง/นำเข้า (ตอนนำเข้าให้ติ๊กไม่แปลงตัวเลข/วันที่) — ไม่งั้น gviz เดาชนิดคอลัมน์: เบอร์ `0812345678` กลายเป็น `812345678`, คอลัมน์ที่ปนข้อความกับตัวเลข/TRUE จะได้ช่องว่างแทนค่า
   - แท็บ `settings`: คอลัมน์ `value` ต้องเป็น **ข้อความ** เสมอ (`TRUE`/`FALSE`, `1`, `20261023` พิมพ์เป็นข้อความ) — ถ้าเป็นตัวเลข/บูลีน gviz จะส่งค่าว่าง ทำให้ `upload_enabled` (สวิตช์ปิด) และ `min_app_version` ไม่ทำงานเงียบ ๆ
   - แอปและ snapshot เรียก gviz ด้วย `&headers=1` และตรวจคอลัมน์ที่ต้องมีทุกแท็บ (`REQUIRED_COLUMNS` ใน `site/js/data.js`) ถ้าหัวคอลัมน์เพี้ยนจะไม่เขียนทับข้อมูลเดิมในเครื่อง/snapshot — ถ้าแอปขึ้น "ใช้ข้อมูลที่บันทึกไว้ในเครื่อง" ตลอดทั้งที่มีเน็ต ให้เช็กแถวหัวของ Sheet ก่อน
2. สร้าง **Spreadsheet ส่วนตัวแยก** สำหรับ log (ไม่แชร์ใคร) → จด `<LOG_SHEET_ID>` เพราะสิทธิ์ดูระดับไฟล์ครอบคลุมทุกแท็บ log จึงต้องไม่อยู่ใน Sheet สาธารณะ
3. โฟลเดอร์ Drive "วันเพจครูเวร" → จด `<ROOT_FOLDER_ID>`
4. script.google.com → โปรเจกต์ "wanpage-uploader" วาง `apps-script/*` แล้วตั้ง Script Properties:
   - `SHEET_ID=<SHEET_ID>`
   - `LOG_SHEET_ID=<LOG_SHEET_ID>`
   - `ROOT_FOLDER_ID=<ROOT_FOLDER_ID>`
   - `APP_KEY=wp_2026_` + `openssl rand -hex 8` (และ `APP_KEY_PREV` ว่างไว้)
   - `TEST_SCHOOL_ID=<school_id ที่ใช้ทดสอบ เช่น changkon8>`
   - `MAX_TOTAL_PER_DAY=100`
   - `UPLOAD_ENABLED=true`, `MAX_PER_SCHOOL_PER_DAY=8`, `MAX_PER_MINUTE=6`, `MAX_BYTES=12000000`, `ALERT_EMAIL=<อีเมลครู>`, `ARCHIVE_ALLOWED_MIME=image/png,image/jpeg`, `RETENTION_DAYS=0`
5. **ลำดับรันครั้งแรกใน Apps Script editor**: `setup()` (ขอสิทธิ์ + สร้าง trigger + ตรวจโฟลเดอร์/Sheet) → `runAllTests()` → Deploy → Web app · Execute as Me · Who has access Anyone → ได้ `<EXEC_URL>` (ลงท้าย `/exec`)
   - หมายเหตุ: `runAllTests()` ใช้โควตารายวันของโรงเรียนทดสอบ (`TEST_SCHOOL_ID`) ไปด้วย (ไฟล์ทดสอบจริงลง Drive) — อย่ารันซ้ำหลายรอบก่อนทดสอบจริงในวันเดียวกัน
6. `tools/smoke-upload.sh <EXEC_URL> <APP_KEY>` → ต้องได้ `"ok":true` และมีไฟล์ทดสอบใน Drive

### B. GitHub
7. รีโป `sricodeboon/wanpage-kruwen` (public) → push `main`
   - **ทันทีหลัง push ครั้งแรก**: Actions → `goldens-update` → Run workflow → ดาวน์โหลด artifact `goldens-linux` → แตกทับ `tests/golden/expected/` (+ `docs/goldens/index.html`) → commit "test: linux goldens" → push (golden ในรีโปตอนนี้สร้างบน macOS; CI ubuntu เทียบแบบเข้มจึงอาจแดงจนกว่าจะทำข้อนี้) · ทำซ้ำทุกครั้งที่ตั้งใจเปลี่ยนหน้าตาภาพ
8. แก้ `site/config.json`: `sheet_id=<SHEET_ID>`, `sheet_csv_published` (ถ้าใช้), `upload_url=<EXEC_URL>`, `app_key=<APP_KEY>`, `app_version` เริ่ม 1
9. Settings → Pages → Source: GitHub Actions → workflow `pages` ทำงาน → `https://sricodeboon.github.io/wanpage-kruwen/`
10. Settings → Secrets and variables → Actions → Variables → เพิ่ม `SHEET_ID=<SHEET_ID>` (สำหรับ snapshot.yml) แล้วสั่ง snapshot รันหนึ่งครั้ง (ถ้าไฟล์เปลี่ยน snapshot.yml จะเรียก pages.yml ต่อให้เอง เพราะ commit จาก GITHUB_TOKEN ไม่ trigger pages.yml เอง)
11. เปิดบนมือถือทดสอบตาม `docs/device-qa.md` กับช่างกลฯ 8

### C. ส่งมอบ
12. (ไม่บังคับ) หน้า redirect ที่ InfinityFree
13. เปิด `admin.html` → ลิงก์+QR 11 โรงเรียน → โพสต์ในกลุ่ม LINE พร้อมคำแนะนำ 3 บรรทัด + ภาพคู่มือ 1 หน้า + "ถ้ากดแชร์ไม่ขึ้น ให้กด เปิดในเบราว์เซอร์" → ปักหมุด
14. ปล่อยใช้จริง 1 โรงเรียน 3 วัน → ทั้ง 11

## 3. Release checklist (ทุกครั้งที่ปล่อย)
- [ ] บวก `app_version` ใน `site/config.json`
- [ ] `npm run validate` ผ่าน
- [ ] `npm test` + `npm run goldens` + `npm run e2e` ผ่านใน CI (CI ubuntu คือผู้ตัดสิน golden; บน mac `npm run goldens` เตือนอย่างเดียว ใช้ `node tools/goldens.mjs --strict` ถ้าอยากให้ล้ม) — ถ้าตั้งใจเปลี่ยนภาพ: รัน workflow `goldens-update` แล้ว commit ภาพจาก artifact
- [ ] ถ้าเคยรัน `goldens.mjs --only …` / `--include-inactive` (หน้าดูไปอยู่ `tests/golden/actual/index.html`): รัน `npm run goldens` **เต็ม** อีกรอบก่อน commit ให้ `docs/goldens/index.html` มีครบทุกแม่แบบ active
- [ ] `tools/smoke-upload.sh <EXEC_URL> <APP_KEY>` ผ่าน (ถ้าแก้ Apps Script)
- [ ] ทดสอบ Android อย่างน้อย 1 เครื่อง (`docs/device-qa.md`)
- [ ] อัปเดต `docs/CHANGELOG.md` + git tag

## 4. หมุน app_key
ตั้ง `APP_KEY` ใหม่ → ย้ายค่าเก่าไป `APP_KEY_PREV` (อยู่ได้ 1 วัน) → แก้ `site/config.json.app_key` → push → วันถัดไปล้าง `APP_KEY_PREV`

## 5. Rollback
- เว็บ (Pages): `git revert` commit ที่มีปัญหาแล้ว push `main`
- Apps Script: Manage deployments → เลือกเวอร์ชันก่อนหน้า (URL เดิม)
- ข้อมูล: Sheet → File → Version history
- ฉุกเฉิน: `settings.upload_enabled=FALSE` (ชั้น 1) หรือ Script Property `UPLOAD_ENABLED=false` (ชั้น 2) — ครูเวรยังแชร์เข้า LINE ได้

## ค่าที่ติดตั้งจริง (23 ต.ค. 69)
| รายการ | ค่า |
|---|---|
| Sheet ข้อมูล (สาธารณะ: ดูได้ด้วยลิงก์) | `1rObft7YnMoX0IRuOAGD72GocxPN9oneA4oePwDRIDuU` |
| Sheet log (ส่วนตัว) | `1eTqUCxeEA52UZlUN3JjanPPbtjPVRajOlojUhWtO_dA` |
| โฟลเดอร์ Drive "วันเพจครูเวร" | `1GBm5YU5MaA388XcyhUdMNHvHmpxfFm-x` |
| Apps Script โปรเจกต์ wanpage-uploader | `1XuRmmA5QMpQ53e8W4c4b5PqpebRVyjUbz9acmM-dtMqftYpapHxckYKE` |
| Web app /exec (deployment v1) | `https://script.google.com/macros/s/AKfycbwoPdmYEHRCV1qTrKt_zruRIeg5SJO5MvlpbaTCURzHmgF6LlFkcvhvpJGjXe4zUKXv/exec` |
| บัญชีเจ้าของ | dev.nathom@gmail.com |

APP_KEY อยู่ใน Script Properties และ `site/config.json` (ไม่ใช่ความลับจริง — กันบอทเท่านั้น หมุนได้ตามหัวข้อ "key หลุด")
การแก้ Apps Script: วางโค้ดทุกไฟล์ใน `apps-script/*.gs` (ยกเว้น appsscript.json) รวมกันในไฟล์เดียวได้ → บันทึก → การทำให้ใช้งานได้ → จัดการ → แก้ไข → เวอร์ชันใหม่ (URL เดิม)
