// ตรวจรายวัน 06:00 (trigger ที่ setup() สร้าง) — อีเมลหา ALERT_EMAIL เมื่อผิดปกติ (spec 10.4)

var AUDIT_REJECT_ERROR_MAX = 5;
var AUDIT_OK_MAX = 40;
var AUDIT_STORAGE_RATIO = 0.8;

function dailyAudit() {
  var props = getProps_();
  var sh = getLogSheet_(props);
  var last = sh.getLastRow();
  var since = Date.now() - 24 * 3600 * 1000;
  var per = {}; // school_id -> {ok, bad}
  var totalOk = 0, totalBad = 0;
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var ts = logTsMillis_(rows[i][0]);
      if (!(ts >= since)) continue;
      var sid = String(rows[i][2]) || '(ไม่ทราบ)';
      var st = rows[i][13];
      if (!per[sid]) per[sid] = { ok: 0, bad: 0 };
      if (st === 'ok') { per[sid].ok++; totalOk++; }
      else if (st === 'rejected' || st === 'error') { per[sid].bad++; totalBad++; }
    }
  }

  var used = DriveApp.getStorageUsed();
  var limit = DriveApp.getStorageLimit();
  var ratio = limit > 0 ? used / limit : 0;

  var alerts = [];
  if (totalBad >= AUDIT_REJECT_ERROR_MAX) alerts.push('ถูกปฏิเสธ/ผิดพลาด ' + totalBad + ' ครั้งใน 24 ชม. (เกณฑ์ ' + AUDIT_REJECT_ERROR_MAX + ')');
  if (totalOk >= AUDIT_OK_MAX) alerts.push('บันทึกสำเร็จ ' + totalOk + ' ไฟล์ใน 24 ชม. (เกณฑ์ ' + AUDIT_OK_MAX + ') ตรวจว่าใช้งานปกติ');
  if (ratio >= AUDIT_STORAGE_RATIO) alerts.push('พื้นที่ Drive ใช้ไป ' + Math.round(ratio * 100) + '% (' + gb_(used) + ' / ' + gb_(limit) + ' GB)');

  if (props.REPORT_MISSING === 'true') {
    var missing = missingSchools_(props, sh, last);
    if (missing.length) alerts.push('ไม่ส่งรายงาน 3 วันทำการติด: ' + missing.join(', '));
  }

  var lines = Object.keys(per).sort().map(function (k) { return k + ': ok ' + per[k].ok + ', rejected/error ' + per[k].bad; });
  if (alerts.length && props.ALERT_EMAIL) {
    MailApp.sendEmail(props.ALERT_EMAIL, '[วันเพจครูเวร] ตรวจพบความผิดปกติ',
      alerts.join('\n') + '\n\nสรุป 24 ชม. ต่อโรงเรียน\n' + (lines.join('\n') || '(ไม่มี)'));
  }

  // สรุปรายสัปดาห์ทุกจันทร์ (u = 1 คือวันจันทร์)
  if (Utilities.formatDate(new Date(), TZ, 'u') === '1' && props.ALERT_EMAIL) {
    MailApp.sendEmail(props.ALERT_EMAIL, '[วันเพจครูเวร] สรุปรายสัปดาห์',
      'พื้นที่ Drive ' + gb_(used) + ' / ' + gb_(limit) + ' GB (' + Math.round(ratio * 100) + '%)\n\n24 ชม. ล่าสุด\n' + (lines.join('\n') || '(ไม่มี)'));
  }

  purgeOldCounters_();
  resetTodayCounts_(props);
  if (Number(props.RETENTION_DAYS) > 0) retentionSweep();
}

function gb_(bytes) { return (Math.round(bytes / 1e7) / 100).toFixed(2); }

// โรงเรียน active ที่ไม่มีรายการ ok เลยใน 3 วันทำการล่าสุด (นับย้อนเฉพาะ จ.–ศ.)
function missingSchools_(props, sh, last) {
  var days = [];
  var d = new Date(Date.now() - 86400000); // เริ่มจากเมื่อวาน: วันนี้ยังไม่จบ
  while (days.length < 3) {
    var dow = Utilities.formatDate(d, TZ, 'u');
    if (dow !== '6' && dow !== '7') days.push(Utilities.formatDate(d, TZ, 'yyyy-MM-dd'));
    d = new Date(d.getTime() - 86400000);
  }
  var seen = {};
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][13] === 'ok' && days.indexOf(logDateStr_(rows[i][3])) >= 0) seen[String(rows[i][2])] = true;
    }
  }
  var schools = readSchools_(props).rows;
  var out = [];
  for (var j = 0; j < schools.length; j++) {
    if (schools[j].active && !seen[schools[j].school_id]) out.push(schools[j].school_id);
  }
  return out;
}

// ลบตัวนับ rl: ของวันก่อน ๆ ออกจาก Script Properties
function purgeOldCounters_() {
  var sp = PropertiesService.getScriptProperties();
  var all = sp.getProperties();
  var today = todayBangkok_();
  for (var k in all) {
    if (k.indexOf('rl:') === 0 && k.indexOf(today) < 0) sp.deleteProperty(k);
  }
}

// RETENTION_DAYS > 0: ย้ายไฟล์ที่เก่ากว่ากำหนดลงถังขยะ (กู้ได้ 30 วัน)
function retentionSweep() {
  var props = getProps_();
  var days = Number(props.RETENTION_DAYS);
  if (!(days > 0)) return 0;
  var cutoff = Date.now() - days * 86400000;
  var root = DriveApp.getFolderById(props.ROOT_FOLDER_ID);
  var folders = root.getFolders();
  var n = 0;
  while (folders.hasNext()) {
    var files = folders.next().getFiles();
    while (files.hasNext()) {
      var f = files.next();
      if (f.getDateCreated().getTime() < cutoff) { f.setTrashed(true); n++; }
    }
  }
  console.log('retentionSweep trashed ' + n);
  return n;
}
