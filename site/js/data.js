// โหลดข้อมูล 3 ชั้น: cache (localStorage wp.data) -> fetch Sheet CSV -> snapshot ที่แถมมากับเว็บ
import { parseCSV, rowsToObjects, parseBool, normalizePhone } from './csv.js';

const KEY = 'wp.data';
export const TABS = ['schools', 'teachers', 'photo_labels', 'settings'];
// คอลัมน์ที่ต้องมีในแถวหัวของแต่ละแท็บ (ใช้ร่วมกับ tools/snapshot.mjs)
// ขาด = gviz รวมแถวหัวเพี้ยน/ผิดแท็บ/Sheet ถูกแก้ → ถือว่าดึงไม่สำเร็จ ไม่เขียนทับข้อมูลเดิม
export const REQUIRED_COLUMNS = {
  schools: ['school_id', 'short_name', 'name_full'],
  teachers: ['teacher_id', 'school_id', 'display_name'],
  photo_labels: ['label'],
  settings: ['key', 'value'],
};

// แถว CSV ที่ parse แล้ว → object; โยน error ถ้าคอลัมน์ที่ต้องมีหายไป
export function tabRowsToObjects(tab, rows) {
  const header = (rows[0] || []).map((h) => String(h).trim());
  const missing = (REQUIRED_COLUMNS[tab] || []).filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`${tab}: ไม่พบคอลัมน์ ${missing.join(', ')}`);
  return rowsToObjects(rows);
}
export const CACHE_MAX_AGE_MS = 7 * 86400000;

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : Infinity; };
const bySort = (a, b) => num(a.sort_order) - num(b.sort_order);
// ไม่มีคอลัมน์ active เลย = ถือว่าใช้งาน; มีคอลัมน์แต่ว่าง = ไม่ใช้
const isActive = (r) => (r.active === undefined ? true : parseBool(r.active));
const str = (v) => String(v ?? '').trim();

export function buildModel(raw) {
  const schools = (raw.schools || []).filter(isActive).sort(bySort).map((s) => ({
    school_id: str(s.school_id),
    short_name: str(s.short_name),
    name_full: str(s.name_full),
    address: str(s.address),
    province: str(s.province),
    logo_file: str(s.logo_file),
    default_bg: str(s.default_bg),
    sort_order: Number.isFinite(num(s.sort_order)) ? num(s.sort_order) : 0,
  }));
  const teachersBySchool = {};
  for (const s of schools) teachersBySchool[s.school_id] = [];
  for (const t of (raw.teachers || []).filter(isActive).sort(bySort)) {
    const list = teachersBySchool[str(t.school_id)];
    if (!list) continue; // โรงเรียนไม่มี/ถูกซ่อน
    list.push({
      teacher_id: str(t.teacher_id),
      school_id: str(t.school_id),
      display_name: str(t.display_name),
      phone: normalizePhone(t.phone),
    });
  }
  const labels = (raw.photo_labels || []).filter(isActive).sort(bySort)
    .map((l) => ({ label: str(l.label), icon: str(l.icon) || 'camera' }));
  const settings = {};
  if (Array.isArray(raw.settings)) for (const r of raw.settings) { if (str(r.key)) settings[str(r.key)] = str(r.value); }
  else Object.assign(settings, raw.settings || {});
  return { schools, teachersBySchool, labels, settings, phonesMissing: computePhonesMissing(teachersBySchool) };
}

function computePhonesMissing(bySchool) {
  const all = Object.values(bySchool).flat();
  return all.length > 0 && all.every((t) => !t.phone);
}

const rawFromCache = (c) => ({ schools: c.schools, teachers: c.teachers, photo_labels: c.labels, settings: c.settings });

function readCache(storage) {
  try {
    const c = JSON.parse(storage.getItem(KEY));
    if (c && typeof c.fetched_at === 'number' && Array.isArray(c.schools) && Array.isArray(c.teachers)) return c;
  } catch { /* cache เสีย = ถือว่าไม่มี */ }
  return null;
}

async function fetchText(fetchFn, url, timeoutMs, requireCsv) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('http');
    if (requireCsv && !/text\/csv/i.test(res.headers?.get?.('content-type') || '')) throw new Error('not csv');
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function fetchTab(config, fetchFn, tab) {
  const timeout = config.csv_timeout_ms || 6000;
  const gviz = String(config.sheet_csv_gviz || '').replace('SHEET_ID', config.sheet_id || '').replace('{sheet}', tab);
  const urls = [];
  if (gviz) urls.push([gviz, true]);
  const pub = config.sheet_csv_published?.[tab];
  if (pub) urls.push([pub, false]);
  for (const [url, requireCsv] of urls) {
    try { return tabRowsToObjects(tab, parseCSV(await fetchText(fetchFn, url, timeout, requireCsv))); } catch { /* ลองทางถัดไป */ }
  }
  throw new Error('fetch failed: ' + tab);
}

export async function refreshData({ config, storage, fetchFn, now = Date.now() }) {
  try {
    const [schools, teachers, labels, settings] = await Promise.all(TABS.map((t) => fetchTab(config, fetchFn, t)));
    const raw = { schools, teachers, photo_labels: labels, settings };
    const model = buildModel(raw);
    if (!model.schools.length) throw new Error('ไม่พบโรงเรียน'); // ของเสีย ไม่ทับ wp.data
    try {
      storage.setItem(KEY, JSON.stringify({
        fetched_at: Number(now), data_version: model.settings.data_version || '',
        schools, teachers, labels, settings,
      }));
    } catch { /* เต็ม/ถูกบล็อก: ใช้ต่อได้ในหน่วยความจำ */ }
    return model;
  } catch { return null; }
}

export async function loadData({ config, storage, fetchFn, now = Date.now(), snapshot }) {
  const cache = readCache(storage);
  const t = Number(now);
  if (cache && t - cache.fetched_at < CACHE_MAX_AGE_MS) {
    // เบื้องหลัง ไม่รอ — คืน promise ให้หน้าเว็บ merge ข้อมูลใหม่เมื่อมาถึง
    const refreshed = refreshData({ config, storage, fetchFn, now: t }).catch(() => null);
    return { model: buildModel(rawFromCache(cache)), source: 'cache', stale: false, refreshed };
  }
  const none = Promise.resolve(null);
  const fresh = await refreshData({ config, storage, fetchFn, now: t });
  if (fresh) return { model: fresh, source: 'fresh', stale: false, refreshed: none };
  if (cache) return { model: buildModel(rawFromCache(cache)), source: 'cache', stale: true, refreshed: none };
  const model = { schools: [], teachersBySchool: {}, labels: [], settings: {}, ...snapshot };
  model.phonesMissing = computePhonesMissing(model.teachersBySchool);
  return { model, source: 'snapshot', stale: true, refreshed: none };
}
