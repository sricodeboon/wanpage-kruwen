// รอฟอนต์ Kanit (ไทย + ละติน/ตัวเลข) ก่อนวาด canvas — ไม่พร้อมใน timeoutMs = คืน false (ห้ามวาด)
const SPECS = [
  ['700 39px Kanit', 'รายงานภาพ ปิ่น กู้ 0123456789'],
  ['500 24px Kanit', 'ที่อยู่ ญาติ ฐิติ 48140 081-234-5678'],
];

export async function ensureFonts({ timeoutMs = 3000, fontFaceSet = (typeof document !== 'undefined' ? document.fonts : null) } = {}) {
  if (!fontFaceSet) return false;
  let timer;
  const timeout = new Promise(res => { timer = setTimeout(() => res('timeout'), timeoutMs); });
  const loading = Promise.all(SPECS.map(([f, t]) => fontFaceSet.load(f, t))).then(() => 'ok', () => 'error');
  const r = await Promise.race([loading, timeout]);
  clearTimeout(timer);
  if (r !== 'ok') return false;
  return SPECS.every(([f, t]) => fontFaceSet.check(f, t));
}
