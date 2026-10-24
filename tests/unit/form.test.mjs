import { describe, it, expect } from 'vitest';
import {
  validateForm, toggleTeacher, dateGuard, reportFileName, nameParts, fileShortName, buildRenderModel,
  pickBackground, reconcileSelection, MAX_TEACHERS, rollToday, nextSentRecord, isSentToday,
} from '../../site/js/form.js';

const school = { school_id: 'changkon8', short_name: 'ช่างกล8', name_full: 'โรงเรียน ช่างกล 8', address: 'ที่อยู่', province: 'np', default_bg: 'np-01' };
const teachers = [
  { teacher_id: 't1', school_id: 'changkon8', display_name: 'ส.ต.ท.รัชเดช ศรีแก้ว', phone: '081-234-5678' },
  { teacher_id: 't2', school_id: 'changkon8', display_name: 'นางสาวสุทัตตา เกษี', phone: '' },
  { teacher_id: 't3', school_id: 'changkon8', display_name: 'นายปริญญา นวลสี', phone: '' },
  { teacher_id: 't4', school_id: 'changkon8', display_name: 'นางกัณหา อันทะปัญญา', phone: '' },
];
const model = { schools: [school], teachersBySchool: { changkon8: teachers }, labels: [], settings: {}, phonesMissing: false };
const photo = { blob: {}, w: 10, h: 10, label: '', icon: null };
const templates = [{ id: 'np-01', province: 'np' }, { id: 'np-02', province: 'np' }];

const full = (over = {}) => ({
  schoolId: 'changkon8', dateISO: '2026-10-23', selectedTeacherIds: ['t1'],
  photos: [photo, photo, photo, photo], bgId: 'np-01', ...over,
});

describe('validateForm', () => {
  it('ok when everything is there', () => {
    expect(validateForm(full(), model, templates)).toEqual({ ok: true, message: '', target: null });
  });
  it('no teacher selected', () => {
    expect(validateForm(full({ selectedTeacherIds: [] }), model, templates))
      .toEqual({ ok: false, message: 'เลือกครูเวรอย่างน้อย 1 คน', target: 'teachers' });
  });
  it('missing photos counts n', () => {
    const r = validateForm(full({ photos: [photo, null, null, photo] }), model, templates);
    expect(r).toEqual({ ok: false, message: 'เลือกรูปอีก 2 ภาพ', target: 'photos' });
    expect(validateForm(full({ photos: [null, null, null, null] }), model, templates).message).toBe('เลือกรูปอีก 4 ภาพ');
  });
  it('teachers come before photos (first missing thing)', () => {
    expect(validateForm(full({ selectedTeacherIds: [], photos: [null, null, null, null] }), model, templates).target).toBe('teachers');
  });
  it('phones missing (first load offline)', () => {
    expect(validateForm(full(), { ...model, phonesMissing: true }, templates))
      .toEqual({ ok: false, message: 'ต่อเน็ตเพื่อโหลดเบอร์โทรครั้งแรก', target: null });
  });
  it('school with no active teachers', () => {
    const m = { ...model, teachersBySchool: { changkon8: [] } };
    expect(validateForm(full({ selectedTeacherIds: [] }), m, templates))
      .toEqual({ ok: false, message: 'ยังไม่มีรายชื่อครูของโรงเรียนนี้ ช่วยแจ้งครูแจ็ก', target: 'teachers' });
  });
  it('province without templates', () => {
    expect(validateForm(full({ bgId: null }), model, []))
      .toEqual({ ok: false, message: 'ยังไม่มีพื้นหลังของจังหวัดนี้ ช่วยแจ้งครูแจ็ก', target: 'background' });
  });
  it('selected ids not in the school list do not count', () => {
    expect(validateForm(full({ selectedTeacherIds: ['ghost'] }), model, templates).message).toBe('เลือกครูเวรอย่างน้อย 1 คน');
  });
});

describe('toggleTeacher', () => {
  it('adds in tap order', () => {
    expect(toggleTeacher(['b'], 'a')).toEqual({ selected: ['b', 'a'], error: null });
  });
  it('rejects the 4th', () => {
    const r = toggleTeacher(['a', 'b', 'c'], 'd');
    expect(MAX_TEACHERS).toBe(3);
    expect(r).toEqual({ selected: ['a', 'b', 'c'], error: 'เลือกได้ไม่เกิน 3 คน แตะชื่อเดิมเพื่อเอาออกก่อน' });
  });
  it('remove then add works', () => {
    const r1 = toggleTeacher(['a', 'b', 'c'], 'b');
    expect(r1).toEqual({ selected: ['a', 'c'], error: null });
    expect(toggleTeacher(r1.selected, 'd')).toEqual({ selected: ['a', 'c', 'd'], error: null });
  });
  it('does not mutate input', () => {
    const s = ['a'];
    toggleTeacher(s, 'b');
    expect(s).toEqual(['a']);
  });
});

describe('dateGuard', () => {
  const today = '2026-10-23';
  it('today ok without warning', () => expect(dateGuard(today, today)).toEqual({ ok: true, warn: null }));
  it('tomorrow is rejected', () => expect(dateGuard('2026-10-24', today).ok).toBe(false));
  it('8 days back is rejected', () => expect(dateGuard('2026-10-15', today).ok).toBe(false));
  it('7 days back is allowed with warning', () => expect(dateGuard('2026-10-16', today)).toEqual({ ok: true, warn: 'ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง' }));
  it('1 day back warns', () => expect(dateGuard('2026-10-22', today)).toEqual({ ok: true, warn: 'ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง' }));
  it('garbage is rejected', () => expect(dateGuard('', today).ok).toBe(false));
});

describe('helpers', () => {
  it('nameParts: ตัดยศ/คำนำหน้าออกจากชื่อต้น', () => {
    expect(nameParts('นางสาวสีแพร ผิวเหลือง')).toEqual({ rank: 'นางสาว', given: 'สีแพร', sur: 'ผิวเหลือง' });
    expect(nameParts('ด.ต.หญิงดารินทร์ อินทิแสง')).toEqual({ rank: 'ด.ต.หญิง', given: 'ดารินทร์', sur: 'อินทิแสง' });
    expect(nameParts('นางสาวจิราวรรณ ชอบพวงดึ').given).toBe('จิราวรรณ');
    expect(nameParts('นางกัณหา อันทะปัญญา').given).toBe('กัณหา');
    expect(nameParts('นายปริญญา นวลสี').given).toBe('ปริญญา');
    expect(nameParts('ร.ต.อ.วิทยา อุปทุม')).toEqual({ rank: 'ร.ต.อ.', given: 'วิทยา', sur: 'อุปทุม' });
    expect(nameParts('ว่าที่ ร.ต.สมชาย ใจดี').given).toBe('สมชาย');
    expect(nameParts('นางสาวธัญญารัตน์ไชยโพธิ์')).toEqual({ rank: 'นางสาว', given: 'ธัญญารัตน์ไชยโพธิ์', sur: '' });
    expect(nameParts('นายิกา ทองดี').given).toBe('นายิกา'); // ชื่อที่ขึ้นด้วย "นาย" ไม่ถูกตัด
    expect(nameParts('')).toEqual({ rank: '', given: '', sur: '' });
  });
  it('reportFileName', () => {
    expect(reportFileName('ช่างกล8', '2026-10-23', '0742')).toBe('วันเพจ_ช่างกล8_2026-10-23_0742.png');
  });
  it('reportFileName: ชื่อย่อยาว/อักขระต้องห้าม → ตัดเหลือ ≤ 12 ตัว ไม่ทิ้งวรรณยุกต์ค้าง', () => {
    expect(fileShortName('การท่าอากาศยาน')).toBe('การท่าอากาศย');
    expect(fileShortName('ใต้ร่มพระบารมี')).toBe('ใต้ร่มพระบาร');
    expect(fileShortName('คอนราดเฮงเค็ล')).toBe('คอนราดเฮงเค็');
    expect(fileShortName('ช่าง/กล_8')).toBe('ช่างกล8');
    expect(fileShortName('')).toBe('รร');
    for (const s of ['การท่าอากาศยาน', 'ใต้ร่มพระบารมี', 'คอนราดเฮงเค็ล']) expect(fileShortName(s).length).toBeLessThanOrEqual(12);
  });
  it('buildRenderModel keeps tap order and labels', () => {
    const st = full({ selectedTeacherIds: ['t3', 't1'], photos: [{ ...photo, label: 'อาคารเรียน', icon: 'building' }, photo, null, photo] });
    const rm = buildRenderModel(st, model, 'หัวเรื่อง');
    expect(rm.school).toBe(school);
    expect(rm.title).toBe('หัวเรื่อง');
    expect(rm.dateISO).toBe('2026-10-23');
    expect(rm.teachers).toEqual([
      { display_name: 'นายปริญญา นวลสี', phone: '' },
      { display_name: 'ส.ต.ท.รัชเดช ศรีแก้ว', phone: '081-234-5678' },
    ]);
    expect(rm.photos).toEqual([{ label: 'อาคารเรียน', icon: 'building' }, null, null, null]);
  });
  it('buildRenderModel default title', () => {
    expect(buildRenderModel(full(), model, '').title).toBe('รายงานภาพบรรยากาศและบริบทโรงเรียน');
  });
  it('pickBackground: stored -> default_bg -> first', () => {
    expect(pickBackground(templates, 'np-02', 'np-01')).toBe('np-02');
    expect(pickBackground(templates, 'sn-01', 'np-01')).toBe('np-01');
    expect(pickBackground(templates, null, 'zz')).toBe('np-01');
    expect(pickBackground([], 'np-02', 'np-01')).toBe(null);
  });
  it('reconcileSelection drops teachers that vanished, keeps order', () => {
    expect(reconcileSelection(['t3', 'gone', 't1'], teachers)).toEqual(['t3', 't1']);
  });
});

describe('rollToday', () => {
  it('advances a date that was still the old today', () => {
    expect(rollToday('2026-10-23', '2026-10-23', '2026-10-24')).toEqual({ dateISO: '2026-10-24', warn: null, changed: true });
  });
  it('keeps a hand-edited date and warns', () => {
    expect(rollToday('2026-10-21', '2026-10-23', '2026-10-24')).toEqual({ dateISO: '2026-10-21', warn: 'ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง', changed: false });
  });
  it('hand-edited date that fell outside the 7-day window resets to the new today', () => {
    expect(rollToday('2026-10-16', '2026-10-23', '2026-10-24')).toEqual({ dateISO: '2026-10-24', warn: null, changed: true });
  });
  it('same day: re-validates without change', () => {
    expect(rollToday('2026-10-22', '2026-10-23', '2026-10-23')).toEqual({ dateISO: '2026-10-22', warn: 'ไม่ใช่วันนี้ — ตรวจสอบอีกครั้ง', changed: false });
    expect(rollToday('2026-10-23', '2026-10-23', '2026-10-23')).toEqual({ dateISO: '2026-10-23', warn: null, changed: false });
  });
});

describe('nextSentRecord / isSentToday (ส่งแล้ววันนี้ใช้วันที่ของรายงาน)', () => {
  const T = '2026-10-23';
  it('stores the report date, not the day it was sent', () => {
    expect(nextSentRecord(null, '2026-10-21', 5, T)).toEqual({ date: '2026-10-21', ts: 5 });
    expect(isSentToday(nextSentRecord(null, '2026-10-21', 5, T), T)).toBe(false);
  });
  it("today's report is recorded and shows the card", () => {
    const r = nextSentRecord({ date: '2026-10-22', ts: 1 }, T, 9, T);
    expect(r).toEqual({ date: T, ts: 9 });
    expect(isSentToday(r, T)).toBe(true);
  });
  it("a back-dated send does not erase today's record", () => {
    const today = { date: T, ts: 7 };
    expect(nextSentRecord(today, '2026-10-20', 8, T)).toBe(today);
  });
  it('no record -> not sent', () => expect(isSentToday(null, T)).toBe(false));
});
