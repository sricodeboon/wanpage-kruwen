# Phase 0 — ผล smoke test (spec 13.1)

บันทึกวัน/ผู้ทดสอบ/เครื่อง ในช่องผลของแต่ละข้อ

## T-00 share + upload
- ผล share sheet Android Chrome:
- ผล share sheet iPhone Safari:
- LINE รับไฟล์ PNG ~4 MB ได้หรือไม่:
- POST base64 ~7 MB ไป doPost → `ok:true`? ไฟล์ขึ้น Drive?:
- **CORS: github.io อ่าน response JSON ของ Apps Script ได้หรือไม่? ถ้าไม่ได้ → เปิด no-cors + fallback `?action=status` ใน `upload.js`**:
- หน้าเดียวกันผ่าน HtmlService (หลักฐานเรื่อง iframe/web-share):
- ขนาด PNG จริง (ภาพมีรูปถ่าย 4 ใบ):
- ขนาด JPEG q0.9 จริง:
- สรุป / การตัดสินใจ:

## T-01 LINE in-app
- UA detection (Android / iOS):
- `openExternalBrowser=1` เด้งออกจริงหรือไม่ (Android / iOS):
- พฤติกรรม share/บันทึกรูปเมื่อไม่ใส่ param:
- สรุป / การตัดสินใจ:

## T-02 CSV
- gviz fetch จาก github.io (CORS ได้ไหม, `Content-Type`):
- published CSV fetch จาก github.io (CORS, `Content-Type`):
- เวลา 10 ครั้ง (gviz):
- เวลา 10 ครั้ง (published):
- แก้ Sheet แล้วเห็นค่าใหม่ใน (gviz / published):
- ตัวหลักที่เลือก:

## T-03 iPhone
- HEIC จากคลัง → กลายเป็น JPEG หรือไม่:
- ถ่ายแนวตั้ง/หมุน 4 ทิศ → ภาพใน canvas ถูกทิศหรือไม่:
- `createImageBitmap` + `imageOrientation` ใน Safari เวอร์ชันที่ทดสอบ:
- สรุป:

## T-04 memory
- เครื่อง / RAM:
- เลือก 12 MP 4 รูปติดกัน + เรนเดอร์ ค้าง/แท็บรีโหลดหรือไม่:
- หน่วยความจำสูงสุด:
- สรุป:
