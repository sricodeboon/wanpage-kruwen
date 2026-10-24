# สเปกสุดท้าย "วันเพจครูเวร" v1 — โลโก้ · มาสคอต · แอนิเมชัน · หน้ามือถือกระชับ

ผู้ตัดสิน/ออกแบบ: Fable 5.1 (หัวหน้าฝ่ายออกแบบ) · ผู้เขียนโค้ด: Opus 5.5 · 24 ต.ค. 2569
ตรวจกับโค้ดจริงแล้ว: `site/index.html`, `site/styles.css`, `site/app.js`, `site/js/ui.js`, `site/js/photos-ui.js`, `site/js/preview-ui.js`, `site/manifest.webmanifest`, `tests/e2e/flow.spec.mjs`, `site/data/snapshot.json`, `assets/mascots/cut/teacher-m.png`, `teacher-f.png`, `site/icons/icon-512.png`

## 0. ผลตัดสิน 3 แนว

| เกณฑ์ (1–10) | compact | wizard | mascot-first |
|---|---|---|---|
| ลดความยาวหน้ามือถือได้จริง | 8 | 9 | 8 |
| ง่ายสำหรับครูทุกวัย (ใช้ซ้ำทุกวัน ต้องเร็ว) | 9 | 6 | 7 |
| ความเสี่ยงต่อโค้ด/e2e (สูง = เสี่ยงน้อย) | 9 | 4 | 6 |
| ความสวย/จดจำแบรนด์ | 7 | 8 | 8 |
| เป็นไปได้กับ ChatGPT 1–2 ภาพ | 6 | 8 | 8 |
| ปฏิบัติตามกฎเจ้าของ | 9 | 8 | 7 |
| **รวม** | **48** | **43** | **44** |

เหตุผลสั้น
- **compact ชนะ** เพราะแก้ปัญหาเลื่อนยาวด้วยโครงสร้าง (กริด 2 คอลัมน์ + พับ 8 คน + ยุบส่วนที่เสร็จ) โดย **ไม่ต้องแก้ e2e แม้บรรทัดเดียว** (ตรวจแล้ว: ครูที่เทสต์ค้นชื่อ 'ส.ต.ท.รัชเดช ศรีแก้ว' อยู่ index 6 < 8; เทสต์คลิก `.t` nth 0–3 เท่านั้น; `toHaveCount` นับ DOM รวมที่ `hidden`) และครูยังเห็นทุกส่วนในหน้าเดียวเหมือนเดิม จุดอ่อน: พรอมต์ 5 ท่าในภาพเดียวเสี่ยงเพี้ยน → ลดเหลือ 4 ท่า (ยืมจาก mascot-first)
- **wizard** สั้นสุดแต่ต้องแก้ e2e 5 จุด + มี race (ขั้น ③ เปิดเอง), และครูสูงวัยต้องเรียนรู้ "แตะแถวสรุปเพื่อเปิด" ทุกวัน
- **mascot-first** สวยและพรอมต์ดี แต่ (ก) เรียงครูใหม่ตามชุดเดิม → ครูหาชื่อตัวเองไม่เจอในตำแหน่งที่คุ้น (ข) พับที่ 6 คน ทำให้เทสต์ `:32` ต้องแก้ (ค) confetti ใช้ JS สร้าง DOM 14 ชิ้น + โลโก้ "ดวงอาทิตย์ครึ่งดวงใต้หัวกลมของมาสคอต" ใกล้เคียง "จุดกลมเหนือส่วนโค้ง" เกินไป

**แกน = compact** ผสม: พรอมต์ 2×2 4 ท่า (mascot-first), แนวคิด "มาสคอตถือมือถือ + สายคล้องเหลือง" (ทั้งสองแนว), ป้ายความคืบหน้า 3 จุด (wizard/compact), ตัดการแยกยศออกจากชื่อ (ลดความเสี่ยง textContent)

**ตัวเลขฐาน (Pixel 7 412×839, `?s=changkon8`, ครู 14 คน):** หน้า 2072 px = 2.47 จอ · navbar 96 · ① 1042 · ② 274 · ③ 474 · cta-space 104
**เป้าหมาย:** ≤ 1,100 px ก่อนเลือกครู (1.31 จอ) · ≤ 800 px หลังกด "เลือกครบแล้ว ถัดไป" (ยุบ ①)

---

## A. โลโก้ "วันเพจครูเวร"

### A1 แนวคิด: "ครูวัน รายงานตัวในเหรียญแดดเย็น"
มาสคอต **ครูวัน** (ครู ตชด. ชาย ตัวเดิม `cut/teacher-m.png` วาดท่าใหม่) ทำวันทยหัตถ์ โผล่ครึ่งตัวจาก **เหรียญกลมไล่สีพระอาทิตย์ตก** (สีเดียวกับ navbar) ขอบขาว + วงนอกเหลืองแดด = "ครูเวรมารายงานตัวแล้ว" ตรงกับงานของแอป

ตรวจกฎแล้ว
- **ไม่มีดวงอาทิตย์แยกชิ้น** (ถ้าวาดวงกลมลอยเหนือเส้นโค้ง = ผิดกฎสัญลักษณ์คนพิการ) → ใช้วงกลมไล่สีเป็น *พื้น* และให้หัวมาสคอตอยู่ *ภายใน* วง ไม่มีแท่งตั้ง/รูป L
- สีเขียวมีเฉพาะชุด/หมวกมาสคอต (เขียวขี้ม้า ≈ #4b5a3c, หมวก ≈ #3f4a33 ตามภาพเดิม) — ห้ามมีที่ขอบ เงา สายคล้อง พื้น
- ตัวอักษรไทยทุกตัว **เรนเดอร์ด้วย Kanit จากโค้ด** ไม่ให้ AI วาด

### A2 องค์ประกอบ (lockup แนวนอน = หัวแอป)
```
[เหรียญ 48×48: วงกลม sunset 135° + bust ครูวัน clip วงกลม]   วันเพจครูเวร  (Kanit 700, 12px opacity .85 เมื่อมีโรงเรียน / 20px เมื่อไม่มี)
                                                              ชื่อโรงเรียน  (#schoolName Kanit 700 20px #fff)
```
- เหรียญ: `.brand-coin { width:48px; height:48px; border-radius:50%; background: linear-gradient(135deg,#6d28d9 0%,#a21caf 38%,#e11d74 66%,#ff7a1a 100%); box-shadow: 0 0 0 2.5px #fff, 0 0 0 4px var(--sun); overflow:hidden; position:relative }`
- มาสคอต: `<img class="brand-mascot" src="assets/brand/kruwan-bust.png" alt="" width="48" height="48" decoding="async" fetchpriority="low">` `object-fit: cover; object-position: 50% 0` (หมวกชิดขอบบน) — ถ้าอยากให้หมวกยื่นพ้นขอบ ใช้ภาพ 2 เลเยอร์ได้ภายหลัง (ไม่บังคับรอบนี้)
- ตัวอักษร "วันเพจครูเวร" = `<span class="brand-name">` ใหม่ (ไม่แตะ `#schoolName`)

### A3 พาเลตต์ (ใช้ตัวแปรเดิมใน styles.css)
| บทบาท | hex | ตัวแปร |
|---|---|---|
| ม่วง / ม่วงเข้ม | #6d28d9 / #5b21b6 | --violet / --violet-dk |
| ม่วงแดงกลางไล่สี | #a21caf | (ใน --sunset) |
| ชมพูบานเย็น | #e11d74 | --magenta |
| ส้มแดด | #ff7a1a | --orange |
| เหลืองแดด (ขอบเหรียญ, สายคล้อง, โฟกัส) | #ffc93c | --sun |
| ฟ้าทะเล (ติ๊กครู, ✓ สรุป) | #1e88e5 | --ocean |
| หมึก | #2b1a4a | --ink |
| ม่วงลึก (พื้นไอคอน, theme_color คงเดิม) | #3b1470 | — |
| ผิว / แก้ม มาสคอต | ≈ #fbe3d1 / #f6a7a7 | วัดจริงจากภาพที่ได้ (ใช้ทำเปลือกตา D2) |
| เครื่องแบบ / หมวก (เฉพาะมาสคอต) | ≈ #4b5a3c / #3f4a33 | ห้ามใช้ที่อื่น |

### A4 รูปแบบที่ต้องผลิต
| ที่ใช้ | ขนาด | ที่มา | รายละเอียด |
|---|---|---|---|
| navbar | เหรียญ 48 + ข้อความ | PNG bust (ChatGPT ท่า 1 ครอป) + CSS | ดู E1 |
| ไอคอนแอป `icon-192.png`, `icon-512.png` (any) | PNG | **สคริปต์** `tools/make-icons.mjs` (Playwright screenshot ของ `tools/icon.html` — Playwright มีอยู่แล้วใน devDeps) | พื้น squircle ไล่สี 135° เต็ม + ขอบเหลือง 2 เส้นแบบไอคอนเดิม + bust ครูวันกินสูง 72% ชิดล่าง กลาง · **ไม่มีตัวอักษร** · เลิกใช้ตัว "ว" เดิม |
| `icon-512-maskable.png` (ใหม่) | PNG | สคริปต์เดียวกัน | เนื้อหาย่อ 80% อยู่ในวงกลม r=205px กลางภาพ; manifest แยก `purpose:"maskable"` ออกจาก any |
| `apple-touch-icon` `icon-180.png` | PNG | สคริปต์เดียวกัน | เหมือน 192 |
| favicon `favicon-48.png` | PNG | สคริปต์เดียวกัน | พื้นไล่สี + หัวมาสคอต (ครอปถึงคาง) |
| splash/boot `#boot` | HTML/CSS | เหรียญ 120px + bust + "วันเพจครูเวร" Kanit 700 26px --ink + "รายงานครูเวร เสร็จใน 1 นาที" 15px --muted | แสดงเฉพาะ `body[data-state="boot"]`/`data` ดู D1 |
| หน้า "ส่งแล้ว" | PNG เต็มตัวท่า 3 (ชูมือถือ+โป้ง) สูง 160px | ChatGPT | วางเหนือ `.done-ok` ที่ย่อเหลือ 72px (คง class/aria-hidden) |
| busy "กำลังสร้างภาพ…" | PNG เต็มตัวท่า 2 (โบกมือ) สูง 96px | ChatGPT | ใน `.wp-busy` ดู D6 |
| ป้าย ctaMsg / ว่าง | ท่า 4 (ชี้) | ChatGPT | ตัวเลือกเสริม ถ้าภาพพอ |

ไฟล์ปลายทาง `site/assets/brand/`: `kruwan-bust.png` (512², โปร่งใส), `kruwan-wave.png`, `kruwan-thumb.png`, `kruwan-point.png` (สูง 640, โปร่งใส) ทุกไฟล์ผ่าน `pngquant --quality 70-90` เป้า ≤ 60 KB/ไฟล์ รวม ≤ 250 KB; ทำ `.webp` คู่ (`cwebp -q 82`) ใช้ `<picture>` ถ้าสะดวก

---

## B. มาสคอต "ครูวัน"

### B1 คาแรกเตอร์ — อิงครู ตชด. ชาย `teacher-m.png` ที่มีอยู่
เหตุผล: ครู 11 โรงเรียนจำชุด ตชด. + เบเรต์ตราช้างได้ทันที; สไตล์เดียวกับภาพรายงาน (render.js) ที่ครูเห็นทุกวัน; เป็นข้อยกเว้นสีเขียวข้อเดียวที่เจ้าของอนุญาต; เส้นขอบหนา สีแบน ชัดที่ 48px
- คงไว้: เบเรต์เขียวเข้มเอียง + ตราวงกลมช้างเผือกขอบทอง, ผมดำสั้น, ตากลมโตมีแสง 1 จุด, แก้มชมพู, เสื้อเครื่องแบบกระเป๋าอก 2 ใบ, รองเท้าบูทดำ
- เพิ่มเอกลักษณ์: **สายคล้องคอสีเหลืองแดด #ffc93c + ป้ายเปล่าสีเหลือง (ห้ามมีตัวอักษร)** และ **ถือสมาร์ทโฟน** แทนสมุด; ยิ้มกว้างกว่าเดิมเล็กน้อย; สัดส่วนหัว:ตัว ≈ 1:1.6 (ชิบิกว่าเดิมเพื่อไอคอน)
- ครูหญิง `teacher-f` = ตัวรอง ไม่ต้องสร้างรอบนี้

### B2 ท่าที่ใช้ในแอป (4 ท่า ภาพเดียว 2×2)
| # | ท่า | ใช้ที่ | แอนิเมชัน |
|---|---|---|---|
| 1 | **ครึ่งตัว (ถึงเอว) วันทยหัตถ์มือขวา ยิ้ม** | ไอคอน, navbar, splash, favicon | breathe + blink (D2), boot-pop (D1) |
| 2 | **เต็มตัว โบกมือขวาชูสูง ฝ่ามือเปิด** | busy, หน้า "ส่งแล้ว" (เสริม) | ทั้งตัวโยก ±3° (D6) |
| 3 | **เต็มตัว ชูมือถือมือซ้าย + ยกนิ้วโป้งมือขวา** | หน้า "ส่งแล้ว", badge ข้าง CTA เมื่อพร้อม | pop (D5, D7) |
| 4 | **เต็มตัว ชี้นิ้วไปทางซ้าย เอียงตัวเล็กน้อย** | ป้ายว่าง/ctaMsg (เสริม) | — |
ถ้าได้ภาพเดียวแล้วบางท่าเพี้ยน: ใช้ท่า 1 เป็นหลัก; ท่า 3 ใช้แทน 2 และ 4 ได้

---

## C. พรอมต์ ChatGPT (บัญชีฟรี — จบใน 1 ภาพ + สำรอง 1)

ก่อนส่ง: **แนบ `assets/mascots/cut/teacher-m.png` เป็นภาพอ้างอิง** ขอขนาด 1:1

### C1 ภาพที่ 1 (หลัก)
```
Use the attached chibi character as the exact reference: same face, same big round dark eyes with one white highlight, same rosy cheeks, same thick soft dark-brown outline, same flat cel-shaded sticker style, same dark olive Thai Border Patrol Police uniform shirt with two chest pockets, same dark olive beret with the small round gold-rimmed white-elephant badge, black boots. Keep this exact character design and art style, but make the head slightly bigger (head about 40% of body height) and the smile a bit wider.
Add two new details in every pose: a bright golden-yellow (#FFC93C) lanyard around the neck with a small BLANK yellow tag, and he owns a purple (#6D28D9) smartphone.
Create ONE square image: a character sheet of this SAME character in 4 poses, arranged in a clean 2x2 grid, each pose centered in its cell at the same scale, generous empty space between poses, front-facing 3/4 view.
Top-left (1): upper body only, from the waist up, right hand giving a crisp military salute at the eyebrow, warm friendly smile, head tilted 5 degrees.
Top-right (2): full body standing, right hand raised high waving with an open palm, left arm relaxed.
Bottom-left (3): full body standing, left hand holding the purple smartphone up with the screen facing the viewer (screen shows only a simple camera icon, no text), right hand thumbs-up, very happy.
Bottom-right (4): full body standing, pointing to the LEFT with the right index finger, slight lean, encouraging smile.
Strict rules: pure flat white background (#FFFFFF), no ground, no shadow under the feet, no gradient, no border lines, NO text, NO letters, NO numbers, NO logos except the elephant badge, no watermark. Green is allowed ONLY on the beret and the uniform; nothing else may be green. Clean sticker edges so each pose can be cut out easily.
```

### C2 ภาพที่ 2 (สำรอง — ใช้เมื่อท่า 1 ไม่คมพอสำหรับไอคอน หรือภาพ 1 เพี้ยน)
```
Same attached character, same style and uniform rules (green only on beret and uniform), with the golden-yellow lanyard and blank yellow tag. One square image: a large close-up bust from the chest up, centered, filling 85% of the canvas, right hand in a crisp military salute at the eyebrow, warm friendly smile, big round eyes, rosy cheeks, head tilted 5 degrees. Pure flat white background, no shadow, no ground, no text, no letters, no logo except the elephant badge.
```

### C3 ตัดแต่ง/แยกชิ้น (บน Mac ไม่เสียเงิน)
1. ลบพื้นขาว: Preview → Instant Alpha ลากบนพื้นขาว (เส้นขอบน้ำตาลเข้มกันไม่ให้ทะลุตาขาว/ฟัน) หรือ `pipx run rembg i in.png out.png`; export PNG โปร่งใส
2. แยก 4 ท่าตามกริด → `kruwan-bust.png` (ท่า 1 ครอปสี่เหลี่ยมจัตุรัสตั้งแต่ยอดหมวกถึงกลางอก), `kruwan-wave.png`, `kruwan-thumb.png`, `kruwan-point.png`
3. ย่อ: bust 512² / เต็มตัวสูง 640 → `pngquant --quality 70-90` → ≤ 60 KB; webp `cwebp -q 82`
4. วัดจากภาพ bust: ตำแหน่งตา 2 จุด (center x,y / กว้าง,สูง เป็น % ของภาพ) และสีผิวจริง → จดลง CSS custom property `--eye-l`, `--eye-r`, `--skin` ใน styles.css (ใช้ทำกะพริบตา D2) — ไม่ต้องตัดตาแยก
5. QA: วางบน #3b1470 ต้องไม่มีขอบขาว (halo); color-pick ขอบ/เงา/สายคล้อง/ป้าย ไม่มี hue 75–165°; ไม่มีตัวอักษร

---

## D. แอนิเมชัน (vanilla CSS, `transform`/`opacity` เท่านั้น)

กติการวม
- บล็อก `@media (prefers-reduced-motion: reduce)` เดิม (styles.css:309) ปิด animation/transition ทั้งหมดอยู่แล้ว **คงไว้** และเพิ่ม `.brand-blink, .cta-mascot { display:none }` ในบล็อกนั้น; ทุกสถานะปลายทาง (✓, สรุปที่ยุบ) ต้องแสดงทันทีโดยไม่พึ่ง animationend
- ไม่มีแอนิเมชันที่ต้องรอจบก่อนแตะ; `pointer-events:none` ใช้เฉพาะ `.cta-mascot` และ `#boot.boot-out`
- เล่นพร้อมกัน ≤ 2 ตัว; วนลูปถาวรได้แค่ D2; ไม่มี JS rAF loop; ไม่ animate box-shadow/filter/height/width/top/left
- helper ใน `js/ui.js`:
  ```js
  export function pulse(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); el.addEventListener('animationend', () => el.classList.remove(cls), { once: true }); }
  ```
- `preview-ui.js` เมื่อ `p.lowPower` เป็น true (บรรทัด 14 และ 54) → `document.documentElement.classList.add('low-power')`; CSS `html.low-power .brand-coin *, html.low-power .busy-mascot { animation: none !important }`
- `visibilitychange` → `document.documentElement.classList.toggle('paused', document.hidden)`; `.paused .brand-coin * { animation-play-state: paused }`

| # | ชื่อ | ทริกเกอร์ | ระยะ/easing | keyframes |
|---|---|---|---|---|
| D1 | boot-pop (splash `#boot`) | แสดงเมื่อ `body[data-state=boot]` หรือ `data` (CSS `body:not([data-state=boot]):not([data-state=data]) #boot { display:none }`); ใน `setPhase()` เมื่อ p ไม่ใช่ boot/data ครั้งแรก → เพิ่ม `.boot-out` แล้ว `hidden=true` หลัง 180 ms (setTimeout) ; ถ้า boot→form ภายใน 150 ms ให้ `hidden` ทันทีไม่เล่น | เข้า 420 ms `cubic-bezier(.34,1.56,.64,1)`; ออก 180 ms ease-out | เหรียญ `scale(.6)→1` + `opacity 0→1`; bust `translateY(24px)→0` delay 80 ms; ข้อความ `opacity 0→1` delay 160 ms; ออก overlay `opacity 1→0` |
| D2 | idle-breathe + blink (navbar) | `data-state=form` (CSS `body[data-state=form] .brand-coin img { animation: breathe … }`) | breathe 4 s ease-in-out infinite alternate; blink 6 s linear infinite | breathe `translateY(0)→translateY(-1.5px) rotate(-1.5deg)`; blink: `<span class="brand-blink">` 2 วงรีสี `--skin` วางทับตา (ตำแหน่งจาก C3-4) `transform-origin:50% 0` keyframes `0%,92%,100%{transform:scaleY(0)} 95%{transform:scaleY(1)}` |
| D3 | tick-pop (เลือกครู) | ใน `onTeacherTap()` หลัง `renderTeachers()` ถ้า id เพิ่งถูกเลือก (`r.selected.includes(id)` และก่อนหน้าไม่มี) → `pulse(box.querySelector(`[data-id="${id}"] .ck`), 'pop')` | 260 ms `cubic-bezier(.34,1.56,.64,1)` | `.ck.pop{animation:pop .26s}` `0%{transform:scale(.6)} 60%{transform:scale(1.18)} 100%{transform:scale(1)}` |
| D4 | slot-in (รูปเข้าช่อง) | ใน `photos-ui.js render()` ช่องที่เปลี่ยนจากไม่มี→มี `p` (เก็บ `prevFilled` array ใน closure) เพิ่ม class `just` บน `.slot` | 300 ms ease-out | `.slot.just img { animation: slot-in .3s ease-out }` `from{opacity:0;transform:scale(1.06)} to{opacity:1;transform:none}` — ไม่แตะโครง `.slot/.lbl/input` |
| D5 | cta-ready | ใน `refreshValidity()` เมื่อ `.off` เปลี่ยนจากมี→ไม่มี (เก็บ `wasOff`) → `pulse($('cta'),'ready')` + แสดง `.cta-mascot` (ท่า 3, 64px, absolute มุมขวาบนของ `.cta-wrap`, `pointer-events:none`) 2.4 s แล้วซ่อน; เล่นครั้งแรกของรอบฟอร์มเท่านั้น (reset ใน `again()`/`setSchool()`) | ปุ่ม 480 ms ease-out; มาสคอต เข้า 300 / ออก 200 ms | ปุ่ม `0%{scale(1)} 35%{scale(1.04)} 70%{scale(.99)} 100%{scale(1)}`; มาสคอต `translateY(16px) scale(.9) opacity 0 → none / 1` |
| D6 | busy-wave | `busyShow()` html = `<img class="busy-mascot" src="assets/brand/kruwan-wave.png" alt="" width="72" height="96"><p id="busyText" class="mb-0"></p>` (คง `#busyText`) | 1.2 s ease-in-out infinite alternate | `.busy-mascot { transform-origin:50% 100%; animation: rock 1.2s … }` `from{transform:rotate(-3deg)} to{transform:rotate(3deg)}` |
| D7 | done-salute | `showDone()` → `#doneView` แสดง; `<img class="done-mascot" src="assets/brand/kruwan-thumb.png" alt="" width="120" height="160">` เหนือ `.done-ok` (ย่อเหลือ 72px, font 40px) | มาสคอต 480 ms spring; `.done-ok` 300 ms delay 200 ms (ใช้ `animation-fill-mode: both`) | มาสคอต `translateY(28px) scale(.85) opacity 0 → none / 1`; `.done-ok` `scale(.4) opacity 0 → 1` — **ไม่มี confetti** |
| D8 | collapse-① | กด `#nextPhotos` → `.is-done` (E2) | 180 ms ease-out | `#teacherSummary` `opacity 0→1`; `.t-body` สลับ `display:none` ทันที (ไม่ animate ความสูง) |
| D9 | `wp-in` ของ Swal เดิม | คงเดิม | — | — |

reduced-motion: D1 ซ่อน splash ทันทีเมื่อออกจาก boot (ไม่เล่นเข้า/ออก), D2 ไม่มี breathe/blink และ `.brand-blink` ไม่แสดง, D3–D8 แสดงสถานะปลายทางทันที

---

## E. UX มือถือให้สั้นลง — "หน้าเดียวกระชับ"

id/คลาสที่ e2e ใช้ **คงไว้ทั้งหมด**: `#schoolName #changeSchool .t .ck #teacherMsg #ctaMsg #cta .off #photoGrid .slot .filled .lbl input[data-index] #bgList [data-bg] #bgMsg #retryTemplates #editDate #bigPreviewBtn #dataBadge #notTodayBadge #dateSheet #dateInput #confirm #confirmImg #sumTeachers #shareBtn #saveBtn #iosSave #confirmMsg #chromeBox #doneView #formView #again #sentToday` และข้อความใน `MSG`/`#ctaMsg`/`#teacherMsg`/`#bgMsg` **ห้ามเปลี่ยน**

### E0 งบความสูง (412×839, ครู 14 คน)
| ส่วน | ก่อน | หลัง (ยังไม่เลือกครู) | หลังกด "ถัดไป" |
|---|---|---|---|
| navbar | 96 | **72** | 72 |
| ① ครูเวร | 1,042 | **≈ 400** | **≈ 64** |
| ② รูปถ่าย | 274 | **≈ 246** | 246 |
| ③ พื้นหลัง | 474 | **≈ 222** | 222 |
| ช่องว่าง (3×10 + pt) | 56 | 42 | 42 |
| cta-space | 104 | **96** | 96 |
| **รวม** | **2,072** | **≈ 1,078 (1.29 จอ)** | **≈ 742 (0.88 จอ)** |
โรงเรียนครู ≤ 8 คน: ไม่มีปุ่ม "ดูครูอีก" ① ≈ 340 → รวม ≈ 1,020; โรงเรียน 23 คน: เท่ากับ 14 คน (พับที่ 8)

### E1 navbar (96 → 72)
- `.app-head { --bs-navbar-padding-y: 10px; border-radius: 0 0 22px 22px }`; `.head-logo-wrap` 64→**48**, `.head-logo` 52→40; `.app-head .navbar-brand` 22→**20px; line-height 1.15**; `#changeSchool` คง `.linkbtn.small` (พื้นที่แตะเดิม)
- เพิ่ม **ขวาสุด** ของ `.container-fluid`: `<span class="brand-coin ms-auto" aria-hidden="true"><img class="brand-mascot" …><span class="brand-blink"></span></span>` 48px
- เพิ่มในกล่องชื่อ: `<span class="brand-name">วันเพจครูเวร</span>` 12px `opacity:.85` บรรทัดเหนือ `#schoolName`; CSS `.app-head.no-school .brand-name { display:none }` (เมื่อไม่มีโรงเรียน `#schoolName` แสดง "วันเพจครูเวร" อยู่แล้ว) — ใน `renderHeader()` toggle class `no-school` บน `.app-head` ตาม `!s`
- ความสูง: 10 + max(48, 14+23+? ) → `#changeSchool` ใช้ margin ติดลบเดิมทำให้กล่องชื่อ ≈ 48 → รวม 68–72 ✓

### E2 ① ครูเวร (1,042 → ≈400 → 64)
HTML ใหม่ใน `#secTeachers .card-body` (ลำดับ):
```html
<h2 id="hTeachers" class="sec-title"><span class="sec-no">1</span>ครูเวร <span id="teacherCount" …hidden></span></h2>
<div class="t-body">
  <div class="t-head">  <!-- แถวเดียว 44px: flex, align-items:center, gap 8 -->
    <div id="dateText" class="date-pill"></div>
    <span id="notTodayBadge" class="badge rounded-pill badge-orange" hidden>ไม่ใช่วันนี้</span>
    <button id="editDate" type="button" class="btn btn-link linkbtn ms-auto">แก้วันที่</button>
  </div>
  <input id="dateInput" type="hidden" aria-label="วันที่เข้าเวร">
  <p id="dateMsg" class="msg" hidden></p>
  <button id="reuseChip" type="button" class="btn btn-gold-soft rounded-pill tap mt-2" hidden></button>
  <div id="teacherList" class="tlist tgrid mt-2" role="group" aria-label="รายชื่อครูเวร"></div>
  <button id="moreTeachers" type="button" class="btn btn-light w-100 tap mt-2" aria-expanded="false" aria-controls="teacherList" hidden></button>
  <p id="teacherMsg" class="msg" role="status" hidden></p>
  <button id="nextPhotos" type="button" class="btn btn-outline-primary w-100 tap mt-2" hidden>เลือกครบแล้ว ถัดไป ↓</button>
</div>
<div id="teacherSummary" class="t-sum" role="status" aria-live="polite" hidden>
  <span class="t-sum-text"></span><button id="editTeachers" type="button" class="btn btn-link linkbtn tap">แก้ไข</button>
</div>
```
- **กริด:** เอา `list-group` ออกจาก `#teacherList`; `.t` คงคลาส `list-group-item list-group-item-action t` (CSS เดิม `.tlist > .list-group-item` ยังจับ) แต่ปรับ:
  ```css
  .tgrid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
  .tlist > .list-group-item { min-height:52px; padding:6px 8px; gap:8px; border-radius:12px; }
  .ck { width:26px; height:26px; font-size:15px; }
  .t-name { font-size:16px; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; }
  .t-phone { display:none; }                       /* ยังอยู่ใน DOM → e2e toContainText (textContent) ผ่าน */
  .t[aria-checked="true"] .t-phone { display:block; font-size:13px; }
  .t.t-more { display:none; }  .tgrid.open .t.t-more { display:flex; }
  ```
  - `.t-name` = `display_name` เต็มเหมือนเดิม (**ไม่แยกยศ** — ลดความเสี่ยง hasText); ชื่อยาวสุด "นางสาวจิราวรรณ ชอบพวงดึ" ที่ 16px Kanit ในช่อง ≈150px = 2 บรรทัดพอดี (ตรวจรับ F)
- **พับที่ 8 คน:** `renderTeachers()` เรนเดอร์ครูทุกคนตาม **ลำดับเดิม** (ไม่เรียงใหม่); index ≥ 8 ใส่ class `t-more`; `#moreTeachers` แสดงเมื่อ `teachers().length > 8` ข้อความ `ดูครูอีก N คน ▾` / `ย่อรายชื่อ ▴`; เปิดอัตโนมัติ (`.tgrid.open`) เมื่อ `state.selectedTeacherIds` หรือ `storedSet()` มีคนที่ index ≥ 8; จำสถานะเปิดใน `app.teachersOpen` (memory) ต่อ session; กด toggle = สลับ class + `aria-expanded`
- **ยุบเป็นสรุป:** `$('nextPhotos').onclick` → `secTeachers.classList.add('is-done')`; CSS `.is-done .t-body { display:none } .is-done #teacherSummary { display:flex }` (64px: ✓ สี --ocean + "ครูเวร: รัชเดช, สุทัตตา · ศ. 24 ต.ค." ชื่อต้นจาก `splitRank` แบบเดียวกับ `renderReuseChip` + ปุ่มแก้ไข ≥52) แล้ว `scrollIntoView` ไป `#secPhotos` เหมือนเดิม (**ไม่ใช้ค่าคืน**) · ลบ `.is-done` เมื่อ: กด `#editTeachers`, `ctaMsg` ชี้ `teachers`, `onCreate()` validity target = teachers, `again()`, `setSchool()`, `selectedTeacherIds` ว่าง (ใน `renderTeachers()`)
- ความสูง: title 38 + t-head 44 + mt 8 + กริด 4 แถว (4×52+3×6=226) + more 52+8 + padding 20+16 ≈ **412** (nextPhotos ซ่อนก่อนเลือก) — ครู ≤ 8: ≈ 352

### E3 ② รูปถ่าย (274 → ≈246)
- ตัด badge "ถ่ายใหม่วันนี้" ออกจาก `#hPhotos` (ย้ายเป็น `title` ของ h2); `.sec-title { margin-bottom: 6px }`
- `.sec { margin: 10px 16px }`; `.sec > .card-body { padding: 14px 16px 14px }` ( `.sec > .card-body { padding-top: 16px }` )
- **ไม่แตะ** `#photoGrid`, `.slot`, `.lbl`, `input[data-index]`, `#photoMsg`
- สูง ≈ 14+32+6+194+14 = **≈ 260** (บวก msg เมื่อมี)

### E4 ③ พื้นหลัง (474 → ≈222)
HTML:
```html
<h2 class="sec-title"><span class="sec-no">3</span><span id="hBg">พื้นหลัง</span></h2>
<div class="bg-row">
  <div class="pv-col">
    <div class="pv-frame"><canvas id="preview" width="256" height="384" aria-label="ตัวอย่างภาพรายงาน"></canvas><button id="tapPreview" type="button" class="pv-tap" hidden>แตะเพื่อดูตัวอย่าง</button>
      <button id="bigPreviewBtn" type="button" class="btn btn-light tap pv-big" aria-label="ดูภาพใหญ่">⤢</button></div>
  </div>
  <div class="bg-col">
    <div id="bgList" class="bgs" role="radiogroup" aria-label="พื้นหลัง"></div>
    <p id="bgPicked" class="bg-picked" aria-live="polite" hidden></p>
  </div>
</div>
<p id="bgMsg" class="msg" hidden></p>
<button id="retryTemplates" …>ลองใหม่</button>
```
CSS:
```css
.bg-row { display:flex; gap:10px; align-items:flex-start; margin-top:4px; }
.pv-col, .pv-frame { flex:none; width:96px; }
#preview { width:96px; height:144px; }                       /* attribute 256×384 คงเดิม */
.pv-big { position:absolute; right:-6px; bottom:-6px; width:52px; height:52px; min-width:52px; border-radius:50%; padding:0; font-size:22px; box-shadow:0 2px 8px rgba(43,26,74,.25); }  /* e2e ≥52×52 ✓ */
.bg-col { flex:1 1 auto; min-width:0; }
.bgs { margin:0 -16px 0 0; padding:4px 16px 4px 0; gap:8px; }
.bg { width:72px; }  .bg img { width:72px; height:96px; margin-bottom:2px; border-width:2px; }
.bg-name { -webkit-line-clamp:1; min-height:1.3em; font-size:12px; }
.bg-picked { font-size:13px; margin:4px 0 0; }
```
- ตัด `.pv-text` ("ตัวอย่างสด…") ทั้งก้อน; ข้อความเดิมอยู่ใน `aria-label` ของ canvas; `#hBg` คงข้อความ `พื้นหลัง (นครพนม N แบบ)` ของ `renderBackgrounds()`; `renderBgPicked()` คง id/ข้อความ
- สูง ≈ 14+32+4+max(144+6, 96+16+8+20)+14 = **≈ 214–222**

### E5 CTA sticky + ความคืบหน้า
- `.cta-space { height:96px }`, `.cta { height:54px }`; `.cta-msg` คงเดิม (ข้อความจาก `MSG` ห้ามเปลี่ยน)
- เพิ่ม `<span id="progressDots" class="dots" aria-hidden="true"><i></i><i></i><i></i></span>` ซ้ายของ `#ctaMsg` ใน `.app-col` (แถวเดียว flex); อัปเดตใน `refreshValidity()`: `.on` เมื่อ teachers ≥1 / photos ครบ 4 / bgId มี; สี --ocean/--orange/--magenta; ไม่กระทบ e2e (`#ctaMsg` toHaveText อ่านเฉพาะ ctaMsg)

### E6 Accessibility
- ปุ่ม/การ์ด/thumbnail ≥ 52 ทุกตัว (`.t` 52, `#moreTeachers` 52, `#editTeachers` .tap, `.pv-big` 52, `.bg img` 72×96, `#editDate` คง `.linkbtn` และวิธีผ่านเทสต์เดิม)
- ตัวอักษร: ชื่อครู 16, วันที่ 18, ชื่อโรงเรียน 20; เบอร์/ชื่อพื้นหลัง 12–13 เป็นข้อมูลเสริมที่ซ้ำในภาพรายงาน
- `#teacherSummary role=status aria-live=polite`; `#moreTeachers aria-expanded/aria-controls`; มาสคอตทุกตัว `alt=""` + `aria-hidden`; `#bigPreviewBtn aria-label="ดูภาพใหญ่"`
- คอนทราสต์: ชื่อครู --ink บนขาว; `.cta-msg` #7a4a00 บน --sun-tint เดิม; ไม่มี `border-left` accent (grep = 0)

### E7 ไฟล์/จุดที่แก้
| ไฟล์ | แก้ |
|---|---|
| `site/index.html` | navbar (E1), ① โครง `.t-body/.t-head/#moreTeachers/#teacherSummary/#editTeachers` (E2), ② ตัด badge (E3), ③ `.bg-row` + ปุ่มไอคอน (E4), `#progressDots` (E5), `#boot` overlay (วางเป็นลูกแรกของ `<body>`), `.done-mascot` ใน `#doneView`, `<link rel="icon" href="icons/favicon-48.png">` + `apple-touch-icon` → `icon-180.png` |
| `site/styles.css` | E1–E5, `.brand-*`, `.tgrid/.t-more/.is-done/.t-sum/.dots/.pv-big/.bg-row`, keyframes D1–D8, `html.low-power`, `.paused`, reduced-motion เพิ่ม `.brand-blink,.cta-mascot{display:none}` |
| `site/app.js` | `renderHeader()` (no-school), `renderTeachers()` (t-more/auto-open/teacherSummary/is-done reset), `onTeacherTap()` (D3), `bindForm()` (moreTeachers, editTeachers, nextPhotos→is-done, visibilitychange), `refreshValidity()` (dots + D5), `onCreate()`/`ctaMsg.onclick` (ลบ is-done เมื่อ target=teachers), `setPhase()` (ซ่อน #boot), `again()`/`setSchool()` (reset) |
| `site/js/ui.js` | `pulse()`, `busyShow()` ใส่ `.busy-mascot` (คง `#busyText`) |
| `site/js/photos-ui.js` | `prevFilled` + class `just` บน `.slot` (D4) — ไม่แตะโครง slot |
| `site/js/preview-ui.js` | lowPower → `html.low-power` |
| `site/manifest.webmanifest` | icons: 192/512 any + `icon-512-maskable.png` purpose maskable; คง `theme_color` #3b1470 |
| `tools/icon.html`, `tools/make-icons.mjs` (ใหม่) | เรนเดอร์ไอคอน 512/192/180/48 + maskable ด้วย Playwright screenshot |
| `site/assets/brand/*` (ใหม่) | PNG/WebP 4 ท่า + bust |

### E8 ผลกระทบต่อ e2e (`tests/e2e/flow.spec.mjs`) — **ไม่ต้องแก้เทสต์เดิม** (ตรวจแล้ว)
| บรรทัด | สิ่งที่เทสต์ทำ | ผล |
|---|---|---|
| 32–33 | `.t` hasText 'ส.ต.ท.รัชเดช ศรีแก้ว' + `toContainText('081-234-5678')` | index 6 < 8 มองเห็น ✓; `.t-name` ยังเป็น display_name เต็ม ✓; `.t-phone` `display:none` แต่ `toContainText` ใช้ textContent ✓ |
| 70, 73–74 | `.t` first/nth(1)(2)(3).click() | index ≤ 3 มองเห็น ✓ |
| 98 | `toHaveCount(snapshotTeachers)` | นับ DOM รวม `.t-more` ✓ |
| 124–128 | boundingBox ≥52: `#changeSchool #editDate #bigPreviewBtn .t>>nth=0 #cta` | `#changeSchool/#editDate` มาร์กอัป+คลาสเดิม ✓; `.pv-big` 52×52 ✓; `.t` 52×~150 ✓; `.cta` 54 ✓ |
| 180–200 | `#retryTemplates`, `#bgMsg` | id/ข้อความคงเดิม ✓ |
| ทุกเทสต์ | `#nextPhotos` ไม่ถูกกด | `.is-done` ไม่เกิดในเทสต์ ✓ |
เทสต์ใหม่ที่ต้องเพิ่ม (ไฟล์เดิมหรือ `tests/e2e/mobile-height.spec.mjs`):
1. Pixel 7 412×839 `?s=changkon8`: `document.documentElement.scrollHeight ≤ 1150` หลังโหลด; เลือกครู 1 คน + กด `#nextPhotos` → `≤ 850` และ `#teacherSummary` visible
2. `#moreTeachers` click → `aria-expanded="true"` และ `.t` nth(13) visible; click อีก → ซ่อน
3. `page.emulateMedia({ reducedMotion: 'reduce' })` → หลังโหลด 1 วิ `document.getAnimations().length === 0` และ `.brand-blink` ไม่แสดง
4. ครูใน `wp.teachers.changkon8` (seed localStorage) index ≥ 8 → `.tgrid.open` อัตโนมัติ
- `tests/golden` / `render.js`: ไม่กระทบ (ไม่แตะการวาด PNG)

---

## F. เกณฑ์ตรวจรับ (วัดได้)

**โลโก้/มาสคอต**
- [ ] มาสคอต = ตัวเดียวกับ teacher-m (เบเรต์+ตราช้าง, ชุดเขียวขี้ม้า) + สายคล้องเหลือง, 4 ท่า พื้นโปร่งใส ไม่มี halo บน #3b1470, ไม่มีตัวอักษรในภาพ
- [ ] color-pick ทุกจุดนอกชุด/หมวก: ไม่มี hue 75–165° (ตรวจด้วย `magick in.png -fuzz 20% -fill red -opaque "#2e8b57"` ดูแดงนอกชุด = 0)
- [ ] โลโก้/ไอคอน: ไม่มีวงกลมลอยเหนือเส้นโค้ง, ไม่มีแท่ง L (ดูที่ 48 และ 512px); ตัวอักษรไทยทั้งหมดเรนเดอร์ด้วย Kanit (`document.fonts.check('700 20px Kanit')`)
- [ ] ไอคอน 192/512 any + 512 maskable (เนื้อหาในวงกลม r=205) + 180 + favicon-48 ผ่าน Lighthouse PWA installable; `site/assets/brand` รวม ≤ 250 KB; icon-512 ≤ 60 KB
- [ ] splash ไม่บล็อกโหลด `app.js`; boot < 150 ms ไม่เห็น splash; `#loadFail` ไม่ถูกบัง

**แอนิเมชัน**
- [ ] ทุก `@keyframes` ใน styles.css มีเฉพาะ `transform`/`opacity` (grep ไม่มี box-shadow|height|width|left|top|background|filter ในบล็อก keyframes)
- [ ] reduced-motion: `document.getAnimations().length === 0` หลังโหลด 1 วิ; `.brand-blink`/`.cta-mascot` ไม่แสดง
- [ ] DevTools Performance CPU 4× (Pixel 7): idle หน้า form 10 วิ long task = 0; เฟรม > 50 ms = 0
- [ ] แตะครู/รูป/ปุ่มระหว่างแอนิเมชัน ตอบสนองทันที; `pointer-events:none` มีเฉพาะ `.cta-mascot`, `#boot.boot-out`
- [ ] แท็บซ่อน → D2 หยุด (`animation-play-state: paused`); `html.low-power` → D2/D6 ไม่เล่น

**หน้ามือถือ**
- [ ] 412×839 `?s=changkon8`: `scrollHeight ≤ 1,150` (เป้า ≈1,080) ก่อนเลือก; ≤ 850 หลัง `#nextPhotos`; iPhone SE 375×667 ≤ 1,250; cocknis (23 คน) เท่ากับ changkon8 ±20
- [ ] `.app-head` ≤ 72, `#secTeachers` ≤ 420 (ก่อนขยาย), `#secPhotos` ≤ 270, `#secBg` ≤ 240
- [ ] `#moreTeachers` toggle `aria-expanded`; ครูที่เลือก/`storedSet()` index ≥ 8 → เปิดอัตโนมัติ; ลำดับครูเท่า data เดิม
- [ ] ทุกปุ่ม/การ์ด/thumbnail ≥ 52×52 (ยกเว้น `.lbl::before` 48/36 ตามเทสต์เดิม); ชื่อครู ≥ 16px; `grep -c "border-left" site/styles.css` = 0
- [ ] "นางสาวจิราวรรณ ชอบพวงดึ" และ "ด.ต.หญิงดารินทร์ อินทิแสง" ไม่ล้นการ์ด 2 คอลัมน์ (≤ 2 บรรทัด, ไม่ถูกตัดกลางคำ)
- [ ] สรุป ① หลังยุบ: ✓ + ชื่อต้น ≤3 คน + วันที่สั้น + ปุ่มแก้ไข ≥52; กด "แก้ไข"/`#ctaMsg` ("เลือกครูเวร…") ขยายกลับและเลื่อนไป ①
- [ ] `npx playwright test tests/e2e` เดิมผ่านทั้งหมด **โดยไม่แก้เทสต์เดิม** + เทสต์ใหม่ E8 ผ่าน; vitest/golden ผ่าน; `#ctaMsg` ทุกข้อความตรงเดิม; `#cta.off` คอนทราสต์ ≥ 4.5 เดิม
- [ ] ไม่มี `.then`/`await` ตามหลัง `scrollIntoView(` ใน app.js
- [ ] ครูจริง 3 คน (อายุต่างกัน) ทำครบ flow บนมือถือตนเองโดยไม่ถาม "ต้องเลื่อนไปไหน" และบอกได้ว่าตัวการ์ตูนคือ "ครู ตชด."

ภาพหน้าจอส่งมอบ `docs/screens/v3-*.png`: ฟอร์มว่าง, เลือกครบ+ยุบ ①, ขยายรายชื่อ, busy, ส่งแล้ว, reduced-motion, ไอคอน home screen Android+iOS
