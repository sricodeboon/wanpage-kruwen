// ตรวจ payload แบบ pure — ห้ามเรียก service ของ Apps Script ในไฟล์นี้ (โหลดใน Node ผ่าน vm เพื่อ unit test)
// ใช้ function declaration เท่านั้น เพราะ .gs ทุกไฟล์ใช้ global scope ร่วมกัน

var VALIDATE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var VALIDATE_SCHOOL_RE = /^[a-z0-9_]{2,24}$/;
var VALIDATE_FILE_RE = /^วันเพจ_[^/\\:*?"<>|]{1,24}_\d{4}-\d{2}-\d{2}_\d{4}\.(png|jpg)$/;
var VALIDATE_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
var EXPECTED_PNG_W = 1536;
var EXPECTED_PNG_H = 2304;
var MAX_REPORT_AGE_DAYS = 7;

function vFail_(error, message) {
  return { ok: false, error: error, message: message };
}

// 'YYYY-MM-DD' -> จำนวนวันนับจาก epoch (UTC) หรือ null ถ้าไม่ใช่วันที่จริง
function isoToDayNumber(iso) {
  var m = VALIDATE_DATE_RE.exec(String(iso));
  if (!m) return null;
  var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  var t = Date.UTC(y, mo - 1, d);
  var back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

function splitList_(s) {
  return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}

function isStringArray_(a, maxLen) {
  if (!Array.isArray(a) || a.length > 20) return false;
  for (var i = 0; i < a.length; i++) {
    if (typeof a[i] !== 'string' || a[i].length > maxLen) return false;
  }
  return true;
}

// spec 10.3 ข้อ 1–4 · props = ค่า Script Properties (สตริงทั้งหมด) · schoolIds = school_id ที่ active ใน Sheet
function validatePayload(p, props, todayISO, schoolIds) {
  props = props || {};
  if (!p || typeof p !== 'object' || p.v !== 1) return vFail_('INVALID', 'รูปแบบข้อมูลไม่ถูกต้อง');
  if (props.UPLOAD_ENABLED !== 'true') return vFail_('DISABLED', 'ปิดการบันทึกชั่วคราว');

  var key = typeof p.app_key === 'string' ? p.app_key : '';
  var okKey = key !== '' && (key === props.APP_KEY || (!!props.APP_KEY_PREV && key === props.APP_KEY_PREV));
  if (!okKey) return vFail_('BAD_KEY', 'รหัสแอปไม่ถูกต้อง');

  if (typeof p.school_id !== 'string' || !VALIDATE_SCHOOL_RE.test(p.school_id)) return vFail_('INVALID', 'รหัสโรงเรียนไม่ถูกต้อง');
  if ((schoolIds || []).indexOf(p.school_id) < 0) return vFail_('UNKNOWN_SCHOOL', 'ไม่พบโรงเรียนนี้');

  if (typeof p.report_id !== 'string' || !VALIDATE_UUID_RE.test(p.report_id)) return vFail_('INVALID', 'รหัสรายงานไม่ถูกต้อง');

  var reportDay = isoToDayNumber(p.report_date);
  var today = isoToDayNumber(todayISO);
  if (reportDay === null || today === null) return vFail_('INVALID', 'วันที่ไม่ถูกต้อง');
  var age = today - reportDay;
  if (age < 0 || age > MAX_REPORT_AGE_DAYS) return vFail_('INVALID', 'วันที่รายงานอยู่นอกช่วงที่รับ');

  var allowed = splitList_(props.ARCHIVE_ALLOWED_MIME || 'image/png,image/jpeg');
  if (typeof p.mime !== 'string' || allowed.indexOf(p.mime) < 0) return vFail_('INVALID', 'ชนิดไฟล์ไม่รับ');

  var fm = typeof p.file_name === 'string' ? VALIDATE_FILE_RE.exec(p.file_name) : null;
  if (!fm) return vFail_('INVALID', 'ชื่อไฟล์ไม่ถูกต้อง');
  var extMime = fm[1] === 'png' ? 'image/png' : 'image/jpeg';
  if (extMime !== p.mime) return vFail_('INVALID', 'นามสกุลไฟล์ไม่ตรงชนิดไฟล์');

  if (!isStringArray_(p.teacher_ids, 64) || !isStringArray_(p.teacher_names, 80)) return vFail_('INVALID', 'รายชื่อครูไม่ถูกต้อง');

  if (typeof p.data_b64 !== 'string' || p.data_b64.length === 0) return vFail_('INVALID', 'ไม่มีข้อมูลไฟล์');
  var maxBytes = Number(props.MAX_BYTES) || 12000000;
  if (p.data_b64.length > maxBytes * 1.37) return vFail_('TOO_LARGE', 'ไฟล์ใหญ่เกินไป');

  return { ok: true };
}

// bytes = อาร์เรย์เลข (Utilities.base64Decode คืน signed -128..127 → & 255 ให้เอง)
function checkImageHeader(bytes, mime) {
  if (!bytes) return false;
  function b(i) { return (bytes[i] & 255); }
  if (mime === 'image/png') {
    if (bytes.length < 24) return false;
    var magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (var i = 0; i < 8; i++) if (b(i) !== magic[i]) return false;
    // IHDR: ไบต์ 12–15 = 'IHDR', 16–19 = กว้าง, 20–23 = สูง (big-endian)
    if (b(12) !== 0x49 || b(13) !== 0x48 || b(14) !== 0x44 || b(15) !== 0x52) return false;
    var w = b(16) * 16777216 + b(17) * 65536 + b(18) * 256 + b(19);
    var h = b(20) * 16777216 + b(21) * 65536 + b(22) * 256 + b(23);
    return w === EXPECTED_PNG_W && h === EXPECTED_PNG_H;
  }
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
  }
  return false;
}

// nowMinute = 'YYYYMMDDHHmm' (เวลาไทย)
function rateKeys(schoolId, todayISO, nowMinute) {
  return ['rl:school:' + schoolId + ':' + todayISO, 'rl:all:' + todayISO, 'rl:min:' + nowMinute];
}

// counts/limits เรียงตาม rateKeys: [โรงเรียน/วัน, ทั้งหมด/วัน, ทั้งหมด/นาที]
// โควตารายวันเต็ม = RATE_LIMIT (client ไม่ retry); โควตานาทีเต็ม = ชั่วคราว → RATE_LIMIT_MINUTE (client retry)
function rateLimitVerdict(counts, limits) {
  if (counts[0] >= limits[0] || counts[1] >= limits[1]) return vFail_('RATE_LIMIT', 'ส่งบ่อยเกินกำหนด');
  if (counts[2] >= limits[2]) return vFail_('RATE_LIMIT_MINUTE', 'ระบบกำลังคับคั่ง ลองใหม่อัตโนมัติ');
  return null;
}
