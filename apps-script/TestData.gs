// ทดสอบจาก editor (Run → เลือกฟังก์ชัน → ดู Execution log) — ไฟล์จริงจะถูกสร้างในโฟลเดอร์ Drive ของโรงเรียนทดสอบ
// ต้องตั้ง Script Properties และรัน setup() แล้ว · ตั้ง TEST_SCHOOL_ID ให้ตรงกับแถวใน schools

// โรงเรียนที่ใช้ทดสอบ: ตั้ง Script Property TEST_SCHOOL_ID (ไม่ตั้ง = changkon8)
// หมายเหตุ: runAllTests() ส่งไฟล์จริงหลายไฟล์ จึงใช้โควตารายวัน (MAX_PER_SCHOOL_PER_DAY) ของโรงเรียนนี้ด้วย
function testSchoolId_() {
  return PropertiesService.getScriptProperties().getProperty('TEST_SCHOOL_ID') || 'changkon8';
}

function crc32_(bytes) {
  var table = crc32_.table;
  if (!table) {
    table = crc32_.table = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
  }
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function be32_(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

function pngChunk_(type, data) {
  var typeBytes = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
  var body = typeBytes.concat(data);
  return be32_(data.length).concat(body, be32_(crc32_(body)));
}

// PNG ขาวดำ 1 บิต ขนาด w x h พื้นขาวล้วน (zlib แบบ stored block — ไม่ต้องบีบอัด)
function makeTestPng_(w, h) {
  var rowBytes = Math.ceil(w / 8);
  var raw = [];
  var r, c;
  for (r = 0; r < h; r++) {
    raw.push(0); // filter none
    for (c = 0; c < rowBytes; c++) raw.push(255);
  }
  var z = [0x78, 0x01];
  var pos = 0;
  while (pos < raw.length) {
    var len = Math.min(65535, raw.length - pos);
    var final = (pos + len >= raw.length) ? 1 : 0;
    z.push(final, len & 255, (len >>> 8) & 255, (~len) & 255, ((~len) >>> 8) & 255);
    for (var i = 0; i < len; i++) z.push(raw[pos + i]);
    pos += len;
  }
  var a = 1, b = 0;
  for (var j = 0; j < raw.length; j++) { a = (a + raw[j]) % 65521; b = (b + a) % 65521; }
  z = z.concat(be32_(((b << 16) | a) >>> 0));
  var ihdr = be32_(w).concat(be32_(h), [1, 0, 0, 0, 0]);
  var sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  var all = sig.concat(pngChunk_('IHDR', ihdr), pngChunk_('IDAT', z), pngChunk_('IEND', []));
  // Apps Script ใช้ไบต์แบบมีเครื่องหมาย (-128..127)
  return all.map(function (x) { return x > 127 ? x - 256 : x; });
}

function testPayload_(overrides) {
  var props = getProps_();
  var schools = readSchools_(props);
  var school = findSchool_(schools, testSchoolId_());
  if (!school) throw new Error('ไม่พบ ' + testSchoolId_() + ' ในแท็บ schools');
  var now = new Date();
  var bytes = makeTestPng_(1536, 2304);
  var p = {
    v: 1, app_key: props.APP_KEY, report_id: Utilities.getUuid(), school_id: testSchoolId_(),
    report_date: todayBangkok_(), teacher_ids: [testSchoolId_() + '-01'], teacher_names: ['ทดสอบ ระบบ'],
    template_id: 'test', template_version: 1, app_version: 1,
    file_name: 'วันเพจ_' + school.short_name + '_' + todayBangkok_() + '_' + Utilities.formatDate(now, TZ, 'HHmm') + '.png',
    mime: 'image/png', data_b64: Utilities.base64Encode(bytes), ua: 'AppsScript test'
  };
  for (var k in (overrides || {})) p[k] = overrides[k];
  return p;
}

function callDoPost_(p) {
  var out = doPost({ postData: { contents: typeof p === 'string' ? p : JSON.stringify(p) } });
  return JSON.parse(out.getContent());
}

function assert_(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
}

function test_pngHeader() {
  assert_(checkImageHeader(makeTestPng_(1536, 2304), 'image/png'), 'PNG 1536x2304 ต้องผ่าน');
  assert_(!checkImageHeader(makeTestPng_(1024, 1536), 'image/png'), 'PNG 1024x1536 ต้องไม่ผ่าน');
  var decoded = Utilities.base64Decode(Utilities.base64Encode(makeTestPng_(1536, 2304)));
  assert_(checkImageHeader(decoded, 'image/png'), 'ผ่าน base64 round-trip (signed bytes)');
  Logger.log('test_pngHeader ผ่าน');
}

function test_rejects_badKey() {
  var res = callDoPost_(testPayload_({ app_key: 'wrong-key' }));
  assert_(res.ok === false && res.error === 'BAD_KEY', 'คาด BAD_KEY ได้ ' + JSON.stringify(res));
  Logger.log('test_rejects_badKey ผ่าน');
}

function test_doPost_valid() {
  var res = callDoPost_(testPayload_());
  assert_(res.ok === true && res.dup === false && res.file_id, 'คาด ok ได้ ' + JSON.stringify(res));
  Logger.log('test_doPost_valid ผ่าน: ' + res.file_url);
}

function test_dedup() {
  var p = testPayload_();
  var first = callDoPost_(p);
  assert_(first.ok === true && first.dup === false, 'ส่งครั้งแรกต้อง ok ได้ ' + JSON.stringify(first));
  var second = callDoPost_(p);
  assert_(second.ok === true && second.dup === true && second.file_id === first.file_id, 'ส่งซ้ำต้อง dup ได้ ' + JSON.stringify(second));
  CacheService.getScriptCache().remove('rid:' + p.report_id); // ทดสอบเส้นทางค้นใน log ด้วย
  var third = callDoPost_(p);
  assert_(third.dup === true && third.file_id === first.file_id, 'ค้นใน log ต้องเจอ ได้ ' + JSON.stringify(third));
  Logger.log('test_dedup ผ่าน');
}

function test_rateLimit() {
  var props = getProps_();
  var keys = rateKeys(testSchoolId_(), todayBangkok_(), minuteBangkok_());
  var cache = CacheService.getScriptCache();
  var prev = cache.get(keys[2]);
  cache.put(keys[2], String(Number(props.MAX_PER_MINUTE)), 120); // เต็มโควตานาทีนี้
  try {
    var res = callDoPost_(testPayload_());
    // โควตานาทีเต็ม = ชั่วคราว (client ลองใหม่เอง)
    assert_(res.ok === false && res.error === 'RATE_LIMIT_MINUTE', 'คาด RATE_LIMIT_MINUTE ได้ ' + JSON.stringify(res));
  } finally {
    if (prev === null) cache.remove(keys[2]); else cache.put(keys[2], prev, 120);
  }
  Logger.log('test_rateLimit ผ่าน');
}

function runAllTests() {
  test_pngHeader();
  test_rejects_badKey();
  test_rateLimit();
  test_doPost_valid();
  test_dedup();
  Logger.log('ผ่านทั้งหมด');
}
