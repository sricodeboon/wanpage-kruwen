// คิวอัปโหลดสำเนา PNG เข้า Drive (spec 10) — ส่งเบื้องหลัง ครูเวรไม่ต้องรอ
// ล้มเหลว = เก็บใน IndexedDB แล้วลองใหม่ตามตาราง 0 / 30 วิ / 5 นาที / รอเปิดแอปครั้งถัดไป

const DB_NAME = 'wanpage';
const STORE = 'pending';
const MAX_ATTEMPTS = 8;
const MAX_AGE_MS = 7 * 86400000;

// ---------- ตัวช่วยเบราว์เซอร์ (ฉีดแทนได้ใน test) ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).replace(/^data:[^,]*;base64,/, ''));
    fr.onerror = () => reject(fr.error || new Error('อ่านไฟล์ไม่ได้'));
    fr.readAsDataURL(blob);
  });
}

async function blobToJpeg(blob, quality = 0.92) {
  const { createCanvas, canvasToBlob } = await import('./render.js');
  const bmp = await createImageBitmap(blob);
  const c = createCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return canvasToBlob(c, 'image/jpeg', quality);
}

export const ARCHIVE_JPEG_QUALITY = 0.9;

// สำเนาเข้า Drive ตาม config.archive_mime: 'image/jpeg' = แปลงเป็น JPEG q0.9 (.jpg) — ไฟล์ที่แชร์เข้ากลุ่มยังเป็น PNG
export async function archiveCopy(report, config, toJpeg = blobToJpeg) {
  if (config?.archive_mime !== 'image/jpeg') return report;
  const blob = await toJpeg(report.blob, ARCHIVE_JPEG_QUALITY);
  return { ...report, blob, mime: 'image/jpeg', file_name: report.file_name.replace(/\.png$/i, '.jpg') };
}

// "Android Chrome 130" — สั้นพอ ไม่เก็บข้อมูลเกินจำเป็น
export function shortUa(uaString = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  const s = String(uaString || '');
  const os = /Android/i.test(s) ? 'Android' : /iPhone|iPad|iPod/i.test(s) ? 'iOS' : /Windows/i.test(s) ? 'Windows' : /Mac OS X/i.test(s) ? 'Mac' : 'Other';
  let br = 'Browser'; let ver = '';
  let m;
  if ((m = s.match(/Line\/([\d]+)/i))) { br = 'LINE'; ver = m[1]; }
  else if ((m = s.match(/(?:Edg|EdgA|EdgiOS)\/(\d+)/))) { br = 'Edge'; ver = m[1]; }
  else if ((m = s.match(/(?:Chrome|CriOS)\/(\d+)/))) { br = 'Chrome'; ver = m[1]; }
  else if ((m = s.match(/(?:Firefox|FxiOS)\/(\d+)/))) { br = 'Firefox'; ver = m[1]; }
  else if ((m = s.match(/Version\/(\d+).*Safari/))) { br = 'Safari'; ver = m[1]; }
  return `${os} ${br} ${ver}`.trim().slice(0, 40);
}

// ---------- payload / การตัดสินผล ----------

export function buildPayload(report, config, b64, ua = shortUa()) {
  return {
    v: 1,
    app_key: config.app_key,
    report_id: report.report_id,
    school_id: report.school_id,
    report_date: report.report_date,
    teacher_ids: report.teacher_ids,
    teacher_names: report.teacher_names,
    template_id: report.template_id,
    template_version: report.template_version,
    app_version: config.app_version,
    file_name: report.file_name,
    mime: report.mime,
    data_b64: b64,
    ua: String(ua).slice(0, 40),
  };
}

const DROP = new Set(['BAD_KEY', 'DISABLED', 'INVALID', 'RATE_LIMIT', 'UNKNOWN_SCHOOL']);

export function classifyResponse(json) {
  if (json && (json.ok === true || json.dup === true)) return 'done';
  const e = json && json.error;
  if (DROP.has(e)) return 'drop';
  if (e === 'TOO_LARGE') return 'jpeg';
  if (e === 'RATE_LIMIT_MINUTE') return 'retry'; // โควตารายนาทีเต็ม = ชั่วคราว
  return 'retry'; // DRIVE_ERROR และทุกอย่างที่ไม่รู้จัก
}

// attempts = จำนวนครั้งที่ลองแล้ว; ≥3 = รอเปิดแอปครั้งถัดไป
export function nextTryAt(attempts, now) {
  if (attempts <= 0) return now;
  if (attempts === 1) return now + 30000;
  if (attempts === 2) return now + 300000;
  return Infinity;
}

function isDisabled(settings) {
  const v = settings && settings.upload_enabled;
  if (v === false) return true;
  return ['false', '0'].includes(String(v ?? '').trim().toLowerCase());
}

const getNow = (n) => (typeof n === 'function' ? n() : (n ?? Date.now()));

// ---------- คิว IndexedDB ----------

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function openQueue(idbFactory = indexedDB) {
  const db = await new Promise((resolve, reject) => {
    const o = idbFactory.open(DB_NAME, 1);
    o.onupgradeneeded = () => o.result.createObjectStore(STORE, { keyPath: 'report_id' });
    o.onsuccess = () => resolve(o.result);
    o.onerror = () => reject(o.error);
  });
  const store = (mode) => db.transaction(STORE, mode).objectStore(STORE);
  const q = {
    add: (item) => req(store('readwrite').put(item)).then(() => undefined), // report_id เดิม = ทับ (dedup)
    put: (item) => req(store('readwrite').put(item)).then(() => undefined),
    all: () => req(store('readonly').getAll()),
    remove: (id) => req(store('readwrite').delete(id)).then(() => undefined),
    async prune({ maxItems = 10, maxAgeDays = 7, now = Date.now() } = {}) {
      const items = (await q.all()).sort((a, b) => b.created - a.created);
      const cutoff = getNow(now) - maxAgeDays * 86400000;
      const keep = items.filter((i) => i.created >= cutoff).slice(0, maxItems);
      const keepIds = new Set(keep.map((i) => i.report_id));
      for (const i of items) if (!keepIds.has(i.report_id)) await q.remove(i.report_id);
    },
  };
  return q;
}

export async function enqueue(queue, report) {
  await queue.add({ ...report, attempts: 0, next_try: 0 });
}

// ---------- ส่ง ----------

async function postOnce(item, { fetchFn, config, toBase64, ua }) {
  const b64 = await toBase64(item.blob);
  const payload = buildPayload(item, config, b64, ua);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.upload_timeout_ms || 90000);
  try {
    const res = await fetchFn(config.upload_url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// lock ในโมดูล: เรียกซ้อนระหว่างกำลังส่ง = จดไว้ แล้ววนรอบใหม่หลังรอบปัจจุบันจบ (อ่าน queue.all() ใหม่)
// promise ที่คืนให้ผู้เรียกซ้อนจะ resolve หลังรอบใหม่นั้นจบ
let running = null;
let rerun = null; // opts ของรอบถัดไป (รวม appOpen แบบ OR)
let wakeTimer = null; // ตั้งปลุกครั้งเดียวที่ next_try ที่ใกล้ที่สุด

function clearWake() {
  if (wakeTimer !== null) { clearTimeout(wakeTimer); wakeTimer = null; }
}

// สำหรับ test/ปิดหน้า: ยกเลิกตัวปลุกที่ค้าง
export function stopUploadTimers() {
  clearWake();
  rerun = null;
}

export function drainQueue(opts) {
  if (running) {
    rerun = { ...opts, appOpen: Boolean(rerun?.appOpen || opts.appOpen) };
    return running;
  }
  clearWake();
  running = (async () => {
    let cur = opts;
    for (;;) {
      let result; let error = null;
      try { result = await doDrain(cur); } catch (e) { error = e; }
      if (rerun) { cur = rerun; rerun = null; continue; }
      await scheduleWake(cur);
      // มีคนเรียก drain ระหว่างรอ scheduleWake (อ่าน IDB) → วนอีกรอบ ไม่ให้คำขอหาย
      if (rerun) { cur = rerun; rerun = null; continue; }
      if (error) throw error;
      return result;
    }
  })().finally(() => { running = null; });
  return running;
}

// หลังจบรอบ: ยังมีรายการที่ next_try (ไม่ใช่ Infinity) อยู่ในอนาคต → ตั้งเวลาปลุกครั้งเดียวที่ตัวที่ใกล้สุด
async function scheduleWake(opts) {
  clearWake();
  if (isDisabled(opts.settings)) return;
  let items = [];
  try { items = await opts.queue.all(); } catch { return; }
  const now = getNow(opts.now);
  const times = items.map((i) => i.next_try).filter((t) => Number.isFinite(t) && t > now);
  if (!times.length) return;
  const delay = Math.min(Math.min(...times) - now, 2147483647); // setTimeout รับได้ไม่เกิน 2^31-1
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    drainQueue({ ...opts, appOpen: false }).catch(() => {});
  }, delay);
  wakeTimer?.unref?.(); // Node (test) ไม่ค้าง process
}

async function doDrain(opts) {
  const { queue, settings, onStatus = () => {}, appOpen = false } = opts;
  const fetchFn = opts.fetchFn || ((...a) => fetch(...a));
  const toBase64 = opts.toBase64 || blobToBase64;
  const toJpeg = opts.toJpeg || blobToJpeg;
  const ua = opts.ua ?? shortUa();
  const ctx = { fetchFn, config: opts.config, toBase64, ua };
  const result = { sent: 0, failed: 0, dropped: 0 };

  if (isDisabled(settings)) { onStatus('disabled'); return result; }

  // เปิดแอป: เก็บกวาดคิวก่อนหนึ่งครั้ง (ไม่ให้ล้มทั้งรอบถ้า prune พัง)
  if (appOpen) {
    try { await queue.prune({ maxItems: 10, maxAgeDays: 7, now: getNow(opts.now) }); } catch (e) { /* ข้าม */ }
  }

  const items = (await queue.all()).sort((a, b) => a.created - b.created);
  if (!items.length) { onStatus('idle'); return result; }

  for (const item of items) {
    try {
      await processItem(item);
    } catch (e) { /* ล้มรายการเดียว ไม่ล้มทั้งรอบ */ }
  }
  return result;

  async function processItem(item) {
    const now = getNow(opts.now);
    if (item.attempts >= MAX_ATTEMPTS || now - item.created > MAX_AGE_MS) {
      await queue.remove(item.report_id);
      onStatus('gave_up', item);
      return;
    }
    // Infinity = รอเปิดแอปครั้งถัดไป — เฉพาะรอบ appOpen เท่านั้นที่ลองใหม่
    if (item.next_try === Infinity ? !appOpen : item.next_try > now) return;

    onStatus('sending', item);
    let verdict; let jpegTried = false;
    for (;;) {
      try {
        const json = await postOnce(item, ctx);
        verdict = classifyResponse(json);
        item.last_error = json && json.error ? String(json.error) : null; // ให้หน้าเว็บโชว์รหัสได้
      } catch (e) {
        verdict = 'retry'; // network / timeout / parse ล้ม
      }
      if (verdict === 'jpeg' && !jpegTried) {
        jpegTried = true;
        try {
          item.blob = await toJpeg(item.blob);
          item.mime = 'image/jpeg';
          item.file_name = item.file_name.replace(/\.png$/i, '.jpg');
          continue;
        } catch (e) { verdict = 'retry'; }
      }
      break;
    }

    if (verdict === 'done') {
      await queue.remove(item.report_id); result.sent++; onStatus('sent', item);
    } else if (verdict === 'drop' || verdict === 'jpeg') {
      await queue.remove(item.report_id); result.dropped++; onStatus('dropped', item);
    } else {
      item.attempts = (item.attempts || 0) + 1;
      item.next_try = nextTryAt(item.attempts, getNow(opts.now));
      await queue.put(item);
      result.failed++; onStatus('retry', item);
    }
  }
}

// เรียกตอนเปิดแอป / แตะแถบสถานะ = appOpen (ลอง item ที่รอเปิดแอปได้)
export function startUpload(deps) {
  drainQueue({ appOpen: true, ...deps }).catch(() => {});
}

// ตัวกระตุ้น: กลับมา online / แท็บกลับมาเห็น
export function installTriggers(deps, win = window, doc = document) {
  const go = () => drainQueue({ ...deps, appOpen: false }).catch(() => {});
  win.addEventListener('online', go);
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') go(); });
}
