// คุยกับครูแจ็ก — ถาม-ตอบแบบออฟไลน์ (ไม่ใช้ AI/อินเทอร์เน็ต)
// จับคำสำคัญในข้อความ → ตอบ + ปุ่มลัด "ทำให้เลย" ที่เรียกฟังก์ชันของแอปผ่าน ctx
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const avatar = p => `assets/mascot/${p}.v1.webp`;

const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const START_CHIPS = ['ต้องทำอะไรต่อ', 'เปลี่ยนวันที่', 'ใครเป็นครูเวร', 'ใส่รูปยังไง', 'ส่งเข้า LINE ยังไง'];

let ctx = null, busy = false, greeted = false;

export function initChat(c) {
  ctx = c;
  $('#chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const i = $('#chatIn'), t = i.value.trim(); if (!t || busy) return;
    i.value = ''; ask(t);
  });
  $('#chatChips').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b && !busy) ask(b.dataset.q); });
  $('#chatLog').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const fn = acts.get(b.dataset.act); if (fn) fn();
  });
  $('#chatClear').addEventListener('click', () => { $('#chatLog').innerHTML = ''; acts.clear(); greeted = false; hello(); });
}

export function openChat() {
  ctx.openSheet('#sheetChat');
  if (!greeted) hello();
  setTimeout(() => $('#chatIn').focus({ preventScroll: true }), 80);
}

function hello() {
  greeted = true;
  const p = ctx.problems();
  bot({
    pose: 'wave',
    text: `สวัสดีครับ ผมครูแจ็ก ถามเรื่องการทำวันเพจได้เลยครับ เช่น ใส่รูป เลือกครูเวร เปลี่ยนวันที่ หรือถามเบอร์ครูก็ได้${p.length ? `\nตอนนี้ยังเหลือ: ${p.map(x => x[1]).join(' · ')}` : '\nตอนนี้ภาพพร้อมส่งแล้วครับ!'}`,
    chips: START_CHIPS,
  }, true);
}

/* ---------------- แสดงข้อความ ---------------- */
const acts = new Map(); let actN = 0;
function bubbleHTML(who, text, buttons = []) {
  const btns = buttons.map(b => { const id = 'a' + (++actN); acts.set(id, () => { b.fn(); }); return `<button class="chat-act" type="button" data-act="${id}">${esc(b.label)}</button>`; }).join('');
  const body = esc(text).replace(/\n/g, '<br>');
  return who === 'bot'
    ? `<div class="msg bot"><img class="msg-av" src="${avatar('wave')}" alt=""><div class="msg-b"><p>${body}</p>${btns ? `<div class="chat-acts">${btns}</div>` : ''}</div></div>`
    : `<div class="msg me"><div class="msg-b"><p>${body}</p></div></div>`;
}
function append(html) {
  const log = $('#chatLog');
  log.insertAdjacentHTML('beforeend', html);
  log.lastElementChild.scrollIntoView({ block: 'end', behavior: reduced() ? 'auto' : 'smooth' });
}
function setChips(list) {
  $('#chatChips').innerHTML = (list || START_CHIPS).map(q => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
}
function bot(r, instant) {
  const show = () => {
    append(bubbleHTML('bot', r.text, r.acts));
    setChips(r.chips);
    if (r.pose) { const img = $('#chatLog .msg.bot:last-child .msg-av'); if (img) img.src = avatar(r.pose); }
    if (r.pose && r.pose !== 'wave') ctx.react({ pose: r.pose, title: 'ครูแจ็ก', text: r.text.split('\n')[0].slice(0, 60) }, 1800);
  };
  if (instant || reduced()) { show(); return; }
  busy = true;
  append('<div class="msg bot typing" aria-label="ครูแจ็กกำลังพิมพ์"><img class="msg-av" src="assets/mascot/point.v1.webp" alt=""><div class="msg-b"><span></span><span></span><span></span></div></div>');
  setTimeout(() => { $('#chatLog .typing')?.remove(); busy = false; show(); }, 450 + Math.min(700, r.text.length * 6));
}
function ask(text) {
  append(bubbleHTML('me', text));
  let r;
  try { r = answer(text); } catch (e) { console.error(e); r = { text: 'ขอโทษครับ ผมงงนิดหน่อย ลองถามใหม่อีกครั้งนะครับ' }; }
  bot(r);
}

/* ---------------- เข้าใจข้อความ ---------------- */
const norm = s => String(s).toLowerCase().replace(/[๐-๙]/g, d => THAI_DIGITS.indexOf(d)).replace(/[\s?!.,'"“”]+/g, '');
const has = (t, ...ws) => ws.some(w => t.includes(w));

// ตัดยศ/คำนำหน้า เหลือ ชื่อ + นามสกุล
function nameParts(full) {
  const s = String(full).trim().replace(/^(ว่าที่\s*)?((?:[ก-ฮ]{1,3}\.)+(หญิง)?|นางสาว|นาง|นาย|ครู|ดร\.)/, '').trim();
  const [first = '', last = ''] = s.split(/\s+/);
  return { first, last };
}
function findTeachers(t) {
  return ctx.teachersList().filter(n => {
    const { first, last } = nameParts(n);
    return (first.length >= 2 && t.includes(norm(first))) || (last.length >= 3 && t.includes(norm(last)));
  });
}

function parseDate(t) {
  const today = ctx.todayBangkok();
  if (has(t, 'เมื่อวานซืน')) return ctx.addDaysISO(today, -2);
  if (has(t, 'เมื่อวาน')) return ctx.addDaysISO(today, -1);
  if (has(t, 'มะรืน')) return ctx.addDaysISO(today, 2);
  if (has(t, 'พรุ่งนี้')) return ctx.addDaysISO(today, 1);
  if (has(t, 'วันนี้')) return today;
  // "5พฤศจิกายน" / "5พ.ย." (+ ปี พ.ศ.)
  for (let i = 0; i < 12; i++) {
    for (const mName of [TH_MONTHS[i], TH_MONTHS_SHORT[i].replace(/\./g, ''), TH_MONTHS_SHORT[i]]) {
      const k = t.replace(/\./g, '').indexOf(mName.replace(/\./g, ''));
      if (k < 0) continue;
      const tt = t.replace(/\./g, '');
      const d = +(tt.slice(0, k).match(/(\d{1,2})$/) || [])[1];
      if (!d || d > 31) continue;
      const yM = tt.slice(k + mName.replace(/\./g, '').length).match(/^(?:พศ)?(\d{4})/);
      const y = yM ? (+yM[1] > 2400 ? +yM[1] - 543 : +yM[1]) : +today.slice(0, 4);
      const days = new Date(Date.UTC(y, i + 1, 0)).getUTCDate(); if (d > days) return null;
      return `${y}-${String(i + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // "วันที่ 5" = เดือนที่เลือกอยู่
  const m = t.match(/วันที่(\d{1,2})(?!\d)/);
  if (m) { const [y, mo] = ctx.S.draft[ctx.mode()].dateISO.split('-'); const d = +m[1]; if (d >= 1 && d <= new Date(Date.UTC(+y, +mo, 0)).getUTCDate()) return `${y}-${mo}-${String(d).padStart(2, '0')}`; }
  return null;
}
const fullDate = iso => `วัน${ctx.thaiWeekday(iso)}ที่ ${ctx.formatThaiDate(iso)}`;

// ขั้นต่อไป จากสิ่งที่ยังขาด (ใช้ problems() ของแอป)
function nextStep() {
  const p = ctx.problems();
  if (!p.length) return { pose: 'thumbs', text: 'ครบหมดแล้วครับ! ตรวจภาพอีกนิด แล้วกดส่งเข้า LINE ได้เลย', acts: [{ label: 'สร้างภาพ & ส่ง LINE', fn: ctx.generate }] };
  const [k, msg] = p[0];
  const fix = { school: { label: 'เลือกโรงเรียน', fn: ctx.openSchoolSheet }, photo: { label: 'เลือกรูป', fn: ctx.pickPhotos },
    teachers: { label: 'เลือกครูเวร', fn: () => ctx.openSheet('#sheetTeachers') }, items: { label: 'ใส่ข้อรายงาน', fn: () => ctx.openSheet('#sheetItems') }, menu: { label: 'ใส่เมนู', fn: () => ctx.openSheet('#sheetMenu') } }[k];
  return { pose: 'point', text: `ขั้นต่อไปคือ ${msg} ครับ${p.length > 1 ? `\nหลังจากนั้น: ${p.slice(1).map(x => x[1]).join(' · ')}` : ''}`, acts: fix ? [fix] : [] };
}

const INTENTS = [
  { kw: ['ขอบคุณ', 'ขอบใจ', 'thank'], r: () => ({ pose: 'cheer', text: 'ยินดีครับ! มีอะไรเรียกผมได้ตลอดนะครับ' }) },
  { kw: ['ชื่ออะไร', 'เป็นใคร', 'ครูแจ็กคือ', 'ครูแจ๊ก', 'ครูวัน'], r: () => ({ pose: 'wave', text: 'ผมชื่อครูแจ็กครับ เป็นผู้ช่วยทำรายงานวันเพจ ช่วยบอกขั้นตอนและพาไปแก้ตรงที่ต้องแก้ได้ครับ' }) },
  { kw: ['สวัสดี', 'หวัดดี', 'hello', 'hi'], r: () => ({ pose: 'wave', text: 'สวัสดีครับคุณครู วันนี้ให้ผมช่วยอะไรดีครับ', chips: START_CHIPS }) },
  { kw: ['ทำอะไรต่อ', 'ต่อไป', 'ขาดอะไร', 'เหลืออะไร', 'เริ่มยังไง', 'เริ่มต้น', 'ทำยังไง', 'ขั้นตอน', 'วิธีใช้', 'ใช้ยังไง'], r: nextStep },
  { kw: ['ใครเป็นครูเวร', 'ใครเวร', 'ครูเวรวันนี้'], r: () => {
    const sel = ctx.S.draft.duty.teachers;
    if (!sel.length) return { pose: 'point', text: 'ยังไม่ได้เลือกครูเวรเลยครับ เลือกได้สูงสุด 3 คน', acts: [{ label: 'เลือกครูเวร', fn: () => ctx.openSheet('#sheetTeachers') }] };
    return { pose: 'thumbs', text: `ครูเวรที่เลือกไว้:\n${sel.map((n, i) => `${i + 1}. ${n}${ctx.phoneOf(n) ? ` (${ctx.phoneOf(n)})` : ''}`).join('\n')}`, acts: [{ label: 'แก้รายชื่อครูเวร', fn: () => ctx.openSheet('#sheetTeachers') }] };
  } },
  { kw: ['แก้ชื่อ', 'ชื่อผิด', 'เปลี่ยนชื่อ', 'เพิ่มชื่อ', 'เพิ่มครู', 'ลบชื่อ', 'ครูใหม่'], r: () => ({ pose: 'point', text: 'เปิดหน้า "ครูเวรวันนี้" แล้ว\n• แก้ชื่อ: แตะรูปดินสอท้ายชื่อ\n• เพิ่มครู: พิมพ์ชื่อในช่องล่างสุดแล้วกด "เพิ่ม"\n• ชื่อที่เพิ่มเองลบได้ในหน้าแก้ชื่อ', acts: [{ label: 'เปิดรายชื่อครู', fn: () => ctx.openSheet('#sheetTeachers') }] }) },
  { kw: ['เบอร์', 'โทร'], r: () => ({ pose: 'point', text: 'เบอร์ครูมีใส่ไว้ให้แล้วครับ พอเลือกครูเวร เบอร์จะขึ้นในภาพเอง ถ้าเบอร์ผิดหรือไม่มี แก้ได้ในช่องเบอร์ใต้ชื่อ ระบบจำไว้ให้ครั้งหน้า\nอยากรู้เบอร์ใคร พิมพ์ชื่อครูมาได้เลยครับ', acts: [{ label: 'เปิดรายชื่อครู', fn: () => ctx.openSheet('#sheetTeachers') }] }) },
  { kw: ['ครูเวร', 'เลือกครู'], r: () => ({ pose: 'point', text: 'แตะกล่องครูเวรด้านล่างของภาพ แล้วแตะชื่อครูตามลำดับ (สูงสุด 3 คน) แตะชื่อซ้ำเพื่อเอาออกครับ', acts: [{ label: 'เลือกครูเวร', fn: () => ctx.openSheet('#sheetTeachers') }] }) },
  { kw: ['รูปหาย', 'รูปไม่ขึ้น', 'เก็บรูป'], r: () => ({ pose: 'camera', text: 'รูปที่เลือกเก็บไว้ในเครื่องนี้ครับ ปิดแอปแล้วกลับมาก็ยังอยู่ แต่ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ต้องเลือกรูปใหม่ครับ' }) },
  { kw: ['รูป', 'ภาพกิจกรรม', 'ถ่าย', 'photo', 'ป้ายชื่อ'], r: () => ({ pose: 'camera', text: 'ใส่รูปได้ 2 แบบครับ\n• แตะช่องรูปบนภาพทีละช่อง (เลือกป้ายชื่อใต้รูปได้ด้วย)\n• หรือเลือกทีเดียว 4 รูป ผมเรียงให้เอง\nรูปแนวตั้ง/แนวนอนใช้ได้หมด ระบบครอปให้พอดี', acts: [{ label: 'เลือกรูปหลายรูป', fn: ctx.pickPhotos }] }) },
  { kw: ['อาหาร', 'เมนู', 'กลางวัน'], r: () => ctx.mode() === 'lunch'
    ? { pose: 'lunch', text: 'พิมพ์เมนูทีละรายการ ภาพจะเรียงเป็น ๑ ๒ ๓ ให้เอง และใส่ข้อความเพิ่ม เช่น จำนวนนักเรียนที่รับประทานได้ครับ', acts: [{ label: 'ใส่เมนู', fn: () => ctx.openSheet('#sheetMenu') }] }
    : { pose: 'lunch', text: 'ตอนนี้อยู่หน้ารายงานครูเวรครับ จะทำรายงานอาหารกลางวันให้สลับก่อน', acts: [{ label: 'สลับเป็นอาหารกลางวัน', fn: () => { ctx.setMode('lunch'); ctx.closeSheet('#sheetChat'); } }] } },
  { kw: ['หน้าแถว', 'ปบ', 'ประชุมหน้าแถว', 'เข้าแถว'], r: () => ctx.mode() === 'assembly'
    ? { pose: 'point', text: 'รายงานหน้าแถวมี: เรียน ผู้บังคับบัญชา → วันที่ → ข้าฯ (ผู้รายงาน) ขอรายงานการ ปบ. ดังนี้ → ข้อ ๑ ๒ ๓ → จึงเรียนมาเพื่อโปรดทราบ และรูป 4 รูป\nแก้ข้อรายงานหรือชื่อผู้รายงานได้เลยครับ', acts: [{ label: 'แก้ข้อรายงาน', fn: () => ctx.openSheet('#sheetItems') }, { label: 'แก้ผู้รายงาน', fn: () => ctx.openSheet('#sheetMemo') }] }
    : { pose: 'point', text: 'สลับไปทำรายงานหน้าแถวได้เลยครับ', acts: [{ label: 'สลับเป็นหน้าแถว', fn: () => { ctx.setMode('assembly'); ctx.closeSheet('#sheetChat'); } }] } },
  { kw: ['ผู้รายงาน', 'ข้าฯ'], r: () => ({ pose: 'point', text: 'ชื่อผู้รายงาน (ข้าฯ …) แก้ได้ในหน้า "หนังสือรายงาน" ของรายงานหน้าแถว แต่ละโรงเรียนจำแยกกันครับ', acts: [{ label: 'แก้ผู้รายงาน', fn: () => { if (ctx.mode() !== 'assembly') ctx.setMode('assembly'); ctx.openSheet('#sheetMemo'); } }] }) },
  { kw: ['รายงานครูเวร', 'โหมดครูเวร', 'กลับไปครูเวร'], r: () => ({ pose: 'point', text: 'สลับไปหน้ารายงานครูเวรได้เลยครับ', acts: [{ label: 'สลับเป็นครูเวร', fn: () => { ctx.setMode('duty'); ctx.closeSheet('#sheetChat'); } }] }) },
  { kw: ['พื้นหลัง', 'ฉาก', 'ธีม', 'สีภาพ', 'แม่แบบ'], r: () => ({ pose: 'point', text: 'เปลี่ยนพื้นหลังได้ที่ปุ่ม "พื้นหลัง" แถบล่างครับ มีภาพสถานที่ของจังหวัดให้เลือกหลายแบบ', acts: [{ label: 'เลือกพื้นหลัง', fn: () => ctx.openSheet('#sheetBg') }] }) },
  { kw: ['โรงเรียน', 'ตรา', 'โลโก้', 'ที่อยู่'], r: () => ({ pose: 'point', text: `ตอนนี้เลือก ${ctx.school()?.name_full || 'ยังไม่ได้เลือกโรงเรียน'} ครับ เปลี่ยนได้ที่ชื่อโรงเรียนด้านบน ถ้าโรงเรียนไม่มีในรายการ กรอกชื่อ ที่อยู่ และใส่ตราเองได้`, acts: [{ label: 'เปลี่ยนโรงเรียน', fn: ctx.openSchoolSheet }] }) },
  { kw: ['หัวเรื่อง', 'ชื่อรายงาน', 'หัวข้อ'], r: () => ({ pose: 'point', text: 'แตะแถบหัวเรื่องบนภาพเพื่อแก้ข้อความหัวเรื่องได้ครับ', acts: [{ label: 'แก้หัวเรื่อง', fn: () => ctx.openSheet('#sheetTitle') }] }) },
  { kw: ['นักเรียน', 'จำนวน', 'ข้อความเพิ่ม'], r: () => ({ pose: 'lunch', text: 'จำนวนนักเรียนที่รับประทานอาหาร ใส่ในช่อง "ข้อความเพิ่มเติม" ของรายงานอาหารกลางวันครับ เช่น "นักเรียนรับประทานอาหาร 52 คน"', acts: [{ label: 'ใส่ข้อความเพิ่มเติม', fn: () => { if (ctx.mode() !== 'lunch') ctx.setMode('lunch'); ctx.openSheet('#sheetMenu'); } }] }) },
  { kw: ['ข้อความเรียน', 'เรียนผู้', 'ผู้รับรายงาน', 'ผู้บังคับบัญชา', 'อีเมล'], r: () => ({ pose: 'lunch', text: 'รายงานอาหารกลางวันแก้ "เรียน…" ผู้รับรายงาน อีเมล และเบอร์ท้ายภาพได้ครับ', acts: [{ label: 'แก้ข้อความเรียน', fn: () => ctx.openSheet('#sheetMemo') }] }) },
  { kw: ['ไลน์', 'line', 'ส่ง', 'แชร์', 'share'], r: () => {
    const p = ctx.problems();
    if (p.length) return { pose: 'point', text: `ก่อนส่งต้อง ${p.map(x => x[1]).join(' · ')} ครับ`, acts: nextStep().acts };
    return { pose: 'thumbs', text: 'กดปุ่ม "ส่ง LINE" สีเขียว แล้วเลือกกลุ่ม LINE ได้เลยครับ ถ้าเครื่องส่งตรงไม่ได้ ระบบจะบันทึกภาพให้แทน แล้วส่งภาพจากอัลบั้ม', acts: [{ label: 'สร้างภาพ & ส่ง LINE', fn: ctx.generate }] };
  } },
  { kw: ['บันทึก', 'ดาวน์โหลด', 'โหลดภาพ', 'เซฟ'], r: () => ({ pose: 'point', text: 'กด "ส่ง LINE" ระบบจะสร้างภาพให้ ในหน้าผลลัพธ์มีปุ่มบันทึกภาพลงเครื่องด้วยครับ', acts: [{ label: 'สร้างภาพ', fn: ctx.generate }] }) },
  { kw: ['ข้อมูล', 'ปลอดภัย', 'ส่วนตัว'], r: () => ({ pose: 'point', text: 'รูปและสิ่งที่กรอกเก็บไว้ในเครื่องของคุณครูเท่านั้นครับ ไม่ได้อัปโหลดไปไหน จนกว่าคุณครูจะกดส่งเข้า LINE เอง' }) },
];

function answer(raw) {
  const t = norm(raw);
  const m = ctx.mode();

  // วันที่: ถาม หรือ เปลี่ยน
  const wantChange = has(t, 'เปลี่ยน', 'ตั้ง', 'เลือกวัน', 'ย้อน', 'เป็นวัน', 'ทำของ', 'รายงานของ', 'แก้วัน');
  const iso = parseDate(t), dateWord = has(t, 'วันที่', 'เมื่อวาน', 'พรุ่งนี้', 'มะรืน');
  if ((iso && (wantChange || /\d/.test(t))) || (wantChange && dateWord) || has(t, 'เปลี่ยนวัน', 'ย้อนวัน')) {
    if (iso) {
      ctx.setDate(iso);
      return { pose: 'thumbs', text: `เปลี่ยนเป็น${fullDate(iso)} แล้วครับ`, acts: [{ label: 'เปิดปฏิทิน', fn: ctx.openDate }] };
    }
    return { pose: 'point', text: `ตอนนี้รายงานเป็น${fullDate(ctx.S.draft[m].dateISO)}ครับ จะเปลี่ยนเป็นวันไหน พิมพ์ได้เลย เช่น "เมื่อวาน" หรือ "5 พ.ย." หรือเลือกจากปฏิทินก็ได้`, acts: [{ label: 'เปิดปฏิทิน', fn: ctx.openDate }], chips: ['เปลี่ยนเป็นเมื่อวาน', 'เปลี่ยนเป็นวันนี้', 'เปลี่ยนเป็นพรุ่งนี้'] };
  }
  if (has(t, 'วันนี้วันอะไร', 'วันนี้วันที่', 'วันที่เท่าไหร่', 'วันที่เท่าไร')) {
    const today = ctx.todayBangkok(), cur = ctx.S.draft[m].dateISO;
    return { pose: 'wave', text: `วันนี้${fullDate(today).slice(3)}ครับ${cur !== today ? `\nแต่รายงานตอนนี้ตั้งเป็น${fullDate(cur)}` : ''}`, acts: cur !== today ? [{ label: 'ใช้วันนี้', fn: () => ctx.setDate(today) }] : [] };
  }

  // ชื่อครู → เบอร์ + เลือกเป็นครูเวร
  if (ctx.school()) {
    const found = findTeachers(t);
    if (found.length) {
      const sel = ctx.S.draft.duty.teachers;
      const lines = found.slice(0, 5).map(n => `• ${n} — ${ctx.phoneOf(n) || 'ยังไม่มีเบอร์'}${sel.includes(n) ? ' (เป็นครูเวรแล้ว)' : ''}`);
      const acts = found.length === 1 && !sel.includes(found[0]) && sel.length < 3
        ? [{ label: 'เลือกเป็นครูเวร', fn: () => { if (ctx.mode() !== 'duty') ctx.setMode('duty'); ctx.addDuty(found[0]); bot({ pose: 'thumbs', text: `เพิ่ม ${found[0]} เป็นครูเวรแล้วครับ` }); } }]
        : [{ label: 'เปิดรายชื่อครู', fn: () => ctx.openSheet('#sheetTeachers') }];
      return { pose: 'point', text: `${found.length > 1 ? 'เจอหลายคนครับ' : 'เจอแล้วครับ'}\n${lines.join('\n')}`, acts };
    }
  }

  // คำสำคัญ: เลือกเรื่องที่ตรงคำยาวที่สุด
  let best = null, score = 0;
  for (const it of INTENTS) {
    const s = it.kw.reduce((a, k) => (t.includes(norm(k)) ? Math.max(a, norm(k).length) : a), 0);
    if (s > score) { score = s; best = it; }
  }
  if (best) return best.r(t);

  return { pose: 'point', text: 'ขอโทษครับ ผมยังไม่เข้าใจคำถามนี้ ลองถามสั้น ๆ เช่น "ใส่รูปยังไง" "เบอร์ครูวิทยา" "เปลี่ยนเป็นเมื่อวาน" หรือเลือกหัวข้อด้านล่างครับ', chips: START_CHIPS };
}
