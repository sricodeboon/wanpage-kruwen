// หน้าครูเวร — ผูกโมดูลทั้งหมดเข้าด้วยกัน (spec 7)
// state machine: boot → data → form → rendering → confirm → sharing → done
import { todayBangkok, formatThaiDate, thaiWeekday, stampHHmm, addDaysISO } from './js/thaidate.js';
import { loadData, refreshData } from './js/data.js';
import { filterTemplates, splitRank } from './js/layout.js';
import { createCanvas, canvasToBlob, renderOnePage } from './js/render.js';
import { ensureFonts } from './js/fonts.js';
import { isLineInApp, saveMode, externalBrowserUrl, canShareFile, sharePng, downloadFile, buildShareText } from './js/share.js';
import { enqueue, archiveCopy } from './js/upload.js';
import {
  validateForm, toggleTeacher, dateGuard, rollToday, reportFileName, buildRenderModel,
  pickBackground, reconcileSelection, nextSentRecord, isSentToday, MSG, MAX_TEACHERS, MAX_BACK_DAYS,
} from './js/form.js';
import { createPreview } from './js/preview-ui.js';
import { createDrive } from './js/drive-ui.js';
import { createPhotos } from './js/photos-ui.js';
import { loadJsonCached, validConfig, validTemplates } from './js/remote-json.js';
import { createImageLoader, logoSrc, loadFinalAssets, loadPreviewAssets, AssetError } from './js/assets.js';
import { panel, busyShow, busyHide, toast, info, closeAll } from './js/ui.js';

const $ = (id) => document.getElementById(id);
const PROVINCE_TH = { np: 'นครพนม', sn: 'สกลนคร', mdh: 'มุกดาหาร' };
const MSG_FONTS = 'กำลังโหลดฟอนต์… (ครั้งแรกต้องต่อเน็ต)';

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
};
const state = { schoolId: null, dateISO: app.today, selectedTeacherIds: [], photos: [null, null, null, null], bgId: null };

function setPhase(p, extra) {
  log('state', app.phase, '→', p, extra || '');
  app.phase = p;
  document.body.dataset.state = p;
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
  if (pick) setSchool(pick); else { $('schoolPick').hidden = schools.length === 0; renderAllSections(); }
}

function setSchool(id) {
  state.schoolId = id;
  ls.set('wp.school', id);
  $('schoolPick').hidden = true;
  $('schoolSelect').value = id;
  state.selectedTeacherIds = [];
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
  $('changeSchool').hidden = !s;
  const logo = $('schoolLogo');
  const src = logoSrc(s);
  logo.hidden = !src; // ยังไม่มีตรา = ไม่แสดง
  if (!src) return;
  logo.onerror = () => { logo.onerror = null; logo.hidden = true; };
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
  for (const t of teachers()) {
    const order = state.selectedTeacherIds.indexOf(t.teacher_id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'list-group-item list-group-item-action t';
    b.setAttribute('role', 'checkbox');
    b.setAttribute('aria-checked', String(order >= 0));
    b.setAttribute('aria-disabled', String(full && order < 0)); // แตะได้ เพื่อบอกเหตุผล
    b.dataset.id = t.teacher_id;
    b.innerHTML = `<span class="ck" aria-hidden="true">${order >= 0 ? order + 1 : ''}</span>`
      + `<span><span class="t-name">${esc(t.display_name)}</span>${t.phone ? `<span class="t-phone">${esc(t.phone)}</span>` : ''}</span>`;
    box.appendChild(b);
  }
  renderReuseChip();
}

function onTeacherTap(id) {
  const r = toggleTeacher(state.selectedTeacherIds, id);
  state.selectedTeacherIds = r.selected;
  showMsg('teacherMsg', r.error);
  renderTeachers();
  onChange();
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
  const byId = new Map(teachers().map((t) => [t.teacher_id, t]));
  const names = ids.map((id) => { const parts = splitRank(byId.get(id).display_name); return (parts[1] || parts[0]).split(' ')[0]; });
  chip.textContent = `↺ ใช้ชุดเดิม: ${names.join(', ')}`;
}

// ---------- ③ พื้นหลัง ----------
function renderBackgrounds() {
  const s = school();
  const list = app.templates;
  $('hBg').textContent = s ? `พื้นหลัง (${PROVINCE_TH[s.province] || s.province} ${list.length} แบบ)` : 'พื้นหลัง';
  $('bgList').innerHTML = list.map((t, k) => `<button type="button" class="bg" role="radio" data-bg="${esc(t.id)}" aria-checked="${t.id === state.bgId}" aria-label="${esc(t.name || t.id)}">`
    + `<img src="${esc(t.thumb)}" alt="" loading="lazy" width="80" height="120">${k + 1}</button>`).join('');
  const failed = Boolean(s) && !app.templatesAll;
  showMsg('bgMsg', failed ? MSG.templatesFail : s && !list.length ? MSG.noTemplates : null);
  $('retryTemplates').hidden = !failed;
  if (template()) loadImage(template().file).catch(() => {});
}

function onBgTap(id) {
  state.bgId = id;
  ls.set(`wp.bg.${state.schoolId}`, id);
  const k = app.templates.findIndex((t) => t.id === id);
  for (const t of [app.templates[k - 1], app.templates[k], app.templates[k + 1]]) if (t) loadImage(t.file).catch(() => {});
  for (const b of $('bgList').children) b.setAttribute('aria-checked', String(b.dataset.bg === id));
  photos.render(); // เลย์เอาต์ช่องรูปขึ้นกับแม่แบบ
  preview.schedule();
}

// ---------- ปุ่มรายงาน ----------
const currentValidity = () => validateForm(state, app.model, !state.schoolId ? undefined : app.templatesAll ? app.templates : null);

function refreshValidity() {
  if (!app.model) return;
  const v = state.schoolId ? currentValidity() : { ok: false, message: 'เลือกโรงเรียน', target: null };
  $('cta').classList.toggle('off', !v.ok);
  $('ctaMsg').textContent = v.ok ? '' : v.message;
}

const SECTION = { teachers: 'secTeachers', photos: 'secPhotos', background: 'secBg' };

async function onCreate() {
  if (app.phase === 'rendering') return;
  if (!state.schoolId) { $('schoolPick').hidden = false; $('schoolSelect').focus(); return; }
  refreshToday();
  const v = currentValidity();
  if (!v.ok) {
    $('ctaMsg').textContent = v.message;
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
    + `<button id="saveBtn" type="button" class="btn ${canShare ? 'btn-outline-primary' : 'btn-primary btn-cta'} btn-lg w-100 ${canShare ? 'tap' : 'tap-lg'}">บันทึกรูปลงเครื่อง</button>`
    + `<p id="confirmMsg" class="alert alert-gold conf-msg mb-0" aria-live="polite" hidden></p>`
    + `<button id="editBtn" type="button" class="btn btn-link linkbtn edit2">แก้ไข</button></div>`;
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
  drive.kick(); // หลัง share settle เท่านั้น
  if (r === 'shared') showDone();
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
  $('doneDrive').hidden = !drive.on();
  $('doneNote').hidden = !drive.on();
  $('formView').hidden = true;
  $('doneView').hidden = false;
  window.scrollTo(0, 0);
  setPhase('done');
}

function again() {
  photos.clear();
  $('doneView').hidden = true;
  $('formView').hidden = false;
  setPhase('form', 'again');
  refreshToday();
  renderAllSections();
  window.scrollTo(0, 0);
}

// ---------- ผูกเหตุการณ์ ----------
function bindForm() {
  $('changeSchool').onclick = () => { $('schoolPick').hidden = false; $('schoolSelect').focus(); };
  $('schoolSelect').onchange = (e) => { if (e.target.value) setSchool(e.target.value); };
  $('editDate').onclick = () => { const i = $('dateInput'); i.hidden = false; i.focus(); i.showPicker?.(); };
  $('dateInput').onchange = onDateChange;
  $('teacherList').onclick = (e) => { const b = e.target.closest('.t'); if (b) onTeacherTap(b.dataset.id); };
  $('reuseChip').onclick = () => {
    state.selectedTeacherIds = storedSet();
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshToday(); });
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

boot().catch((e) => log('boot error', String(e?.stack || e)));
