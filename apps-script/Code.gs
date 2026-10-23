// จุดเข้า Web App: doPost (รับไฟล์) / doGet (health, status) / setup (รันครั้งเดียวจาก editor)
// ลำดับตาม spec 10.3 — HTTP 200 JSON เสมอ

var TZ = 'Asia/Bangkok';
var SCHEMA_VERSION = 1;

var PROP_DEFAULTS = {
  UPLOAD_ENABLED: 'true',
  MAX_PER_SCHOOL_PER_DAY: '8',
  MAX_TOTAL_PER_DAY: '100',
  MAX_PER_MINUTE: '6',
  MAX_BYTES: '12000000',
  ALERT_EMAIL: 'dev.nathom@gmail.com',
  ARCHIVE_ALLOWED_MIME: 'image/png,image/jpeg',
  RETENTION_DAYS: '0',
  VERSION: '1'
};
var PROP_REQUIRED = ['SHEET_ID', 'LOG_SHEET_ID', 'ROOT_FOLDER_ID', 'APP_KEY'];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getProps_() {
  var stored = PropertiesService.getScriptProperties().getProperties();
  var out = {};
  var k;
  for (k in PROP_DEFAULTS) out[k] = PROP_DEFAULTS[k];
  for (k in stored) if (stored[k] !== '') out[k] = stored[k];
  return out;
}

function todayBangkok_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function minuteBangkok_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmm');
}

function doPost(e) {
  var t0 = Date.now();
  var p = null;
  var props = null;
  var result;
  var ctx = { pending: false, saved: false };
  try {
    props = getProps_();
    try {
      p = JSON.parse((e && e.postData && e.postData.contents) || '');
    } catch (err) {
      p = null;
    }
    result = processUpload_(p, props, t0, ctx);
  } catch (err2) {
    result = handleUploadException_(err2, p, props, t0, ctx);
  }
  result.ms = Date.now() - t0;
  return json_(result);
}

// คืน object ผลลัพธ์ (ไม่ throw ยกเว้นข้อผิดพลาดที่ไม่คาด → doPost จับเป็น DRIVE_ERROR)
function processUpload_(p, props, t0, ctx) {
  // ตรวจชั้นแรกโดยไม่แตะ Sheet: เชื่อ school_id ที่ส่งมาไปก่อน เพื่อตัด v/DISABLED/BAD_KEY/ฟิลด์ผิดทิ้งเร็ว
  var claimed = (p && typeof p.school_id === 'string') ? [p.school_id] : [];
  var pre = validatePayload(p, props, todayBangkok_(), claimed);
  if (!pre.ok) {
    logSafe_(props, p, 'rejected', pre.error, '', '', 0, t0);
    return { ok: false, error: pre.error, message: pre.message };
  }
  var schools = readSchools_(props);
  var schoolIds = [];
  var i;
  for (i = 0; i < schools.rows.length; i++) {
    if (schools.rows[i].active) schoolIds.push(schools.rows[i].school_id);
  }

  var check = validatePayload(p, props, todayBangkok_(), schoolIds);
  if (!check.ok) {
    logSafe_(props, p, 'rejected', check.error, '', '', 0, t0);
    return { ok: false, error: check.error, message: check.message };
  }
  var school = findSchool_(schools, p.school_id);

  // ข้อ 5: dedup (cache 6 ชม. แล้ว TextFinder ใน log)
  var dup = findDuplicate_(props, p.report_id);
  if (dup === 'PENDING') return { ok: false, error: 'DRIVE_ERROR', message: 'กำลังบันทึกรายงานนี้อยู่ ลองใหม่อีกครั้ง' };
  if (dup) return { ok: true, dup: true, file_id: dup.file_id, file_url: dup.file_url };

  // ข้อ 6: rate limit ใต้ lock + จองสถานะ pending กันส่งซ้อนพร้อมกัน
  var rl = reserveSlot_(props, p);
  if (!rl.ok && rl.dup) return { ok: true, dup: true, file_id: rl.dup.file_id, file_url: rl.dup.file_url };
  if (!rl.ok) {
    logSafe_(props, p, 'rejected', rl.error, '', '', 0, t0);
    return { ok: false, error: rl.error, message: rl.message };
  }

  ctx.pending = true;
  var saved;
  try {
    // ข้อ 7: decode + ตรวจ magic/ขนาดภาพ
    var bytes;
    try {
      bytes = Utilities.base64Decode(p.data_b64);
    } catch (decErr) {
      releaseSlot_(props, p);
      ctx.pending = false;
      logSafe_(props, p, 'rejected', 'INVALID', '', '', 0, t0);
      return { ok: false, error: 'INVALID', message: 'ข้อมูลไฟล์ไม่ถูกต้อง' };
    }
    if (bytes.length > Number(props.MAX_BYTES)) {
      releaseSlot_(props, p);
      ctx.pending = false;
      logSafe_(props, p, 'rejected', 'TOO_LARGE', '', '', bytes.length, t0);
      return { ok: false, error: 'TOO_LARGE', message: 'ไฟล์ใหญ่เกินไป' };
    }
    if (!checkImageHeader(bytes, p.mime)) {
      releaseSlot_(props, p);
      ctx.pending = false;
      logSafe_(props, p, 'rejected', 'INVALID', '', '', bytes.length, t0);
      return { ok: false, error: 'INVALID', message: 'ไฟล์ภาพไม่ถูกต้อง' };
    }
    // ข้อ 8–9
    saved = saveToDrive_(props, school, p, bytes, ctx);
  } catch (err) {
    if (!ctx.saved) {
      releaseSlot_(props, p);
      ctx.pending = false;
    }
    throw err;
  }

  // ข้อ 10: log + เขียน today_count/last_report_ts + cache rid
  finalizeSuccess_(props, school, p, saved, t0);
  ctx.pending = false;
  return { ok: true, dup: false, file_id: saved.file_id, file_url: saved.file_url };
}

function handleUploadException_(err, p, props, t0, ctx) {
  var msg = String((err && err.message) || err);
  try {
    if (ctx && ctx.pending && !ctx.saved && p && p.report_id) CacheService.getScriptCache().remove('rid:' + p.report_id);
  } catch (e1) { /* ไม่เป็นไร */ }
  logSafe_(props || {}, p, 'error', msg.slice(0, 200), '', '', 0, t0);
  if (/quota|storage/i.test(msg)) alertQuota_(props || {}, msg);
  return { ok: false, error: 'DRIVE_ERROR', message: 'บันทึกเข้า Drive ไม่สำเร็จ' };
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  try {
    var props = getProps_();
    if (action === 'health') {
      return json_({
        ok: true,
        version: props.VERSION,
        upload_enabled: props.UPLOAD_ENABLED === 'true',
        storage_used_gb: Math.round(DriveApp.getStorageUsed() / 1e7) / 100,
        storage_limit_gb: Math.round(DriveApp.getStorageLimit() / 1e7) / 100,
        today_count: getCounter_(rateKeys('-', todayBangkok_(), '')[1])
      });
    }
    if (action === 'status') {
      var rid = String((e.parameter && e.parameter.report_id) || '');
      if (!VALIDATE_UUID_RE.test(rid)) return json_({ ok: false, error: 'INVALID', message: 'รหัสรายงานไม่ถูกต้อง' });
      var d = findDuplicate_(props, rid);
      if (d && d !== 'PENDING') return json_({ ok: true, found: true, file_url: d.file_url });
      return json_({ ok: true, found: false, file_url: '' });
    }
    return json_({ ok: false, error: 'INVALID', message: 'ไม่รู้จักคำสั่งนี้' });
  } catch (err) {
    return json_({ ok: false, error: 'DRIVE_ERROR', message: 'ระบบขัดข้อง' });
  }
}

// รันครั้งเดียวจาก editor หลังตั้ง Script Properties: ตรวจค่า + สร้าง trigger + ตรวจสิทธิ์เข้าถึง
function setup() {
  var lines = [];
  var okAll = true;
  function mark(ok, text) { lines.push((ok ? '[ผ่าน] ' : '[ไม่ผ่าน] ') + text); if (!ok) okAll = false; }

  var sp = PropertiesService.getScriptProperties();
  var stored = sp.getProperties();
  var fill = {};
  var k;
  for (k in PROP_DEFAULTS) if (!stored[k]) fill[k] = PROP_DEFAULTS[k];
  if (Object.keys(fill).length) {
    sp.setProperties(fill, false);
    lines.push('[ตั้งค่าเริ่มต้น] ' + Object.keys(fill).join(', '));
  }
  stored = sp.getProperties();

  var i;
  for (i = 0; i < PROP_REQUIRED.length; i++) {
    mark(!!stored[PROP_REQUIRED[i]], 'Script Property ' + PROP_REQUIRED[i]);
  }
  mark(!!stored.ALERT_EMAIL && /@/.test(stored.ALERT_EMAIL), 'ALERT_EMAIL = ' + (stored.ALERT_EMAIL || '(ว่าง)'));

  // trigger dailyAudit 06:00 (ลบของเดิมก่อนกันซ้ำ)
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyAudit') { ScriptApp.deleteTrigger(triggers[i]); removed++; }
  }
  ScriptApp.newTrigger('dailyAudit').timeBased().everyDays(1).atHour(6).nearMinute(0).create();
  mark(true, 'trigger dailyAudit ทุกวัน 06:00 (ลบของเดิม ' + removed + ' ตัว)');

  // สิทธิ์เข้าถึงโฟลเดอร์และชีต
  if (stored.ROOT_FOLDER_ID) {
    try { mark(true, 'โฟลเดอร์หลัก: ' + DriveApp.getFolderById(stored.ROOT_FOLDER_ID).getName()); }
    catch (e1) { mark(false, 'เปิด ROOT_FOLDER_ID ไม่ได้: ' + e1.message); }
  }
  if (stored.SHEET_ID) {
    try {
      var ss = SpreadsheetApp.openById(stored.SHEET_ID);
      mark(!!ss.getSheetByName('schools'), 'Sheet สาธารณะ "' + ss.getName() + '" มีแท็บ schools');
    } catch (e2) { mark(false, 'เปิด SHEET_ID ไม่ได้: ' + e2.message); }
  }
  if (stored.LOG_SHEET_ID) {
    try {
      var ls = SpreadsheetApp.openById(stored.LOG_SHEET_ID);
      mark(true, 'Sheet log (ส่วนตัว) "' + ls.getName() + '"');
      getLogSheet_(stored);
      mark(true, 'แท็บ log พร้อมใช้ (สร้างหัวคอลัมน์ให้ถ้ายังไม่มี)');
    } catch (e3) { mark(false, 'เปิด LOG_SHEET_ID ไม่ได้: ' + e3.message); }
  }

  lines.push(okAll ? 'สรุป: พร้อม deploy เป็น Web App (Execute as me / Anyone)' : 'สรุป: ยังมีรายการไม่ผ่าน แก้แล้วรัน setup ใหม่');
  Logger.log('\n' + lines.join('\n'));
  return okAll;
}
