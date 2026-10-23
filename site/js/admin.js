// หน้าผู้ดูแล (ซ่อน): ตรวจข้อมูล Sheet · ลิงก์ปักหมุด+QR · พรีวิวแม่แบบ · โหมดวัดพิกัด · health ตัวอัปโหลด
import { loadData } from './data.js';
import { mergeTemplate, filterTemplates, validateTemplate, computeLayout } from './layout.js';
import { renderOnePage, createCanvas } from './render.js';
import { ensureFonts } from './fonts.js';
import { drawQR } from './qr.js';
import { createImageLoader, hasLogo, logoSrc } from './assets.js';

const BASE = 'https://sricodeboon.github.io/wanpage-kruwen/';
const PROVINCES = ['np', 'sn', 'mdh'];
const DESIGN_W = 1024, DESIGN_H = 1536;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// เก็บแค่ค่าสะดวก (แท็บล่าสุด) — ถูกบล็อกได้ จึงมีสำรองในหน่วยความจำ
function safeStorage() {
  try {
    const s = window.localStorage;
    s.setItem('wp.__t', '1'); s.removeItem('wp.__t');
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
  }
}
const store = safeStorage();
// หน้านี้ต้องเห็นข้อมูลสดจาก Sheet เสมอ จึงไม่ใช้แคชร่วมกับแอป (wp.data)
const memStorage = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; })();

const A = { config: {}, model: null, templatesAll: null, merged: [] };

const linkFor = (id) => `${BASE}?s=${encodeURIComponent(id)}&openExternalBrowser=1`;

// ---------- แท็บ ----------
function showTab(panelId) {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.panel === panelId)));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== panelId; });
  try { store.setItem('wp.admin.tab', panelId); } catch { /* ข้าม */ }
  if (panelId === 'p-health') checkHealth();
}
document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => showTab(t.dataset.panel); });

// ---------- โหลดข้อมูล ----------
async function jsonOr(url, fallback) {
  try { return await (await fetch(url, { cache: 'no-cache' })).json(); } catch { return fallback; }
}

async function load() {
  $('dataSrc').textContent = 'กำลังโหลด…';
  A.config = await jsonOr('config.json', {});
  A.templatesAll = await jsonOr('templates.json', null);
  A.merged = A.templatesAll ? A.templatesAll.templates.map((t) => mergeTemplate(A.templatesAll.common, t)) : [];
  const snapshot = await jsonOr('data/snapshot.json', {});
  const r = await loadData({ config: A.config, storage: memStorage, fetchFn: (...a) => fetch(...a), snapshot });
  A.model = r.model;
  $('dataSrc').textContent = r.source === 'fresh' ? 'ข้อมูลสดจาก Google Sheet' : 'ต่อ Sheet ไม่ได้ — กำลังดูข้อมูลสำรองที่แถมมากับเว็บ';
  await renderCheck();
  renderLinks();
}

// ---------- 1) ตรวจข้อมูล ----------
async function logoExists(file) {
  if (!file) return false;
  try { return (await fetch('assets/logos/' + file, { method: 'HEAD' })).ok; } catch { return false; }
}

async function renderCheck() {
  const { schools, teachersBySchool } = A.model;
  const warns = [];
  const rows = [];
  for (const s of schools) {
    const ts = teachersBySchool[s.school_id] || [];
    const withLogo = hasLogo(s);
    const logoOk = withLogo && await logoExists(s.logo_file);
    if (!ts.length) warns.push(`${s.name_full || s.school_id}: โรงเรียนไม่มีครู`);
    if (!PROVINCES.includes(s.province)) warns.push(`${s.name_full || s.school_id}: province "${s.province}" ไม่ถูกต้อง (ต้องเป็น np|sn|mdh)`);
    if (!withLogo) warns.push(`${s.name_full || s.school_id}: ยังไม่มีไฟล์ตรา (ภาพรายงานจะไม่มีตรา)`);
    else if (!logoOk) warns.push(`${s.name_full || s.school_id}: logo ไม่มีไฟล์ ("${s.logo_file}")`);
    if (s.short_name.length > 12) warns.push(`${s.name_full || s.school_id}: short_name "${s.short_name}" ยาว ${s.short_name.length} ตัว (เกิน 12) — ตัวอัปโหลด Drive จะปฏิเสธ`);
    if (!/^[a-z0-9_]+$/.test(s.school_id)) warns.push(`${s.school_id}: school_id ต้องเป็น a-z 0-9 _ เท่านั้น`);
    for (const t of ts) {
      if (t.phone && !/^\d{10}$/.test(String(t.phone).replace(/\D/g, ''))) warns.push(`${t.display_name} (${s.short_name}): เบอร์ไม่ครบ 10 หลัก ("${t.phone}")`);
    }
    rows.push(`<tr><td>${esc(s.school_id)}</td><td>${esc(s.short_name)}<br><span class="muted">${esc(s.name_full)}</span></td><td>${esc(s.province)}</td><td>${logoOk ? 'มี' : 'ไม่มี'}</td><td>${ts.length}</td><td>${ts.filter((t) => t.phone).length}</td></tr>`);
  }
  if (A.templatesAll) {
    for (const t of A.merged) {
      const v = validateTemplate(t);
      if (!v.ok) warns.push(`แม่แบบ ${t.id}: ${v.errors.join('; ')}`);
    }
  } else warns.push('โหลด templates.json ไม่ได้');
  $('warnList').innerHTML = warns.length ? warns.map((w) => `<li>${esc(w)}</li>`).join('') : '<li class="ok">ไม่พบปัญหา</li>';
  $('dataTable').querySelector('tbody').innerHTML = rows.join('');
}

// ---------- 2) ลิงก์ปักหมุด ----------
function pinMessage() {
  const lines = ['วันเพจครูเวร — แตะลิงก์โรงเรียนของตัวเอง'];
  for (const s of A.model.schools) lines.push(`• ${s.name_full || s.short_name}: ${linkFor(s.school_id)}`);
  lines.push('ถ้ากดแชร์ไม่ขึ้น ให้กด ⋮ แล้วเลือก เปิดในเบราว์เซอร์');
  return lines.join('\n');
}

async function copyText(text, stateEl) {
  try { await navigator.clipboard.writeText(text); stateEl.textContent = 'คัดลอกแล้ว'; }
  catch { stateEl.textContent = 'คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ข้อความแล้วเลือกคัดลอก'; }
}

function renderLinks() {
  $('pinMsg').value = pinMessage();
  const box = $('linkList');
  box.innerHTML = '';
  for (const s of A.model.schools) {
    const card = document.createElement('div');
    card.className = 'card';
    const url = linkFor(s.school_id);
    card.innerHTML = `<b>${esc(s.name_full || s.short_name)}</b><a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`;
    const cv = document.createElement('canvas');
    try { drawQR(cv, url); } catch { cv.remove(); }
    card.appendChild(cv);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn alt'; b.textContent = 'คัดลอกลิงก์';
    const st = document.createElement('span'); st.className = 'muted'; st.setAttribute('role', 'status');
    b.onclick = () => copyText(url, st);
    card.append(b, st);
    box.appendChild(card);
  }
}
$('copyPin').onclick = () => copyText($('pinMsg').value, $('copyState'));

// ---------- โหลดรูป ----------
const loadImage = createImageLoader();

function sampleModel(province) {
  const school = A.model.schools.find((s) => s.province === province) || A.model.schools[0]
    || { name_full: 'โรงเรียนตัวอย่าง', address: 'ที่อยู่ตัวอย่าง', short_name: 'ตัวอย่าง', logo_file: '' };
  const real = (A.model.teachersBySchool[school.school_id] || []).slice(0, 2);
  const teachers = real.length ? real : [{ display_name: 'ครูตัวอย่าง หนึ่ง', phone: '0812345678' }, { display_name: 'ครูตัวอย่าง สอง', phone: '' }];
  const labels = ['หน้าโรงเรียน', 'เคารพธงชาติ', 'อาคารเรียน', 'รอบบริเวณ'].map((l) => ({ label: l, icon: 'camera' }));
  return { school, title: A.model.settings.title_text || 'รายงานการปฏิบัติหน้าที่ครูเวร', dateISO: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }), teachers, photos: labels };
}

async function logoFor(school) {
  return hasLogo(school) ? loadImage(logoSrc(school)).catch(() => null) : null; // ไม่มีตรา = ไม่วาด
}

// ---------- 3) พรีวิวแม่แบบ ----------
async function renderPreview(province) {
  const grid = $('pvGrid');
  grid.innerHTML = '';
  $('pvMsg').textContent = '';
  if (!province || !A.templatesAll) return;
  if (!(await ensureFonts({ timeoutMs: 8000 }))) { $('pvMsg').textContent = 'ฟอนต์ยังไม่มา — ไม่วาดพรีวิว ลองโหลดใหม่'; return; }
  const list = filterTemplates(A.templatesAll, province);
  if (!list.length) { $('pvMsg').textContent = 'จังหวัดนี้ยังไม่มีแม่แบบที่เปิดใช้'; return; }
  const model = sampleModel(province);
  const logo = await logoFor(model.school);
  for (const t of list) {
    const bg = await loadImage(t.file).catch(() => null);
    const cv = document.createElement('canvas');
    cv.width = DESIGN_W * 0.25; cv.height = DESIGN_H * 0.25;
    renderOnePage(cv.getContext('2d'), model, t, 0.25, { bg, logo, photos: [] });
    const fig = document.createElement('figure');
    fig.append(cv);
    const cap = document.createElement('figcaption');
    const v = validateTemplate(t);
    cap.textContent = `${t.id} · ${t.name} · ${t.photo_layout}${v.ok ? '' : ' · มีข้อผิดพลาดเลย์เอาต์'}`;
    fig.append(cap);
    grid.append(fig);
  }
}
$('pvProvince').onchange = (e) => renderPreview(e.target.value);

// ---------- 4) โหมดวัด ----------
const MS = { scale: 0.5, bg: null, resolved: null, points: [] };

function msFillTemplates() {
  const sel = $('msTemplate');
  sel.innerHTML = '<option value="">— เลือก —</option>' + A.merged.map((t) => `<option value="${esc(t.id)}">${esc(t.id)} · ${esc(t.name)}</option>`).join('');
}

function msOutput() {
  const [p1, p2, p3] = MS.points;
  const out = {};
  if (p1 && p2) {
    const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
    out.landmark = { x, y, w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
  }
  if (p3) out.band = { top_y: p3.y };
  return out;
}

function msDraw() {
  const cv = $('msCanvas');
  const ctx = cv.getContext('2d');
  const k = MS.scale;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#e4dbf3'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (MS.bg) ctx.drawImage(MS.bg, 0, 0, cv.width, cv.height);
  if (MS.resolved) {
    const model = sampleModel(MS.resolved.province);
    const measure = (str, px, weight = 700) => { ctx.font = `${weight} ${px}px Kanit`; return ctx.measureText(String(str)).width; };
    try {
      const L = computeLayout(MS.resolved, { ...model, logoSize: null }, measure);
      ctx.lineWidth = 2; ctx.strokeStyle = '#ff8a00'; ctx.fillStyle = '#ff8a0033';
      for (const r of [...L.photos, L.duty.rect]) { ctx.fillRect(r.x * k, r.y * k, r.w * k, r.h * k); ctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k); }
    } catch { /* เลย์เอาต์พัง = ไม่วาดกรอบ */ }
  }
  const o = msOutput();
  ctx.lineWidth = 2; ctx.strokeStyle = '#d9a93a';
  if (o.landmark) { const l = o.landmark; ctx.fillStyle = '#d9a93a44'; ctx.fillRect(l.x * k, l.y * k, l.w * k, l.h * k); ctx.strokeRect(l.x * k, l.y * k, l.w * k, l.h * k); }
  if (o.band) { ctx.beginPath(); ctx.moveTo(0, o.band.top_y * k); ctx.lineTo(cv.width, o.band.top_y * k); ctx.stroke(); }
  $('msOut').value = Object.keys(o).length ? JSON.stringify(o) : '';
}

async function msSetTemplate(id) {
  const t = A.merged.find((m) => m.id === id);
  MS.resolved = t || null;
  MS.bg = t ? await loadImage(t.file).catch(() => null) : null;
  MS.points = [];
  await ensureFonts({ timeoutMs: 3000 });
  msDraw();
}
$('msTemplate').onchange = (e) => msSetTemplate(e.target.value);
$('msFile').onchange = async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  try { MS.bg = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
  catch { $('msPos').textContent = 'เปิดไฟล์รูปไม่ได้'; return; }
  if (!MS.resolved && A.merged[0]) MS.resolved = A.merged[0];
  MS.points = [];
  msDraw();
};
$('msCanvas').addEventListener('click', (e) => {
  const cv = $('msCanvas');
  const b = cv.getBoundingClientRect();
  const x = Math.round(((e.clientX - b.left) / b.width) * DESIGN_W);
  const y = Math.round(((e.clientY - b.top) / b.height) * DESIGN_H);
  if (MS.points.length >= 3) MS.points = [];
  MS.points.push({ x, y });
  $('msPos').textContent = `จุดที่ ${MS.points.length}: x=${x} y=${y}`;
  msDraw();
});
$('msReset').onclick = () => { MS.points = []; $('msPos').textContent = ''; msDraw(); };
$('msCopy').onclick = () => copyText($('msOut').value, $('msPos'));

// ---------- 5) health ----------
async function checkHealth() {
  const out = $('healthOut');
  const url = A.config.upload_url;
  if (!url) { out.textContent = 'ยังไม่ได้ตั้งค่า upload_url'; return; }
  out.textContent = 'กำลังตรวจ…';
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=health');
    const h = await res.json();
    if (!h.ok) throw new Error('not ok');
    out.innerHTML = `<ul class="warns"><li class="ok">พื้นที่ Drive: ใช้ ${esc(h.storage_used_gb)} / ${esc(h.storage_limit_gb)} GB</li>`
      + `<li class="ok">รับอัปโหลด: ${h.upload_enabled ? 'เปิดอยู่' : 'ปิดอยู่'}</li>`
      + `<li class="ok">รายงานวันนี้: ${esc(h.today_count)} ภาพ</li><li class="ok">เวอร์ชันสคริปต์: ${esc(h.version)}</li></ul>`;
  } catch { out.textContent = 'ตรวจสถานะไม่ได้ (ต่อ upload_url ไม่สำเร็จ)'; }
}
$('healthBtn').onclick = checkHealth;

// ---------- boot ----------
$('reload').onclick = () => load().catch(() => { $('dataSrc').textContent = 'โหลดไม่สำเร็จ'; });
load().then(() => {
  msFillTemplates();
  let saved = null;
  try { saved = store.getItem('wp.admin.tab'); } catch { /* ข้าม */ }
  if (saved && document.getElementById(saved)) showTab(saved);
}).catch(() => { $('dataSrc').textContent = 'โหลดไม่สำเร็จ'; });
