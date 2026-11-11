# พื้นหลังรายงานหน้าแถว (สร้างด้วย ChatGPT, 11 พ.ย. 2569)

ขนาด 1024×1536 (2:3) บันทึกเป็น webp q0.9 · ไฟล์ `<theme>.v1.webp` ตรงกับ `asm` ใน `LUNCH_THEMES` (`js/engine/lunch.js`)
แปลงไฟล์: วาง png ไว้ที่ `tests/tmp/<theme>.png` แล้วเปิด `tests/asm-bg.html?t=<theme>` ผ่าน `python tests/serve.py`

## ตำแหน่งที่ภาพต้องเว้นให้ (โค้ดวาดทับตรงนี้)
- มุมซ้ายบน 30%×22% = ตราโรงเรียน (ว่าง)
- มุมขวาบน = ดวงอาทิตย์ + ธงชาติ → ชื่อโรงเรียนจบที่ x ≤ 760, หัวเรื่อง/ป้ายวันที่จบที่ x ≤ 680
- กลาง x 8–88%, y 20–85% = ข้อความหนังสือ + รูป 2×2 (ต้องเรียบ)
- คอลัมน์ขวา ~12% = เสาธง + ดอกไม้ · ล่าง ~15% = อาคารเรียน ต้นไม้ (เนื้อหาจบที่ y 1306)

## พรอมต์แรก (บานเย็น)
Generate an image: a vertical poster BACKGROUND only, portrait 2:3 (1024x1536), for a Thai school "morning assembly report" one-page (Thai Border Patrol Police school in the countryside of north-east Thailand). Style: soft watercolor and gouache illustration, clean, elegant, print-ready, high quality. Theme colours: magenta pink, soft rose and warm gold accents on a very light blush-pink paper. Subject (decoration only): an early-morning scene - a tall white flagpole with the Thai national flag (red-white-blue-white-red horizontal stripes) waving, a soft rising sun with gentle rays, a simple one-storey Thai rural school building with a red roof, green trees, pink bougainvillea and golden shower (ratchaphruek) flowers, a few small birds. Layout rules (very important): 1) TOP-LEFT area (left 30% of width, top 22% of height) must be completely EMPTY and very light (a logo will be placed there). 2) The CENTER area from 8% to 88% of the width and from 20% down to 85% of the height must be clean, smooth, very light and almost empty (photos and text will cover it) - only a very faint paper texture. 3) Put the illustrations ONLY in: the TOP-RIGHT corner (the rising sun and the top of the flag), a narrow decorative column along the RIGHT edge (right 12% of width: the flagpole running down with flowers), and the bottom 15% of the height (the school building, trees, flowers and grass along the bottom edge). 4) The very bottom edge can be a soft magenta watercolor wash. No text, no letters, no numbers, no logos, no labels, no people, no faces, no hands, no frames, no boxes.

## สีต่อไป (ส่งในแชทเดียวกัน)
"Generate a NEW image in exactly the same watercolor style and exactly the same layout rules (…). Theme colours: X. Flowers: Y. Same Thai rural school with red roof, Thai national flag, rising sun. No text, no people."
- plum: royal purple, lavender & soft gold · purple orchids, lavender bougainvillea, golden shower
- sky: sky blue, indigo & soft gold · butterfly-pea, white jasmine, golden shower
- orange: warm orange, saffron, terracotta & gold · marigolds, flame-tree, golden shower
