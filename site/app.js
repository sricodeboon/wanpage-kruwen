// หน้าครูเวร — ผูกโมดูลทั้งหมดเข้าด้วยกัน (spec 7)
// state machine: boot → data → form → rendering → confirm → sharing → done
import { todayBangkok, formatThaiDate, formatThaiDateShort, thaiWeekday, stampHHmm, addDaysISO } from './js/thaidate.js';
import { loadData, refreshData } from './js/data.js';
import { filterTemplates, photoRects } from './js/layout.js';
import { createCanvas, canvasToBlob, renderOnePage } from './js/render.js';
import { ensureFonts } from './js/fonts.js';
import { isLineInApp, saveMode, externalBrowserUrl, canShareFile, sharePng, downloadFile, buildShareText } from './js/share.js';
import { enqueue, archiveCopy } from './js/upload.js';
import {
  validateForm, toggleTeacher, dateGuard, rollToday, reportFileName, buildRenderModel,
  pickBackground, reconcileSelection, nextSentRecord, isSentToday, nameParts, MSG, MAX_TEACHERS, MAX_BACK_DAYS,
} from './js/form.js';
import { createPreview } from './js/preview-ui.js';
import { createDrive } from './js/drive-ui.js';
import { createPhotos } from './js/photos-ui.js';
import { loadJsonCached, validConfig, validTemplates } from './js/remote-json.js';
import { createImageLoader, logoSrc, loadFinalAssets, loadPreviewAssets, AssetError } from './js/assets.js';
import { panel, sheet, busyShow, busyHide, toast, info, closeAll, pulse } from './js/ui.js';

const $ = (id) => document.getElementById(id);
const PROVINCE_TH = { np: 'นครพนม', sn: 'สกลนคร', mdh: 'มุกดาหาร' };
const MSG_FONTS = 'กำลังโหลดฟอนต์… (ครั้งแรกต้องต่อเน็ต)';
const FOLD = 8; // ① แสดงครู 8 คนแรก ที่เหลือพับไว้
const WEEKDAY_SHORT = { อาทิตย์: 'อา.', จันทร์: 'จ.', อังคาร: 'อ.', พุธ: 'พ.', พฤหัสบดี: 'พฤ.', ศุกร์: 'ศ.', เสาร์: 'ส.' };

// ---------- บันทึกเหตุการณ์ (ring buffer 50) ----------
const debugLog = [];
function log(...parts) {
  debugLog.push(`${new Date().toISOString()} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}`);
  if (debugLog.length > 50) debugLog.shift();
  console.info('[wanpage]', ...parts);
}

// ---------- storage: localStorage ถูกบล็อกได้ (แตะ global ก็ throw) → ใช้ memory แทน ----------
function safeStorage() {
  try {
    const s = window.localStorage;
    s.setItem('wp.__t', '1');
    s.removeItem('wp.__t');
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
  }
}
const storage = safeStorage();
const ls = {
  get(k) { try { return storage.getItem(k); } catch { return null; } },
  set(k, v) { try { storage.setItem(k, v); } catch { /* ข้าม */ } },
  json(k) { try { return JSON.parse(storage.getItem(k)); } catch { return null; } },
};

// ---------- สถานะ ----------
const app = {
  phase: 'boot', config: {}, configFresh: false, model: null, templatesAll: null, templates: [], today: todayBangkok(),
  lastFile: null, lastReport: null, lastReportShared: false, queue: null,
  teachersOpen: null, // null = เปิด/พับตามครูที่เลือก · true/false = ครูกดเอง (จำต่อ session)
  cheered: false, cheerTimer: 0, // D5 เล่นครั้งแรกของรอบฟอร์มเท่านั้น
};
const state = { schoolId: null, dateISO: app.today, selectedTeacherIds: [], photos: [null, null, null, null], bgId: null };

function setPhase(p, extra) {
  log('state', app.phase, '→', p, extra || '');
  app.phase = p;
  document.body.dataset.state = p;
  if (p !== 'boot' && p !== 'data') hideBoot();
}

// หน้าเปิดแอป (D1): โหลดเร็วกว่า 150 ms หรือลดการเคลื่อนไหว = ซ่อนทันที ไม่เล่นออก
function hideBoot() {
  const el = $('boot');
  if (!el || el.hidden || el.classList.contains('boot-out')) return;
  if (performance.now() < 150 || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.hidden = true; return; }
  el.classList.add('boot-out');
  setTimeout(() => { el.hidden = true; }, 180);
}

const school = () => app.model?.schools.find((s) => s.school_id === state.schoolId) || null;
const teachers = () => app.model?.teachersBySchool[state.schoolId] || [];
const template = () => app.templates.find((t) => t.id === state.bgId) || null;
const shortSchoolName = (s) => (s.name_full || '').replace(/^โรงเรียนตำรวจตระเวนชายแดน/, '') || s.short_name;
const renderModel = () => buildRenderModel(state, app.model, app.model.settings.title_text);

// ---------- โหลดรูป/asset (same-origin, จำไว้, หมดเวลา 10 วิ) ----------
const loadImage = createImageLoader();

// พรีวิว: ขาดพื้นหลัง/ตราได้
async function gatherAssets(photoFn) {
  const [{ bg, logo }, photos] = await Promise.all([
    loadPreviewAssets({ tpl: template(), school: school(), loadImage }), Promise.all([0, 1, 2, 3].map(photoFn)),
  ]);
  return { bg, logo, photos };
}

// ---------- ส่วนย่อย ----------
const preview = createPreview({ state, $, ls, log, ready: () => Boolean(app.model && state.schoolId), template, gatherAssets, renderModel });
const drive = createDrive({ app, $, log, esc, school });
const onChange = () => { refreshValidity(); preview.schedule(); };
const photos = createPhotos({ app, state, $, log, esc, showMsg, template, preview, onChange });

// ---------- boot ----------
async function boot() {
  setPhase('boot');
  $('retryLoad').onclick = () => location.reload(); // ต้องใช้ได้แม้โหลดข้อมูลล้ม
  setupLineBar();
  // config.json ล้ม → ใช้สำเนาล่าสุด (wp.config) ให้ upload_url/sheet_id ยังใช้ได้
  const cfg = await loadJsonCached({ url: 'config.json', key: 'wp.config', storage, fetchFn: (...a) => fetch(...a), validate: validConfig, fetchOpts: { cache: 'no-cache' } });
  app.config = cfg.data || {};
  app.configFresh = cfg.source === 'fresh';
  log('config', cfg.source);
  const [result] = await Promise.all([loadModel(), loadTemplates()]);
  if (!result) return;
  applyModel(result.model, result.source, result.stale);
  result.refreshed?.then((m) => { if (m) { log('data refreshed'); mergeModel(m); } });
  drive.setup();
  bindForm();
  document.fonts?.ready?.then(() => preview.schedule());
  ensureFonts({ timeoutMs: 8000 }).then((ok) => { log('fonts', ok); if (ok) preview.schedule(); });
}

// templates.json ล้ม → สำเนาล่าสุด (wp.templates); ไม่มีเลย → templatesAll = null (ข้อความโหลดไม่ได้ + ลองใหม่)
async function loadTemplates() {
  const r = await loadJsonCached({ url: 'templates.json', key: 'wp.templates', storage, fetchFn: (...a) => fetch(...a), validate: validTemplates });
  log('templates', r.source);
  app.templatesAll = r.data;
  return r.data;
}

async function retryTemplates() {
  $('retryTemplates').disabled = true;
  try {
    if (!(await loadTemplates()) || !school()) return;
    applyTemplates(school());
    renderBackgrounds();
    photos.render();
    onChange();
  } finally { $('retryTemplates').disabled = false; }
}

function applyTemplates(s) {
  app.templates = app.templatesAll ? filterTemplates(app.templatesAll, s.province) : [];
  state.bgId = pickBackground(app.templates, ls.get(`wp.bg.${s.school_id}`), s.default_bg);
}

async function loadModel() {
  setPhase('data');
  let snapshot = {};
  try { snapshot = await (await fetch('data/snapshot.json')).json(); } catch { /* ไม่มีก็ได้ */ }
  try {
    const r = await loadData({ config: app.config, storage, fetchFn: (...a) => fetch(...a), snapshot });
    log('data', r.source, r.stale ? 'stale' : '');
    return r;
  } catch (e) {
    log('data error', String(e));
    hideBoot(); // ไม่บังข้อความโหลดไม่ได้
    $('loadFail').hidden = false;
    return null;
  }
}

function applyModel(model, source, stale) {
  app.model = model;
  if (checkAppVersion(model.settings)) return;
  showNotice(model.settings);
  const badge = $('dataBadge');
  badge.hidden = !(source === 'snapshot' || stale);
  badge.textContent = source === 'snapshot' ? 'ใช้ข้อมูลสำรอง (ไม่ได้ต่อเน็ต)' : 'ใช้ข้อมูลที่บันทึกไว้ในเครื่อง (ไม่ได้ต่อเน็ต)';
  $('loadFail').hidden = model.schools.length > 0;
  chooseSchool();
  setPhase('form');
}

// ข้อมูลใหม่จากเบื้องหลัง: แทนโมเดล คงสิ่งที่ครูติ๊ก/รูป/พื้นหลังไว้
function mergeModel(model) {
  app.model = model;
  $('dataBadge').hidden = true;
  showNotice(model.settings);
  if (checkAppVersion(model.settings)) return;
  // ลิงก์ ?s= ของโรงเรียนที่ข้อมูลในเครื่องยังไม่มี → ข้อมูลใหม่มีแล้ว ให้สลับไปโรงเรียนตามลิงก์
  const pending = app.urlSchoolPending;
  if (pending && model.schools.some((s) => s.school_id === pending)) { setSchool(pending); return; }
  if (!school()) { chooseSchool(); return; }
  state.selectedTeacherIds = reconcileSelection(state.selectedTeacherIds, teachers());
  renderHeader();
  renderTeachers();
  onChange();
}

function checkAppVersion(settings) {
  // config.json โหลดไม่ได้ (ใช้สำเนา/ว่าง) = ไม่รู้เวอร์ชันจริงของหน้านี้ → ห้าม reload
  if (!app.configFresh) return false;
  const min = Number(settings.min_app_version || 0);
  if (min > Number(app.config.app_version || 0)) {
    let done = false;
    try { done = sessionStorage.getItem('wp.reloaded') === '1'; sessionStorage.setItem('wp.reloaded', '1'); } catch { done = true; }
    if (!done) { log('reload for min_app_version', min); location.reload(); return true; }
  }
  return false;
}

function showNotice(settings) {
  const n = $('notice');
  n.hidden = !settings.notice_text;
  n.textContent = settings.notice_text || '';
  const warn = settings.notice_level === 'warn';
  n.classList.toggle('alert-warning', warn);
  n.classList.toggle('alert-primary', !warn);
}

function setupLineBar() {
  if (!isLineInApp(navigator.userAgent)) return;
  $('lineBar').hidden = false;
  $('lineBarLink').href = externalBrowserUrl(location.href);
}

// ---------- โรงเรียน ----------
function chooseSchool() {
  const schools = app.model.schools;
  $('schoolSelect').innerHTML = '<option value="">— เลือกโรงเรียน —</option>' + schools
    .map((s) => `<option value="${esc(s.school_id)}">${esc(s.name_full || s.short_name)}</option>`).join('');
  const fromUrl = new URLSearchParams(location.search).get('s');
  const pick = [fromUrl, ls.get('wp.school')].find((id) => id && schools.some((s) => s.school_id === id));
  app.urlSchoolPending = fromUrl && pick !== fromUrl ? fromUrl : null;
  if (pick) setSchool(pick); else { $('schoolPick').hidden = schools.length === 0; renderAllSections(); }
}

function setSchool(id) {
  app.urlSchoolPending = null;
  state.schoolId = id;
  ls.set('wp.school', id);
  $('schoolPick').hidden = true;
  $('schoolSelect').value = id;
  state.selectedTeacherIds = [];
  app.teachersOpen = null;
  resetFormRound();
  applyTemplates(school());
  renderAllSections();
}

function renderAllSections() {
  renderHeader();
  renderDate();
  renderTeachers();
  photos.render();
  renderBackgrounds();
  renderSentToday();
  onChange();
}

function renderHeader() {
  const s = school();
  $('schoolName').textContent = s ? shortSchoolName(s) : 'วันเพจครูเวร';
  document.querySelector('.app-head').classList.toggle('no-school', !s); // ไม่มีโรงเรียน: ชื่อแอปอยู่ใน #schoolName แล้ว
  $('changeSchool').hidden = !s;
  const logo = $('schoolLogo');
  const src = logoSrc(s);
  const wrap = $('schoolLogoWrap'); // วงกลมขาวรอบตรา
  logo.hidden = wrap.hidden = !src; // ยังไม่มีตรา = ไม่แสดง
  if (!src) return;
  logo.onerror = () => { logo.onerror = null; logo.hidden = wrap.hidden = true; };
  logo.src = src;
}

function renderSentToday() {
  const last = state.schoolId && ls.json(`wp.lastReport.${state.schoolId}`);
  const el = $('sentToday');
  el.hidden = !isSentToday(last, app.today);
  if (el.hidden) return;
  const hhmm = stampHHmm(new Date(last.ts));
  el.textContent = `วันนี้ส่งแล้ว ${hhmm.slice(0, 2)}:${hhmm.slice(2)} ✓ — ส่งซ้ำได้ถ้าต้องแก้`;
}

// ---------- ① วันที่ + ครู ----------
function renderDate() {
  $('dateText').textContent = `${thaiWeekday(state.dateISO)} ${formatThaiDate(state.dateISO)}`;
  $('notTodayBadge').hidden = state.dateISO === app.today;
  const inp = $('dateInput');
  inp.max = app.today;
  inp.min = addDaysISO(app.today, -MAX_BACK_DAYS);
  inp.value = state.dateISO;
  if (!$('teacherSummary').hidden) renderTeacherSummary();
}

// หน้าเปิดค้างข้ามวัน: คำนวณ "วันนี้" ใหม่ แล้วเลื่อน/ตรวจวันที่ด้วย rollToday
function refreshToday() {
  const now = todayBangkok();
  const r = rollToday(state.dateISO, app.today, now);
  const dayChanged = now !== app.today;
  app.today = now;
  state.dateISO = r.dateISO;
  if (!dayChanged && !r.changed) return;
  log('today', now, r.dateISO);
  showMsg('dateMsg', r.warn);
  renderDate();
  renderSentToday();
  preview.schedule();
}

// แผ่นเลือกวัน: วันนี้ + ย้อนหลัง MAX_BACK_DAYS วัน แสดงชื่อวัน + พ.ศ. (ปฏิทินเครื่องแสดง ค.ศ. ทำให้ครูสับสน)
function openDateSheet() {
  const rel = ['วันนี้', 'เมื่อวาน'];
  const items = Array.from({ length: MAX_BACK_DAYS + 1 }, (_, k) => {
    const iso = addDaysISO(app.today, -k);
    const cur = iso === state.dateISO ? ' ✓' : '';
    return { act: iso, text: `${thaiWeekday(iso)} ${formatThaiDateShort(iso)}${rel[k] ? ` (${rel[k]})` : ''}${cur}` };
  });
  sheet({
    id: 'dateSheet', title: 'เลือกวันที่เข้าเวร', items,
    onPick: (iso) => { $('dateInput').value = iso; onDateChange(); },
  });
}

function onDateChange() {
  const v = $('dateInput').value;
  const g = dateGuard(v, app.today);
  if (!g.ok) {
    showMsg('dateMsg', `เลือกได้ตั้งแต่ ${formatThaiDate(addDaysISO(app.today, -MAX_BACK_DAYS))} ถึงวันนี้`);
    $('dateInput').value = state.dateISO;
    return;
  }
  showMsg('dateMsg', g.warn);
  state.dateISO = v;
  renderDate();
  preview.schedule();
}

function renderTeachers() {
  const box = $('teacherList');
  box.innerHTML = '';
  const full = state.selectedTeacherIds.length >= MAX_TEACHERS;
  const list = teachers();
  list.forEach((t, k) => {
    const order = state.selectedTeacherIds.indexOf(t.teacher_id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'list-group-item list-group-item-action t' + (k >= FOLD ? ' t-more' : ''); // ลำดับเดิม ไม่เรียงใหม่
    b.setAttribute('role', 'checkbox');
    b.setAttribute('aria-checked', String(order >= 0));
    b.setAttribute('aria-disabled', String(full && order < 0)); // แตะได้ เพื่อบอกเหตุผล
    b.dataset.id = t.teacher_id;
    b.innerHTML = `<span class="ck" aria-hidden="true">${order >= 0 ? order + 1 : ''}</span>`
      + `<span><span class="t-name">${nameWords(t.display_name)}</span>${t.phone ? `<span class="t-phone">${esc(t.phone)}</span>` : ''}</span>`;
    box.appendChild(b);
  });
  const n = state.selectedTeacherIds.length;
  $('teacherCount').hidden = n === 0;
  $('teacherCount').textContent = `เลือกแล้ว ${n}/${MAX_TEACHERS} คน`;
  $('nextPhotos').hidden = n === 0;
  renderMoreTeachers(list);
  renderReuseChip();
  if (!n) setTeachersDone(false); else if (!$('teacherSummary').hidden) renderTeacherSummary();
}

// ปุ่ม "ดูครูอีก N คน" — เปิดเองเมื่อครูที่เลือก/ชุดเดิมอยู่หลังคนที่ 8
function renderMoreTeachers(list) {
  const late = new Set(list.slice(FOLD).map((t) => t.teacher_id));
  const open = app.teachersOpen ?? [...state.selectedTeacherIds, ...storedSet()].some((id) => late.has(id));
  const more = $('moreTeachers');
  more.hidden = !late.size;
  if (!late.size) return;
  more.setAttribute('aria-expanded', String(open));
  more.textContent = open ? 'ย่อรายชื่อ ▴' : `ดูครูอีก ${late.size} คน ▾`;
  $('teacherList').classList.toggle('open', open);
}

function onTeacherTap(id) {
  const was = state.selectedTeacherIds.includes(id);
  const r = toggleTeacher(state.selectedTeacherIds, id);
  state.selectedTeacherIds = r.selected;
  showMsg('teacherMsg', r.error);
  renderTeachers();
  if (!was && r.selected.includes(id)) pulse($('teacherList').querySelector(`[data-id="${CSS.escape(id)}"] .ck`), 'pop');
  onChange();
}

// ยุบ ① เป็นแถวสรุป (หลัง "เลือกครบแล้ว ถัดไป") / ขยายกลับ
function setTeachersDone(on) {
  $('secTeachers').classList.toggle('is-done', on);
  $('teacherSummary').hidden = !on;
  if (on) renderTeacherSummary();
}

function renderTeacherSummary() {
  const day = `${WEEKDAY_SHORT[thaiWeekday(state.dateISO)] || thaiWeekday(state.dateISO)} ${formatThaiDateShort(state.dateISO).replace(/ \d{4}$/, '')}`;
  const late = state.dateISO !== app.today ? ' · <span class="t-sum-warn">ไม่ใช่วันนี้</span>' : ''; // .t-body ซ่อนอยู่ ป้ายเตือนวันที่จึงต้องมาอยู่ตรงนี้
  $('teacherSummary').querySelector('.t-sum-text').innerHTML = `ครูเวร: ${esc(firstNames(state.selectedTeacherIds).join(', '))} · <span class="t-sum-day">${esc(day)}</span>${late}`;
}

function openTeachers() {
  setTeachersDone(false);
  $('secTeachers').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ชื่อในกริด 2 คอลัมน์: ตัดบรรทัดได้เฉพาะหลังยศและระหว่างชื่อ-นามสกุล (ICU ไม่รู้จักชื่อคน จะตัดกลางคำ) — textContent ยังเท่าชื่อเต็มเดิม
function nameWords(name) {
  const { rank, given, sur } = nameParts(name);
  return `${rank ? `<span class="w">${esc(rank)}</span><wbr>` : ''}<span class="w">${esc(given)}</span>${sur ? ` <span class="w">${esc(sur)}</span>` : ''}`;
}

// ชื่อต้น (ตัดยศ/คำนำหน้า) สำหรับป้ายสั้น
function firstNames(ids) {
  const byId = new Map(teachers().map((t) => [t.teacher_id, t]));
  return ids.filter((id) => byId.has(id)).map((id) => nameParts(byId.get(id).display_name).given);
}

function storedSet() {
  const ids = ls.json(`wp.teachers.${state.schoolId}`);
  return Array.isArray(ids) ? reconcileSelection(ids, teachers()).slice(0, MAX_TEACHERS) : [];
}

function renderReuseChip() {
  const ids = storedSet();
  const chip = $('reuseChip');
  chip.hidden = !ids.length || ids.join() === state.selectedTeacherIds.join();
  if (chip.hidden) return;
  chip.textContent = `↺ ใช้ชุดเดิม: ${firstNames(ids).join(', ')}`;
}

// ---------- ③ พื้นหลัง ----------
function renderBackgrounds() {
  const s = school();
  const list = app.templates;
  $('hBg').textContent = s ? `พื้นหลัง (${PROVINCE_TH[s.province] || s.province} ${list.length} แบบ)` : 'พื้นหลัง';
  $('bgList').innerHTML = list.map((t, k) => `<button type="button" class="bg" role="radio" data-bg="${esc(t.id)}" aria-checked="${t.id === state.bgId}" aria-label="${k + 1}. ${esc(t.name || t.id)}">`
    + `<span class="bg-thumb"><img src="${esc(t.thumb)}" alt="" loading="lazy" width="96" height="144">${layoutIcon(t)}</span>`
    + `<span class="bg-name">${k + 1}. ${esc(t.name || t.id)}</span></button>`).join('');
  renderBgPicked();
  const failed = Boolean(s) && !app.templatesAll;
  showMsg('bgMsg', failed ? MSG.templatesFail : s && !list.length ? MSG.noTemplates : null);
  $('retryTemplates').hidden = !failed;
  if (template()) loadImage(template().file).catch(() => {});
}

// ไอคอนผังรูปเล็ก ๆ มุมภาพย่อ — ให้ครูเห็นก่อนเลือกว่ารูป 4 ภาพจะวางแบบไหน (ช่องหลักสีเข้ม)
function layoutIcon(t) {
  let rects;
  try { rects = photoRects(t, 0); } catch { return ''; }
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const W = Math.max(...rects.map((r) => r.x + r.w)) - x0, H = Math.max(...rects.map((r) => r.y + r.h)) - y0;
  const k = 30 / W;
  const cells = rects.map((r, i) => `<rect x="${((r.x - x0) * k).toFixed(1)}" y="${((r.y - y0) * k).toFixed(1)}" width="${Math.max(1, r.w * k - 1).toFixed(1)}" height="${Math.max(1, r.h * k - 1).toFixed(1)}" rx="1.5"${i === 0 ? ' class="m"' : ''}/>`).join('');
  return `<svg class="bg-lay" viewBox="-2 -2 ${34} ${(H * k + 4).toFixed(1)}" aria-hidden="true">${cells}</svg>`;
}

function renderBgPicked() {
  const t = template();
  $('bgPicked').hidden = !t;
  $('bgPicked').textContent = t ? `เลือกอยู่: ${t.name || t.id}` : '';
}

function onBgTap(id) {
  state.bgId = id;
  ls.set(`wp.bg.${state.schoolId}`, id);
  const k = app.templates.findIndex((t) => t.id === id);
  for (const t of [app.templates[k - 1], app.templates[k], app.templates[k + 1]]) if (t) loadImage(t.file).catch(() => {});
  for (const b of $('bgList').children) b.setAttribute('aria-checked', String(b.dataset.bg === id));
  renderBgPicked();
  photos.render(); // เลย์เอาต์ช่องรูปขึ้นกับแม่แบบ
  preview.schedule();
}

// ---------- ปุ่มรายงาน ----------
const currentValidity = () => validateForm(state, app.model, !state.schoolId ? undefined : app.templatesAll ? app.templates : null);

function refreshValidity() {
  if (!app.model) return;
  const v = state.schoolId ? currentValidity() : { ok: false, message: 'เลือกโรงเรียน', target: null };
  const cta = $('cta');
  const wasOff = cta.classList.contains('off');
  cta.classList.toggle('off', !v.ok);
  $('ctaMsg').textContent = v.ok ? '' : v.message;
  const [d1, d2, d3] = $('progressDots').children;
  d1.classList.toggle('on', state.selectedTeacherIds.length > 0);
  d2.classList.toggle('on', state.photos.every(Boolean));
  d3.classList.toggle('on', Boolean(state.bgId && template()));
  if (wasOff && v.ok && !app.cheered) cheer();
}

// D5: ปุ่มเด้ง + ครูวันโผล่มุมขวา 2.4 วิ (ครั้งแรกของรอบฟอร์ม)
function cheer() {
  app.cheered = true;
  pulse($('cta'), 'ready');
  const m = document.querySelector('.cta-mascot');
  clearTimeout(app.cheerTimer);
  m.classList.remove('out');
  m.hidden = false;
  app.cheerTimer = setTimeout(() => {
    m.classList.add('out');
    app.cheerTimer = setTimeout(() => { m.hidden = true; m.classList.remove('out'); }, 200);
  }, 2400);
}

function resetFormRound() {
  app.cheered = false;
  clearTimeout(app.cheerTimer);
  const m = document.querySelector('.cta-mascot');
  m.hidden = true;
  m.classList.remove('out');
  setTeachersDone(false);
}

const SECTION = { teachers: 'secTeachers', photos: 'secPhotos', background: 'secBg' };

async function onCreate() {
  if (app.phase === 'rendering') return;
  if (!state.schoolId) { $('schoolPick').hidden = false; $('schoolSelect').focus(); return; }
  refreshToday();
  const v = currentValidity();
  if (!v.ok) {
    $('ctaMsg').textContent = v.message;
    if (v.target === 'teachers') setTeachersDone(false);
    if (v.target) $(SECTION[v.target]).scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  setPhase('rendering');
  busyShow('ฟอนต์… รูป 4/4 ✓');
  try {
    if (!(await ensureFonts({ timeoutMs: 3000 }))) {
      $('ctaMsg').textContent = MSG_FONTS;
      setPhase('form', 'fonts');
      return;
    }
    busyShow('ฟอนต์ ✓ รูป 4/4 ✓');
    const file = await renderReport();
    await queueReport(file);
    openConfirm(file);
  } catch (e) {
    log('render error', String(e?.message || e));
    const msg = e instanceof AssetError ? e.message : 'สร้างภาพไม่สำเร็จ ลองกดอีกครั้ง';
    $('ctaMsg').textContent = msg;
    setPhase('form', 'error');
    busyHide();
    toast(msg, 'error');
  } finally {
    busyHide(); // ถ้าเปิดหน้ายืนยันแล้ว busyHide ไม่ปิดมัน
  }
}

async function decodeAllPhotos() {
  const settled = await Promise.allSettled(state.photos.map((p) => createImageBitmap(p.blob)));
  const bitmaps = settled.map((r) => (r.status === 'fulfilled' ? r.value : null));
  const failed = settled.find((r) => r.status === 'rejected');
  if (failed) { bitmaps.forEach((b) => b?.close?.()); throw failed.reason; }
  return bitmaps;
}

async function renderReport() {
  const t0 = performance.now();
  // ต้องได้พื้นหลัง + ตราจริงก่อน (ไม่ได้ = ไม่สร้าง PNG)
  const { bg, logo } = await loadFinalAssets({ tpl: template(), school: school(), loadImage });
  const canvas = createCanvas(1536, 2304);
  const bitmaps = await decodeAllPhotos();
  try {
    renderOnePage(canvas.getContext('2d'), renderModel(), template(), 1.5, { bg, logo, photos: bitmaps });
  } finally {
    bitmaps.forEach((b) => b?.close?.());
  }
  const blob = await canvasToBlob(canvas, 'image/png');
  canvas.width = 1; canvas.height = 1;
  const name = reportFileName(school().short_name, state.dateISO, stampHHmm(new Date()));
  log('rendered', name, blob.size, Math.round(performance.now() - t0) + 'ms');
  return new File([blob], name, { type: 'image/png' });
}

async function queueReport(file) {
  const byId = new Map(teachers().map((t) => [t.teacher_id, t]));
  const ids = state.selectedTeacherIds.filter((id) => byId.has(id));
  ls.set(`wp.teachers.${state.schoolId}`, JSON.stringify(ids));
  // สร้างใหม่หลัง "แก้ไข": รายการเก่าที่ยังไม่เริ่มส่งถูกลบ
  if (drive.on() && app.lastReport && !app.lastReportShared) await app.queue.remove(app.lastReport.report_id).catch(() => {});
  const tpl = template();
  app.lastReport = {
    report_id: crypto.randomUUID(), created: Date.now(), school_id: state.schoolId, report_date: state.dateISO,
    teacher_ids: ids, teacher_names: ids.map((id) => byId.get(id).display_name),
    template_id: tpl.id, template_version: tpl.version, file_name: file.name, mime: 'image/png', blob: file,
  };
  app.lastReportShared = false;
  if (drive.on()) {
    // archive_mime=image/jpeg: เก็บ Drive เป็น JPEG ส่วนไฟล์ที่แชร์ (app.lastFile) ยังเป็น PNG
    await archiveCopy(app.lastReport, app.config).then((r) => enqueue(app.queue, r)).catch((e) => log('enqueue error', String(e)));
  }
}

// ---------- หน้ายืนยัน (SweetAlert2) ----------
// ปุ่มอยู่ใน html ของ Swal และผูก onclick ใน didOpen → navigator.share ถูกเรียกตรงจากการแตะ (user activation)
function confirmHtml(file, canShare) {
  return `<div id="confirm" class="conf" aria-labelledby="sumTitle">`
    + `<img id="confirmImg" class="conf-img" alt="ภาพรายงานที่จะส่ง">`
    + `<div id="sumTitle" class="sum">`
    + `<div>โรงเรียน <b id="sumSchool"></b></div>`
    + `<div>ครูเวร <b id="sumTeachers"></b></div>`
    + `<div>วันที่ <b id="sumDate"></b> <span id="sumNotToday" class="badge rounded-pill badge-orange" hidden>ไม่ใช่วันนี้</span></div>`
    + `<div id="sumSize" class="sum-size"></div></div>`
    + `<div id="chromeBox" class="alert alert-primary chromebox mb-0"${canShare ? ' hidden' : ''}>`
    + `<p class="mb-2">เปิดลิงก์ใน Chrome จะส่งเข้า LINE ได้ในแตะเดียว</p>`
    + `<a id="chromeLink" class="btn btn-outline-primary w-100 tap" href="#">เปิดใน Chrome</a></div>`
    + `<button id="shareBtn" type="button" class="btn btn-line btn-lg w-100 tap-lg"${canShare ? '' : ' hidden'}>ส่งเข้า LINE</button>`
    + `<div class="conf-row">`
    + `<button id="editBtn" type="button" class="btn btn-outline-secondary btn-lg tap edit2">‹ แก้ไข</button>`
    + `<button id="saveBtn" type="button" class="btn ${canShare ? 'btn-outline-primary' : 'btn-primary btn-cta'} btn-lg ${canShare ? 'tap' : 'tap-lg'}">บันทึกรูปลงเครื่อง</button></div>`
    + `<p id="confirmMsg" class="alert alert-gold conf-msg mb-0" aria-live="polite" hidden></p></div>`;
}

function openConfirm(file) {
  if (app.lastFile?.url) URL.revokeObjectURL(app.lastFile.url);
  app.lastFile = { file, url: URL.createObjectURL(file) };
  showConfirm();
}

// เปิด/เปิดซ้ำ (หลังปิดหน้าต่างกดค้างบันทึก) โดยไม่สร้างภาพใหม่
function showConfirm() {
  const file = app.lastFile.file;
  const canShare = canShareFile(file);
  panel({
    html: confirmHtml(file, canShare), cls: 'wp-confirm', allowOutsideClick: false,
    onOpen: () => {
      $('confirmImg').src = app.lastFile.url;
      $('sumSchool').textContent = shortSchoolName(school());
      $('sumTeachers').textContent = app.lastReport.teacher_names.join(', ');
      $('sumDate').textContent = formatThaiDate(state.dateISO).replace('พ.ศ. ', '');
      $('sumNotToday').hidden = state.dateISO === app.today;
      $('sumSize').textContent = `ขนาดไฟล์ ${(file.size / 1048576).toFixed(1)} MB`;
      $('chromeLink').href = externalBrowserUrl(location.href);
      $('shareBtn').onclick = onShare;
      $('saveBtn').onclick = onSave;
      $('editBtn').onclick = () => { closeAll(); setPhase('form', 'edit'); };
    },
  }).then((r) => { if (r.dismiss === 'esc' && app.phase === 'confirm') setPhase('form', 'edit'); });
  setPhase('confirm');
}

async function onShare() {
  if (app.phase === 'sharing') return;
  setPhase('sharing');
  const s = school();
  const st = app.model.settings;
  const text = buildShareText(st.share_text_template || 'วันเพจ {short_name} {date_th}', { short_name: s.short_name, date_th: formatThaiDate(state.dateISO) });
  const r = await sharePng(app.lastFile.file, { title: st.share_title || 'วันเพจครูเวร', text });
  log('share', r);
  // เก็บเข้า Drive เฉพาะเมื่อแชร์สำเร็จ (ยกเลิก = ยังแก้ไขได้ ไม่ส่ง; ล้มเหลว → onSave() เป็นคนส่ง)
  if (r === 'shared') { drive.kick(); showDone(); }
  else if (r === 'aborted') setPhase('confirm', 'aborted');
  else { setPhase('confirm', 'share failed'); onSave(); }
}

function onSave() {
  markSent();
  // LINE in-app / iOS: ดาวน์โหลด blob ไม่ได้จริง → ให้กดค้างที่รูป (ไม่บอกว่า "บันทึกแล้ว")
  if (saveMode(navigator.userAgent) === 'longpress') {
    showIosSave();
  } else {
    downloadFile(app.lastFile.file);
    showMsg('confirmMsg', 'บันทึกรูปลงเครื่องแล้ว — เปิดกลุ่ม LINE แล้วแนบรูปนี้');
  }
  drive.kick();
}

// iOS/LINE: กดค้างที่รูปเพื่อบันทึก — ปิดแล้วกลับหน้ายืนยัน
function showIosSave() {
  panel({
    cls: 'wp-confirm', allowOutsideClick: false,
    html: `<div id="iosSave" class="conf">`
      + `<img id="iosImg" class="conf-img" alt="ภาพรายงาน กดค้างเพื่อบันทึก">`
      + `<ol class="ios-steps"><li>กดค้างที่รูป</li><li>บันทึกรูปภาพ</li><li>ไปกลุ่ม LINE → แนบรูป</li></ol>`
      + `<button id="iosClose" type="button" class="btn btn-primary btn-lg w-100 tap">เสร็จแล้ว</button></div>`,
    onOpen: () => {
      $('iosImg').src = app.lastFile.url;
      $('iosClose').onclick = showConfirm;
    },
  }).then((r) => { if (r.dismiss === 'esc') showConfirm(); });
}

function markSent() {
  const key = `wp.lastReport.${state.schoolId}`;
  ls.set(key, JSON.stringify(nextSentRecord(ls.json(key), state.dateISO, Date.now(), app.today)));
}

// ---------- หน้า "ส่งแล้ว" ----------
function showDone() {
  markSent();
  closeAll();
  $('doneTitle').textContent = `ส่งวันเพจวันที่ ${formatThaiDate(state.dateISO).replace('พ.ศ. ', '')} แล้ว`;
  if (drive.on()) drive.renderDone();
  $('doneDrive').hidden = !drive.on();
  $('doneNote').hidden = !drive.on();
  $('formView').hidden = true;
  $('doneView').hidden = false;
  window.scrollTo(0, 0);
  setPhase('done');
}

function again() {
  photos.clear();
  $('doneDrive').innerHTML = '';
  $('doneView').hidden = true;
  $('formView').hidden = false;
  setPhase('form', 'again');
  resetFormRound();
  app.teachersOpen = null;
  refreshToday();
  renderAllSections();
  window.scrollTo(0, 0);
}

// ---------- ผูกเหตุการณ์ ----------
function bindForm() {
  $('changeSchool').onclick = () => { $('schoolPick').hidden = false; $('schoolSelect').focus(); };
  $('schoolSelect').onchange = (e) => { if (e.target.value) setSchool(e.target.value); };
  $('editDate').onclick = openDateSheet;
  $('nextPhotos').onclick = () => { setTeachersDone(true); $('secPhotos').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('editTeachers').onclick = openTeachers;
  $('moreTeachers').onclick = () => {
    app.teachersOpen = $('moreTeachers').getAttribute('aria-expanded') !== 'true';
    renderMoreTeachers(teachers());
  };
  // ป้ายเหตุผลใต้ปุ่มรายงาน แตะแล้วพาไปส่วนที่ยังขาด
  $('ctaMsg').onclick = () => {
    const v = state.schoolId && currentValidity();
    if (!v || v.ok || !v.target) return;
    if (v.target === 'teachers') setTeachersDone(false);
    $(SECTION[v.target]).scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('dateInput').onchange = onDateChange;
  $('teacherList').onclick = (e) => { const b = e.target.closest('.t'); if (b) onTeacherTap(b.dataset.id); };
  $('reuseChip').onclick = () => {
    state.selectedTeacherIds = storedSet();
    app.teachersOpen = null; // กลับไปเปิด/พับตามครูที่เลือก ไม่ให้ครูที่ติ๊กไปซ่อนในส่วนที่พับ
    showMsg('teacherMsg', null);
    renderTeachers();
    onChange();
  };
  photos.bind();
  $('retryTemplates').onclick = retryTemplates;
  $('bgList').onclick = (e) => { const b = e.target.closest('[data-bg]'); if (b) onBgTap(b.dataset.bg); };
  $('tapPreview').onclick = () => preview.draw($('preview'), 0.25, true);
  $('bigPreviewBtn').onclick = openBigPreview;
  $('cta').onclick = onCreate;
  $('again').onclick = again;
  $('closeDone').onclick = () => { window.close(); setTimeout(again, 300); };
  $('doneMenuBtn').onclick = () => { $('doneMenu').hidden = !$('doneMenu').hidden; };
  $('reloadData').onclick = async () => {
    $('doneMenu').hidden = true;
    const m = await refreshData({ config: app.config, storage, fetchFn: (...a) => fetch(...a) });
    if (m) mergeModel(m);
    toast(m ? 'โหลดข้อมูลใหม่แล้ว' : 'ยังโหลดไม่ได้ ต่อเน็ตแล้วลองใหม่', m ? 'success' : 'warning');
  };
  $('reportIssue').onclick = async () => {
    $('doneMenu').hidden = true;
    try {
      await navigator.clipboard.writeText(debugLog.join('\n'));
      info({ icon: 'success', title: 'คัดลอกข้อความแล้ว', text: 'ส่งให้ครูแจ็กใน LINE ได้เลย' });
    } catch {
      info({ title: 'แจ้งปัญหา', html: `<p>กดค้างที่ข้อความแล้วเลือกคัดลอก ส่งให้ครูแจ็กใน LINE</p><textarea class="form-control log-box" readonly>${esc(debugLog.slice(-10).join('\n'))}</textarea>` });
    }
  };
  $('driveBar').onclick = drive.retryTap;
  // ช่องว่างท้ายหน้า = ความสูงจริงของแถบปุ่มรายงาน (ไม่ให้แถบบังช่องรูป/รายชื่อแถวท้าย)
  const wrap = document.querySelector('.cta-wrap');
  if (wrap && typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const h = Math.ceil(wrap.getBoundingClientRect().height);
      document.querySelector('.cta-space').style.height = `${h}px`; // ระยะห่างเหนือแถบ = margin ล่างของการ์ด
      document.documentElement.style.setProperty('--cta-h', `${h}px`);
    }).observe(wrap);
  }
  document.documentElement.classList.toggle('paused', document.hidden); // เปิดในแท็บพื้นหลัง/prerender
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('paused', document.hidden); // หยุดมาสคอตวนลูปเมื่อแท็บซ่อน
    if (document.visibilityState === 'visible') refreshToday();
  });
  window.addEventListener('pageshow', refreshToday);
}

function openBigPreview() {
  panel({
    cls: 'wp-big',
    html: `<div id="bigPreview" class="big-wrap"><canvas id="bigCanvas" width="512" height="768" aria-label="ภาพตัวอย่างขนาดใหญ่"></canvas></div>`
      + `<button id="bigClose" type="button" class="btn btn-primary btn-lg w-100 tap mt-2">ปิด</button>`,
    onOpen: () => {
      $('bigClose').onclick = closeAll;
      preview.draw($('bigCanvas'), 0.5, true);
    },
  });
}

// ---------- ตัวช่วย ----------
function showMsg(id, text) {
  const el = $(id);
  el.hidden = !text;
  el.textContent = text || '';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

boot().catch((e) => { log('boot error', String(e?.stack || e)); hideBoot(); });
