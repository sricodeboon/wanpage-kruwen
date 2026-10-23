// งานที่แตะ Drive / Sheet / Cache / Lock ของตัวรับไฟล์ (spec 10.3 ข้อ 5–11)

var LOG_HEADERS = ['ts_iso', 'report_id', 'school_id', 'report_date', 'teacher_ids', 'teacher_names',
  'template_id', 'template_version', 'app_version', 'file_id', 'file_url', 'bytes', 'mime',
  'status', 'error', 'ua_short', 'ms'];
var LOG_TAB = 'log';
var RID_TTL_SEC = 21600; // 6 ชม. = สูงสุดที่ CacheService อนุญาต

function truthy_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'ใช่';
}

// ---------- แท็บ schools ----------

function cellAt_(rowValues, headers, name) {
  return headers[name] ? rowValues[headers[name] - 1] : '';
}

// คืน { sheet, headers: {ชื่อหัว: คอลัมน์(1-based)}, rows: [{row, school_id, short_name, active, drive_folder_id}] }
function readSchools_(props) {
  var sheet = SpreadsheetApp.openById(props.SHEET_ID).getSheetByName('schools');
  var values = sheet.getDataRange().getValues();
  var headers = {};
  var i;
  for (i = 0; i < values[0].length; i++) headers[String(values[0][i]).trim()] = i + 1;
  var rows = [];
  for (i = 1; i < values.length; i++) {
    var first = String(values[i][0]).trim();
    if (first === '' || first.charAt(0) === '#') continue;
    rows.push({
      row: i + 1,
      school_id: first,
      short_name: String(cellAt_(values[i], headers, 'short_name')).trim(),
      active: truthy_(cellAt_(values[i], headers, 'active')),
      drive_folder_id: String(cellAt_(values[i], headers, 'drive_folder_id')).trim()
    });
  }
  return { sheet: sheet, headers: headers, rows: rows };
}

function findSchool_(schools, schoolId) {
  for (var i = 0; i < schools.rows.length; i++) {
    if (schools.rows[i].school_id === schoolId) return schools.rows[i];
  }
  return null;
}

function writeCell_(schools, row, colName, value) {
  var col = schools.headers[colName];
  if (!col) return; // ไม่มีคอลัมน์ = ข้าม (โค้ดอ้างด้วยชื่อหัว)
  schools.sheet.getRange(row, col).setValue(value);
}

// ---------- log (Spreadsheet ส่วนตัว) ----------

function getLogSheet_(props) {
  var ss = SpreadsheetApp.openById(props.LOG_SHEET_ID);
  var sh = ss.getSheetByName(LOG_TAB);
  if (!sh) sh = ss.insertSheet(LOG_TAB);
  // ts_iso (A) และ report_date (D) เป็นข้อความล้วน กัน Sheets แปลงเป็น Date
  // ตั้งซ้ำได้ไม่เสียหาย (idempotent) แต่ใช้ flag ใน cache ไม่ให้รันทุกคำขอ
  var cache = CacheService.getScriptCache();
  if (!cache.get('logfmt')) {
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('D:D').setNumberFormat('@');
    cache.put('logfmt', '1', 21600);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// ค่าจากแถว log ที่อาจถูก Sheets แปลงเป็น Date -> สตริง
function logDateStr_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v);
}

function logTsMillis_(v) {
  return v instanceof Date ? v.getTime() : Date.parse(v);
}

function appendLog_(props, p, status, error, fileId, fileUrl, bytes, t0) {
  p = p || {};
  var row = [
    new Date().toISOString(),
    String(p.report_id || ''), String(p.school_id || ''), String(p.report_date || ''),
    JSON.stringify(Array.isArray(p.teacher_ids) ? p.teacher_ids : []),
    JSON.stringify(Array.isArray(p.teacher_names) ? p.teacher_names : []),
    String(p.template_id || ''), p.template_version || '', p.app_version || '',
    fileId || '', fileUrl || '', bytes || 0, String(p.mime || ''),
    status, String(error || ''), String(p.ua || '').slice(0, 40), Date.now() - t0
  ];
  // ช่องข้อความที่ผู้ใช้ควบคุมได้ ป้องกันถูกตีความเป็นสูตร
  // ข้ามคอลัมน์ A และ D (รูปแบบ '@' เก็บ ' ตามตัวอักษร; ค่าเป็น ISO ที่ระบบสร้าง/ผ่านการตรวจแล้ว)
  for (var i = 0; i < row.length; i++) {
    if (i === 0 || i === 3) continue;
    if (typeof row[i] === 'string' && /^[=+\-@]/.test(row[i])) row[i] = "'" + row[i];
  }
  getLogSheet_(props).appendRow(row); // อะตอมมิก ไม่ต้อง lock
}

// log ล้มต้องไม่ทำให้คำตอบล้ม
function logSafe_(props, p, status, error, fileId, fileUrl, bytes, t0) {
  try {
    if (!props || !props.LOG_SHEET_ID) return;
    // ไม่ lock: appendRow ของ Sheets อะตอมมิกอยู่แล้ว
    appendLog_(props, p, status, error, fileId, fileUrl, bytes, t0);
  } catch (e) {
    console.error('log failed: ' + e);
  }
}

// ---------- dedup ----------

// คืน null | 'PENDING' | {file_id, file_url}
function findDuplicate_(props, reportId) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('rid:' + reportId);
  if (hit) {
    if (hit === 'pending') return 'PENDING';
    try { return JSON.parse(hit); } catch (e) { /* ตกไปค้นใน log */ }
  }
  // cache หมดอายุ (คิวค้างข้ามวัน) → ค้นใน log เฉพาะแถวสถานะ ok
  var sh = getLogSheet_(props);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var finder = sh.getRange(2, 2, last - 1, 1).createTextFinder(reportId).matchEntireCell(true);
  var found = finder.findAll();
  for (var i = 0; i < found.length; i++) {
    var r = found[i].getRow();
    var vals = sh.getRange(r, 1, 1, LOG_HEADERS.length).getValues()[0];
    if (vals[13] === 'ok') {
      var d = { file_id: String(vals[9]), file_url: String(vals[10]) };
      cache.put('rid:' + reportId, JSON.stringify(d), RID_TTL_SEC);
      return d;
    }
  }
  return null;
}

// ---------- rate limit ----------
// ตัวนับรายวันเก็บใน Script Properties (ไม่ใช่ cache) เพราะ cache อยู่ได้สูงสุด 6 ชม. → นับรายวันเพี้ยน
// ตัวนับรายนาทีใช้ cache (หมดอายุ 2 นาที) · ลบคีย์ rl: ของวันเก่าใน dailyAudit

function getCounter_(key) {
  if (key.indexOf('rl:min:') === 0) return parseInt(CacheService.getScriptCache().get(key) || '0', 10) || 0;
  return parseInt(PropertiesService.getScriptProperties().getProperty(key) || '0', 10) || 0;
}

function setCounter_(key, n) {
  if (n < 0) n = 0;
  if (key.indexOf('rl:min:') === 0) CacheService.getScriptCache().put(key, String(n), 120);
  else PropertiesService.getScriptProperties().setProperty(key, String(n));
}

function reserveSlot_(props, p) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    // lock ไม่ได้ ≠ ส่งบ่อยเกิน: ต้องให้ client retry ได้ (DRIVE_ERROR) ไม่ใช่ทิ้งรายงาน
    return { ok: false, error: 'DRIVE_ERROR', message: 'ระบบกำลังคับคั่ง ลองใหม่อัตโนมัติ' };
  }
  try {
    var cache = CacheService.getScriptCache();
    // ตรวจซ้ำใน lock: มีคำขอเดียวกันแทรกเข้ามาระหว่างทางไหม
    var again = cache.get('rid:' + p.report_id);
    if (again === 'pending') return { ok: false, error: 'DRIVE_ERROR', message: 'กำลังบันทึกรายงานนี้อยู่ ลองใหม่อีกครั้ง' };
    if (again) {
      try { return { ok: false, dup: JSON.parse(again) }; } catch (e2) { /* ไปต่อ */ }
    }
    var keys = rateKeys(p.school_id, todayBangkok_(), minuteBangkok_());
    var limits = [Number(props.MAX_PER_SCHOOL_PER_DAY), Number(props.MAX_TOTAL_PER_DAY), Number(props.MAX_PER_MINUTE)];
    var counts = [getCounter_(keys[0]), getCounter_(keys[1]), getCounter_(keys[2])];
    var over = rateLimitVerdict(counts, limits);
    if (over) return over;
    for (var i = 0; i < 3; i++) setCounter_(keys[i], counts[i] + 1);
    cache.put('rid:' + p.report_id, 'pending', 360);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// คืนสิทธิ์เมื่อบันทึกไม่สำเร็จ (client จะ retry ซึ่งต้องไม่ถูกนับซ้ำ)
function releaseSlot_(props, p) {
  try {
    CacheService.getScriptCache().remove('rid:' + p.report_id);
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var keys = rateKeys(p.school_id, todayBangkok_(), minuteBangkok_());
      for (var i = 0; i < 3; i++) setCounter_(keys[i], getCounter_(keys[i]) - 1);
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    console.error('release failed: ' + e);
  }
}

// ---------- Drive ----------

function resolveFolder_(props, schools, school) {
  if (school.drive_folder_id) {
    try {
      var f = DriveApp.getFolderById(school.drive_folder_id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* ไม่เจอ → ค้นหา/สร้างใหม่ */ }
  }
  var root = DriveApp.getFolderById(props.ROOT_FOLDER_ID);
  var it = root.getFoldersByName(school.short_name);
  var folder = it.hasNext() ? it.next() : null;
  var created = false;
  if (!folder) { folder = root.createFolder(school.short_name); created = true; }
  // เขียน id กลับใต้ lock (ถ้า lock ไม่ได้ก็ไม่เป็นไร รอบหน้าค้นจากชื่อเจอเหมือนเดิม)
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    try { writeCell_(schools, school.row, 'drive_folder_id', folder.getId()); }
    finally { lock.releaseLock(); }
  } catch (e2) {
    console.error('write folder id failed: ' + e2 + (created ? ' (created)' : ''));
  }
  return folder;
}

function saveToDrive_(props, school, p, bytes, ctx) {
  var schools = readSchools_(props); // อ่านสดเพื่อให้ row/headers ล่าสุด
  var fresh = findSchool_(schools, school.school_id) || school;
  var folder = resolveFolder_(props, schools, fresh);
  var blob = Utilities.newBlob(bytes, p.mime, p.file_name);
  var file = folder.createFile(blob);
  ctx.saved = true; // จากจุดนี้ไฟล์อยู่ใน Drive แล้ว: ห้ามคืนสิทธิ์/ลบ rid ใน cache
  try {
    file.setDescription(JSON.stringify({
    report_id: p.report_id, school_id: p.school_id, report_date: p.report_date,
    teacher_names: p.teacher_names, template_id: p.template_id,
    template_version: p.template_version, app_version: p.app_version,
    uploaded_at: new Date().toISOString()
    })); // ไม่ตั้ง sharing — ไฟล์เป็นของเจ้าของ script เท่านั้น
  } catch (e) {
    console.error('setDescription failed: ' + e); // metadata เสริม ไม่คุ้มที่จะทำให้ไฟล์ซ้ำ
  }
  return { file_id: file.getId(), file_url: file.getUrl(), bytes: bytes.length };
}

// ข้อ 10: log ok + cache rid + เขียน today_count / last_report_ts กลับแท็บ schools (ใต้ lock)
function finalizeSuccess_(props, school, p, saved, t0) {
  try {
    CacheService.getScriptCache().put('rid:' + p.report_id,
      JSON.stringify({ file_id: saved.file_id, file_url: saved.file_url }), RID_TTL_SEC);
  } catch (e0) {
    // ไฟล์อยู่ใน Drive แล้ว: cache ล้มต้องไม่ทำให้ตอบ error (client จะ retry → ไฟล์ซ้ำ); dedup ยังค้นจาก log ได้
    console.error('cache rid failed: ' + e0);
  }
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
  } catch (e) {
    console.error('finalize lock timeout: ' + e); // ไฟล์บันทึกแล้ว ห้ามทำให้ client retry จนเกิดไฟล์ซ้ำ
  }
  try {
    logSafe_(props, p, 'ok', '', saved.file_id, saved.file_url, saved.bytes, t0);
    try {
      var schools = readSchools_(props);
      var s = findSchool_(schools, p.school_id);
      if (s) {
        var today = todayBangkok_();
        writeCell_(schools, s.row, 'today_count', getCounter_(rateKeys(p.school_id, today, '')[0]));
        writeCell_(schools, s.row, 'last_report_ts', new Date().toISOString());
      }
    } catch (e2) {
      console.error('write schools failed: ' + e2);
    }
  } finally {
    if (locked) lock.releaseLock();
  }
}

// ---------- แจ้งเตือนโควตา (≤ 1 ฉบับ/ชม.) ----------

function alertQuota_(props, msg) {
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get('mail:quota')) return;
    cache.put('mail:quota', '1', 3600);
    if (!props.ALERT_EMAIL) return;
    MailApp.sendEmail(props.ALERT_EMAIL, '[วันเพจครูเวร] Drive โควตา/พื้นที่มีปัญหา',
      'ตัวรับไฟล์ตอบ DRIVE_ERROR เพราะ: ' + msg + '\n\nตรวจพื้นที่ Drive แล้วลบ/ย้ายไฟล์เก่า หรือตั้ง RETENTION_DAYS');
  } catch (e) {
    console.error('alert failed: ' + e);
  }
}

// ตั้ง today_count = 0 ทุกโรงเรียน (เรียกจาก dailyAudit 06:00)
function resetTodayCounts_(props) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    console.error('resetTodayCounts lock timeout: ' + e); // ไม่ให้ล้ม dailyAudit ทั้งงาน
    return;
  }
  try {
    var schools = readSchools_(props);
    var col = schools.headers['today_count'];
    if (!col) return;
    for (var i = 0; i < schools.rows.length; i++) {
      schools.sheet.getRange(schools.rows[i].row, col).setValue(0);
    }
  } finally {
    lock.releaseLock();
  }
}
