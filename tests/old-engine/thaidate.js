// ตัวช่วยวันที่ไทย — คำนวณจาก ISO ด้วย Date.UTC ไม่พึ่ง timezone เครื่อง
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const WEEKDAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

const bkk = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function bangkokParts(now) {
  const p = {};
  for (const { type, value } of bkk.formatToParts(now)) p[type] = value;
  return p;
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toISO(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayBangkok(now = new Date()) {
  const p = bangkokParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatThaiDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} พ.ศ. ${y + 543}`;
}

const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// "23 ต.ค. 2569" (พ.ศ.)
export function formatThaiDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y + 543}`;
}

export function thaiWeekday(iso) {
  return WEEKDAYS[new Date(parseISO(iso)).getUTCDay()];
}

export function stampHHmm(now = new Date()) {
  const p = bangkokParts(now);
  return `${p.hour}${p.minute}`;
}

export function addDaysISO(iso, n) {
  return toISO(parseISO(iso) + n * 86400000);
}

export function daysBetweenISO(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
