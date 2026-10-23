// ข้อมูลทดสอบ golden: ข้อมูลช่างกลฯ 8 + รูปตัวอย่าง 4 ใบ (แนวนอน/แนวตั้ง/สี่เหลี่ยม/EXIF หมุน)
export const SCHOOL = {
  name_full: 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8',
  address: 'บ้านโนนอุดมดี ต.ดอนเตย อ.นาทม จ.นครพนม 48140',
};

export const TEACHERS = [
  { display_name: 'ส.ต.ท.รัชเดช ศรีแก้ว', phone: '081-234-5678' },
  { display_name: 'ด.ต.หญิง สมหญิง ใจดีมีสุขสันต์', phone: '081-234-5678' },
  { display_name: 'ร.ต.อ.วิทยา เทพนาคราชา', phone: '089-765-4321' },
];

export const PHOTOS = [
  { label: 'อาคารเรียน', icon: 'building' },
  { label: 'สนามกีฬา / พื้นที่กิจกรรม', icon: 'field' },
  { label: 'แปลงเกษตรโรงเรียน', icon: 'farm' },
  { label: 'ทางเดินอาคารเรียน', icon: 'walkway' },
];

// ลำดับ = แนวนอน, แนวตั้ง, สี่เหลี่ยม, EXIF Orientation=6
export const PHOTO_FILES = [
  'tests/golden/fixtures/photo1.jpg',
  'tests/golden/fixtures/photo-portrait.jpg',
  'tests/golden/fixtures/photo-square.jpg',
  'tests/golden/fixtures/photo-exif6.jpg',
];
export const LOGO_FILE = 'tests/golden/fixtures/logo.png';

const base = () => ({
  school: { ...SCHOOL },
  title: 'รายงานภาพบรรยากาศและบริบทโรงเรียน',
  dateISO: '2026-10-23',
  teachers: [],
  photos: PHOTOS.map(p => ({ ...p })),
});

// คืนรายการเคสต่อแม่แบบ: ครู 1/2/3 + 3 เคสขอบ
export function casesFor(tplId) {
  const out = [];
  for (const n of [1, 2, 3]) {
    out.push({ name: `${tplId}-${n}`, title: `${tplId} · ครูเวร ${n} คน`, tpl: tplId, model: { ...base(), teachers: TEACHERS.slice(0, n) } });
  }
  const longLabel = { ...base(), teachers: TEACHERS.slice(0, 2) };
  longLabel.photos[1] = { label: 'กิจกรรมเข้าแถวเคารพธงชาติและสวดมนต์ตอนเช้าประจำวัน', icon: 'field' };
  longLabel.photos[3] = { label: 'ห้องสมุดและมุมอ่านหนังสือของนักเรียน', icon: 'walkway' };
  out.push({ name: `${tplId}-e1`, title: `${tplId} · ป้ายรูปยาว`, tpl: tplId, model: longLabel });

  const addr2 = { ...base(), teachers: TEACHERS.slice(0, 1) };
  addr2.school = {
    name_full: 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8 กองกำกับการตำรวจตระเวนชายแดนที่ 23',
    address: 'บ้านโนนอุดมดี หมู่ที่ 6 ตำบลดอนเตย อำเภอนาทม จังหวัดนครพนม รหัสไปรษณีย์ 48140 โทร 042-123-456',
  };
  out.push({ name: `${tplId}-e2`, title: `${tplId} · ชื่อโรงเรียน+ที่อยู่ 2 บรรทัด`, tpl: tplId, model: addr2 });

  const noPhone = { ...base(), teachers: TEACHERS.slice(0, 3).map((t, i) => (i === 1 ? { display_name: t.display_name } : t)) };
  out.push({ name: `${tplId}-e3`, title: `${tplId} · ครูไม่มีเบอร์`, tpl: tplId, model: noPhone });
  return out;
}
