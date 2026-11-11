// วันเพจ (ระบบใหม่) — หน้าเว็บนิ่ง ทำงานในเครื่องทั้งหมด
// เครื่องวาดภาพ (engine/) ยกมาจากวันเพจครูเวรเดิม → ภาพออกมาเหมือนเดิมทุกแม่แบบ
import { renderOnePage, canvasToBlob } from './engine/render.js';
import { mergeTemplate, computeLayout } from './engine/layout.js';
import { formatThaiDate, formatThaiDateShort, thaiWeekday, todayBangkok, stampHHmm, addDaysISO } from './engine/thaidate.js';
import { ICONS } from './engine/icons.js';
import { renderLunch, LUNCH_THEMES } from './engine/lunch.js';
import { initBuddy, say, react, celebrate } from './buddy.js';
import { initChat, openChat } from './chat.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = 'wanpage:v2';
const MODES = ['duty', 'assembly', 'lunch'];
const TITLE = { duty: 'รายงานภาพบรรยากาศและบริบทโรงเรียน', lunch: 'รายงานการประกอบเลี้ยงอาหารกลางวัน', assembly: 'รายงานการประชุมหน้าแถว' };
const KIND = { duty: 'ครูเวร', lunch: 'อาหารกลางวัน', assembly: 'หน้าแถว' }; // ชื่อเรียกแต่ละแบบ
const ASM_SUGGEST = ['เวลา 08.30 น. ประชุมหน้าแถว ชี้แจงแนวทาง ปบ. ประจำวัน และการ ปบ. ตามคำสั่ง 1212/2537', 'ตรวจการแต่งกาย ความสะอาด และสุขภาพนักเรียน', 'เคารพธงชาติ สวดมนต์ และร้องเพลงสรรเสริญพระบารมี', 'อบรมคุณธรรม จริยธรรม และระเบียบวินัย'];
const isMemo = m => m !== 'duty'; // แบบหนังสือรายงาน (อาหารกลางวัน / หน้าแถว) ใช้เครื่องวาดเดียวกัน
const MSG_SUGGEST = ['นักเรียนรับประทานอาหาร __ คน', 'ครูรับประทานอาหารร่วมกับนักเรียน', 'อาหารสะอาด ถูกหลักโภชนาการ'];
const FINAL_SCALE = 1.5;

/* ---------------- state ---------------- */
const S = {
  data: null, tplJson: null, templates: [],
  settings: { schoolId: null, custom: null, mode: 'duty', tpl: {}, title: {}, phones: {}, extra: {}, names: {}, memoBySchool: {}, allProv: false, lunch: { thaiNum: true, theme: 'magenta' } },
  draft: { duty: { dateISO: todayBangkok(), teachers: [] }, lunch: { dateISO: todayBangkok(), menu: ['', '', ''], message: '' }, assembly: { dateISO: todayBangkok(), items: [ASM_SUGGEST[0]] } },
  photos: { duty: [null, null, null, null], lunch: [null, null, null, null], assembly: [null, null, null, null] },
  result: null,
};
const mode = () => S.settings.mode;

function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o?.settings) { const l = S.settings.lunch; Object.assign(S.settings, o.settings); S.settings.lunch = { ...l, ...(o.settings.lunch || {}) }; }
    if (o?.draft) for (const m of MODES) Object.assign(S.draft[m], o.draft[m] || {});
  } catch { /* ไม่มีที่เก็บ = ใช้ค่าเริ่มต้น */ }
  // วันที่เก่ากว่าวันนี้ = เริ่มเป็นวันนี้ใหม่ (รายงานรายวัน)
  for (const m of MODES) if (!S.draft[m].dateISO || S.draft[m].dateISO < todayBangkok()) S.draft[m].dateISO = todayBangkok();
}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ settings: S.settings, draft: S.draft })); } catch { /* เต็ม/ถูกปิด */ }
  }, 200);
}

/* ---------------- IndexedDB: รูปที่เลือกไว้ (รอดจากการสลับแอป/รีเฟรช) ---------------- */
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('wanpage-v2', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = (rw, fn) => open().then(db => new Promise((res, rej) => {
    const tx = db.transaction('photos', rw), req = fn(tx.objectStore('photos'));
    tx.oncomplete = () => res(req?.result); tx.onerror = () => rej(tx.error);
  }));
  return {
    get: k => run('readonly', s => s.get(k)).catch(() => null),
    set: (k, v) => run('readwrite', s => s.put(v, k)).catch(() => null),
    del: k => run('readwrite', s => s.delete(k)).catch(() => null),
  };
})();

/* ---------------- helpers ---------------- */
function toast(msg, ms = 3000) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
}
const imgCache = new Map();
function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res, rej) => {
      const i = new Image(); i.decoding = 'async';
      const tm = setTimeout(() => fail(new Error('timeout')), 15000);
      const fail = e => { clearTimeout(tm); imgCache.delete(src); rej(e); };
      i.onload = () => { clearTimeout(tm); res(i); }; i.onerror = () => fail(new Error('load ' + src));
      i.src = src;
    }));
  }
  return imgCache.get(src);
}
async function decodeBlob(blob) {
  if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch { /* fallback */ } }
  const url = URL.createObjectURL(blob);
  try { const i = await loadImage(url); return i; } finally { imgCache.delete(url); }
}
// ย่อรูปให้ด้านยาว ≤ max แล้วเก็บเป็น JPEG — รูปมือถือ 12MP เหลือ ~400KB
async function shrink(file, max = 1800) {
  const src = await decodeBlob(file);
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  const k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return canvasToBlob(c, 'image/jpeg', 0.9);
}
const iconSvg = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${ICONS[name] || ICONS.camera}"/></svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ua = navigator.userAgent;
const isLineApp = / Line\//i.test(ua), isIOS = /iPhone|iPad|iPod/i.test(ua);

/* ---------------- school ---------------- */
function school() {
  const st = S.settings;
  if (st.schoolId === 'custom' && st.custom) return { ...st.custom, school_id: 'custom' };
  return S.data.schools.find(s => s.school_id === st.schoolId) || null;
}
function logoSrc(s) {
  if (!s) return null;
  if (s.school_id === 'custom') return s.logoData || null;
  const f = String(s.logo_file || '').trim();
  return f && !f.startsWith('_default') ? 'assets/logos/' + f : null;
}
// ชื่อที่แก้ในเครื่อง: settings.names[school_id][ชื่อในไฟล์] = ชื่อใหม่
const renamed = () => { const s = school(); return (s && S.settings.names[s.school_id]) || {}; };
const fileTeachers = () => { const s = school(); return s ? S.data.teachersBySchool[s.school_id] || [] : []; };
const shownName = t => renamed()[t.display_name] || t.display_name;
function teachersList() {
  const s = school(); if (!s) return [];
  const base = fileTeachers().map(shownName);
  const extra = S.settings.extra[s.school_id] || [];
  return [...new Set([...extra, ...base])];
}
// เบอร์ที่ครูแก้เองในเครื่องมาก่อน (ลบเป็นค่าว่าง = ไม่ใส่เบอร์) ไม่งั้นใช้เบอร์จาก data/schools.json
function phoneOf(name) {
  const own = S.settings.phones;
  if (Object.prototype.hasOwnProperty.call(own, name)) return own[name];
  const t = fileTeachers().find(x => shownName(x) === name);
  return (t && t.phone) || '';
}
// แก้ชื่อครู: ย้ายเบอร์ + ครูเวรที่เลือกไว้ไปชื่อใหม่ด้วย
function renameTeacher(from, to) {
  const s = school(); to = to.trim();
  if (!s || !to || to === from) return true;
  if (teachersList().includes(to)) { toast('มีชื่อนี้ในรายการแล้ว'); return false; }
  const ex = S.settings.extra[s.school_id] || [], i = ex.indexOf(from);
  if (i >= 0) ex[i] = to;
  else {
    const t = fileTeachers().find(x => shownName(x) === from); if (!t) return true;
    const map = S.settings.names[s.school_id] || (S.settings.names[s.school_id] = {});
    if (to === t.display_name) delete map[t.display_name]; else map[t.display_name] = to;
  }
  const ph = S.settings.phones;
  if (Object.prototype.hasOwnProperty.call(ph, from)) { ph[to] = ph[from]; delete ph[from]; }
  const sel = S.draft.duty.teachers, j = sel.indexOf(from); if (j >= 0) sel[j] = to;
  return true;
}
function removeExtraTeacher(name) {
  const s = school(); if (!s) return;
  const ex = S.settings.extra[s.school_id] || [], i = ex.indexOf(name); if (i < 0) return;
  ex.splice(i, 1); delete S.settings.phones[name];
  const sel = S.draft.duty.teachers, j = sel.indexOf(name); if (j >= 0) sel.splice(j, 1);
}
function renderSchool() {
  const s = school();
  $('#schoolShort').textContent = s ? s.name_full : 'เลือกโรงเรียน';
  $('#schoolAddr').textContent = s ? (s.address || 'แตะเพื่อเปลี่ยนโรงเรียน') : 'แตะเพื่อเลือกโรงเรียน';
  const src = logoSrc(s), box = $('#schoolLogo');
  box.innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/></svg>';
}
function openSchoolSheet() {
  const cur = S.settings.schoolId;
  $('#schoolList').innerHTML = S.data.schools.map(s => `
    <button class="s-item" type="button" data-id="${esc(s.school_id)}" aria-current="${s.school_id === cur}">
      <span class="school-logo">${logoSrc(s) ? `<img src="${esc(logoSrc(s))}" alt="" loading="lazy">` : ''}</span>
      <span><b>${esc(s.name_full)}</b><small>${esc(s.address || '')}</small></span></button>`).join('');
  const c = S.settings.custom || {};
  $('#c-name').value = c.name_full || ''; $('#c-short').value = c.short_name || '';
  $('#c-addr').value = c.address || ''; $('#c-prov').value = c.province || 'np';
  $('#c-logoPrev').innerHTML = c.logoData ? `<img src="${c.logoData}" alt="">` : '';
  $('#c-logoPrev').dataset.logo = c.logoData || '';
  $('#customBox').open = cur === 'custom';
  openSheet('#schoolSheet');
}
function setSchool(id) {
  const changed = S.settings.schoolId !== id;
  S.settings.schoolId = id;
  if (changed) { S.settings.tpl = {}; S.draft.duty.teachers = []; }
  save(); renderSchool(); renderTeachers(); renderMemo(); renderTemplates(); schedule();
  closeSheet('#schoolSheet');
}

/* ---------------- templates ---------------- */
function provinceTemplates() {
  const s = school(); const prov = s?.province || 'np';
  return S.templates.filter(t => S.settings.allProv || t.province === prov);
}
function currentTpl() {
  const id = S.settings.tpl[mode()] || school()?.default_bg;
  return S.templates.find(t => t.id === id) || provinceTemplates()[0] || S.templates[0];
}
function renderTemplates() {
  const list = provinceTemplates(), cur = currentTpl();
  $('#f-allProv').checked = !!S.settings.allProv;
  $('#tpls').innerHTML = list.map(t => `
    <button class="tpl" type="button" role="radio" data-id="${t.id}" aria-checked="${t.id === cur.id}" title="${esc(t.name)}">
      <span class="th"><img src="${esc(t.thumb)}" alt="" loading="lazy"></span><span><i class="dot" style="background:${esc(t.palette?.p2 || '#5b2a9e')}"></i>${esc(t.id)}</span></button>`).join('');
  $('#tplName').textContent = cur ? `ที่เลือก: ${cur.name}` : '';
}

/* ---------------- date / title ---------------- */
function renderDate() {
  const d = S.draft[mode()];
  $('#bigDate').textContent = `วัน${thaiWeekday(d.dateISO)} ${formatThaiDate(d.dateISO)}`;
  $('#dateHead').textContent = `${KIND[mode()]}ประจำวันที่`;
  $('#f-title').value = S.settings.title[mode()] || '';
  $('#f-title').placeholder = titleFor(mode());
}

/* ---------------- ปฏิทิน (ไทย พ.ศ.) แทนตัวเลือกวันที่ของเบราว์เซอร์ ---------------- */
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_WD = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const TH_WD_FULL = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
let calView = null; // { y, m } m = 0..11
const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function openDate() {
  const [y, m] = S.draft[mode()].dateISO.split('-').map(Number);
  calView = { y, m: m - 1 }; renderCal(); openSheet('#sheetDate');
}
function renderCal(focusISO) {
  const cur = S.draft[mode()].dateISO, today = todayBangkok();
  $('#calPicked').innerHTML = `<small>${KIND[mode()]}ประจำวัน</small><b>${esc(thaiWeekday(cur))}ที่ ${esc(formatThaiDate(cur))}</b>`;
  const quick = [['วันนี้', today], ['เมื่อวาน', addDaysISO(today, -1)], ['พรุ่งนี้', addDaysISO(today, 1)]];
  $('#calQuick').innerHTML = quick.map(([l, iso]) => `<button class="chip${iso === cur ? ' on' : ''}" type="button" data-iso="${iso}" aria-pressed="${iso === cur}">${l}</button>`).join('');
  const { y, m } = calView, prefix = isoOf(y, m, 1).slice(0, 8);
  $('#calMonth').textContent = `${TH_MONTHS[m]} ${y + 543}`;
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const tabISO = [focusISO, cur, today].find(x => x && x.startsWith(prefix)) || isoOf(y, m, 1);
  let html = TH_WD.map((w, i) => `<span class="cal-wd${i === 0 || i === 6 ? ' we' : ''}" role="columnheader" aria-label="วัน${TH_WD_FULL[i]}">${w}</span>`).join('');
  html += '<span class="cal-pad" aria-hidden="true"></span>'.repeat(first);
  for (let d = 1; d <= days; d++) {
    const iso = isoOf(y, m, d), wd = (first + d - 1) % 7;
    const cls = ['cal-d', wd === 0 || wd === 6 ? 'we' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
    html += `<button class="${cls}" type="button" role="gridcell" data-iso="${iso}" aria-selected="${iso === cur}" tabindex="${iso === tabISO ? 0 : -1}" aria-label="วัน${TH_WD_FULL[wd]}ที่ ${esc(formatThaiDate(iso))}${iso === today ? ' (วันนี้)' : ''}">${d}</button>`;
  }
  $('#calGrid').innerHTML = html;
  if (focusISO) $(`#calGrid [data-iso="${focusISO}"]`)?.focus({ preventScroll: true });
}
function calShift(n) { let { y, m } = calView; m += n; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } calView = { y, m }; renderCal(); }
function setDateISO(iso) { S.draft[mode()].dateISO = iso; save(); renderDate(); schedule(); }
function pickDate(iso) {
  setDateISO(iso);
  const [y, m] = iso.split('-').map(Number); calView = { y, m: m - 1 }; renderCal();
  setTimeout(() => closeSheet('#sheetDate'), 280);
}

const titleFor = m => (S.settings.title[m] || '').trim() || (m === 'duty' ? (S.data.title_text || TITLE.duty) : TITLE[m]);

/* ---------------- duty teachers ---------------- */
let showAllTeachers = false, editingT = null;
const PENCIL = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>';
function renderTeachers() {
  const sel = S.draft.duty.teachers, all = teachersList();
  const ordered = [...sel.filter(n => all.includes(n)), ...all.filter(n => !sel.includes(n))];
  const visible = showAllTeachers || ordered.length <= 8 ? ordered : ordered.slice(0, Math.max(8, sel.length));
  $('#teachers').innerHTML = visible.map(n => {
    const i = sel.indexOf(n), on = i >= 0;
    if (n === editingT) {
      const own = (S.settings.extra[school()?.school_id] || []).includes(n);
      return `<form class="t-edit-form" data-editform="${esc(n)}">
      <input class="input" name="nm" value="${esc(n)}" maxlength="60" aria-label="แก้ชื่อครู" autocomplete="off">
      <div class="t-edit-btns"><button class="btn btn-primary btn-sm" type="submit">บันทึก</button><button class="btn btn-ghost btn-sm" type="button" data-editcancel>ยกเลิก</button>${own ? `<button class="btn btn-ghost btn-sm t-del" type="button" data-delteacher="${esc(n)}">ลบชื่อนี้</button>` : ''}</div>
    </form>`;
    }
    return `<div class="t-row" role="checkbox" tabindex="0" aria-checked="${on}" data-name="${esc(n)}">
      <span class="t-dot">${on ? i + 1 : ''}</span><span class="t-name">${esc(n)}${!on && phoneOf(n) ? `<small class="t-tel">${esc(phoneOf(n))}</small>` : ''}</span>
      <button class="t-pen" type="button" data-edit="${esc(n)}" aria-label="แก้ชื่อ ${esc(n)}">${PENCIL}</button>
      ${on ? `<span class="t-phone"><input class="input" inputmode="tel" maxlength="20" placeholder="เบอร์โทร (ไม่บังคับ)" value="${esc(phoneOf(n))}" data-phone="${esc(n)}" aria-label="เบอร์โทร ${esc(n)}"></span>` : ''}
    </div>`;
  }).join('') + (visible.length < ordered.length ? `<button class="btn btn-soft btn-sm list-more" type="button" id="btnMoreT">แสดงอีก ${ordered.length - visible.length} คน</button>` : '')
    + (!all.length ? '<p class="note">ยังไม่มีรายชื่อ เพิ่มชื่อครูด้านล่างได้เลย</p>' : '');
  $('#dutyCount').textContent = `เลือกแล้ว ${sel.length} / 3 คน`;
}
function toggleTeacher(name) {
  const sel = S.draft.duty.teachers, i = sel.indexOf(name);
  if (i >= 0) sel.splice(i, 1);
  else if (sel.length >= 3) { toast('เลือกครูเวรได้สูงสุด 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน'); return; }
  else sel.push(name);
  save(); renderTeachers(); schedule();
}

/* ---------------- lunch menu ---------------- */
function renderMenu() {
  const m = S.draft.lunch.menu;
  $('#menuList').innerHTML = m.map((v, i) => `
    <div class="menu-item"><span class="k">${i + 1}</span>
      <input class="input" data-menu="${i}" maxlength="40" value="${esc(v)}" placeholder="${['เช่น ข้าวสวย', 'เช่น ผัดเผ็ด', 'เช่น ผัดแตงกวา', 'เช่น แตงโม'][i] || 'เมนูเพิ่มเติม'}" aria-label="เมนูที่ ${i + 1}">
      <button type="button" data-delmenu="${i}" aria-label="ลบเมนูที่ ${i + 1}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`).join('');
  $('#btnAddMenu').hidden = m.length >= 8;
  $('#f-message').value = S.draft.lunch.message;
}
/* ---------------- หน้าแถว: ข้อรายงาน ---------------- */
function renderItems() {
  const it = S.draft.assembly.items;
  $('#itemList').innerHTML = it.map((v, i) => `
    <div class="menu-item item-row"><span class="k">${i + 1}</span>
      <textarea class="input" data-item="${i}" rows="3" maxlength="220" placeholder="เช่น เวลา 08.30 น. …" aria-label="ข้อที่ ${i + 1}">${esc(v)}</textarea>
      <button type="button" data-delitem="${i}" aria-label="ลบข้อที่ ${i + 1}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`).join('');
  $('#btnAddItem').hidden = it.length >= 6;
  $('#itemChips').innerHTML = ASM_SUGGEST.filter(x => !it.includes(x)).map(x => `<button class="chip" type="button" data-sug="${esc(x)}">+ ${esc(x.length > 38 ? x.slice(0, 36) + '…' : x)}</button>`).join('');
}
// ผู้รับรายงาน (เรียน / ชื่อและตำแหน่ง / ที่อยู่ / อีเมล / โทร) แยกตามโรงเรียน — เปลี่ยนโรงเรียนแล้วไม่ติดของโรงเรียนเดิม
const MEMO_KEYS = ['to', 'line1', 'line2', 'email', 'phone', 'reporter'];
function memo() {
  const s = school(); if (!s) return { to: 'ผู้บังคับบัญชา' };
  const all = S.settings.memoBySchool;
  return all[s.school_id] || (all[s.school_id] = { to: 'ผู้บังคับบัญชา', line1: '', line2: '', email: '', phone: '' });
}
// ข้อมูลเดิมเคยเก็บรวมไว้ที่ settings.lunch → ย้ายไปไว้กับโรงเรียนที่ชื่ออยู่ในข้อความ (ไม่เจอ = โรงเรียนที่เลือกอยู่)
function migrateMemo() {
  const L = S.settings.lunch;
  if (!MEMO_KEYS.some(k => k in L)) return;
  const old = {}; MEMO_KEYS.forEach(k => { old[k] = L[k] || ''; delete L[k]; });
  if (!old.to) old.to = 'ผู้บังคับบัญชา';
  if (!old.line1 && !old.line2 && !old.email && !old.phone) { save(); return; }
  const n = x => String(x || '').replace(/รร\.|โรงเรียน|ตชด\.|ตำรวจตระเวนชายแดน|ฯ|\s/g, '');
  const text = n(old.line1 + old.line2);
  const hit = S.data.schools.find(x => n(x.short_name) && text.includes(n(x.short_name)));
  const id = hit?.school_id || S.settings.schoolId;
  if (id && !S.settings.memoBySchool[id]) S.settings.memoBySchool[id] = old;
  save();
}
function renderMemo() {
  const L = S.settings.lunch, M = memo(), s = school() || {};
  $$('#memoCard [data-l]').forEach(i => { const k = i.dataset.l; if (i.type === 'checkbox') i.checked = !!L[k]; else i.value = (MEMO_KEYS.includes(k) ? M[k] : L[k]) || ''; });
  $('#l-line1').placeholder = s.name_full ? `เช่น พ.ต.ท.… ครูใหญ่ ${s.short_name || s.name_full}` : 'ชื่อ ตำแหน่ง ผู้รับรายงาน';
  $('#l-line2').placeholder = s.address || 'ที่อยู่ / สังกัด';
  $('#l-reporter').placeholder = s.name_full ? `เช่น ด.ต.… ครูใหญ่ รร.ตชด.${s.short_name || s.name_full}` : 'ยศ ชื่อ ตำแหน่ง ผู้รายงาน';
}
function renderLThemes() {
  const cur = S.settings.lunch.theme;
  $('#lthemes').innerHTML = Object.entries(LUNCH_THEMES).map(([k, t]) => { const f = mode() === 'lunch' ? t.file : t.asm; return `
    <button class="lt" type="button" role="radio" data-k="${k}" aria-checked="${k === cur}">
      ${f ? `<span class="sw img"><img src="${esc(f)}" alt="" loading="lazy"></span>` : `<span class="sw" style="background:linear-gradient(180deg,${t.bg0},${t.bg1})"><b style="background:${t.deep}"></b><i style="background:${t.ribbon[0]}"></i></span>`}${esc(t.name)}</button>`; }).join('');
}
function renderMsgChips() {
  $('#msgChips').innerHTML = MSG_SUGGEST.map(t => `<button class="chip" type="button" data-msg="${esc(t)}">${esc(t)}</button>`).join('');
}


/* ---------------- photos ---------------- */
const CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/></svg>';
const PEOPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c.6-3.6 3.5-6 7-6s6.4 2.4 7 6"/></svg>';
const BOWL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18a9 8 0 0 1-18 0Zm5-8v5m4-6v6m4-5v5"/></svg>';
async function putPhoto(m, i, file) {
  const blob = await shrink(file);
  const img = await decodeBlob(blob);
  const old = S.photos[m][i];
  if (old) URL.revokeObjectURL(old.url);
  const label = old?.label || '', icon = old?.icon || null;
  S.photos[m][i] = { blob, img, url: URL.createObjectURL(blob), label, icon };
  idb.set(`${m}-${i}`, { blob, label, icon });
}
async function addFiles(files, start) {
  const m = mode(); const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!list.length) return;
  const slots = start != null && list.length === 1 ? [start] : [0, 1, 2, 3].filter(i => !S.photos[m][i]);
  if (list.length > slots.length) toast(slots.length ? `เหลือช่องว่าง ${slots.length} ช่อง ใช้ ${slots.length} รูปแรก` : 'รูปครบ 4 ช่องแล้ว แตะรูปบนภาพเพื่อเปลี่ยน');
  $('#paper').classList.add('busy');
  for (let k = 0; k < Math.min(list.length, slots.length); k++) {
    try { await putPhoto(m, slots[k], list[k]); flashHot(`photo:${slots[k]}`); schedule(); }
    catch { toast(`เปิดไฟล์ ${list[k].name} ไม่ได้ ลองถ่ายใหม่หรือเลือกไฟล์ JPG`); }
  }
  const left = S.photos[m].filter(x => !x).length;
  if (left) react({ pose: 'thumbs', title: 'รูปสวยมากครับ!', text: `เหลืออีก ${left} รูป` });
  schedule();
}
async function restorePhotos() {
  for (const m of MODES) for (let i = 0; i < 4; i++) {
    const r = await idb.get(`${m}-${i}`);
    if (r?.blob) {
      try { S.photos[m][i] = { blob: r.blob, img: await decodeBlob(r.blob), url: URL.createObjectURL(r.blob), label: r.label || '', icon: r.icon || null }; }
      catch { idb.del(`${m}-${i}`); }
    }
  }
}
function setLabel(i, label, icon) {
  const p = S.photos[mode()][i]; if (!p) return;
  p.label = label; p.icon = label ? (icon || 'camera') : null;
  idb.set(`${mode()}-${i}`, { blob: p.blob, label: p.label, icon: p.icon });
  schedule();
}
function removePhoto(i) {
  const p = S.photos[mode()][i]; if (p) URL.revokeObjectURL(p.url);
  S.photos[mode()][i] = null; idb.del(`${mode()}-${i}`); schedule();
}
let photoSlot = 0, pickSlot = null;
function pickPhoto(i) { pickSlot = i; $('#f-one').click(); }
function openPhotoSheet(i) {
  photoSlot = i;
  const p = S.photos[mode()][i];
  $('#photoTitle').textContent = mode() === 'duty' && i === 0 ? 'รูปที่ 1 (ภาพใหญ่)' : `รูปที่ ${i + 1}`;
  $('#photoPrev').src = p?.url || '';
  if (mode() === 'duty') {
    const cur = p?.label || '';
    $('#labelList').innerHTML = S.data.labels.map(x => `<button class="l-item" type="button" data-l="${esc(x.label)}" data-icon="${esc(x.icon)}" aria-current="${x.label === cur}"><i>${iconSvg(x.icon)}</i>${esc(x.label)}</button>`).join('');
    $('#f-labelText').value = S.data.labels.some(x => x.label === cur) ? '' : cur;
  }
  openSheet('#sheetPhoto');
}

/* ---------------- hotspots: แตะส่วนต่าง ๆ บนภาพ ---------------- */
let regions = null;
const DW = 1024, DH = 1536;
function measureWith(ctx) { return (str, px, weight = 700) => { ctx.font = `${weight} ${px}px Kanit`; return ctx.measureText(String(str ?? '')).width; }; }
const union = (a, b) => (!a ? b : !b ? a : { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) });
function spots() {
  if (!regions) return [];
  const m = mode(), P = S.photos[m], out = [];
  const photoSpot = (r, i) => ({ k: `photo:${i}`, r, tag: P[i] ? `รูปที่ ${i + 1} · แตะเพื่อ${m === 'duty' ? 'เปลี่ยนหรือใส่ป้ายชื่อ' : 'เปลี่ยนรูป'}` : `ใส่รูปที่ ${i + 1}`,
    need: !P[i], cta: P[i] ? '' : `${CAMERA}<span>${m === 'duty' && i === 0 ? 'แตะใส่ภาพใหญ่' : 'แตะใส่รูป'}</span>` });
  if (m === 'duty') {
    const L = regions;
    out.push({ k: 'school', r: L.logo, tag: 'เปลี่ยนโรงเรียน' });
    out.push({ k: 'title', r: L.title.rect, tag: 'แก้หัวเรื่อง' });
    out.push({ k: 'school2', r: union(L.school.rect, L.address?.rect), tag: 'เปลี่ยนโรงเรียน' });
    L.photos.forEach((r, i) => out.push(photoSpot(r, i)));
    const none = !S.draft.duty.teachers.length;
    out.push({ k: 'teachers', r: L.duty.rect, tag: 'เลือกครูเวร / ใส่เบอร์', need: none, cta: none ? `${PEOPLE}<span>แตะเลือกครูเวร</span>` : '' });
  } else {
    const R = regions;
    out.push({ k: 'school', r: R.logo, tag: 'เปลี่ยนโรงเรียน' });
    out.push({ k: 'title', r: R.title, tag: 'แก้หัวเรื่อง' });
    out.push({ k: 'date', r: R.date, tag: 'เปลี่ยนวันที่' });
    out.push({ k: 'school2', r: R.school, tag: 'เปลี่ยนโรงเรียน' });
    out.push({ k: 'memo', r: R.memo, tag: m === 'assembly' ? 'แก้ เรียน / ผู้รายงาน' : 'แก้ เรียน / ผู้รับ / สังกัด' });
    if (m === 'assembly') {
      const none = !S.draft.assembly.items.some(v => v.trim());
      out.push({ k: 'items', r: R.menu, tag: 'แก้ข้อรายงาน', need: none, cta: none ? `${PEN}<span>แตะใส่ข้อรายงาน</span>` : '' });
    } else {
      const none = !S.draft.lunch.menu.some(v => v.trim());
      out.push({ k: 'menu', r: R.menu, tag: 'แก้เมนูอาหาร', need: none, cta: none ? `${BOWL}<span>แตะใส่เมนู</span>` : '' });
    }
    R.photos.forEach((r, i) => out.push(photoSpot(r, i)));
    if (R.foot) out.push({ k: 'foot', r: R.foot, tag: 'แก้อีเมล / เบอร์โทร' });
  }
  return out.filter(o => o.r && o.r.w > 4 && o.r.h > 4);
}
function renderHots() {
  const box = $('#hots'), list = spots(), keep = new Set();
  for (const o of list) {
    keep.add(o.k);
    let b = box.querySelector(`[data-k="${o.k}"]`);
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'hot'; b.dataset.k = o.k; box.append(b); }
    const pct = (v, d) => `${(v / d * 100).toFixed(3)}%`;
    Object.assign(b.style, { left: pct(o.r.x, DW), top: pct(o.r.y, DH), width: pct(o.r.w, DW), height: pct(o.r.h, DH) });
    b.classList.toggle('need', !!o.need);
    b.classList.toggle('small', o.r.w < 330);
    b.classList.toggle('top', o.r.y < 160);
    b.setAttribute('aria-label', o.tag);
    const html = `${o.cta ? `<span class="cta"><b>${o.cta}</b></span>` : ''}<span class="pen" aria-hidden="true">${PEN}</span><span class="tag" aria-hidden="true">${esc(o.tag)}</span>`;
    if (b.dataset.html !== html) { b.innerHTML = html; b.dataset.html = html; }
  }
  $$('.hot', box).forEach(b => { if (!keep.has(b.dataset.k)) b.remove(); });
}
function flashHot(k) {
  const b = $(`#hots [data-k="${k}"]`); if (!b) return;
  b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
}
function onHot(k) {
  if (k.startsWith('photo:')) { const i = +k.slice(6); if (S.photos[mode()][i]) openPhotoSheet(i); else pickPhoto(i); return; }
  ({ teachers: () => openSheet('#sheetTeachers'), menu: () => openSheet('#sheetMenu'), items: () => openSheet('#sheetItems'), memo: () => openSheet('#sheetMemo'), foot: () => openSheet('#sheetMemo'),
    title: () => openSheet('#sheetTitle'), school: openSchoolSheet, school2: openSchoolSheet, date: openDate })[k]?.();
}

/* ---------------- render ---------------- */
function model() {
  const m = mode(), s = school() || { name_full: 'ชื่อโรงเรียน', address: '' };
  return {
    kind: m,
    school: { name_full: s.name_full, address: s.address || '' },
    title: titleFor(m),
    dateISO: S.draft[m].dateISO,
    teachers: S.draft.duty.teachers.map(n => ({ display_name: n, phone: phoneOf(n) })),
    menu: S.draft.lunch.menu,
    message: m === 'lunch' ? S.draft.lunch.message : '',
    items: S.draft.assembly.items,
    photos: S.photos[m].map(p => (p && p.label ? { label: p.label, icon: p.icon || 'camera' } : null)),
    lunch: lunchInfo(),
  };
}
// ค่าว่าง → เดาจากข้อมูลโรงเรียน (ครูใหญ่ + ชื่อโรงเรียน / ที่อยู่)
function lunchInfo() {
  const L = { ...S.settings.lunch, ...memo() }, s = school() || {};
  return { ...L, reporter: (L.reporter || '').trim() || (s.name_full ? `ครูใหญ่ ${/ตำรวจตระเวนชายแดน/.test(s.name_full) && s.short_name ? 'รร.ตชด.' + s.short_name : s.name_full}` : ''), line1: (L.line1 || '').trim() || (s.name_full ? `ครูใหญ่ ${s.name_full}` : ''), line2: (L.line2 || '').trim() || s.address || '' };
}
// วาดลง canvas แล้วคืนตำแหน่งส่วนต่าง ๆ (หน่วยออกแบบ) ไว้วางจุดแตะ
async function draw(canvas, scale, final) {
  const tpl = currentTpl(), s = school(), lsrc = logoSrc(s);
  const md = model();
  if (isMemo(mode())) {
    const lt = LUNCH_THEMES[S.settings.lunch.theme] || LUNCH_THEMES.magenta, m = mode();
    const [logo, bg] = await Promise.all([
      lsrc ? loadImage(lsrc).catch(() => { if (final) throw new Error('logo'); return null; }) : null,
      (m === 'lunch' ? lt.file : lt.asm) ? loadImage(m === 'lunch' ? lt.file : lt.asm).catch(() => { if (final) throw new Error('bg'); return null; }) : null,
    ]);
    canvas.width = Math.round(DW * scale); canvas.height = Math.round(DH * scale);
    return renderLunch(canvas.getContext('2d'), md, scale, { logo, bg, photos: S.photos[m].map(p => p?.img || null) });
  }
  const [bg, logo] = await Promise.all([
    loadImage(tpl.file).catch(() => { if (final) throw new Error('bg'); return null; }),
    lsrc ? loadImage(lsrc).catch(() => { if (final) throw new Error('logo'); return null; }) : null,
  ]);
  canvas.width = Math.round(DW * scale); canvas.height = Math.round(DH * scale);
  const ctx = canvas.getContext('2d');
  renderOnePage(ctx, md, tpl, scale, { bg, logo, photos: S.photos.duty.map(p => p?.img || null) });
  const size = logo ? { w: logo.naturalWidth || logo.width, h: logo.naturalHeight || logo.height } : null;
  return computeLayout(tpl, { ...md, logoSize: md.logoSize ?? size }, measureWith(ctx));
}
// ฟอนต์ที่เครื่องวาดใช้ (ไฟล์อยู่ในแอป css/fonts.css) — ต้องโหลดครบก่อนวาด ไม่งั้นเครื่องจะใช้ฟอนต์อื่นแทนและตัวอักษรเพี้ยน
const FONT_SPECS = ['500 24px Kanit', '700 39px Kanit', '400 29px Sarabun', '500 29px Sarabun', '600 29px Sarabun', '700 29px Sarabun'];
const FONT_SAMPLE = 'รายงานภาพ ญาติ ฐิติ ปิ่น กู้ ๑๒๓ 0123456789 ABC abc';
let fontsOk = false, fontsP = null, fontsWatch = false;
const fontsLoaded = () => FONT_SPECS.every(f => document.fonts.check(f, FONT_SAMPLE));
// คืน true เมื่อโหลดครบ · false เมื่อเกินเวลา (ลองใหม่ได้ครั้งหน้า)
function fontsReady(ms = 8000) {
  if (fontsOk) return Promise.resolve(true);
  if (!fontsP) fontsP = Promise.all(FONT_SPECS.map(f => document.fonts.load(f, FONT_SAMPLE))).catch(() => {}).then(() => { fontsP = null; fontsOk = fontsLoaded(); return fontsOk; });
  return Promise.race([fontsP, new Promise(r => setTimeout(() => r(fontsLoaded()), ms))]).then(ok => (fontsOk = fontsOk || ok));
}
// สีของแอปตามแม่แบบ/สีรายงานที่เลือก
let lastTheme = '';
function applyTheme() {
  let pal, thumb;
  if (isMemo(mode())) {
    const t = LUNCH_THEMES[S.settings.lunch.theme] || LUNCH_THEMES.magenta;
    pal = { p1: t.deep, p2: t.accent, p3: t.ribbon[0], gold: '#D9A93A', gold2: '#F6D983' }; thumb = mode() === 'lunch' ? t.file : t.asm;
  } else {
    const t = currentTpl(); pal = { p1: '#3b1470', p2: '#5b2a9e', p3: '#7d4bc4', gold: '#d9a93a', gold2: '#f6d983', ...(t?.palette || {}) }; thumb = t?.thumb;
  }
  const key = JSON.stringify([pal.p1, pal.p2, pal.p3, thumb]);
  if (key === lastTheme) return; lastTheme = key;
  const r = document.documentElement.style;
  r.setProperty('--plum', pal.p1); r.setProperty('--plum-2', pal.p2); r.setProperty('--violet', pal.p3);
  r.setProperty('--gold', pal.gold); r.setProperty('--gold-soft', pal.gold2);
  $('meta[name="theme-color"]')?.setAttribute('content', pal.p1);
  $('#bgThumb').innerHTML = thumb ? `<img src="${esc(thumb)}" alt="">` : '';
}
let pvT, pvToken = 0;
function schedule() {
  $('#paper').classList.add('busy');
  clearTimeout(pvT); pvT = setTimeout(refresh, 120);
  if (S.data) { updateReady(); applyTheme(); }
}
async function refresh() {
  const token = ++pvToken;
  if (!(await fontsReady()) && !fontsWatch) { fontsWatch = true; document.fonts.addEventListener('loadingdone', () => { if (fontsLoaded()) { fontsOk = true; schedule(); } }); }
  const cssW = $('#paper').clientWidth || 600;
  const scale = Math.min(1.5, Math.max(0.5, cssW * (window.devicePixelRatio || 1) / DW));
  const off = document.createElement('canvas');
  let reg = null;
  try { reg = await draw(off, scale, false); } catch { /* preview tolerates missing assets */ }
  if (token !== pvToken) return;
  const cv = $('#cv'); cv.width = off.width; cv.height = off.height;
  cv.getContext('2d').drawImage(off, 0, 0);
  regions = reg; renderHots();
  $('#paper').classList.remove('busy');
}
// ความพร้อม: บอกขั้นต่อไปเหนือภาพ + ใต้ปุ่มส่ง
function updateReady() {
  const p = problems(), ok = !p.length;
  document.body.dataset.ready = ok ? '1' : '0';
  $('#ready').innerHTML = `<i></i>${ok ? 'พร้อมแล้ว กด “ส่ง LINE” ได้เลย' : esc(p[0][2] || p[0][1])}`;
  $$('.gen-s').forEach(n => { n.textContent = ok ? '' : `ยังขาด ${p.length} อย่าง`; });
  buddyTip(p);
}
// ครูแจ็กบอกขั้นต่อไป + ปุ่มลัดทำให้เลย
function buddyTip(p) {
  const m = mode();
  if (!p.length) {
    say({ key: 'ready:' + m, pose: 'thumbs', title: 'เยี่ยมเลย พร้อมส่งแล้ว!', text: 'ตรวจภาพอีกนิด แล้วกดส่งเข้ากลุ่ม LINE ได้เลยครับ',
      act: { label: 'สร้างภาพ & ส่ง LINE', fn: () => generate($('.go')) } });
    return;
  }
  const [k] = p[0];
  if (k === 'school') say({ key: 'school', pose: 'wave', title: 'สวัสดีครับ ผมครูแจ็ก', text: 'เริ่มจากเลือกโรงเรียนของคุณครูก่อนนะครับ', act: { label: 'เลือกโรงเรียน', fn: openSchoolSheet } });
  else if (k === 'photo') {
    const n = S.photos[m].filter(x => !x).length;
    say({ key: `photo:${m}:${n}`, pose: 'camera', title: n === 4 ? 'มาใส่รูปกิจกรรมกันครับ' : `อีก ${n} รูปก็ครบแล้ว!`,
      text: 'แตะช่องรูปที่กะพริบบนภาพ หรือให้ผมเปิดรูปให้เลือกทีเดียวหลายรูป', act: { label: n === 4 ? 'เลือกรูป 4 รูป' : `เลือกอีก ${n} รูป`, fn: () => $('#f-multi').click() } });
  } else if (k === 'teachers') say({ key: 'teachers', pose: 'point', title: 'วันนี้ใครเป็นครูเวรครับ?', text: 'เลือกได้สูงสุด 3 คน ใส่เบอร์โทรไว้ครั้งเดียว ครั้งหน้าจำให้เอง', act: { label: 'เลือกครูเวร', fn: () => openSheet('#sheetTeachers') } });
  else if (k === 'items') say({ key: 'items', pose: 'point', title: 'วันนี้หน้าแถวมีอะไรบ้างครับ?', text: 'พิมพ์เป็นข้อ ๆ หรือแตะข้อความแนะนำได้เลย', act: { label: 'ใส่ข้อรายงาน', fn: () => openSheet('#sheetItems') } });
  else if (k === 'menu') say({ key: 'menu', pose: 'lunch', title: 'วันนี้เมนูอะไรครับ?', text: 'พิมพ์เมนูทีละรายการ ภาพจะจัดเป็น ๑ ๒ ๓ ๔ ให้เอง', act: { label: 'ใส่เมนู', fn: () => openSheet('#sheetMenu') } });
}

/* ---------------- generate + share ---------------- */
function problems() {
  const m = mode(), out = [];
  if (!school()) out.push(['school', 'เลือกโรงเรียนก่อน', 'แตะชื่อโรงเรียนด้านบนเพื่อเลือกโรงเรียน']);
  const missing = S.photos[m].map((p, i) => (p ? null : i + 1)).filter(Boolean);
  if (missing.length) out.push(['photo', `ใส่รูปให้ครบ 4 ช่อง (ยังขาดรูปที่ ${missing.join(', ')})`, `แตะช่องรูปที่กะพริบบนภาพ (ยังขาด ${missing.length} รูป)`]);
  if (m === 'duty' && !S.draft.duty.teachers.length) out.push(['teachers', 'เลือกครูเวรอย่างน้อย 1 คน', 'แตะกล่องครูเวรด้านล่างของภาพเพื่อเลือกครู']);
  if (m === 'lunch' && !S.draft.lunch.menu.some(v => v.trim())) out.push(['menu', 'ใส่เมนูอาหารอย่างน้อย 1 รายการ', 'แตะรายการเมนูบนภาพเพื่อใส่เมนู']);
  if (m === 'assembly' && !S.draft.assembly.items.some(v => v.trim())) out.push(['items', 'ใส่ข้อรายงานหน้าแถวอย่างน้อย 1 ข้อ', 'แตะส่วนข้อรายงานบนภาพเพื่อพิมพ์']);
  return out;
}
async function generate(btn) {
  if (btn.classList.contains('busy')) return;
  const p = problems();
  if (p.length) {
    toast(p[0][1], 3600);
    const k = p[0][0];
    if (k === 'school') openSchoolSheet();
    else if (k === 'photo') $$('#hots .hot.need').forEach(b => { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); });
    else flashHot(k);
    return;
  }
  btn.classList.add('busy');
  const t0 = performance.now();
  try {
    if (!(await fontsReady(15000))) { toast('ตัวอักษรยังโหลดไม่ครบ ตรวจสัญญาณเน็ตแล้วกดอีกครั้งนะครับ', 5000); fontsReady(30000).then(ok => ok && schedule()); return; }
    const c = document.createElement('canvas');
    await draw(c, FINAL_SCALE, true);
    const blob = await canvasToBlob(c, 'image/png');
    const s = school(), m = mode(), d = S.draft[m].dateISO;
    const short = String(s.short_name || s.name_full || 'โรงเรียน').replace(/[\\/:*?"<>|\s]+/g, '');
    const kind = m === 'duty' ? 'วันเพจ' : KIND[m];
    if (S.result) URL.revokeObjectURL(S.result.url);
    S.result = {
      blob, url: URL.createObjectURL(blob),
      name: `${kind}_${short}_${d}_${stampHHmm()}.png`,
      text: `${kind} ${s.short_name || s.name_full} ${formatThaiDateShort(d)}`,
    };
    const wait = 700 - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    openResult();
    celebrate({ title: 'สำเร็จแล้ว เก่งมากครับ!', text: 'กดส่งเข้า LINE แล้วเลือกกลุ่มของโรงเรียนได้เลย' });
  } catch (e) {
    toast(e.message === 'bg' ? 'ยังโหลดพื้นหลังไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'
      : e.message === 'logo' ? 'ยังโหลดตราโรงเรียนไม่ได้ ลองใหม่' : 'สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง', 4000);
  } finally { btn.classList.remove('busy'); }
}
function openResult() {
  const r = S.result;
  $('#resImg').src = r.url;
  $('#resMeta').textContent = `1536 × 2304 px · ${(r.blob.size / 1048576).toFixed(1)} MB`;
  $('#resTip').textContent = (isLineApp || isIOS)
    ? 'ถ้ากด “บันทึกรูป” ไม่ได้ ให้กดค้างที่รูปแล้วเลือกบันทึกรูปภาพ'
    : 'มือถือ: กด “ส่งเข้า LINE” แล้วเลือกกลุ่ม · คอมพิวเตอร์: บันทึกรูปแล้วลากไปวางในแชท LINE';
  openSheet('#resultSheet', true);
}
function copyText(silent) {
  const t = S.result?.text || '';
  return (navigator.clipboard?.writeText(t) || Promise.reject()).then(
    () => { if (!silent) toast('คัดลอกข้อความแล้ว'); return true; },
    () => { if (!silent) toast(t, 5000); return false; });
}
function download() {
  const a = document.createElement('a'); a.href = S.result.url; a.download = S.result.name;
  document.body.append(a); a.click(); a.remove();
}

/* ---------------- sheets ---------------- */
const isDesk = () => matchMedia('(min-width:960px)').matches;
let lastFocus = null;
function openSheet(sel, replay) {
  const sh = $(sel); const editor = !sh.classList.contains('center');
  // แผงแก้ไขเปิดได้ทีละแผง
  if (editor) $$('.sheet:not(.center)').forEach(o => { if (o !== sh && !o.hidden) o.hidden = true; });
  else lastFocus = document.activeElement;
  if (editor && sh.hidden) lastFocus = document.activeElement;
  sh.hidden = false;
  if (sel === '#sheetBg') renderTemplates(), renderLThemes();
  if (replay) $$('.sheet-panel,.sheet-bg,.printer img,.check circle,.check path', sh).forEach(n => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
  syncSheetState();
  // ปฏิทิน: โฟกัสวันที่เลือกไว้ · แผงอื่น: ปุ่ม/ช่องแรก
  setTimeout(() => ($('.cal-d[tabindex="0"]', sh) || $('button, input, [tabindex]', $('.sheet-panel', sh)))?.focus({ preventScroll: true }), 60);
}
function closeSheet(sel) {
  const sh = typeof sel === 'string' ? $(sel) : sel; if (!sh || sh.hidden) return;
  sh.hidden = true; syncSheetState();
  lastFocus?.focus?.({ preventScroll: true });
}
function syncSheetState() {
  const open = $$('.sheet').filter(s => !s.hidden);
  const editorOpen = open.some(s => !s.classList.contains('center'));
  document.body.classList.toggle('drawer', editorOpen);
  document.body.style.overflow = open.some(s => s.classList.contains('center') || !isDesk()) ? 'hidden' : '';
}
function setMode(m) {
  if (!MODES.includes(m)) return;
  S.settings.mode = m; document.body.dataset.mode = m; save();
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  $$('.sheet:not(.center)').forEach(s => { s.hidden = true; }); syncSheetState();
  regions = null; renderHots();
  const p = $('#paper'); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  renderDate(); renderTemplates(); schedule();
}

/* ---------------- events ---------------- */
function wire() {
  $('#schoolBtn').addEventListener('click', openSchoolSheet);
  $('#schoolList').addEventListener('click', e => { const b = e.target.closest('.s-item'); if (b) setSchool(b.dataset.id); });
  $('#c-logo').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const b = await shrink(f, 400); const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
      $('#c-logoPrev').innerHTML = `<img src="${url}" alt="">`; $('#c-logoPrev').dataset.logo = url;
    } catch { toast('เปิดไฟล์ตราไม่ได้ ลองใช้ PNG หรือ JPG'); }
  });
  $('#customForm').addEventListener('submit', e => {
    e.preventDefault();
    S.settings.custom = {
      name_full: $('#c-name').value.trim(), short_name: $('#c-short').value.trim(), address: $('#c-addr').value.trim(),
      province: $('#c-prov').value, logoData: $('#c-logoPrev').dataset.logo || null, default_bg: null,
    };
    setSchool('custom');
  });

  $$('#modeSeg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#calPrev').addEventListener('click', () => calShift(-1));
  $('#calNext').addEventListener('click', () => calShift(1));
  $('#calQuick').addEventListener('click', e => { const b = e.target.closest('[data-iso]'); if (b) pickDate(b.dataset.iso); });
  $('#calGrid').addEventListener('click', e => { const b = e.target.closest('[data-iso]'); if (b) pickDate(b.dataset.iso); });
  $('#calGrid').addEventListener('keydown', e => {
    const b = e.target.closest('[data-iso]'); if (!b) return;
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); calShift(e.key === 'PageUp' ? -1 : 1); $('#calGrid [tabindex="0"]')?.focus(); return; }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
    e.preventDefault(); const iso = addDaysISO(b.dataset.iso, step), [y, m] = iso.split('-').map(Number);
    calView = { y, m: m - 1 }; renderCal(iso);
  });
  $('#dateChip').addEventListener('click', openDate);
  $('#f-title').addEventListener('input', e => { S.settings.title[mode()] = e.target.value; save(); schedule(); });

  // จุดแตะบนภาพ
  const hots = $('#hots');
  hots.addEventListener('click', e => { const b = e.target.closest('.hot'); if (b) onHot(b.dataset.k); });
  hots.addEventListener('dragover', e => { const b = e.target.closest('.hot[data-k^="photo:"]'); if (b) { e.preventDefault(); b.classList.add('over'); } });
  hots.addEventListener('dragleave', e => e.target.closest('.hot')?.classList.remove('over'));
  hots.addEventListener('drop', e => {
    const b = e.target.closest('.hot[data-k^="photo:"]'); if (!b) return;
    e.preventDefault(); b.classList.remove('over');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, +b.dataset.k.slice(6));
  });
  $('#paper').addEventListener('dragover', e => e.preventDefault());

  $('#teachers').addEventListener('click', e => {
    if (e.target.closest('input')) return;
    const ed = e.target.closest('[data-edit]');
    if (ed) { editingT = ed.dataset.edit; renderTeachers(); const f = $('#teachers [name="nm"]'); f.focus(); f.select(); return; }
    if (e.target.closest('[data-editcancel]')) { editingT = null; renderTeachers(); return; }
    const del = e.target.closest('[data-delteacher]');
    if (del) { removeExtraTeacher(del.dataset.delteacher); editingT = null; save(); renderTeachers(); schedule(); toast('ลบชื่อแล้ว'); return; }
    if (e.target.closest('.t-edit-form')) return;
    if (e.target.id === 'btnMoreT') { showAllTeachers = true; renderTeachers(); return; }
    const r = e.target.closest('.t-row'); if (r) toggleTeacher(r.dataset.name);
  });
  $('#teachers').addEventListener('keydown', e => {
    const r = e.target.closest('.t-row'); if (r && e.target === r && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggleTeacher(r.dataset.name); }
  });
  $('#teachers').addEventListener('input', e => { const n = e.target.dataset.phone; if (n != null) { S.settings.phones[n] = e.target.value.trim(); save(); schedule(); } });
  $('#teachers').addEventListener('submit', e => {
    const f = e.target.closest('[data-editform]'); if (!f) return;
    e.preventDefault();
    if (!renameTeacher(f.dataset.editform, f.nm.value)) return;
    editingT = null; save(); renderTeachers(); schedule();
  });
  $('#teachers').addEventListener('keydown', e => { if (e.key === 'Escape' && editingT) { e.stopPropagation(); editingT = null; renderTeachers(); } }, true);
  $('#addTeacher').addEventListener('submit', e => {
    e.preventDefault(); const n = $('#f-newTeacher').value.trim(); const s = school(); if (!n || !s) return;
    const ex = S.settings.extra[s.school_id] || (S.settings.extra[s.school_id] = []);
    if (!ex.includes(n)) ex.unshift(n);
    $('#f-newTeacher').value = '';
    if (!S.draft.duty.teachers.includes(n) && S.draft.duty.teachers.length < 3) S.draft.duty.teachers.push(n);
    save(); renderTeachers(); schedule();
  });

  $('#itemList').addEventListener('input', e => { const i = e.target.dataset.item; if (i != null) { S.draft.assembly.items[+i] = e.target.value; save(); schedule(); } });
  $('#itemList').addEventListener('change', () => renderItems());
  $('#itemList').addEventListener('click', e => {
    const b = e.target.closest('[data-delitem]'); if (!b) return;
    const it = S.draft.assembly.items; it.splice(+b.dataset.delitem, 1); if (!it.length) it.push('');
    save(); renderItems(); schedule();
  });
  $('#btnAddItem').addEventListener('click', () => { S.draft.assembly.items.push(''); renderItems(); $(`#itemList [data-item="${S.draft.assembly.items.length - 1}"]`).focus(); });
  $('#itemChips').addEventListener('click', e => {
    const b = e.target.closest('[data-sug]'); if (!b) return;
    const it = S.draft.assembly.items, empty = it.findIndex(v => !v.trim());
    if (empty >= 0) it[empty] = b.dataset.sug; else if (it.length < 6) it.push(b.dataset.sug); else { toast('ใส่ได้สูงสุด 6 ข้อ'); return; }
    save(); renderItems(); schedule();
  });
  $('#menuList').addEventListener('input', e => { const i = e.target.dataset.menu; if (i != null) { S.draft.lunch.menu[+i] = e.target.value; save(); schedule(); } });
  $('#menuList').addEventListener('click', e => {
    const b = e.target.closest('[data-delmenu]'); if (!b) return;
    const m = S.draft.lunch.menu; m.splice(+b.dataset.delmenu, 1); if (!m.length) m.push('');
    save(); renderMenu(); schedule();
  });
  $('#btnAddMenu').addEventListener('click', () => { S.draft.lunch.menu.push(''); renderMenu(); $(`#menuList [data-menu="${S.draft.lunch.menu.length - 1}"]`).focus(); });
  $('#memoCard').addEventListener('input', e => {
    const k = e.target.dataset.l; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (MEMO_KEYS.includes(k)) memo()[k] = v; else S.settings.lunch[k] = v;
    save(); schedule();
  });
  $('#lthemes').addEventListener('click', e => {
    const b = e.target.closest('.lt'); if (!b) return;
    S.settings.lunch.theme = b.dataset.k; save(); renderLThemes(); schedule();
  });
  $('#f-message').addEventListener('input', e => { S.draft.lunch.message = e.target.value; save(); schedule(); });
  $('#msgChips').addEventListener('click', e => {
    const b = e.target.closest('[data-msg]'); if (!b) return;
    const inp = $('#f-message'); inp.value = b.dataset.msg; S.draft.lunch.message = inp.value; save(); schedule();
    const k = inp.value.indexOf('__'); inp.focus(); if (k >= 0) inp.setSelectionRange(k, k + 2);
  });

  // รูป
  $('#f-one').addEventListener('change', e => { const f = e.target.files; if (f.length && pickSlot != null) { addFiles(f, pickSlot); closeSheet('#sheetPhoto'); } e.target.value = ''; });
  $('#f-multi').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('#btnPhotoChange').addEventListener('click', () => pickPhoto(photoSlot));
  $('#btnPhotoDel').addEventListener('click', () => { removePhoto(photoSlot); closeSheet('#sheetPhoto'); });
  $('#labelList').addEventListener('click', e => { const b = e.target.closest('.l-item'); if (b) { setLabel(photoSlot, b.dataset.l, b.dataset.icon); closeSheet('#sheetPhoto'); } });
  $('#labelCustom').addEventListener('submit', e => { e.preventDefault(); const t = $('#f-labelText').value.trim(); if (t) { setLabel(photoSlot, t); closeSheet('#sheetPhoto'); } });
  $('#btnNoLabel').addEventListener('click', () => { setLabel(photoSlot, ''); closeSheet('#sheetPhoto'); });

  // พื้นหลัง
  $('#btnBg').addEventListener('click', () => openSheet('#sheetBg'));
  $('#f-allProv').addEventListener('change', e => { S.settings.allProv = e.target.checked; save(); renderTemplates(); });
  $('#tpls').addEventListener('click', e => {
    const b = e.target.closest('.tpl'); if (!b) return;
    S.settings.tpl[mode()] = b.dataset.id; save();
    $$('#tpls .tpl').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    $('#tplName').textContent = `ที่เลือก: ${currentTpl().name}`; schedule();
  });

  $$('[data-gen]').forEach(b => b.addEventListener('click', () => generate(b)));
  $$('.sheet [data-close]').forEach(b => b.addEventListener('click', () => closeSheet(b.closest('.sheet'))));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const open = $$('.sheet').filter(s => !s.hidden).pop(); if (open) closeSheet(open); } });
  let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { syncSheetState(); schedule(); }, 200); });

  $('#btnCopy').addEventListener('click', () => copyText(false));
  $('#btnSave').addEventListener('click', () => {
    if (isLineApp || isIOS) { toast('กดค้างที่รูปด้านบน แล้วเลือก “บันทึกรูปภาพ”', 4000); return; }
    download(); toast('บันทึกรูปแล้ว');
  });
  $('#btnShare').addEventListener('click', async () => {
    const r = S.result; if (!r) return;
    const copied = copyText(true); // ต้องเริ่มในจังหวะที่ผู้ใช้แตะ
    const file = new File([r.blob], r.name, { type: 'image/png' });
    let can = false; try { can = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch { /* no */ }
    if (can) {
      try { await navigator.share({ files: [file], title: r.text }); toast((await copied) ? 'แชร์แล้ว ข้อความคัดลอกไว้ให้ วางต่อในแชทได้' : 'แชร์แล้ว', 3600); }
      catch (e) { if (e.name !== 'AbortError') toast('แชร์ตรงไม่ได้ กด “บันทึกรูป” แล้วแนบใน LINE แทน', 4200); }
    } else if (isLineApp) {
      toast('ในแอป LINE แชร์ไฟล์ไม่ได้ กดค้างที่รูปเพื่อบันทึก หรือแตะ “เปิดในเบราว์เซอร์” ด้านบน', 5200);
    } else { download(); toast('อุปกรณ์นี้แชร์ตรงไม่ได้ บันทึกรูปไว้ให้แล้ว เปิด LINE แล้วแนบรูปนี้', 5000); }
  });

  if (isLineApp) {
    $('#inappNote').hidden = false;
    const u = location.href, h = u.indexOf('#'), base = h < 0 ? u : u.slice(0, h);
    $('#extLink').href = base + (base.includes('?') ? '&' : '?') + 'openExternalBrowser=1' + (h < 0 ? '' : u.slice(h));
  }
}

/* ---------------- boot ---------------- */
(async function boot() {
  load();
  document.body.dataset.mode = mode();
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode())));
  try {
    const [d, t] = await Promise.all([fetch('data/schools.json').then(r => r.json()), fetch('data/templates.json').then(r => r.json())]);
    S.data = d; S.tplJson = t; migrateMemo();
    S.templates = t.templates.filter(x => x.active !== false).map(x => mergeTemplate(t.common, x));
  } catch {
    toast('โหลดข้อมูลไม่ได้ ต้องเปิดผ่านเว็บ (http/https) ไม่ใช่เปิดไฟล์ตรง', 8000);
    return;
  }
  wire(); initBuddy();
  initChat({ S, mode, school, teachersList, phoneOf, problems, openSheet, closeSheet, openSchoolSheet, openDate, setMode, react,
    setDate: setDateISO, todayBangkok, addDaysISO, thaiWeekday, formatThaiDate,
    pickPhotos: () => $('#f-multi').click(), generate: () => generate($('.go')),
    addDuty: n => { const sel = S.draft.duty.teachers; if (!sel.includes(n) && sel.length < 3) { sel.push(n); save(); renderTeachers(); schedule(); } } });
  $('#bubbleAsk').addEventListener('click', e => { e.stopPropagation(); openChat(); });
  react({ pose: 'wave', title: 'สวัสดีครับ ผมครูแจ็ก', text: 'วันนี้มาทำรายงานด้วยกันนะครับ แตะตรงไหนบนภาพก็แก้ได้เลย' }, 2600);
  renderSchool(); renderDate(); renderTeachers(); renderMenu(); renderItems(); renderMemo(); renderLThemes(); renderMsgChips(); renderTemplates();
  schedule();
  await restorePhotos(); schedule();
  if (!school()) openSchoolSheet();
})();
