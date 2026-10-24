// กติกาของฟอร์มครูเวร — pure ไม่แตะ DOM (ข้อความตาม spec 7.7 ตามตัวอักษร)
import { daysBetweenISO } from './thaidate.js';

export const MAX_TEACHERS = 3;
export const MAX_BACK_DAYS = 7;
export const DEFAULT_TITLE = 'รายงานภาพบรรยากาศและบริบทโรงเรียน';

export const MSG = {
  noTeacher: 'เลือกครูเวรอย่างน้อย 1 คน',
  tooMany: 'เลือกได้ไม่เกิน 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน',
  photosLeft: (n) => `เลือกรูปอีก ${n} ภาพ`,
  phonesMissing: 'ต่อเน็ตเพื่อโหลดเบอร์โทรครั้งแรก',
  schoolEmpty: 'ยังไม่มีรายชื่อครูของโรงเรียนนี้ ช่วยแจ้งครูแจ็ก',
  noTemplates: 'ยังไม่มีพื้นหลังของจังหวัดนี้ ช่วยแจ้งครูแจ็ก',
  templatesFail: 'ยังโหลดรายการพื้นหลังไม่ได้ ต่ออินเทอร์เน็ตแล้วแตะ ลองใหม่',
  notToday: 'ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง',
};

const fail = (message, target) => ({ ok: false, message, target });

const teachersOf = (model, schoolId) => (model?.teachersBySchool?.[schoolId]) || [];

/**
 * ตรวจสิ่งที่ขาด "ข้อแรก" ตามลำดับที่ครูเห็นบนหน้า
 * @param templates แม่แบบที่ใช้ได้ของจังหวัดโรงเรียนนี้ (ผล filterTemplates); ไม่ส่ง = ไม่ตรวจ;
 *        null = โหลด templates.json ไม่ได้ (ไม่ใช่ "จังหวัดนี้ไม่มีพื้นหลัง")
 */
export function validateForm(state, model, templates) {
  const list = teachersOf(model, state.schoolId);
  if (!list.length) return fail(MSG.schoolEmpty, 'teachers');
  if (templates === null) return fail(MSG.templatesFail, 'background');
  if (Array.isArray(templates) && !templates.length) return fail(MSG.noTemplates, 'background');
  const ids = new Set(list.map((t) => t.teacher_id));
  if (!(state.selectedTeacherIds || []).some((id) => ids.has(id))) return fail(MSG.noTeacher, 'teachers');
  const missing = (state.photos || []).filter((p) => !p).length + Math.max(0, 4 - (state.photos || []).length);
  if (missing > 0) return fail(MSG.photosLeft(missing), 'photos');
  if (model.phonesMissing) return fail(MSG.phonesMissing, null);
  return { ok: true, message: '', target: null };
}

export function toggleTeacher(selected, id) {
  if (selected.includes(id)) return { selected: selected.filter((x) => x !== id), error: null };
  if (selected.length >= MAX_TEACHERS) return { selected: [...selected], error: MSG.tooMany };
  return { selected: [...selected, id], error: null };
}

// ห้ามวันอนาคต · ย้อนได้ไม่เกิน 7 วัน · ไม่ใช่วันนี้ = เตือน
export function dateGuard(iso, todayISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return { ok: false, warn: null };
  const back = daysBetweenISO(iso, todayISO);
  if (!Number.isFinite(back) || back < 0 || back > MAX_BACK_DAYS) return { ok: false, warn: null };
  return { ok: true, warn: back === 0 ? null : MSG.notToday };
}

// ชื่อย่อในชื่อไฟล์: ตัดอักขระต้องห้าม (/ \ : * ? " < > | _) และยาวไม่เกิน 12 ตัว ให้ผ่าน uploader ทุกรุ่น (Validate.gs)
// ตัดไม่ให้ทิ้งสระบน/ล่าง/วรรณยุกต์ไว้หลังจุดตัด (ถอยไปตัดก่อนพยัญชนะตัวนั้น)
export const FILE_SHORT_MAX = 12;
const isMark = (ch) => { const c = ch.codePointAt(0); return c === 0x0e31 || (c >= 0x0e34 && c <= 0x0e3a) || (c >= 0x0e47 && c <= 0x0e4e); };
export function fileShortName(shortName) {
  const t = String(shortName ?? '').replace(/[\/\\:*?"<>|_]+/g, '').trim();
  if (t.length <= FILE_SHORT_MAX) return t || 'รร';
  let n = FILE_SHORT_MAX;
  while (n > 1 && isMark(t[n])) n--;
  return t.slice(0, n);
}

// แยกชื่อครูเป็น ยศ/คำนำหน้า · ชื่อต้น · นามสกุล (ป้ายสั้น + ตัดบรรทัดในกริด) — ไม่ใช้กับ render (layout.splitRank)
const NAME_RE = /^((?:[ก-ฮ][ก-๎]{0,3}\.)+(?:หญิง)?|ว่าที่\s?(?:[ก-ฮ][ก-๎]{0,3}\.)+(?:หญิง)?|(?:นางสาว|นาง|นาย)(?=[ก-ฮเ-ไ]))?\s*(\S+)\s*(.*)$/u;
export function nameParts(name) {
  const m = String(name ?? '').trim().match(NAME_RE) || [];
  return { rank: m[1] || '', given: m[2] || '', sur: m[3] || '' };
}

export function reportFileName(shortName, dateISO, hhmm) {
  return `วันเพจ_${fileShortName(shortName)}_${dateISO}_${hhmm}.png`;
}

// RenderModel สำหรับ renderOnePage — ลำดับครู = ลำดับที่ติ๊ก
export function buildRenderModel(state, model, title) {
  const school = model.schools.find((s) => s.school_id === state.schoolId) || null;
  const byId = new Map(teachersOf(model, state.schoolId).map((t) => [t.teacher_id, t]));
  const teachers = state.selectedTeacherIds.filter((id) => byId.has(id))
    .map((id) => ({ display_name: byId.get(id).display_name, phone: byId.get(id).phone || '' }));
  const photos = [0, 1, 2, 3].map((i) => {
    const p = state.photos[i];
    return p && p.label ? { label: p.label, icon: p.icon || 'camera' } : null;
  });
  return { school, title: title || DEFAULT_TITLE, dateISO: state.dateISO, teachers, photos };
}

// บันทึก "ส่งแล้ว" ของโรงเรียน: เก็บวันที่ของรายงาน (ไม่ใช่วันที่กด) — รายงานย้อนหลังไม่ทับบันทึกของวันนี้
export function nextSentRecord(prev, reportDateISO, ts, todayISO) {
  if (reportDateISO !== todayISO && prev && prev.date === todayISO) return prev;
  return { date: reportDateISO, ts };
}

// การ์ด "วันนี้ส่งแล้ว" แสดงเฉพาะเมื่อรายงานที่ส่งล่าสุดเป็นของวันนี้
export const isSentToday = (rec, todayISO) => Boolean(rec && rec.date === todayISO);

// ค่าเริ่มต้นพื้นหลัง: ที่จำไว้ → default_bg ของโรงเรียน → ตัวแรกของจังหวัด
export function pickBackground(templates, storedId, defaultBg) {
  const has = (id) => id && templates.some((t) => t.id === id);
  if (has(storedId)) return storedId;
  if (has(defaultBg)) return defaultBg;
  return templates[0]?.id ?? null;
}

// ข้อมูลใหม่มาถึง: คงที่ติ๊กไว้ (ลำดับเดิม) ตัดเฉพาะคนที่ไม่อยู่ในรายชื่อแล้ว
export function reconcileSelection(selectedIds, teachers) {
  const ids = new Set(teachers.map((t) => t.teacher_id));
  return selectedIds.filter((id) => ids.has(id));
}

// เปิดหน้าค้างข้ามเที่ยงคืน: วันที่ที่ยังเป็น "วันนี้เดิม" (ครูไม่ได้แก้) เลื่อนตาม;
// วันที่ที่ครูแก้เองคงไว้ถ้ายังอยู่ในช่วง ไม่งั้นกลับเป็นวันนี้ใหม่
export function rollToday(dateISO, oldToday, newToday) {
  const next = dateISO === oldToday ? newToday : dateISO;
  const g = dateGuard(next, newToday);
  if (!g.ok) return { dateISO: newToday, warn: null, changed: newToday !== dateISO };
  return { dateISO: next, warn: g.warn, changed: next !== dateISO };
}
