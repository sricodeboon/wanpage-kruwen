# วันเพจครูเวร — เอกสารออกแบบฉบับสมบูรณ์ (v2)

วันที่ 23 ต.ค. 2569 · ผู้ออกแบบ: Claude (Fable 5.1) · ผู้เขียนโค้ดต่อ: Opus 5.5 · เจ้าของงาน: ครูแจ็ก (ส.ต.ท.รัชเดช ศรีแก้ว)

เอกสารนี้เป็นฉบับสังเคราะห์จากร่าง `2026-10-23-wanpage-kruwen-design.md` (ร่างเดิม — **ข้อ 7 ของร่างเดิมเป็นข้อกำหนดตายตัว**) และแบบร่างทางเลือก 3 ฉบับที่ผ่านกรรมการแล้ว (ฉบับ "ครูเวรใช้ง่าย" ชนะ 1 เสียง, ฉบับ "ทนทาน/ดูแลคนเดียว" ชนะ 1 เสียง; กรรมการทั้ง 2 ชุดเห็นตรงกันเรื่องสถาปัตยกรรม) เอกสารนี้เลือกฉบับ "ครูเวรใช้ง่าย" เป็นโครงหลัก แล้วต่อกิ่งเรื่องความเร็ว/หน่วยความจำ (ฉบับ 1) และความปลอดภัย/การดูแลระยะยาว (ฉบับ 3) เข้ามาตามที่กรรมการระบุ จุดที่กรรมการขัดกันตัดสินไว้ในหัวข้อ 2.4

ละเอียดพอให้ Opus 5.5 วางแผนเขียนโค้ดได้โดยไม่ต้องถามครูแจ็กอีก ยกเว้นคำถามในหัวข้อ 16 (สั้น เรียงจากสำคัญสุด ทุกข้อมีค่าเริ่มต้นให้ถ้าครูไม่ตอบ)

---

## 0. สรุปสำหรับครูแจ็ก (อ่าน 1 นาที)

1. **ครูเวร**: แตะลิงก์ที่ปักหมุดในกลุ่ม LINE (ลิงก์ของโรงเรียนตัวเอง) → หน้าเว็บเปิดใน Chrome/Safari โรงเรียนถูกเลือกไว้แล้ว → ติ๊กครูเวร 1–3 คน → แตะช่องรูป 4 ช่อง (ถ่าย/เลือก รูปย่อทันที) → เลือกพื้นหลัง (เห็นภาพจริงของวันนี้เปลี่ยนตาม) → กด **รายงาน** → เห็นภาพเต็ม → กด **ส่งเข้า LINE** → เลือกกลุ่ม → ส่ง รวม ≤ 90 วินาที
2. **หลังบ้าน**: ภาพ PNG ถูกส่งเข้า Google Drive ของครูแจ็ก (โฟลเดอร์ต่อโรงเรียน) **เบื้องหลัง** ครูเวรไม่ต้องรอ ถ้าเน็ตหลุดเครื่องจะจำแล้วส่งเองรอบหน้า
3. **โฮสต์**: หน้าเว็บอยู่บน GitHub Pages (`https://sricodeboon.github.io/wanpage-kruwen/`) — ไม่ใช่ Apps Script web app ตามร่างเดิม เพราะ Apps Script ช้าตอนเปิดและหน้าถูกห่อใน iframe ที่ "แชร์ 1 แตะ" อาจพัง; Apps Script ยังใช้ แต่เป็นแค่ตัวรับไฟล์ลง Drive (หัวข้อ 2) — **นี่คือข้อเดียวที่ขอให้ครูยืนยัน**
4. **ค่าใช้จ่าย 0 บาท**: GitHub Pages + Google Sheet + Apps Script + Drive ของบัญชี dev.nathom
5. **ครูแจ็กแก้ข้อมูล** (ครู/เบอร์/ที่อยู่/ป้ายรูป) ใน Google Sheet แผ่นเดียว ไม่แตะโค้ด เห็นผลทันทีที่ครูเวรเปิดแอปครั้งถัดไป
6. **งานขั้นที่ 1** = พื้นหลัง 10 แบบชุดนครพนม (np-01..np-10 ที่ครูเริ่มทำไว้แล้วใน `assets/backgrounds/`) — หัวข้อ 11 มี prompt ที่แก้ให้จุดเด่นอยู่ต่ำพอ + ค่าแม่แบบ + สคริปต์ตรวจ (np-02 และ np-03 ที่มีอยู่ **ยังไม่ผ่าน** เกณฑ์จุดเด่น ต้องสร้างใหม่ ดู 11.6)

---

## 1. เจตนา ผู้ใช้ เป้าหมาย

### 1.1 เจตนา
ครูเวรประจำวันของโรงเรียน ตชด. ในสังกัด กก.ตชด.23 (11 โรงเรียน) ต้องส่ง "วันเพจ" (ภาพรายงานบรรยากาศและบริบทโรงเรียน + ครูเวรประจำวัน) เข้ากลุ่ม LINE ทุกวัน ปัจจุบันทำมือทีละวัน ช้าและหน้าตาไม่สม่ำเสมอ เป้าหมายคือครูเวรทำได้เองจากมือถือใน ≤ 2 นาที ได้ภาพคุณภาพเท่าต้นแบบที่ครูแจ็กอนุมัติ (`assets/reference/onepage-b-2026-10-23.png` (เก็บในเครื่องครูแจ็กเท่านั้น ไม่อยู่ใน git เพราะมีเบอร์โทรจริง) "เยี่ยมสวยงาม")

### 1.2 ผู้ใช้
| ผู้ใช้ | อุปกรณ์/บริบท | สิ่งที่ต้องการ |
|---|---|---|
| ครูเวร (~30–40 คน ใน 11 โรงเรียน) | Android ราคาถูก–กลาง (Samsung/Xiaomi/OPPO, RAM 2–4 GB) + iPhone บางส่วน · เปิดจากกลุ่ม LINE · 4G ไม่เสถียรในพื้นที่ชายแดน · ไม่ใช่สายเทคนิค | เสร็จเร็ว ไม่ต้องคิด ผิดโรงเรียน/ครู/วันที่ไม่ได้ ไม่ต้องจำวิธี |
| ครูแจ็ก (ผู้ดูแลคนเดียว) | Mac + มือถือ | แก้ข้อมูลใน Sheet, ดูภาพย้อนหลังใน Drive, เพิ่ม/เปลี่ยนพื้นหลังเอง, รู้เมื่อระบบมีปัญหาโดยไม่ต้องเฝ้า |

### 1.3 เป้าหมาย (Goals)
1. ลิงก์เดียว (+ ลิงก์รายโรงเรียน) ใช้ได้ทั้ง 11 โรงเรียน ไม่ต้องล็อกอิน
2. เลือกโรงเรียน → ติ๊กครูเวร 1–3 คนจากรายชื่อของโรงเรียนนั้น
3. วันที่ = วันนี้ (เวลาไทย) อัตโนมัติ แก้ได้ แสดง "23 ตุลาคม พ.ศ. 2569"
4. รูปใหม่ 4 ภาพ/วัน (ถ่าย/เลือกจากคลัง) ป้ายชื่อรูปไม่บังคับ
5. พื้นหลัง 1 ใน 10 แบบ พรีวิวสด
6. กด "รายงาน" → PNG 1536×2304 บนเครื่อง → Web Share → กลุ่ม LINE (ครูแตะเอง 1 แตะ)
7. เก็บเฉพาะ PNG สำเร็จลง Drive แยกโฟลเดอร์ต่อโรงเรียน
8. ข้อมูลหลักใน Google Sheet แผ่นเดียว ครูแจ็กแก้เอง

### 1.4 ไม่ทำ (Non-goals) รอบแรก
- บอท LINE / LIFF ส่งอัตโนมัติ · ระบบล็อกอิน · เก็บรูปต้นฉบับ · รายงานประเภทอื่น · แอป native · ลายน้ำ · โหมดมืด · ลากสลับรูป · เลือกจุดโฟกัสรูป · Service Worker (เลื่อนไประยะ 1.5) · อ่าน EXIF วันที่ถ่าย (ระยะ 2)

### 1.5 Anti-goals (ถือว่าล้มเหลวแม้ระบบทำงาน)
- ตัวหนังสือไทยเพี้ยน/สระลอย/วรรณยุกต์ซ้อนผิด — ข้อความทุกตัววาดด้วยฟอนต์ไทยจริง ห้ามให้ AI วาดตัวหนังสือ
- รูปถ่ายครูถูก AI วาดใหม่/ใส่ฟิลเตอร์ — ครอป cover เท่านั้น
- จุดเด่นของพื้นหลัง (องค์พระธาตุ ฯลฯ) ถูกรูป/กล่องทับ
- ค่าใช้จ่ายรายเดือน · ครูเวรต้องรอเซิร์ฟเวอร์ · ขั้นตอนเยอะจนไม่อยากใช้
- สีเขียวเด่นในพื้นหลัง (รูปถ่ายจริงมีต้นไม้ได้) · แถบสีขอบซ้ายใน UI · รูปทรงคล้ายสัญลักษณ์คนพิการ
- ไฟล์ซ้ำใน Drive จากการส่งซ้ำ · รูปดิบหลุดออกจากเครื่อง

### 1.6 ข้อจำกัด (Constraints)
- ฟรีทั้งหมด ใช้บัญชี/บริการที่มีอยู่: GitHub `sricodeboon`, Google `dev.nathom`, ChatGPT/Gemini สำหรับพื้นหลัง
- Apps Script เรนเดอร์ภาพฝั่งเซิร์ฟเวอร์ไม่ได้ → วาดบนเบราว์เซอร์ด้วย `<canvas>`
- Web app deploy "Execute as: Me / Anyone" ไฟล์ลง Drive ของครูแจ็ก (โควตา 15 GB ร่วมกับ Gmail/Photos)
- มือถือหน่วยความจำจำกัด → ย่อรูปทันทีที่เลือก (ด้านยาว 1600 px) ปล่อย bitmap
- Web Share แนบไฟล์ใช้ได้ใน Chrome Android / Safari iOS แต่ **ไม่มีใน Android WebView ของ LINE** → ต้องเด้งออกเบราว์เซอร์ภายนอก + ทางสำรอง
- เบอร์โทรครูต้องปรากฏบนภาพ (ตามต้นแบบ) จึงเป็นข้อมูลที่โพสต์ในกลุ่มอยู่แล้ว แต่ต้องไม่กระจายเกินจำเป็น (ไม่ใส่ใน snapshot สาธารณะในรีโป)

---

## 2. สถาปัตยกรรม (ทางเลือก A — กรรมการทั้ง 2 ชุดยืนยัน)

### 2.1 ภาพรวม
```
[กลุ่ม LINE] ปักหมุด: https://sricodeboon.github.io/wanpage-kruwen/?s=changkon8&openExternalBrowser=1
      │ LINE เปิดใน Chrome/Safari ภายนอก (openExternalBrowser=1)
      ▼
[หน้าเว็บ static — GitHub Pages, origin เดียวกับพื้นหลัง/ตรา/ฟอนต์]
  1. โหลด shell ≤ 200 KB → ฟอร์มพร้อมใช้ (ข้อมูลจาก localStorage ทันที)
  2. เบื้องหลัง: fetch Google Sheet (gviz CSV; สำรอง published CSV; สำรองสุดท้าย data/snapshot.json ในรีโป)
  3. เลือกรูป → ย่อทันทีเป็น JPEG blob ในหน่วยความจำ (ไม่เก็บที่ไหน)
  4. กดรายงาน → canvas 1536×2304 → PNG File (บนเครื่อง ≤ 3 วิ)
  5. กดส่งเข้า LINE → navigator.share({files:[png]}) → share sheet → ครูแตะกลุ่ม
  6. พร้อมกับ 5 (ไม่รอ): POST text/plain JSON{base64} → Apps Script /exec ; ล้มเหลว → คิว IndexedDB → ส่งซ้ำ
      ▼
[Apps Script web app — Execute as ครูแจ็ก / Anyone] doPost เท่านั้น
  ตรวจ key → kill switch → rate limit → PNG magic+IHDR → dedup report_id → DriveApp.createFile → append log
  doGet ?action=health (สถานะ) · trigger dailyAudit 06:00 → อีเมลเมื่อผิดปกติ/Drive ≥ 80%
      ▼
[Drive ครูแจ็ก] วันเพจครูเวร/{short_name}/วันเพจ_{short}_{YYYY-MM-DD}_{HHmm}.png
[Sheet "วันเพจครูเวร-ข้อมูล"] schools · teachers · photo_labels · settings (อ่านได้ด้วยลิงก์) · log (ระบบเขียน ไม่เผยแพร่)
```

### 2.2 หลักการ 6 ข้อ (ใช้ตัดสินทุกรายละเอียด)
1. **สิ่งที่ครูเวรต้องรอ ห้ามพึ่ง Apps Script** — Apps Script อยู่หลังปุ่มแชร์เท่านั้น
2. **ทุกไฟล์ที่ canvas วาด (พื้นหลัง ตรา ฟอนต์ ไอคอน) อยู่ origin เดียวกับหน้าเว็บ** → ไม่มี CORS/tainted canvas, cache ได้
3. **ผิดไม่ได้ > เตือน > แก้ได้** — ล็อกโรงเรียนจากลิงก์, ครูเฉพาะโรงเรียน, วันอนาคตเลือกไม่ได้, เตือนเมื่อไม่ใช่วันนี้, แก้ได้ทุกอย่างก่อนกดส่ง
4. **ทุกอย่างมีทางสำรองที่ทำงานเองตอนตี 5** — Sheet ล่ม → cache/snapshot; Drive ล่ม → ยังแชร์ได้ + คิว; share ไม่ได้ → บันทึกรูป
5. **ข้อมูลที่แก้บ่อยอยู่ใน Sheet; ของที่แก้นาน ๆ ครั้ง (ตรา พื้นหลัง แม่แบบ) อยู่ในรีโป** ชื่อไฟล์ติดเวอร์ชัน
6. **ไม่มี build step, ไม่มี framework, ไม่มี dependency runtime** — ครูแจ็กแก้ไฟล์เดียวผ่าน GitHub web ได้

### 2.3 ทางเลือกโฮสต์ที่ประเมิน (ตอบคำถาม "Apps Script บางทีช้ามาก")
| ทางเลือก | เปิดหน้า (4G ช้า) | แชร์ไฟล์ 1 แตะ | cache/offline | ครูรอ backend? | เขียน Drive ฟรี | ผล |
|---|---|---|---|---|---|---|
| **A. GitHub Pages + Sheet + Apps Script doPost เบื้องหลัง** | ครั้งแรก ~2–3 วิ, ถัดไป ≤ 1.5 วิ (HTTP cache; SW ระยะ 1.5) | ได้ (top-level HTTPS page) | ได้ | ไม่ | ได้ | **เลือก** |
| B. Apps Script HtmlService ล้วน (ร่างเดิม) | cold start 2–5 วิ (บางที 8) ทุกครั้ง; พื้นหลัง/ฟอนต์ต้องผ่าน base64 ใน HTML cache ไม่ได้ | **เสี่ยง** หน้าอยู่ใน iframe ข้ามโดเมนของ Google ที่เราใส่ `allow="web-share"` ไม่ได้ → Chrome ตอบ `NotAllowedError` (อนุมานจาก Permissions-Policy `web-share` default = self; ยืนยันใน T-00) | ไม่ได้ | รอทุกครั้ง | ได้ | ปฏิเสธ |
| C. InfinityFree PHP (`sricodeboon.infinityfreeapp.com`) | มี browser challenge (aes.js/`?i=1`) ปิดไม่ได้ → `fetch`/API/manifest พัง | ได้ถ้า HTTPS | ไม่แน่นอน | ไม่ | ต้องเก็บ Service Account key บนโฮสต์ที่ไว้ใจน้อย | ปฏิเสธ — ใช้ได้แค่หน้า redirect ลิงก์สั้น (ไม่ใช้ iframe) |
| D. Cloudflare Pages | ≈ A (PoP กรุงเทพ) | ได้ | ได้ | ไม่ | ได้ | **แผน B** ย้ายได้ใน 15 นาที (static ล้วน) ไม่เลือกเพราะต้องเปิดบัญชีใหม่ |
| E. Firebase/Supabase/Vercel | ครบเครื่อง | ได้ | ได้ | ไม่ | — | เกินจำเป็น ผูกบัตร/นโยบายเปลี่ยนได้ ขัดหลัก "ฟรีก่อน" |

bandwidth ของ A: ครั้งแรก ≈ 0.2 MB shell + พื้นหลังที่เลือก 0.4 MB (+ ทั้ง 10 แบบถ้าเลื่อนดูครบ ≈ 4 MB) → 40 เครื่อง × 5 MB × ล้าง cache 3 ครั้ง/เดือน < 1 GB/เดือน จาก soft limit 100 GB

### 2.4 จุดที่กรรมการ/แบบร่างขัดกัน — ตัดสินแล้ว
| เรื่อง | ทางเลือก | ตัดสิน | เหตุผล |
|---|---|---|---|
| สำเนาใน Drive | PNG (ข้อ 7) vs JPEG q0.9 (ฉบับ 1, 3) | **PNG เป็นค่าเริ่มต้น** + สวิตช์ `archive_mime` ใน config + อีเมลเตือนที่ 80% | เคารพข้อ 7; ตัวเลขโควตา (12.6) ให้ครูตัดสินภายหลังได้ทันเพราะมีเตือน |
| หน่วยพิกัดแม่แบบ | 1536 (ฉบับ 1, 2) vs 1024 + `ctx.scale(1.5)` (ฉบับ 3) | **1024 + scale 1.5** | ตัวเลขเท่ากับ prototype HTML ที่ครูอนุมัติทุกจุด ลดโอกาสแปลงพิกัดผิด; ค่า 1536 ระบุไว้ในวงเล็บ |
| รูปเล็กสูง | 230 (= ต้นแบบ) vs 213 (320/1.5 ฉบับ 2) | **230** (= 345 px) ผ่าน validator; แม่แบบไหนจุดเด่นสูงให้ override | กรรมการระบุให้คงต้นแบบ ×1.5 เป๊ะ |
| กล่องครูเวร 3 คน | กว้าง 684 (ฉบับ 2) vs 884 (ฉบับ 3) | **884** (x 70) | ยศ+ชื่อ-สกุลไทย 3 คอลัมน์ที่ 684 ย่อฟอนต์ถึงขั้นต่ำบ่อย |
| ฟอนต์ | Kanit+Prompt (ฉบับ 2) / Kanit+Sarabun (ฉบับ 3) / Kanit อย่างเดียว (ฉบับ 1) | **Kanit 500 + 700 เท่านั้น** (UI และภาพ) | ไฟล์น้อย โหลดเร็ว ต้นแบบใช้ฟอนต์ตระกูลเดียวกันทั้งภาพ |
| Service Worker | รุ่นแรก (ฉบับ 1) vs ไม่ทำ (ฉบับ 3) | **ระยะ 1.5** หลังผ่าน device QA; รุ่นแรกใช้ HTTP cache + ชื่อไฟล์ติดเวอร์ชัน | ลดความเสี่ยง cache ค้างสำหรับคนดูแลคนเดียว |
| LINE in-app | แผ่นเต็มจอ (ฉบับ 3) vs แถบ + ใช้ต่อได้ (ฉบับ 2) | **แถบด้านบน + ใช้ต่อได้** โดยปุ่มหลักกลายเป็น "บันทึกรูป" | ลิงก์ปักหมุดมี openExternalBrowser อยู่แล้ว กรณีนี้เป็นข้อยกเว้น |
| ลายน้ำ | ปิด/เปิด | **ไม่มีในรุ่นแรก** | ภาพราชการ ครูไม่ได้ขอ |
| EXIF วันที่ถ่าย | soft warning (ฉบับ 2) | **ระยะ 2** | ประโยชน์น้อย รูปจาก LINE/สกรีนช็อตไม่มี EXIF; ไม่เพิ่ม dependency |
| CSV | published (ฉบับ 2, 3) vs gviz (ฉบับ 1) | **gviz หลัก, published สำรอง** ตัดสินด้วยผล T-02 | gviz ไม่ติด cache 5 นาที; published มีเอกสารชุมชนมากกว่า |
| พื้นหลัง 10 แบบ | ธีม 10 แบบในร่างเดิม vs ชุดนครพนม np-01..10 ใน `assets/backgrounds/PROMPTS.md` ที่ครูเริ่มทำแล้ว (11:04 วันนี้ หลังร่าง) | **ใช้ชุด np-01..np-10** | เป็นงานล่าสุดของครู; ธีมเดิมทับซ้อนกัน 6/10; ชุด sn/mdh เป็นชุดที่ 2–3 ภายหลัง (คำถาม 16.3) |

---

## 3. ที่ครูแจ็กตัดสินแล้ว (ตายตัว — จากร่างเดิมข้อ 7 + บทสนทนา)

| เรื่อง | คำตอบ |
|---|---|
| ผู้ใช้ | ครูเวร รายงานรายวันจากมือถือ |
| โรงเรียน | 11 แห่ง เลือกจาก dropdown (ยังมีเมื่อเปิดลิงก์เปล่า) |
| ครูเวร | 1–3 คน ไม่บังคับจำนวน ต้องอย่างน้อย 1 เลือกจากรายชื่อโรงเรียนนั้น |
| รูป | ถ่ายใหม่วันนั้น อัปโหลด 4 ภาพ ไม่เก็บรูปดิบ |
| พื้นหลัง | 10 แบบ สไตล์เดียวกับ bg-01 (ไม่มีตัวหนังสือ กลางโล่ง ทิวทัศน์ล่าง แถบโค้งเข้มล่างสุด) ทำก่อนเป็นอันดับแรก |
| ส่ง LINE | กลุ่มเดียวทั้ง 11 โรงเรียน · กดแชร์เอง 1 แตะ ผ่าน share sheet · ฟรี ไม่มี LINE bot |
| เก็บไฟล์ | Drive แยกโฟลเดอร์ต่อโรงเรียน · เก็บเฉพาะ PNG วันเพจสำเร็จ |
| ดีไซน์ | ต้นแบบแบบ B (กล่องครูเวรล่างสุดบนแถบคลื่น) |
| ฟรี | ไม่มีโฮสต์/บริการเสียเงิน |
| กติกาภาพ | ไม่มีเขียวเด่น · ตัวหนังสือไทยฟอนต์จริง · รูปจริงห้าม AI วาดใหม่ · จุดเด่นห้ามถูกทับ · ไม่มีแถบสีขอบซ้ายใน UI |
| แพลตฟอร์ม | ร่างเดิม = Apps Script web app → **เอกสารนี้เสนอเปลี่ยนเป็นทางเลือก A** (คำถาม 16.1) |

---

## 4. การตัดสินใจของผู้ออกแบบ — ครูแจ็กแก้ได้

1. **ลิงก์รายโรงเรียน** `?s={school_id}&openExternalBrowser=1` ปักหมุดในกลุ่ม LINE (admin.html สร้างลิงก์+QR ให้ทั้ง 11); ลิงก์เปล่ายังมี dropdown
2. **ผลลัพธ์** 1536×2304 PNG; แม่แบบหน่วยออกแบบ 1024×1536 คูณ 1.5
3. **เลย์เอาต์รูป** ใหญ่ 1 (เต็มกว้าง) + เล็ก 3 แถวเดียว; รูปแรก = ใหญ่ สลับได้; ป้ายชื่อรูปไม่บังคับ (ค่าเริ่มต้นช่องใหญ่ไม่มีป้าย)
4. **กล่องครูเวร 3 รูปแบบ** ตามจำนวนครู (หัวข้อ 8.3)
5. **ฟอนต์** Kanit 500/700 self-host subset Thai+Latin; รอ `document.fonts.load` ด้วยสตริงไทยก่อนวาด; เลขอารบิก
6. **แม่แบบต่อพื้นหลัง** ใน `templates.json` (palette, landmark, band, overrides) + validator อัตโนมัติ
7. **สำเนา Drive = PNG** (สวิตช์ `archive_mime` เปลี่ยนเป็น JPEG q0.9 ได้โดยไม่แก้โค้ด)
8. **ชื่อไฟล์** `วันเพจ_{short_name}_{YYYY-MM-DD}_{HHmm}.png` (ค.ศ. ในชื่อไฟล์เพื่อเรียงใน Drive; บนภาพเป็น พ.ศ.) ส่งซ้ำวันเดียวกันไม่ทับ
9. **จำค่าบนเครื่อง** (localStorage): โรงเรียน, พื้นหลังต่อโรงเรียน, ชุดครูล่าสุด (เสนอ "ใช้ชุดเดิม" ไม่ติ๊กให้เอง), ส่งแล้ววันนี้เวลาใด
10. **ข้อมูล 3 ชั้น** localStorage → gviz CSV สด (เบื้องหลัง) → `data/snapshot.json` ในรีโป (ไม่มีเบอร์โทร; สร้างอัตโนมัติรายสัปดาห์)
11. **Apps Script = doPost เท่านั้น** พร้อม rate limit, ตรวจ PNG, dedup, kill switch 2 ชั้น, key หมุนได้, audit อีเมล
12. **คิวอัปโหลด IndexedDB** + ตัวกระตุ้น 4 จุด (เปิดแอป/online/visible/หลังแชร์) backoff 0 → 30 วิ → 5 นาที → ครั้งถัดไปที่เปิด
13. **พรีวิวสด** scale 0.25 ด้วย pipeline เดียวกับของจริง debounce 150 ms + guard เครื่องช้า
14. **Service Worker** ระยะ 1.5 (precache เขียนมือ, versioned filenames, toast "มีเวอร์ชันใหม่")
15. **UI** ม่วง/ทอง, ฟอนต์ฐาน 18 px, แตะ ≥ 52 px, ไม่มีแถบขอบซ้าย, เครื่องหมายถูกสีทองบนวงกลมน้ำเงิน (ไม่ใช้เขียว), ธีมสว่างเท่านั้น
16. **ไม่มี** ลายน้ำ, EXIF warning, ลบไฟล์อัตโนมัติ (retention ปิด `RETENTION_DAYS=0`)
17. **อีเมลแจ้งเตือน** dev.nathom@gmail.com
18. **ชื่อโฟลเดอร์ Drive** = `short_name` ภาษาไทย (เช่น `ช่างกล8`)

---

## 5. โครงรีโปและไฟล์

รีโป `github.com/sricodeboon/wanpage-kruwen` (public — จำเป็นสำหรับ Pages ฟรี; ไม่มีความลับในรีโป) · Pages จากโฟลเดอร์ `site/` ผ่าน GitHub Actions (`upload-pages-artifact`) เพื่อไม่นับโควตา build 10/ชม.

```
wanpage-kruwen/
├─ site/                         ← เผยแพร่
│  ├─ index.html                 หน้าเดียว lang=th, <meta name=robots content=noindex>, inline critical CSS
│  ├─ admin.html                 หน้าผู้ดูแล (static ไม่ลิงก์จากหน้าแรก): ตรวจข้อมูล · พรีวิว 10 แบบ · ลิงก์+QR · health · วัดพิกัด landmark
│  ├─ styles.css
│  ├─ app.js                     bootstrap + state machine
│  ├─ js/ data.js                โหลด CSV/snapshot/localStorage (SWR), parser RFC4180
│  │     thaidate.js             วันที่ไทย (pure)
│  │     layout.js               คำนวณกรอบ/ย่อฟอนต์/ตัดคำ/validate template (pure, ทดสอบใน Node)
│  │     render.js               renderOnePage(ctx, model, template, scale)
│  │     photos.js               เลือกไฟล์ → ย่อ → JPEG blob (EXIF orientation)
│  │     fonts.js                FontFace loader + รอ ready
│  │     share.js                canShare/share/fallback/ตรวจ LINE UA
│  │     upload.js               payload + fetch + IndexedDB queue + retry triggers
│  │     icons.js                Path2D ไอคอนป้าย 12 ตัว + หมุด + โทรศัพท์
│  ├─ config.json                SHEET_ID, URL CSV, upload_url, app_key, app_version, archive_mime, csv_timeout_ms
│  ├─ templates.json             แม่แบบพื้นหลัง (หัวข้อ 11.5)
│  ├─ data/snapshot.json         สำเนา schools/photo_labels/settings (ไม่มี teachers.phone)
│  ├─ assets/bg/np-NN.v1.webp    1536×2304 q82 ≤ 450 KB · assets/bg/thumb/np-NN.v1.webp 240×360 ≤ 15 KB
│  ├─ assets/logos/{school_id}.v1.webp  โปร่ง กว้าง ≤ 900 px (changkon8 2200×1568 → 900×641)
│  ├─ assets/fonts/kanit-500-thai.woff2 kanit-500-latin.woff2 kanit-700-thai.woff2 kanit-700-latin.woff2
│  └─ icons/ icon-192.png icon-512.png · manifest.webmanifest (display standalone, theme #3b1470)
├─ apps-script/ Code.gs Upload.gs Audit.gs TestData.gs appsscript.json   (.clasp.json ไม่ commit)
├─ tools/ check-bg.mjs make-bg.mjs snapshot.mjs validate-templates.mjs goldens.mjs subset-fonts.sh smoke-upload.sh
├─ tests/ unit/*.test.mjs  golden/{fixtures,expected}/
├─ .github/workflows/ pages.yml tests.yml snapshot.yml (cron จันทร์ 03:00 ICT + manual)
├─ assets/backgrounds/           ต้นฉบับ PNG จาก AI + PROMPTS.md + prompts.json (ของครู, ไม่ deploy)
├─ assets/reference/             ของเดิม
└─ docs/ specs/ RUNBOOK.md CHANGELOG.md bg-qa.md device-qa.md phase0-results.md
```

งบน้ำหนักจนฟอร์มพร้อมใช้ (brotli): html 6 KB · css 8 KB · js รวม ≤ 45 KB · snapshot 6 KB · ฟอนต์ 4 ไฟล์ ≈ 90–120 KB (preload) · ตรา 1 ไฟล์ ≈ 30 KB ⇒ **≤ 200 KB**; thumb 10 ไฟล์ ≈ 120 KB โหลดหลัง interactive (`loading=lazy`); พื้นหลังเต็มโหลดเมื่อแตะ (prefetch ตัวล่าสุดทันทีหลัง interactive)

dev dependencies เท่านั้น: `vitest`, `playwright`, `pixelmatch`, `sharp`, (`tesseract.js` ไม่บังคับ)

---

## 6. โมเดลข้อมูล (Google Sheet "วันเพจครูเวร-ข้อมูล")

แผ่นเดียว 5 แท็บ · แถว 1 = หัวคอลัมน์อังกฤษตามนี้ (โค้ดอ้างด้วย **ชื่อหัว** ไม่ใช่ลำดับ → เพิ่มคอลัมน์ไม่พัง) · แถวที่ช่องแรกขึ้นต้น `#` = คำอธิบาย ถูกข้าม · `active` รับ `TRUE/true/1/ใช่`

### 6.1 `schools`
| คอลัมน์ | ชนิด | ตัวอย่าง | กติกา |
|---|---|---|---|
| `school_id` | slug `[a-z0-9_]{2,24}` | `changkon8` | ห้ามเปลี่ยนหลังใช้ (ผูกกับลิงก์/ตรา/โฟลเดอร์/log); Data validation `=REGEXMATCH(A3,"^[a-z0-9_]+$")` |
| `short_name` | text ≤ 12 | `ช่างกล8` | ชื่อโฟลเดอร์/ไฟล์ Drive; ห้าม `/ \ : * ? " < > \|` |
| `name_full` | text ≤ 60 | โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8 | ป้ายโรงเรียนย่อฟอนต์ถึง 22 แล้วขึ้น 2 บรรทัด |
| `address` | text ≤ 70 | บ้านโนนอุดมดี ต.ดอนเตย อ.นาทม จ.นครพนม 48140 | |
| `logo_file` | text | `changkon8.v1.webp` | ไฟล์ใน `site/assets/logos/`; ว่าง = `_default.v1.webp` (ตรา บช.ตชด.) |
| `default_bg` | text | `np-01` | ต้องมีใน templates.json |
| `sort_order` | number | 1 | ลำดับ dropdown |
| `active` | checkbox | TRUE | FALSE ซ่อนจาก dropdown |
| `drive_folder_id` | text | (ระบบกรอก) | Apps Script สร้างแล้วเขียนกลับ; ลบค่าได้ถ้าย้ายโฟลเดอร์ |
| `today_count` | สูตร | `=COUNTIFS(log!C:C,A3,log!D:D,TEXT(TODAY(),"yyyy-mm-dd"))` | ไม่บังคับ ให้ครูแจ็กเห็นใครยังไม่ส่ง |

### 6.2 `teachers`
`teacher_id` (`changkon8-01`, unique, ใช้จำค่า/log) · `school_id` (validation จาก schools) · `display_name` (ยศ+ชื่อ-สกุล ตามที่ต้องการให้ขึ้นภาพเป๊ะ ≤ 32) · `phone` (Plain text; เว็บ normalize 10 หลักล้วน → `xxx-xxx-xxxx`; อย่างอื่นแสดงตามกรอก; ว่างได้ = ไม่แสดงไอคอนโทร) · `sort_order` · `active` (ครูย้าย → FALSE ไม่ลบแถว)

### 6.3 `photo_labels`
`label` (≤ 22 ตัวอักษร) · `icon` ∈ `building, field, farm, canteen, classroom, flag, walkway, library, kitchen, toilet, fence, camera` (ว่าง = camera) · `sort_order` · `active`
ค่าเริ่มต้น 10 แถว: อาคารเรียน/building · สนามกีฬา / พื้นที่กิจกรรม/field · แปลงเกษตรโรงเรียน/farm · โรงอาหาร/canteen · ห้องเรียน/classroom · กิจกรรมหน้าเสาธง/flag · ทางเดินอาคารเรียน/walkway · ห้องสมุด/library · บ้านพักครู/building · รั้วและบริเวณโรงเรียน/fence · ครูเวรพิมพ์เองได้ ≤ 24 ตัวอักษร (icon camera)

### 6.4 `settings` (key/value — ควบคุมเว็บโดยไม่ deploy)
| key | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| `notice_text` / `notice_level` | ว่าง / `info` | กล่องแจ้งบนหน้าแรก (`info`/`warn`) |
| `upload_enabled` | TRUE | FALSE = เว็บไม่ยิง doPost (ยังแชร์ได้) kill switch ชั้นที่ 1 |
| `min_app_version` | 1 | เว็บที่ cache เก่ากว่า → `location.reload()` ครั้งเดียว |
| `title_text` | รายงานภาพบรรยากาศและบริบทโรงเรียน | แถบหัวเรื่อง |
| `share_title` / `share_text_template` | วันเพจครูเวร / `วันเพจ {short_name} {date_th}` | ส่งเข้า share sheet (text ช่วยค้นในกลุ่ม) |
| `data_version` | 20261023 | ครูบวกเลขเมื่อแก้ข้อมูลสำคัญ → เว็บรู้ว่าต้องอัปเดต cache |

### 6.5 `log` (ระบบเขียน · ห้ามเผยแพร่)
`ts_iso, report_id, school_id, report_date, teacher_ids, teacher_names, template_id, template_version, app_version, file_id, file_url, bytes, mime, status(ok|dup|rejected|error), error, ua_short, ms` (ไม่มีคอลัมน์ IP — Apps Script ไม่ให้)

### 6.6 การอ่านจากเว็บ
- **หลัก (gviz)**: Sheet แชร์ "ทุกคนที่มีลิงก์: ดู" → `https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=schools` (4 แท็บ) ไม่ติด cache 5 นาที
- **สำรอง (published)**: ไฟล์ → เผยแพร่ไปยังเว็บ → ทีละแท็บ (**ห้ามเลือกทั้งเอกสาร** — จะเผยแพร่ log) → CSV → "เผยแพร่ซ้ำอัตโนมัติ" → 4 URL ใน `config.json.sheet_csv_published`
- T-02 ตัดสินว่าใช้ตัวไหนเป็นหลัก; โค้ดรองรับทั้งคู่ (ลอง gviz → ไม่ได้/ไม่ใช่ `text/csv` → published)
- **snapshot** `data/snapshot.json` สร้างโดย `tools/snapshot.mjs` (Action รายสัปดาห์ + manual): มี schools/photo_labels/settings และ teachers **ไม่มี phone** (ชื่อครูอยู่ได้เพราะอยู่บนภาพสาธารณะอยู่แล้ว; เบอร์ดึงสดเสมอแล้ว cache บนเครื่อง) → เปิดครั้งแรกแบบออฟไลน์จะเห็นชื่อครูแต่ไม่มีเบอร์ และปุ่มรายงานเตือน "ต่อเน็ตเพื่อโหลดเบอร์โทรครั้งแรก"

### 6.7 ข้อมูลบนเครื่องครูเวร
localStorage (คีย์ `wp.`): `data` {fetched_at, data_version, schools, teachers(+phone), labels, settings} · `school` · `bg.{school}` · `teachers.{school}` (ชุดล่าสุด) · `lastReport.{school}` {date, ts} · `clientId` (UUID)
IndexedDB `wanpage` store `pending`: `{report_id, created, school_id, report_date, teacher_ids, teacher_names, template_id, template_version, file_name, mime, blob, attempts, last_error, next_try}` — **Blob เดียวที่เก็บ = PNG สำเร็จ** ลบเมื่อส่งสำเร็จ; เก็บ ≤ 10 รายการ/7 วัน
**ไม่เก็บรูปถ่ายต้นฉบับหรือรูปย่อที่ไหนเลย** (อยู่ใน memory จนปิดหน้า)

---

## 7. หน้าจอและลำดับการใช้งาน (ครูเวร)

หน้าเดียว เลื่อนลง ความกว้างออกแบบ 360–430 px · สี `--p1:#3b1470 --p2:#5b2a9e --p3:#7d4bc4 --gold:#d9a93a --gold2:#f6d983 --paper:#f7f3fc` การ์ดขาว ขอบรอบ 1px `#e4dbf3` radius 16 · ฟอนต์ Kanit ฐาน 18 px · ปุ่ม/ช่องติ๊ก ≥ 52 px · คอนทราสต์ ≥ 4.5:1 · ไม่มีแถบสีขอบซ้าย · สถานะไม่พึ่งสีอย่างเดียว · `prefers-reduced-motion` ปิดแอนิเมชัน · `aria-live=polite` ที่ข้อความใต้ปุ่มรายงานและสถานะ Drive · ธีมสว่างเท่านั้น

### 7.0 เปิดหน้า (0 แตะ)
1. อ่าน `?s=` → ตรง school_id ที่ active → **ล็อกโรงเรียน**: หัวแสดงตรา + ชื่อย่อ + ลิงก์เล็ก "ไม่ใช่โรงเรียนนี้? เปลี่ยน" (เปิด dropdown) · ไม่มี `?s=` → `wp.school` → ไม่มีเลยจึงแสดง dropdown เต็ม 11 แห่ง (native `<select>` สูง 56)
2. ตรวจ UA `/ Line\//i` → แถบบนสุด "เพื่อส่งเข้า LINE ได้ในแตะเดียว เปิดใน Chrome/Safari" + ปุ่ม (href = URL ปัจจุบัน + `openExternalBrowser=1`) — ใช้งานต่อได้
3. ข้อมูล: `wp.data` ทันที (อายุ < 7 วัน) → fetch CSV เบื้องหลัง (AbortController 6 วิ) → ต่าง/`data_version` ใหม่กว่า → merge โดย id ไม่รีเซ็ตสิ่งที่ครูติ๊กอยู่ · ไม่มี cache และ fetch ล้ม → snapshot + ป้าย "ใช้ข้อมูลสำรอง (ไม่ได้ต่อเน็ต)"
4. `settings.min_app_version > config.app_version` → reload 1 ครั้ง; `notice_text` → กล่องแจ้ง
5. พรีโหลด: ฟอนต์ 4 ไฟล์ (preload + `document.fonts.load`) · ตรา · พื้นหลังล่าสุดเต็ม · thumb 10 (lazy)
6. `wp.lastReport.{school}` = วันนี้ → การ์ด "วันนี้ส่งแล้ว 07:42 ✓ — ส่งซ้ำได้ถ้าต้องแก้"
7. คิวค้างใน IndexedDB → `drainQueue()` เบื้องหลัง + แถบสถานะเล็ก "มีรายการรอส่งเข้า Drive n รายการ" (แตะเพื่อส่งซ้ำ)

### 7.1 ส่วน ① ครูเวรวันนี้
- หัว "① ครูเวรประจำวันที่" + วันที่ตัวใหญ่ 22 px หนา "พฤหัสบดี 23 ตุลาคม พ.ศ. 2569" + ปุ่มเล็ก "แก้วันที่" → `<input type=date>` `max=วันนี้`, `min=วันนี้−7` · ต่างจากวันนี้ → ป้ายส้ม "ไม่ใช่วันนี้" ติดตลอดทั้งฟอร์มและหน้ายืนยัน
- วันนี้ = `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'})` → `YYYY-MM-DD`; ข้อความไทยจาก `thaidate.js` (เดือนเต็ม, พ.ศ.=ค.ศ.+543, เลขอารบิก) ตัวเดียวกับที่วาดบนภาพ
- รายชื่อครูของโรงเรียนนี้เท่านั้น: การ์ดติ๊กสูง 56 (ชื่อ 18 px + เบอร์ 15 px เทาเข้ม) ติ๊กได้ ≤ 3 → คนที่ 4 ขึ้น "เลือกได้ไม่เกิน 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน" + ช่องที่เหลือ disabled · เลขลำดับ 1/2/3 ในวงกลมบนการ์ด (ลำดับบนภาพ = ลำดับที่ติ๊ก)
- มี `wp.teachers.{school}` → ชิป "ใช้ชุดเดิม: รัชเดช" แตะครั้งเดียวติ๊กให้
- ว่าง → ปุ่มรายงานบอก "เลือกครูเวรอย่างน้อย 1 คน"

### 7.2 ส่วน ② รูปถ่ายวันนี้ 4 ภาพ
- กริด: ช่อง 1 เต็มกว้าง (อัตราส่วน 932:282 เหมือนผลลัพธ์) ป้าย "ภาพใหญ่ (บนสุด)" + 3 ช่องเล็กแถวเดียว (297:230) ป้าย "ภาพเล็ก"
- แตะช่องว่าง → `<input type=file accept="image/*">` (**ไม่ใส่ `capture`** ให้มือถือเสนอทั้งถ่าย/คลัง; iOS ถามเอง) · ช่องแรกอนุญาต `multiple` → เติม 1→4 ตามลำดับ
- หลังเลือก: ย่อทันที (หัวข้อ 8.1) spinner ≤ 1 วิ → thumbnail (objectURL) + ปุ่ม "✕ เปลี่ยน" + ปุ่ม "⇄ สลับเป็นภาพใหญ่" (ช่องเล็ก; ย้าย blob ไม่ย่อใหม่)
- ป้ายชื่อรูป (ไม่บังคับ): chip "เพิ่มป้ายชื่อ" → bottom sheet รายการ `photo_labels` + "พิมพ์เอง" (≤ 24) — ไม่ใส่ให้อัตโนมัติ
- ไฟล์ไม่ใช่ภาพ/decode ไม่ได้ → "รูปนี้เปิดไม่ได้ ลองเลือกรูปอื่นหรือถ่ายใหม่" · > 25 MB → เตือนแต่ให้ลอง
- หัวส่วนมีป้าย "ถ่ายใหม่วันนี้" (คำเตือนเชิงกติกา ไม่ตรวจ EXIF รุ่นแรก)
- ไม่ครบ 4 → ปุ่มรายงานบอก "เลือกรูปอีก {n} ภาพ"

### 7.3 ส่วน ③ พื้นหลัง
- **พรีวิวสด** บนสุดของส่วนนี้: `<canvas>` 256×384 (วาด scale 0.25 ผ่าน `renderOnePage` เดียวกับของจริง) อัปเดตทุกการเปลี่ยน (ครู/วันที่/รูป/ป้าย/พื้นหลัง) debounce 150 ms · ยังไม่มีรูป = กรอบเทาอ่อน · **guard**: วาดเฉพาะเมื่อ `requestIdleCallback` ว่าง; ถ้าวาด 1 ครั้ง > 250 ms ติดกัน 3 ครั้ง (`performance.now()`) → สลับเป็นโหมด "แตะเพื่อดูตัวอย่าง" (ปุ่มเดียว ไม่วาดอัตโนมัติ) และจำไว้ใน `wp.lowPower`
- แถว thumb 10 แบบ เลื่อนแนวนอน snap, 96×144, ขอบทอง 3 px เมื่อเลือก + ชื่อสั้น + เลข; แตะ = เลือก + `prefetch` พื้นหลังเต็มของตัวที่เลือกและตัวซ้าย/ขวา
- ค่าเริ่มต้น `wp.bg.{school}` → `schools.default_bg` → `np-01`
- ปุ่ม "ดูภาพใหญ่" → overlay pinch-zoom (canvas scale 0.5)

### 7.4 ปุ่ม "สร้างภาพรายงาน" (sticky ล่าง)
สูง 60 เต็มกว้าง ม่วงไล่ทอง ตัว 20 px · ยังไม่ครบ = ปุ่มเทา + ข้อความใต้ปุ่มบอกสิ่งที่ขาด (ข้อแรก) แตะปุ่มเทา = เลื่อนไปส่วนที่ขาด · กด → overlay "กำลังสร้างภาพ… (ฟอนต์ ✓ รูป 4/4 ✓)" → เรนเดอร์เต็ม → `toBlob('image/png')` → `report_id = crypto.randomUUID()` → **เขียนลงคิว IndexedDB ทันที** (ก่อนแชร์) → หน้ายืนยัน

### 7.5 หน้ายืนยัน (`<dialog>` เต็มจอ)
- `<img src=objectURL>` (ไม่ใช่ canvas ใหญ่) ซูมได้ + แถบสรุป 3 บรรทัดตัวใหญ่: **โรงเรียน · ครูเวร (ชื่อเต็ม) · วันที่** (+ ป้ายส้มถ้าไม่ใช่วันนี้) + ขนาดไฟล์
- ปุ่มหลัก **"ส่งเข้า LINE"** (60) · ปุ่มรอง "บันทึกรูปลงเครื่อง" · ลิงก์ "แก้ไข" (กลับ ข้อมูลยังอยู่ report_id เดิมถูกแทนด้วยใหม่เมื่อสร้างใหม่ — รายการเก่าในคิวถูกลบถ้ายังไม่เริ่มส่ง)
- `navigator.canShare?.({files:[file]})` เป็น false (เช่นใน LINE Android) → ปุ่มหลักกลายเป็น "บันทึกรูปลงเครื่อง" + กล่อง 2 บรรทัด "เปิดลิงก์ใน Chrome จะส่งเข้า LINE ได้ในแตะเดียว" + ปุ่ม "เปิดใน Chrome"
- กด "ส่งเข้า LINE" → ในแตะเดียวกัน (user gesture): `startUpload()` (ไม่ await) แล้ว `await navigator.share({files:[file], title, text})` (ไม่ใส่ `url`)
  - resolve → หน้า "ส่งแล้ว ✓" + `wp.lastReport` + สถานะ Drive ("กำลังเก็บเข้า Drive… อย่าเพิ่งปิด" → "เก็บเข้า Drive แล้ว" / "จะเก็บเข้า Drive ให้ภายหลังอัตโนมัติ")
  - `AbortError` → กลับหน้ายืนยันเงียบ ๆ (upload ที่เริ่มแล้วปล่อยให้เสร็จ; กดใหม่ = report_id เดิม → server `dup` ไม่มีไฟล์ซ้ำ)
  - error อื่น → fallback บันทึกรูป + บันทึก debug
- "บันทึกรูปลงเครื่อง": Android/desktop `<a download>`; iOS → overlay ภาพเต็ม + "กดค้างที่รูป → บันทึกรูปภาพ → ไปกลุ่ม LINE → แนบรูป" (ภาพประกอบ 3 ช่อง) — บันทึกรูปก็เริ่ม upload เหมือนกัน

### 7.6 หน้า "ส่งแล้ว"
✓ ทองใหญ่ · "ส่งวันเพจวันที่ 23 ตุลาคม 2569 แล้ว ขอบคุณครับ" · ปุ่ม "ทำอีกครั้ง" (ล้างรูป คงครู/พื้นหลัง) · "ปิด" · เมนู ⋯: "โหลดข้อมูลใหม่", "แจ้งปัญหา" (copy ข้อความ debug 50 บรรทัดล่าสุด)

### 7.7 ถ้อยคำ (ภาษาคน ไม่มี error code โชว์ครูเวร)
| สถานการณ์ | ข้อความ |
|---|---|
| ยังไม่เลือกครู / เกิน | "เลือกครูเวรอย่างน้อย 1 คน" / "เลือกได้ไม่เกิน 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน" |
| รูปไม่ครบ / ไฟล์เสีย | "เลือกรูปอีก {n} ภาพ" / "รูปนี้เปิดไม่ได้ ลองเลือกรูปอื่นหรือถ่ายใหม่" |
| ออฟไลน์ตอนเปิด / ไม่มีข้อมูล | "ใช้ข้อมูลที่บันทึกไว้ในเครื่อง (ไม่ได้ต่อเน็ต)" / "ยังโหลดรายชื่อครูไม่ได้ ต่ออินเทอร์เน็ตแล้วแตะ ลองใหม่" |
| ฟอนต์ยังไม่มา | "กำลังโหลดฟอนต์… (ครั้งแรกต้องต่อเน็ต)" |
| ใน LINE | "เปิดใน Chrome/Safari เพื่อส่งเข้า LINE ได้ในแตะเดียว" |
| Drive ล้มเหลว (retry ได้) | "ส่งเข้า LINE แล้ว ส่วนการเก็บเข้า Drive จะลองใหม่ให้เองเมื่อต่อเน็ต" |
| Drive ปฏิเสธ (ไม่ retry) | "ส่งเข้า LINE แล้ว แต่เก็บเข้า Drive ไม่ได้ (รหัส {code}) ช่วยแจ้งครูแจ็ก" |
| วันที่ไม่ใช่วันนี้ | "ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง" |

### 7.8 State machine (app.js)
`boot → data(cached|fresh|snapshot) → form → rendering → confirm → sharing → done` · error states ไม่ไปหน้าพิเศษ ใช้ข้อความในที่ · ทุก transition ลง `console` + ring buffer 50 รายการ

---

## 8. ไปป์ไลน์รูปและการวาด

### 8.1 รูปถ่าย (photos.js) — ทำทันทีที่เลือก ไม่รอกดรายงาน
1. ตรวจ `file.type` ขึ้นต้น `image/` (HEIC ที่ iOS แปลงให้จะมาเป็น JPEG; ถ้าหลุดมา decode ล้ม → ข้อความ 7.7)
2. `createImageBitmap(file, {resizeWidth, resizeHeight, resizeQuality:'medium', imageOrientation:'from-image'})` ด้านยาว = **1600 px** (พอสำหรับช่องใหญ่ 1398×423 และเล็ก 446×345 ที่ scale 1 ไม่ upscale) · ไม่รองรับ option (Safari < 17) → fallback `<img>` + `decode()` + canvas ย่อ (Safari หมุนตาม EXIF เองตั้งแต่ iOS 13)
3. วาดลง canvas ชั่วคราว → `toBlob('image/jpeg', 0.85)` → `state.photos[i] = {blob, w, h, label, icon}` → `bitmap.close()` ทันที; canvas ชั่วคราวตั้ง 1×1 — **ไม่เก็บ ImageBitmap ค้าง** (เครื่อง 2 GB: 4 blob ≈ 2 MB รวม แทน bitmap 40 MB)
4. thumbnail ในฟอร์ม = `URL.createObjectURL(blob)` revoke เมื่อเปลี่ยน
5. ทำ **ทีละไฟล์** (ไม่ขนาน) คั่นด้วย `setTimeout 0` เมื่อเลือกหลายไฟล์
6. ตอนวาด: `createImageBitmap(blob)` → `drawImage` cover + clip → `close()` ทันทีหลังวาด
7. **โครงสร้างบังคับ**: `upload.js` ไม่มี API รับรูปดิบ; payload มีเฉพาะ PNG สำเร็จ (unit test ตรวจ)
เป้า: ย่อ 1 รูป 12 MP ≤ 0.8 วิ บน Android ราคาถูก

### 8.2 ระบบพิกัดและลำดับวาด (render.js)
- ภาพออก **1536×2304** · แม่แบบเขียนใน **หน่วยออกแบบ 1024×1536** (= prototype) · `ctx.scale(1.5,1.5)` ครั้งเดียว · ใช้ `OffscreenCanvas` ถ้ามี ไม่งั้น canvas ไม่ attach DOM · พรีวิวใช้ฟังก์ชันเดียว `renderOnePage(ctx, model, template, scale)` scale 0.25/0.5/1.5
- ลำดับ: พื้นหลัง (`drawImage` เต็ม 1024×1536) → ตรา → แถบหัวเรื่อง → ป้ายโรงเรียน → ที่อยู่ → รูปใหญ่ → รูปเล็ก 3 → ป้ายชื่อรูป → กล่องครูเวร
- `textBaseline='middle'`, `textAlign='center'`; **ไม่ใช้** `letterSpacing` (สระลอยบางเบราว์เซอร์) และ `ctx.filter` (Safari); เงาใช้ `shadowBlur/shadowColor` แล้วรีเซ็ต; จัดกลางแนวตั้งด้วย `actualBoundingBoxAscent/Descent` ให้วรรณยุกต์ไม่ชนขอบ
- หลังได้ Blob: canvas 1×1, ปล่อย bitmap ทุกตัว; พรีวิวใช้ `<img>`

องค์ประกอบคงที่ (หน่วยออกแบบ; ในวงเล็บ = px จริง):
| ส่วน | ตำแหน่ง/ขนาด | ฟอนต์ | หมายเหตุ |
|---|---|---|---|
| ตรา | กึ่งกลาง x, `top 12` (18), สูง ≤ 132 (198), กว้าง ≤ 320 (480) รักษาสัดส่วน | – | เงา `0 6 10 rgba(59,20,112,.33)` |
| แถบหัวเรื่อง | x 92–932 (w 840), y 152, h 76, r 38 | Kanit 700 **39** (58) ขาว เงา `0 2 4 #0006` | ไล่ p3→p1 แนวตั้ง, ขอบ gold 5, วงขาว `#fff8` 3, เงา `0 10 24 #3b147066`, เส้นทองซ้าย/ขวา 70×4 ที่ x 14/940; auto-fit ลดทีละ 1 ถึง 30 |
| ป้ายโรงเรียน | x 150–874 (w 724), y 240, h 54, r 27 ขาว ขอบ p3 3 | Kanit 700 **28** (42) p1 | auto-fit ถึง 22 → ยังเกิน 684 → 2 บรรทัด (h 80, ทุกอย่างใต้นี้เลื่อน `dy=26`) |
| ที่อยู่ | y 304 pill สูง 36 กว้างตามข้อความ+36 พื้น `#ffffffd9` | Kanit 500 **24** (36) p1 | หมุดแดง `#d6304a` 22×28 (Path2D) ซ้ายข้อความ gap 6; auto-fit ถึง 19 → 2 บรรทัด (h 64, `dy+=28`) |
| รูปใหญ่ | x 46, y 352, w 932, h 282, r 22 ขอบขาว 6 + วง p3 2 + เงา `0 12 26 #3b147055` | – | cover; focal แนวตั้ง 50% (แนวตั้ง) / 45% (แนวนอน) |
| รูปเล็ก ×3 | y 650, h **230** (345), w 297 (446), x = 46 / 363.5 / 681 (gap 20.5), r 22 ขอบเดียวกัน | – | ล่างสุด y 880 (1320) |
| ป้ายชื่อรูป | ซ้ายล่างของรูป offset 14,14; h 42; r 21; วงขาว 32 + ไอคอน p2; padding 6/18 | Kanit 700 **21** (31) ขาว | ไล่ p3→p1 ขอบ gold2 2; กว้างสุด = w−28 → ลดถึง 17 → ตัด "…"; ภาพใหญ่ h 46 ฟอนต์ 23 |
| กล่องครูเวร | 8.3 | | |
| จุดเด่นพื้นหลัง | `template.landmark` ว่างเสมอ — ไม่มี rect ใดตัด (validator) | | |

### 8.3 กล่องครูเวร 3 รูปแบบ (ล่างสุด บนแถบคลื่น)
ค่าร่วม: พื้นไล่ `palette.dutyTop → palette.dutyBottom` (np-01 = `#5b2a9ef2 → #2e0f5cf5`) ขอบ gold 4 + วงขาว `#fff6` 3, r 26, เงา `0 -6 22 #2e0f5c66` · หัวกล่อง "ครูเวรประจำวันที่ {d} {เดือน} พ.ศ. {yyyy}" Kanit 700 gold2 เงา `0 1 3 #0008` · ชื่อ/เบอร์ Kanit 700 ขาว · ไอคอนโทรทอง · `bottom = template.duty.bottom` (np-01 = 22) → y = 1536 − bottom − h

| ครู | กล่อง x / w / h (px จริง) | หัวกล่อง | เนื้อหา | auto-fit |
|---|---|---|---|---|
| 1 | 170 / 684 / **104** (255/1026/156) | 26 ที่ y+28 | แถวเดียว y+76: ชื่อ **29** · gap 34 · โทร 24 + เบอร์ **28** กึ่งกลาง | กว้าง > 640 → ลดทั้งคู่ถึง 22 → ยังเกิน → ชื่อบรรทัด 1 เบอร์บรรทัด 2 (h 126) |
| 2 | 120 / 784 / **118** (180/1176/177) | 26 ที่ y+26 | 2 คอลัมน์ (กว้าง 380 กึ่งกลางคอลัมน์) เส้นคั่นทอง 60% w2 h44 กลาง; ชื่อ **24** ที่ y+62, เบอร์ **22** ที่ y+92 | ชื่อลดถึง 19 |
| 3 | 70 / 884 / **120** (105/1326/180) | 24 ที่ y+26 | 3 คอลัมน์ (กว้าง 290, x 70+2 / +296 / +592) เส้นคั่น 2 เส้น; ชื่อ **22** ที่ y+60, เบอร์ **20** ที่ y+92 | ชื่อลดถึง 17 → ยังเกิน → ยศบรรทัดแรก ชื่อ-สกุลบรรทัดสอง (ชื่อ y+52/y+76, เบอร์ y+104, h 134) ไม่ตัดยศทิ้ง |

กติกา: กล่องสูงสุด 134 + bottom 22 → ขอบบน y 1380 ต้อง ≥ `template.band.top_y − 4`; validator เตือนถ้าแม่แบบใดแถบบางกว่า (ให้ลด `duty.bottom` หรือสร้างพื้นหลังใหม่)

### 8.4 ฟอนต์ไทย (fonts.js)
- Kanit 500/700 OFL subset ด้วย `pyftsubset` แยก `thai` (`U+0E00-0E7F,U+200B,U+2013,U+2014`) และ `latin` (`U+0020-007E,U+00A0`) 4 ไฟล์ ≈ 25–35 KB/ไฟล์ · `<link rel=preload as=font crossorigin>` · `@font-face` `font-display: swap` + `unicode-range`
- ก่อนวาดทุกครั้ง: `await Promise.all([document.fonts.load('700 39px Kanit','รายงานภาพ ปิ่น กู้'), document.fonts.load('500 24px Kanit','ที่อยู่ ญาติ ฐิติ')])` → `document.fonts.check` ทั้ง 2 น้ำหนักต้อง true → ไม่ผ่านใน 3 วิ → **ไม่วาด** แสดง "กำลังโหลดฟอนต์…" (anti-goal: ห้ามภาพฟอนต์ระบบหลุด)
- ไม่พึ่ง fonts.googleapis.com ตอนใช้งาน · `fillText` ทั้งสตริง ห้ามวาดทีละตัว · ทดสอบคำเสี่ยง: ปิ่น กู้ ป้ำ ญาติ ฐิติ ชื่อที่มี "ฺ" และเลข 0–9

### 8.5 วันที่ไทย (thaidate.js, pure)
`formatThaiDate('2026-10-23') → "23 ตุลาคม พ.ศ. 2569"` · `thaiWeekday` → "พฤหัสบดี" · `todayBangkok()` · `stampHHmm()` เวลาไทยสำหรับชื่อไฟล์

### 8.6 ผลลัพธ์
`toBlob(cb,'image/png')` → `File([blob], 'วันเพจ_ช่างกล8_2026-10-23_0742.png', {type:'image/png'})` คาด 3–5 MB · ถ้า `config.archive_mime === 'image/jpeg'` สร้าง blob ที่สอง `toBlob('image/jpeg',0.9)` สำหรับ Drive (ภาพแชร์ยังเป็น PNG) · ถ้า server ตอบ `TOO_LARGE` → ส่งใหม่เป็น JPEG q0.92 เฉพาะสำเนา Drive (ชื่อ `.jpg`)
เป้า (Android ราคาถูก): วาด ≤ 0.4 วิ · PNG encode ≤ 2.5 วิ · กดรายงาน→พรีวิว ≤ 3 วิ · memory แท็บ ≤ 250 MB

---

## 9. แชร์เข้า LINE และทางสำรอง (share.js)

```
เปิดหน้า: UA มี "Line/" → แถบ "เปิดใน Chrome/Safari" (+openExternalBrowser=1) ใช้ต่อได้
หน้ายืนยัน: f = PNG File
  navigator.canShare?.({files:[f]}) → ปุ่มหลัก "ส่งเข้า LINE"   else → ปุ่มหลัก "บันทึกรูปลงเครื่อง" + แนะนำเปิด Chrome
กด "ส่งเข้า LINE" (click handler ตรง = user activation):
  startUpload(report)                       // fire-and-forget
  try { await navigator.share({files:[f], title: settings.share_title, text: shareText}) ; done() }
  catch (e) { e.name==='AbortError' ? stay() : (debug(e), fallbackDownload()) }
หลัง share resolve/reject: drainQueue()     // iOS ระงับ fetch ระหว่าง share sheet
```
- ไม่ใส่ `url` (บางแอปแนบลิงก์แทนไฟล์) · `text` ใช้ค้นในกลุ่มได้ · ไม่ใช้ `line://msg/image/…` (จำกัดขนาด)
- ลิงก์ที่ปักหมุด **ต้องมี `openExternalBrowser=1` เสมอ** (admin.html สร้างให้พร้อม QR + ข้อความปักหมุด)
- ลิงก์สั้น (ไม่บังคับ): `sricodeboon.infinityfreeapp.com/wanpage/` = HTML `<meta refresh>` + JS redirect ไป Pages (**ห้าม iframe**)

---

## 10. บันทึกลง Drive (upload.js + Apps Script)

### 10.1 ฝั่งเว็บ
- `enqueue(report)` ทันทีหลังได้ PNG (7.4) → `drainQueue()` เริ่มเมื่อกดแชร์/บันทึกรูป
- `drainQueue()`: ทีละรายการเก่าสุดก่อน (ไม่ขนาน) · ข้าม `next_try` ในอนาคต · `settings.upload_enabled=FALSE` → ไม่ยิง แสดง "ปิดการบันทึก Drive ชั่วคราว"
- Request: `fetch(upload_url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload), redirect:'follow'})` + AbortController 90 วิ · base64 จาก `FileReader.readAsDataURL` ตัด prefix (ขนาด ×1.37)
- ผล: `ok:true` / `dup:true` → ลบรายการ + ✓ · network/timeout/parse ล้ม → `attempts++`, `next_try` = now + [0, 30 วิ, 5 นาที, ครั้งถัดไปที่เปิด] สูงสุด 8 ครั้ง/7 วัน แล้วแจ้งครูเวร "เก็บเข้า Drive ไม่สำเร็จ ช่วยแจ้งครูแจ็ก" + ปุ่มบันทึกรูป · `ok:false` ที่เป็น `BAD_KEY|DISABLED|INVALID|RATE_LIMIT|UNKNOWN_SCHOOL` → **ไม่ retry** (`RATE_LIMIT_MINUTE` = retry, 17.5) ลบรายการ แสดงข้อความ 7.7; `TOO_LARGE` → ส่งใหม่เป็น JPEG 1 ครั้ง; `DRIVE_ERROR` → retry
- **ตัวกระตุ้น**: เปิดแอป · `online` · `visibilitychange→visible` · หลัง share settle · แตะแถบสถานะ
- **CORS fallback**: ถ้าอ่าน response ข้ามโดเมนไม่ได้ (T-00) → `mode:'no-cors'` ส่งอย่างเดียว + หลัง 20 วิ `GET ?action=status&report_id=` (ตอบ `{ok, found, file_url}`) เพื่อยืนยัน
- ไม่ใช้ `keepalive`/`sendBeacon` (จำกัด 64 KB) → ปิดแท็บทันทีหลังแชร์ = ส่งรอบหน้า; หน้า "ส่งแล้ว" ขึ้น "กำลังเก็บเข้า Drive… อย่าเพิ่งปิด" + แถบความคืบหน้า (ปกติ 3–8 วิ)

### 10.2 สัญญา API
POST body (text/plain JSON):
```json
{ "v":1, "app_key":"wp_2026_xxxxxxxx", "report_id":"uuid", "school_id":"changkon8",
  "report_date":"2026-10-23", "teacher_ids":["changkon8-01"], "teacher_names":["ส.ต.ท.รัชเดช ศรีแก้ว"],
  "template_id":"np-01", "template_version":1, "app_version":3,
  "file_name":"วันเพจ_ช่างกล8_2026-10-23_0742.png", "mime":"image/png", "data_b64":"iVBORw0...",
  "ua":"Android Chrome 130" }
```
ตอบ (HTTP 200 เสมอ): `{ "ok":true, "file_id", "file_url", "dup":false, "ms":2300 }` หรือ `{ "ok":false, "error":"BAD_KEY|DISABLED|INVALID|RATE_LIMIT|RATE_LIMIT_MINUTE|TOO_LARGE|UNKNOWN_SCHOOL|DRIVE_ERROR", "message":"ไทยสั้น ๆ" }`
GET `?action=health` → `{ok, version, upload_enabled, storage_used_gb, storage_limit_gb, today_count}` · `?action=status&report_id=` → `{ok, found, file_url}` · endpoint **ไม่มี** action อ่าน/ลิสต์/ลบไฟล์

### 10.3 Apps Script (standalone, Execute as Me / Anyone; อัปเดต deployment เดิมเสมอเพื่อคง URL)
Script Properties: `SHEET_ID, ROOT_FOLDER_ID, APP_KEY, APP_KEY_PREV, UPLOAD_ENABLED=true, MAX_PER_SCHOOL_PER_DAY=8, MAX_TOTAL_PER_DAY=60, MAX_PER_MINUTE=6, MAX_BYTES=12000000, ALERT_EMAIL, ARCHIVE_ALLOWED_MIME=image/png,image/jpeg, RETENTION_DAYS=0, VERSION`
`appsscript.json`: `timeZone Asia/Bangkok`, webapp `ANYONE_ANONYMOUS / USER_DEPLOYING`, scopes `drive, spreadsheets, script.send_mail` (ต้อง `drive` เต็ม เพราะต้องเห็นโฟลเดอร์ที่ครูสร้างเอง)

ลำดับ `doPost` (ล้มข้อไหนตอบ error + log ทันที):
1. parse JSON, `v===1` → ไม่ผ่าน `INVALID`
2. `UPLOAD_ENABLED !== 'true'` → `DISABLED`
3. `app_key` ∈ {APP_KEY, APP_KEY_PREV} → ไม่ `BAD_KEY`
4. ฟิลด์: school_id regex + มีใน Sheet (`UNKNOWN_SCHOOL`); report_date ISO ห่างวันนี้ (ไทย) ≤ 7; report_id UUID; mime ∈ allowed; file_name regex `^วันเพจ_[^/\\:*?"<>|]{1,12}_\d{4}-\d{2}-\d{2}_\d{4}\.(png|jpg)$`; `data_b64.length ≤ MAX_BYTES×1.37` (`TOO_LARGE`)
5. Dedup: `CacheService.getScriptCache().get('rid:'+report_id)` → มี = `{ok:true,dup:true,file_id}`; ไม่มีใน cache (หมดอายุ 6 ชม.) → `TextFinder` ค้น report_id ในแท็บ log (คิวค้างข้ามวัน) → เจอ = dup
6. Rate limit ภายใต้ `LockService.getScriptLock().waitLock(10000)`: keys `rl:school:{id}:{date}`, `rl:all:{date}`, `rl:min:{YYYYMMDDHHmm}` ใน CacheService (ยอมรับว่าไม่อะตอมสมบูรณ์) → เกินโควตารายวัน `RATE_LIMIT` (ไม่ retry) · เกินโควตารายนาที `RATE_LIMIT_MINUTE` "ระบบกำลังคับคั่ง ลองใหม่อัตโนมัติ" (ชั่วคราว client retry ตามตาราง — ดู 17.5)
7. decode → ตรวจ magic: PNG `89 50 4E 47 0D 0A 1A 0A` + IHDR (bytes 16–23) = 1536×2304; JPEG `FF D8 FF` → ผิด `INVALID`
8. โฟลเดอร์: `drive_folder_id` → ว่าง/ไม่เจอ → ค้นชื่อ `short_name` ใต้ ROOT → สร้าง → เขียน id กลับ Sheet (ใต้ lock)
9. `folder.createFile(Utilities.newBlob(bytes, mime, file_name)).setDescription(JSON meta)` ไม่ตั้ง sharing
10. append log (ok) · cache rid 6 ชม. · ตอบ
11. exception → log error + `DRIVE_ERROR`; ข้อความมี `quota|storage` → อีเมลทันที (จำกัด 1/ชม.)

ความปลอดภัย (ยอมรับความจริง): `app_key` ในหน้าเว็บไม่ใช่ความลับ กันแค่ bot; กำแพงจริง = rate limit + ตรวจไฟล์ + ขนาด + `MAX_TOTAL_PER_DAY` (เสียหายสูงสุด ≈ 60×12 MB/วัน แล้ว audit เตือน) · หมุน key: ตั้ง APP_KEY ใหม่, ย้ายเก่าไป APP_KEY_PREV 1 วัน, แก้ config.json · kill switch 2 ชั้น (settings + Script Property) ปิดจากมือถือได้ · ไม่ตรวจ Origin/Referer (Apps Script ไม่ให้)

### 10.4 Trigger `dailyAudit()` 06:00 ไทย
นับ log 24 ชม. ต่อโรงเรียน + `DriveApp.getStorageUsed()/getStorageLimit()` → อีเมล `ALERT_EMAIL` เมื่อ rejected+error ≥ 5, ok ≥ 40, storage ≥ 80% (ทุกวันจนต่ำกว่า), (ถ้า `REPORT_MISSING=true`) โรงเรียน active ไม่ส่ง 3 วันทำการติด · สรุปรายสัปดาห์ทุกจันทร์ · `retentionSweep()` ทำงานเมื่อ `RETENTION_DAYS>0` (ย้ายลงถังขยะ กู้ได้ 30 วัน)

### 10.5 ทดสอบฝั่ง Apps Script
`test_doPost_valid / test_rejects_badKey / test_rateLimit / test_pngHeader / test_dedup` รันจาก editor ด้วย `doPost({postData:{contents}})` + PNG 1536×2304 พื้นเรียบ 100 KB ใน `TestData.gs` · `tools/smoke-upload.sh <exec>` curl `-L -H 'Content-Type: text/plain' --data-binary @payload.json` ตรวจ `ok:true` หลัง deploy ทุกครั้ง

---

## 11. พื้นหลัง 10 แบบ — brief, prompt, template (งานขั้นที่ 1)

### 11.1 สถานะปัจจุบัน (ตรวจ 23 ต.ค. 69)
ครูแจ็กเริ่มชุด "นครพนม" แล้วใน `assets/backgrounds/` (PROMPTS.md + prompts.json มี 30 prompt 3 จังหวัด, ไฟล์ np-01..03):
| ไฟล์ | ขนาด | ผลตรวจเบื้องต้น |
|---|---|---|
| np-01 (= bg-01 ต้นแบบ) | 1024×1536 | **ผ่าน** ยอดพระธาตุ y≈890 (58%), หัวนาค y≈1030, แถบเริ่ม y≈1375 |
| np-02 พระธาตุราตรี | 1024×1536 | **ไม่ผ่าน** ยอดพระธาตุ y≈795 (52%) สูงกว่าขอบล่างรูปเล็ก (880) → ถูกทับ; กลางโล่งดี |
| np-03 โขงยามเย็น+นาค | 1696×2528 | **ไม่ผ่าน** หัวนาค y≈49% · กลางภาพมีลายไทยจาง (ไม่โล่ง) · มุมบนดอกเฟื่องฟ้าลงถึง 21% ชนป้ายโรงเรียน · มีป้ายเล็กบนฐานอาจมีตัวอักษร |
บทเรียน: prompt ฐานเดิม "Bottom 35%" ให้จุดเด่นสูงถึง 49–52% → prompt ใหม่ (11.3) ระบุ **จุดสูงสุดของจุดเด่นต้องอยู่ต่ำกว่า 60%** และกลาง 15–60% ว่างเปล่าไม่มีลาย

### 11.2 ข้อกำหนดร่วม (หน่วยออกแบบ 1024×1536)
- สร้างที่ 1024×1536 (หรือ 2:3 ใหญ่กว่า) → `tools/make-bg.mjs` ย่อ/ขยายเป็น 1536×2304 ด้วย `sharp` lanczos3 (ไม่ใช้ AI upscaler ที่เติมรายละเอียด) → WebP q82 + thumb 240×360
- โครงเหมือน np-01: **บน 0–230 (0–15%)** ท้องฟ้า/ลาย + ของประดับ 2 มุมบน (ไม่ยื่นต่ำกว่า y 230 และไม่เข้ากลาง x 352–672 ซึ่งเป็นที่ตรา) · **กลาง 230–904 (15–59%)** โล่ง สีอ่อน ไล่โทนเรียบ ไม่มีลาย/วัตถุ (ค่าเฉลี่ยความสว่าง ≥ 215/255, std ≤ 14) · **ล่าง 904–1370 (59–89%)** ทิวทัศน์/จุดเด่น จุดสูงสุด ≥ y 904 จุดเด่นหลักอยู่ในกรอบ x 230–800 ไม่ถูกตัด · **แถบโค้งสีเข้ม y ≥ 1370–1536** เต็มกว้าง ขอบบนคลื่นเบา ๆ เส้นทองบาง ความสว่างเฉลี่ย ≤ 120 ทุกคอลัมน์ที่ y ≥ 1385
- ไม่มีตัวหนังสือ ตัวเลข โลโก้ ธงที่มีอักษร ป้าย กรอบ ลายน้ำ รูปถ่าย คน (ยกเว้นที่ระบุ: np-05 ไม่มีคน, ชุดนี้ไม่มีแบบการ์ตูน) · ไม่มีเขียวเด่น (hue 75–165° sat ≥ .25 ≤ 8% ทั้งภาพ, ≤ 15% โซนล่าง) ต้นไม้เป็นโทนม่วง/ทอง/น้ำเงินหมอก · ไม่มีรูปทรงคล้ายสัญลักษณ์คนพิการ
- **ตรวจอัตโนมัติ** `node tools/check-bg.mjs <png>`: สัดส่วน 2:3 · โซนกลางสว่าง/นิ่ง · แถบล่างเข้ม · สัดส่วนเขียว · หา y แรกที่โซนกลาง "มีวัตถุ" (std ต่อแถว > 20) ต้อง ≥ 904 → รายงาน `landmark.top_y` คาด · OCR tesseract.js (ถ้าติดตั้ง) ต้องไม่พบคำ ≥ 3 ตัวอักษร → ไม่ผ่านข้อใด = ไม่รับ + ครูดูตัวหนังสือแฝงด้วยตาที่ซูม 200%
- **วัดพิกัด** `admin.html` โหมด "วัด": วางพื้นหลัง + กรอบ overlay ของรูป/กล่อง คลิก 2 จุดได้กรอบ `landmark` และ `band.top_y` → ใส่ `templates.json`

### 11.3 Prompt ฐาน (ใช้กับ ChatGPT Images และ Gemini; ทำ 2–3 ตัวเลือก/แบบ)
```
Create a vertical portrait poster BACKGROUND only, aspect ratio 2:3 (1024x1536). Thai Isan school daily-report style, soft painterly-photographic, clean, elegant, print-ready.
STRICT LAYOUT (measure from the top):
- TOP 0–15%: {SKY} with delicate {CORNER} only in the top-left and top-right corners (no green leaves). Nothing hangs below 15%, and the top-center stays clear.
- MIDDLE 15%–60%: completely EMPTY — a smooth, very light {LIGHT} gradient. No pattern, no texture, no objects, no clouds with hard edges. This area will be covered by photos and text.
- BOTTOM 60%–89%: {SCENE}. The TALLEST point of the main landmark must stay below the 60% line (inside the bottom 40% of the image). The landmark is centered, fully visible, not cropped. Low horizon, gentle haze. Keep the extreme left and right edges soft.
- VERY BOTTOM 89%–100%: a dark {DARK} flowing curved wave band spanning the full width, with one thin shiny gold ribbon line along its top edge. The band is plain and dark enough for white text.
Colour theme: {THEME}. Absolutely NO text, NO letters, NO numbers, NO signs, NO logos, NO flags with lettering, NO frames, NO borders, NO watermark, NO photographs, NO people. Avoid any dominant green: render trees and grass in soft purple, blue-grey, gold or dusty tones.
```
(ประโยคท้ายซ้ำสำหรับเครื่องมือที่ไม่มี negative prompt: `Absolutely no text or lettering anywhere. Keep the middle 15%–60% empty. Landmark top below 60%.`)

### 11.4 บรีฟ 10 แบบ (ชุดนครพนม — ค่า landmark/band เป็น "คาด" จนกว่าจะวัดจากภาพจริง)
| id | ชื่อแสดง | {SKY} / {CORNER} / {LIGHT} | {SCENE} | {THEME} / {DARK} | palette p1 / p3 / gold · band | landmark คาด (1024 units) |
|---|---|---|---|---|---|---|
| np-01 | พระธาตุพนม ม่วงทอง | **มีแล้ว** (bg-01-phrathat-naga.png) | พระธาตุพนม + พญานาค + สะพานมิตรภาพ 3 + กล้วยไม้ม่วง | ม่วงทอง | #3b1470 / #7d4bc4 / #d9a93a · #4a1a8a | x 300–760 y 890–1375 (วัดแล้ว) |
| np-02 | พระธาตุราตรี น้ำเงินทอง | starry deep-navy night sky fading to pale blue / gold lotus flowers / pale blue-white | the golden Phra That Phanom stupa at night glowing with warm golden light, a few small floating lanterns low in the sky (below the 60% line), dark temple roofs and a calm reflecting courtyard | navy & gold / deep navy | #0f1f5c / #3457b8 / #e0b84c · #0b1740 | x 330–700 y 904–1375 (**สร้างใหม่**) |
| np-03 | โขงยามเย็น พญาศรีสัตตนาคราช | sunset sky orange→pink→violet, soft clouds / purple bougainvillea (small, corners only) / pale peach | the Mekong at sunset with the golden seven-headed Phaya Si Satta Nakharat naga statue on the Nakhon Phanom riverside seen from a distance, Laos mountains in violet, golden reflections; no signs or plaques | orange, pink & purple sunset / deep purple | #4a1a4f / #b3457c / #e0a43b · #3a1850 | x 300–760 y 904–1375 (**สร้างใหม่**) |
| np-04 | สะพานมิตรภาพ 3 ยามเช้า | clear sky blue with soft morning light / white orchids / very light blue | the Third Thai-Lao Friendship Bridge spanning the wide Mekong at sunrise, misty limestone mountains of Laos, calm water reflections, bridge towers kept low | sky blue & gold / royal blue | #123c7a / #3b7ddb / #d9a93a · #1d3a7a | x 0–1024 y 980–1375 (เตี้ย) |
| np-05 | ไหลเรือไฟ | midnight-blue night sky with soft fireworks far away / gold marigold garlands / pale lavender | several glowing illuminated fire-boats (Lai Ruea Fai) decorated with Buddhist lotus and naga patterns floating on the dark Mekong, warm reflections, no people on boats | midnight blue, gold & orange / midnight blue | #141a4d / #4a4fa8 / #f0b84a · #0d1238 | x 100–924 y 960–1375 |
| np-06 | พระธาตุเรณูนคร ผ้าภูไท | warm cream sky with faint gold light / pink lotus flowers / cream | Phra That Renu Nakhon stupa (white and gold, Lao style) with Phu Thai woven textile motifs as ornamental borders along the bottom band only, no lettering | red-maroon & gold / maroon | #5a0f1e / #b8324b / #d9a93a · #4a0f18 | x 330–700 y 904–1375 |
| np-07 | ริมโขง หอนาฬิกา | pastel blue-white sky, soft clouds / purple flowers / white | the Nakhon Phanom riverside promenade with the Indochina-style clock tower (clock face plain, no numerals), street lamps, Mekong and Laos mountains behind, evening light | pastel blue, white & gold / deep blue | #1b3a7a / #4d7fd0 / #d9a93a · #14306a | x 380–640 y 904–1375 (หอสูง — QA เข้ม) |
| np-08 | พระธาตุท่าอุเทน | white-gold sky with soft light rays / white frangipani / pale sky blue | Phra That Tha Uthen stupa (tall white and gold, Lao style) in a peaceful temple courtyard, small golden chedi at the sides, Mekong faint behind | white, gold & sky blue / navy | #16305f / #3f6fb8 / #d9a93a · #0f2247 | x 330–700 y 904–1375 (องค์สูง — QA เข้ม) |
| np-09 | ทะเลหมอกภูลังกา | lavender-pink dawn sky / pink flowers / misty white | a sea of morning mist over the Phu Langka mountain range at sunrise, layered purple mountains, a small golden Buddha statue on a cliff at the lower center, soft golden light | lavender, pink & gold / purple | #4a1d5e / #9a4fb8 / #e3b65a · #351445 | x 0–1024 y 1000–1375 (เตี้ย) |
| np-10 | มินิมอล ครีมทอง (ลายเส้น) | pale warm cream with a faint radial glow / thin gold floral line ornaments / ivory | minimal elegant thin gold line-art of Phra That Phanom and a naga on cream, subtle Thai pattern only inside the bottom scene, very low contrast | cream & gold minimal / deep gold-brown | #4a3414 / #8c6d4a / #c9a24a · #2b2118 | x 330–700 y 904–1375 |

ค่า palette อื่นทุกแบบ: `gold2 #f6d983` (np-05/06 ใช้ `#ffe08a`), `pillBg #ffffffd9`, `pillText = p1`, `dutyTop/dutyBottom` = p2 ที่ alpha f2 → สีแถบที่ alpha f5 (ตามสูตร np-01) · np-10 แถบหัวเรื่องขาวบนไล่น้ำตาลทองเข้ม คอนทราสต์ผ่าน
ทางหนีถ้าแบบใดไม่ผ่าน 3 รอบ: ลดความสูงจุดเด่น (ถ่ายจากไกลขึ้น) หรือย้ายไปใช้ `overrides` (11.5) ชั่วคราว; ชุดสกลนคร (sn) และมุกดาหาร (mdh) ใน PROMPTS.md เป็นชุดถัดไป เพิ่มได้โดยไม่แตะโค้ด

### 11.5 `templates.json` (schema)
```json
{ "schemaVersion": 1,
  "canvas": { "design": [1024, 1536], "output": [1536, 2304] },
  "common": {
    "logo":    { "top": 12, "maxH": 132, "maxW": 320 },
    "title":   { "x": 92, "y": 152, "w": 840, "h": 76, "font": 39, "minFont": 30 },
    "school":  { "x": 150, "y": 240, "w": 724, "h": 54, "font": 28, "minFont": 22 },
    "address": { "y": 304, "h": 36, "font": 24, "minFont": 19 },
    "photos":  { "main": { "x": 46, "y": 352, "w": 932, "h": 282 },
                 "small": { "y": 650, "h": 230, "w": 297, "xs": [46, 363.5, 681] },
                 "radius": 22, "border": 6, "minMainH": 240, "minSmallH": 170 },
    "label":   { "h": 42, "font": 21, "minFont": 17 },
    "duty":    { "bottom": 22,
                 "variants": { "1": { "x": 170, "w": 684, "h": 104 },
                               "2": { "x": 120, "w": 784, "h": 118 },
                               "3": { "x": 70,  "w": 884, "h": 120 } } } },
  "templates": [
    { "id": "np-01", "version": 1, "active": true, "name": "พระธาตุพนม ม่วงทอง",
      "file": "assets/bg/np-01.v1.webp", "thumb": "assets/bg/thumb/np-01.v1.webp",
      "palette": { "p1": "#3b1470", "p2": "#5b2a9e", "p3": "#7d4bc4", "gold": "#d9a93a", "gold2": "#f6d983",
                   "pillBg": "#ffffffd9", "pillText": "#3b1470", "dutyTop": "#5b2a9ef2", "dutyBottom": "#2e0f5cf5" },
      "landmark": { "x": 300, "y": 890, "w": 460, "h": 485, "note": "ยอดพระธาตุ+หัวนาค" },
      "band": { "top_y": 1375 },
      "overrides": {},
      "approvedAt": "2026-10-23" }
    /* np-02 .. np-10 โครงเดียวกัน; ค่า landmark/band จากการวัดจริง */
  ] }
```
- `overrides` deep-merge ทับ `common` ต่อแบบ เช่น `{"photos":{"small":{"h":200}}}`, `{"duty":{"bottom":30}}`, `{"palette":{"pillBg":"#ffffff"}}`
- `layout.js` คำนวณอัตโนมัติ: `smallH = min(common.small.h, landmark.y − 16 − small.y)`; ถ้า `< minSmallH` → ลด `mainH` (ขั้นต่ำ 240) แล้วเลื่อน small.y ขึ้น; ยังไม่พอ → **validator ล้ม** (แม่แบบใช้ไม่ได้ ต้องสร้างพื้นหลังใหม่) — ไม่ปล่อยให้ทับ
- `tools/validate-templates.mjs` (รันใน CI และก่อน deploy): schemaVersion; ไฟล์มีจริงและ 1536×2304; `small.y+smallH+16 ≤ landmark.y`; `1536 − duty.bottom − 134 ≥ band.top_y − 4`; ตรา (x 352–672, y 12–144) ไม่ชน corner ornament (ตรวจด้วย check-bg); ทุก rect อยู่ใน 1024×1536
- เปลี่ยนภาพ = ไฟล์ใหม่ `.v2.webp` + `version: 2` (log เก็บ `template_version`); เพิ่มแบบที่ 11 = เพิ่ม object; ซ่อน = `active:false`

### 11.6 ขั้นตอนผลิต (ทำซ้ำได้ — ลำดับงานขั้นที่ 1)
1. np-01: ใช้ไฟล์เดิม · np-02, np-03: **สร้างใหม่** ด้วย prompt 11.3+11.4 · np-04..10: สร้างใหม่ 2–3 ตัวเลือก/แบบ → บันทึก `assets/backgrounds/np-NN.png` (ต้นฉบับ > 5 MB เก็บใน Drive ไม่ commit)
2. `node tools/check-bg.mjs assets/backgrounds/np-NN.png` → ผ่านทุกข้อ + ครูดูตัวหนังสือแฝง → บันทึกผลใน `docs/bg-qa.md`
3. `node tools/make-bg.mjs` → `site/assets/bg/np-NN.v1.webp` + thumb
4. วัด `landmark`/`band.top_y` ใน admin.html โหมดวัด → `templates.json` → `node tools/validate-templates.mjs` ผ่าน
5. `node tools/goldens.mjs` → 10 แบบ × ครู 1/2/3 คน ด้วยข้อมูลช่างกลฯ 8 + รูปตัวอย่าง 4 ภาพ = 30 ภาพ → ครูแจ็กอนุมัติทีละแบบ (`approvedAt`) ก่อนเปิดใช้

---

## 12. งานผู้ดูแล (ครูแจ็ก) — RUNBOOK.md

| งาน | วิธี | มีผล |
|---|---|---|
| เพิ่ม/แก้/ปิดครู, เบอร์, ที่อยู่, ป้ายรูป | แก้ Sheet (มือถือได้) + บวก `data_version` | ครั้งถัดไปที่ครูเวรเปิดแอปแบบมีเน็ต (gviz ทันที; published ≤ 5 นาที) |
| เพิ่มโรงเรียน | แถวใน schools + อัปโหลด `site/assets/logos/{id}.v1.webp` ผ่าน GitHub web | Pages build 1–2 นาที |
| เปลี่ยนตรา | ไฟล์ชื่อใหม่ `.v2.webp` + แก้ `logo_file` | ทันที |
| เพิ่ม/เปลี่ยนพื้นหลัง | 11.6 → commit webp + templates.json + บวก `app_version` | หลัง build |
| แจ้งข่าว/ปิดระบบชั่วคราว | `settings.notice_text` / `upload_enabled` | ≤ 5 นาที |
| key หลุด/ไฟล์แปลก | หมุน key (10.3), ลบไฟล์ใน Drive, ดู log | 10 นาที |
| Drive ใกล้เต็ม (อีเมล 80%) | เลือก: ลบปีเก่า / ตั้ง `RETENTION_DAYS` / เปลี่ยน `archive_mime` เป็น JPEG | 10 นาที |
| แก้ Apps Script | editor หรือ `clasp push` → Manage deployments → Edit → New version (URL เดิม) → `smoke-upload.sh` | 3 นาที |
| ใครยังไม่ส่งวันนี้ | schools.`today_count` / อีเมลสรุป | — |
| สร้าง snapshot ด้วยมือ | Actions → snapshot → Run (หรือ `node tools/snapshot.mjs`) | 2 นาที |
| ย้ายโฮสต์ | Cloudflare Pages ชี้รีโปเดียวกัน โฟลเดอร์ `site` → แจ้งลิงก์ใหม่ | 15 นาที |
| ลิงก์+QR สำหรับปักหมุด | admin.html → "ลิงก์ 11 โรงเรียน" | — |

เวอร์ชัน: `config.json.app_version` (จำนวนเต็ม) บวกทุก deploy · `docs/CHANGELOG.md` · git tag · Apps Script `VERSION` ตอบใน health · `settings.min_app_version` บังคับ reload เมื่อแก้สำคัญ

### 12.6 โควตา Drive (ให้ครูตัดสินบนตัวเลข — คำถาม 16.2)
| สำเนา Drive | ขนาด/ไฟล์ | ต่อปี (11 รร. × 200 วันเรียน) | 15 GB พอกี่ปี (สมมติว่าง 10 GB) |
|---|---|---|---|
| **PNG (ค่าเริ่มต้นตามข้อ 7)** | 3–5 MB | 6.6–11 GB | ~1–1.5 ปี → อีเมลเตือนที่ 80% แล้วค่อยเลือก |
| JPEG q0.9 | 0.5–0.8 MB | 1.1–1.8 GB | ~6–9 ปี |
| PNG + retention 400 วัน | 3–5 MB | คงที่ ~9 GB | ตลอดไป ย้อนดูได้ 1 ปี |
ภาพที่แชร์เข้า LINE เป็น PNG ทุกกรณี; สวิตช์ `archive_mime` เปลี่ยนได้โดยไม่แก้โค้ด · ไฟล์ที่ "Me" สร้างนับโควตาของครูแจ็กเสมอ (บัญชีสำรองต้อง deploy สคริปต์ใต้บัญชีนั้น)

---

## 13. การทดสอบ

### 13.1 Phase 0 — smoke test วันแรก ก่อนเขียน UI (~2 ชม.; ผลลง `docs/phase0-results.md`)
- **T-00 share+upload**: หน้า HTML 40 บรรทัดบน Pages วาด canvas 1536×2304 (Kanit self-host + ข้อความไทย) → ปุ่มแชร์ → Android Chrome + iPhone Safari: share sheet เปิด, LINE รับไฟล์ PNG 4 MB · POST base64 7 MB ไป doPost → `ok:true` + ไฟล์ใน Drive + อ่าน response ข้ามโดเมนได้? (ไม่ได้ → ใช้ no-cors+status) · **หน้าเดียวกันผ่าน HtmlService** เพื่อบันทึกหลักฐานเรื่อง iframe/web-share (เหตุผลไม่ใช้ pure Apps Script) · วัดขนาด PNG/JPEG จริงของภาพที่มีรูปถ่าย 4 ใบ (ประกอบคำถาม 16.2)
- **T-01 LINE in-app**: เปิดลิงก์จากข้อความในกลุ่ม ทั้ง 2 OS: UA detection, `openExternalBrowser=1` เด้งออกจริง, พฤติกรรม share/บันทึกรูปเมื่อไม่ใส่ param
- **T-02 CSV**: gviz และ published fetch จาก github.io (CORS, `Content-Type`), เวลา 10 ครั้ง, แก้ Sheet แล้วจับเวลาจนเห็นค่าใหม่ → เลือกตัวหลัก
- **T-03 iPhone**: HEIC จากคลัง → เป็น JPEG? · ถ่ายแนวตั้ง/หมุน 4 ทิศ → ภาพใน canvas ถูกทิศ · `createImageBitmap` + `imageOrientation` ใน Safari เวอร์ชันในพื้นที่
- **T-04 memory**: Android RAM 2–3 GB เลือก 12 MP 4 รูปติดกัน + เรนเดอร์ ไม่ค้าง/ไม่รีโหลดแท็บ

### 13.2 Unit (vitest, Node)
`thaidate` (ปี พ.ศ., 12 เดือน, อธิกสุรทิน, 23:30 UTC = วันถัดไปไทย) · `csv` (quoted comma, `""`, CRLF/BOM, แถว `#`, active, ครู school_id ไม่มี → ข้าม, phone normalize) · `layout` (auto-fit ชื่อ 32 ตัว×3, โรงเรียน 60 ตัว → 2 บรรทัด+dy, ที่อยู่ยาว, ป้ายยาว, 1/2/3 คน, smallH อัตโนมัติ, validate templates ทั้งไฟล์ loop 10 แบบ) · `upload` (payload ตรง schema และไม่มีฟิลด์รูปดิบ; mock fetch: network error เข้าคิว, `ok:false` ไม่ retry, `dup` = สำเร็จ, `TOO_LARGE` → JPEG 1 ครั้ง; fake-indexeddb) · `measureText` stub = ตัวอักษร × 0.55 × font

### 13.3 Golden-image (Playwright Chromium headless, Action ทุก push)
fixtures: ตรา changkon8, รูป 4 ใบ (แนวนอน/แนวตั้ง/สี่เหลี่ยม/EXIF หมุน), ครู 1/2/3 (รวมชื่อยาวสุด) × 10 พื้นหลัง = 30 ภาพ + 3 เคสขอบ (ป้ายยาว, ที่อยู่ 2 บรรทัด, ไม่มีเบอร์) · `pixelmatch` threshold 0.1, ต่าง ≤ 0.5% · อัปเดต golden ตั้งใจด้วย `npm run goldens:update` + ดู diff ใน PR · golden ชุดแรก = ชุดที่ครูอนุมัติ

### 13.4 บนเครื่องจริง (`docs/device-qa.md` ก่อนปล่อย + ทุกครั้งที่แก้ render/share)
Android Chrome (Samsung กลาง) · Android Chrome (Xiaomi/OPPO RAM ≤ 3 GB) · Samsung Internet · iPhone Safari (iOS 16+) · LINE in-app ทั้ง 2 OS · Slow 4G throttling · โหมดเครื่องบินกลางทาง
ต้องผ่าน: เปิดครั้งแรก ≤ 3 วิ จนเลือกได้, ครั้งถัดไป ≤ 1.5 วิ · รูปไม่กลับหัว · รายงาน→พรีวิว ≤ 3 วิ · ตัวหนังสือไทยถูกทั้ง 30 ภาพ · กล่องไม่ทับจุดเด่น · แชร์เข้ากลุ่มได้ไฟล์ PNG 1 ครั้ง ไม่ซ้ำ · ยกเลิกแชร์ไม่พัง · ปิดเน็ตก่อนแชร์ → บันทึกรูปได้ เปิดเน็ตแล้วเปิดแอป → Drive ได้ 1 ไฟล์ + log 1 แถว · Apps Script ช้า 60 วิ (`Utilities.sleep`) → UI ไม่รู้สึก · ส่งซ้ำวันเดียวกัน → 2 ไฟล์ชื่อต่าง · ปิด Apps Script ทั้งตัว → ยังแชร์ได้ + สถานะชัด · ทดสอบกับครูเวรจริง 2 คน (Android+iPhone) โดยไม่สอน จดจุดลังเล · รวม ≤ 90 วิ แตะ ≤ 15 ครั้ง

### 13.5 เป้าหมายตัวเลข (Slow 4G, Android ราคาถูก)
| ตัวชี้วัด | เป้า |
|---|---|
| โหลดครั้งแรกถึงใช้งานได้ | ≤ 3.0 วิ (≤ 200 KB) |
| โหลดครั้งถัดไป | ≤ 1.5 วิ (HTTP cache) → ≤ 1.0 วิ เมื่อมี SW |
| ย่อรูป 12 MP ต่อรูป | ≤ 0.8 วิ |
| กดรายงาน → พรีวิว | ≤ 3.0 วิ |
| กดแชร์ → share sheet | ≤ 0.5 วิ |
| อัปโหลด Drive สำเร็จภายใน 24 ชม. | ≥ 99% (ไม่มีผลต่อครู) |
| หน่วยความจำสูงสุดของแท็บ | ≤ 250 MB |

---

## 14. Deploy (ครูแจ็กทำเอง เรียงลำดับ) และ Rollback

**A. Google (10 นาที)** 1) สร้าง Sheet จาก `docs/sheet-template/*.csv` กรอก 11 โรงเรียน+ครู · แชร์ "ทุกคนที่มีลิงก์: ดู" (+ เผยแพร่ 4 แท็บเป็น CSV ถ้า T-02 ต้องใช้) 2) โฟลเดอร์ Drive "วันเพจครูเวร" → id 3) script.google.com → โปรเจกต์ "wanpage-uploader" วาง `apps-script/*` → Script Properties (APP_KEY = `wp_2026_` + `openssl rand -hex 8`) → Run `setup()` ครั้งเดียว (สิทธิ์ + trigger + ตรวจโฟลเดอร์) → Deploy Web app · Me · Anyone → URL `/exec` 4) `tools/smoke-upload.sh <exec>` → `ok:true` + ไฟล์ทดสอบใน Drive
**B. GitHub (10 นาที)** 5) รีโป `sricodeboon/wanpage-kruwen` public → push 6) `site/config.json` (SHEET_ID, CSV URLs, exec URL, app_key, app_version 1) 7) Settings → Pages → Source: GitHub Actions → `pages.yml` → `https://sricodeboon.github.io/wanpage-kruwen/` · Actions variable `SHEET_ID` สำหรับ snapshot.yml 8) เปิดบนมือถือทดสอบ 13.4 กับช่างกลฯ 8
**C. ส่งมอบ (5 นาที)** 9) (ไม่บังคับ) หน้า redirect InfinityFree 10) admin.html → ลิงก์+QR 11 โรงเรียน → โพสต์ในกลุ่ม LINE พร้อมคำแนะนำ 3 บรรทัด + ภาพคู่มือ 1 หน้า + "ถ้ากดแชร์ไม่ขึ้น ให้กด เปิดในเบราว์เซอร์" → ปักหมุด 11) ปล่อยใช้จริง 1 โรงเรียน 3 วัน → ทั้ง 11
**Rollback**: Pages = revert commit; Apps Script = Manage deployments → เวอร์ชันก่อน (URL เดิม); ข้อมูล = Sheet version history
**Release checklist ทุกครั้ง**: บวก `app_version` · validate-templates ผ่าน · unit+golden ผ่าน · smoke-upload ผ่าน · ทดสอบ Android 1 เครื่อง · CHANGELOG

### ลำดับงานสำหรับ Opus 5.5
ขั้น 1 พื้นหลัง 10 แบบ (11.6) + check-bg + make-bg + templates.json + goldens → ครูอนุมัติ 30 ภาพ → ขั้น 2 Phase 0 (T-00..T-04) → ขั้น 3 thaidate/csv/layout/render + unit tests + validate-templates → ขั้น 4 index.html ครบ flow (photos/fonts/พรีวิวสด/ยืนยัน) ทดสอบแชร์ 3 เครื่อง → ขั้น 5 data.js + Sheet + snapshot Action → ขั้น 6 Apps Script (doPost/health/audit/tests) + upload.js คิว → ขั้น 7 admin.html + ลิงก์/QR + คู่มือ 1 หน้า → ขั้น 8 golden CI + device QA + RUNBOOK → deploy → ขั้น 9 (ระยะ 1.5) Service Worker precache เขียนมือ

---

## 15. ที่ปล่อยให้ผู้สร้าง (Opus 5.5) ตัดสิน
- รายละเอียด CSS/สถานะ UI ภายใต้กติกาหัวข้อ 7 · โครงภายในของ state machine · รูปแบบ Path2D ของไอคอน 12 ตัว · วิธี subset ฟอนต์ (pyftsubset หรือ glyphhanger) · ใช้ `clasp` หรือ copy-paste · รายละเอียด `pages.yml`/`tests.yml` · วิธี stub canvas ใน Node สำหรับ layout tests · ถ้อยคำคู่มือ 1 หน้า · เกณฑ์ตัวเลขใน check-bg ปรับได้หลังลองกับภาพจริง (ค่าในเอกสารเป็นค่าตั้งต้น) · ถ้า T-00 พบว่า `OffscreenCanvas` ช้ากว่า canvas ธรรมดาบน Android ให้เลือกตัวที่เร็วกว่า

---

## 16. คำถามที่ต้องให้ครูแจ็กตัดสิน (เรียงจากสำคัญสุด — ถ้าไม่ตอบ ผู้สร้างใช้ค่าเริ่มต้นได้เลย)

1. **ยืนยันเปลี่ยนแพลตฟอร์ม** จาก "Apps Script web app" (ข้อ 7 ร่างเดิม) เป็น **GitHub Pages (sricodeboon) + Apps Script เฉพาะรับไฟล์ลง Drive** — ข้อเดียวที่ขัดข้อ 7 จริง (เหตุผล 2.3) · ค่าเริ่มต้น: **ใช่**
2. **สำเนาใน Drive**: PNG ตามที่ตัดสินไว้ (เต็ม ~1–1.5 ปี แล้วอีเมลเตือนที่ 80% ให้เลือกใหม่) หรือ JPEG q0.9 ตั้งแต่แรก (อยู่ได้ 6–9 ปี) — ภาพในกลุ่ม LINE เป็น PNG ทั้งคู่ · ค่าเริ่มต้น: **PNG**
3. **ชุดพื้นหลัง 10 แบบแรก = ชุดนครพนม np-01..np-10** ตาม `assets/backgrounds/PROMPTS.md` ที่ครูเริ่มทำ (ไม่ใช่ธีม 10 แบบในร่างเดิม; ชุด sn/mdh เพิ่มทีหลัง) และยอมรับว่า **np-02/np-03 ต้องสร้างใหม่** เพราะจุดเด่นสูงเกินจนรูปเล็กทับ · ค่าเริ่มต้น: **ใช่**
4. **ลิงก์ปักหมุดรายโรงเรียน** `?s=ID&openExternalBrowser=1` ในกลุ่ม LINE (11 ลิงก์ + QR; ลิงก์เปล่ายังมี dropdown) — เปลี่ยนวิธีแจกลิงก์ · ค่าเริ่มต้น: **ใช่**
5. **Google Sheet อ่านด้วยลิงก์สาธารณะ** (เบอร์ครูอ่านได้ถ้ารู้ URL — ชุดเดียวกับที่อยู่บนภาพในกลุ่ม; snapshot ในรีโปไม่มีเบอร์) ยอมรับหรือไม่ · ค่าเริ่มต้น: **ยอมรับ**

---

## 17. อัปเดตหลังครูแจ็กตัดสิน (23 ต.ค. 69 บ่าย) — **มีผลเหนือหัวข้อก่อนหน้าที่ขัดกัน**

### 17.1 คำตอบคำถามหัวข้อ 16
| เรื่อง | ครูแจ็กตัดสิน |
|---|---|
| โฮสต์ | **ยืนยัน** GitHub Pages + Apps Script เฉพาะ doPost บันทึก Drive เบื้องหลัง |
| Sheet | **เปิดลิงก์สาธารณะ (ดูได้)** สำหรับ schools/teachers/photo_labels/settings — **แต่ log ต้องย้ายไป Spreadsheet ส่วนตัวแยก** (`LOG_SHEET_ID` ใน Script Properties) เพราะสิทธิ์ดูระดับไฟล์ครอบคลุมทุกแท็บ; `today_count`/`last_report_ts` ให้ Apps Script เขียนกลับใน `schools` แทนสูตรอ้าง log |
| ผู้ติดตั้ง | **Claude ทำใน Chrome ที่ครูล็อกอิน** (สร้าง Sheet, โฟลเดอร์ Drive, deploy Apps Script, สร้างรีโป public sricodeboon/wanpage-kruwen + เปิด Pages); ขั้นยืนยันสิทธิ์ OAuth ของ Google ครูกดเอง |
| เลย์เอาต์รูป 4 ภาพ | **ขึ้นกับแม่แบบแต่ละพื้นหลัง** — `templates.json` ต้องมีฟิลด์ `photo_layout` ∈ {`1+3`, `2x2`, `2+2`} พร้อมพิกัดช่องรูปของแม่แบบนั้น; render.js/validator/golden รองรับทั้ง 3 แบบ; ค่าเริ่มต้น `1+3` |
| Drive | คง PNG (ค่าเริ่มต้นเดิม) + สวิตช์ `archive_mime` |

### 17.2 พื้นหลัง: 30 แบบ แยกตามจังหวัด (แทนหัวข้อ 11 ที่มีแค่ชุดนครพนม)
- โรงเรียนอยู่จังหวัดไหน **ใช้ได้เฉพาะพื้นหลังของจังหวัดนั้น**: เพิ่มคอลัมน์ `province` ∈ {`np`,`sn`,`mdh`} ใน `schools`; picker แสดงเฉพาะ `bg.province == school.province` (10 แบบ)
- ไฟล์: `np-01..10`, `sn-01..10`, `mdh-01..10`; `templates.json` มีฟิลด์ `province`
- **ต้องเป็นสถานที่ที่มีอยู่จริงในจังหวัด** วาดด้วย AI โดยแนบภาพถ่ายจริงเป็นแบบ (Wikimedia Commons, เครดิตใน `assets/refs/CREDITS.tsv`) — ห้ามสถานที่สมมติ/ทั่วไป; ภาพเดียวรวมหลายจุดเด่นได้แบบ np-01 (ครูยกตัวอย่างนครพนม: พระธาตุพนม + พญานาค + สะพานมิตรภาพแห่งที่ 3 + ทิวเขาหินปูนฝั่งลาว)
- รายชื่อสถานที่ที่ครูอนุมัติ:
  - **นครพนม**: พระธาตุพนม, พญาศรีสัตตนาคราชริมโขง, สะพานมิตรภาพ 3, ไหลเรือไฟ, พระธาตุเรณู, หอนาฬิกาเวียดนามอนุสรณ์, พระธาตุท่าอุเทน, ภูลังกา, วัดโอกาสศรีบัวบาน, บ้านลุงโฮ (นาจอก)
  - **สกลนคร**: พระธาตุเชิงชุม, พระธาตุนารายณ์เจงเวง, หนองหาร-เกาะดอนสวรรค์, พระตำหนักภูพานราชนิเวศน์, ปราสาทผึ้ง, วัดถ้ำผาแด่น, พระธาตุภูเพ็ก, พิพิธภัณฑ์หลวงปู่มั่น (วัดป่าสุทธาวาส), ลานสาวเอ้ อช.ภูพาน, พระธาตุดุม
  - **มุกดาหาร**: สะพานมิตรภาพ 2, หอแก้วมุกดาหาร, พระพุทธนวมินทร์ฯ ภูมโนรมย์, อช.ภูผาเทิบ, แก่งกะเบา, วัดศรีมงคลใต้, ตลาดอินโดจีน, อช.ภูสระดอกบัว, วัดภูด่านแต้, พิพิธภัณฑ์ 8 ชนเผ่า
- **มาสคอตการ์ตูน** อยู่ในพื้นหลัง (มุมล่าง ไม่ทับจุดเด่น/โซนรูป/กล่องครูเวร): ครู ตชด. ชาย+หญิง **ชุดสีเขียว (เขียวมะกอกเข้ม) มีตราช้างบนแขนเสื้อ/หมวกเบเร่ต์** (ครูสั่งเอง — ข้อยกเว้นของกติกาไม่ใช้สีเขียว ใช้ได้กับชุดมาสคอตเท่านั้น) + นักเรียนชาย/หญิงชุดนักเรียนไทย; ตัวละครต้องหน้าตาเดียวกันทุกภาพ → ทำ character sheet ก่อน (`assets/mascots/`; v1 เป็นชุดกากี **ใช้ไม่ได้** ต้องทำ v2 ชุดเขียวตราช้าง)
- สถานะ: ภาพชุดแรก 15 ภาพใน `assets/backgrounds/` (np-01..10, sn-01..05) สร้างจาก prompt ทั่วไป **ไม่ผ่านเกณฑ์สถานที่จริง/มาสคอต ยกเว้น np-01 อาจใช้ได้** → ต้องทำใหม่ตามข้อนี้; โควตาภาพ: ChatGPT ฟรี ~1 ภาพ/วัน, Gemini Pro รีเซ็ตเป็นรอบ — งานพื้นหลังทำคู่ขนานกับการเขียนแอปได้ (แอปใช้พื้นหลังชั่วคราวระหว่างพัฒนา)
- การวางเลย์เอาต์ต้อง "สวยดูดี" ทุกแม่แบบ — ด่านอนุมัติคือชุดภาพตัวอย่างต่อแม่แบบ (golden) ที่ครูดูก่อนเปิดใช้

### 17.3 แก้จุดผิดจาก builder check (ผู้สร้างทำตามนี้)
1. OffscreenCanvas ใช้ `convertToBlob` — ทำ helper `canvasToBlob()`
2. ค่าเงา canvas ไม่ถูก scale ตาม transform — คูณ scale เองใน helper `setShadow()`
3. `requestIdleCallback` ไม่มีใน Safari — fallback `setTimeout(fn, 50)`
4. `createImageBitmap({imageOrientation:'from-image'})` ใน try/catch → เรียกซ้ำแบบไม่มี option → fallback `<img>`
5. GitHub Actions cron เป็น UTC (`0 20 * * 0` = จันทร์ 03:00 ไทย)
6. focal รูปเริ่มต้น 50%; ฟอนต์ Kanit (ไม่ใช้ Sukhumvit ของ macOS); ผลลัพธ์ 1536×2304
7. ค่า minor อื่น ๆ ใช้ `suggested_call` ของ builder check (MAX_TOTAL_PER_DAY=100, sessionStorage กัน reload ลูป, แถวข้อมูล Sheet เริ่มแถว 3, golden เทียบเฉพาะใน CI, .gitignore ต้นฉบับ PNG ใหญ่)

### 17.4 ข้อมูลที่ยังต้องได้จากครูแจ็ก (ไม่บล็อกการเขียนโค้ด — ใช้ข้อมูลตัวอย่างช่างกลฯ 8 ระหว่างพัฒนา)
- รายชื่อ 11 โรงเรียน: ชื่อเต็ม ชื่อย่อ ที่อยู่ จังหวัด + รายชื่อครู (ยศ ชื่อ เบอร์) + ไฟล์ตราโรงเรียน

### 17.5 แก้หลังตรวจทั้งสาขา (23 ต.ค. 69 เย็น — controller ruling)
- โควตารายนาที (`MAX_PER_MINUTE` รวมทุกโรงเรียน) เป็นเรื่องชั่วคราว: Apps Script ตอบ `RATE_LIMIT_MINUTE` ข้อความ "ระบบกำลังคับคั่ง ลองใหม่อัตโนมัติ" → เว็บถือเป็น retry (30 วิ / 5 นาที / เปิดแอปครั้งถัดไป); โควตารายวัน (`MAX_PER_SCHOOL_PER_DAY`, `MAX_TOTAL_PER_DAY`) ยังเป็น `RATE_LIMIT` ไม่ retry
- ตรา `_default`: โรงเรียนที่ `logo_file` ว่างหรือขึ้นต้น `_default` **ไม่วาดตรา** (ไม่ยืมตราโรงเรียนอื่น); admin เตือน "ยังไม่มีไฟล์ตรา"
- ภาพจริงต้องโหลดพื้นหลัง (และตรา ถ้าโรงเรียนมี) ได้ภายใน ~10 วิ ไม่งั้นไม่สร้าง PNG แสดง "ยังโหลดพื้นหลังไม่ได้ ลองใหม่" / "ยังโหลดตราโรงเรียนไม่ได้ ลองใหม่"; พรีวิวยังวาดแบบขาดได้
- golden เทียบแบบเข้มเฉพาะ linux (CI); เครื่องอื่นเตือนอย่างเดียว เว้นแต่ `--strict`; ภาพ golden ชุดจริงสร้างด้วย workflow `goldens-update` บน ubuntu
