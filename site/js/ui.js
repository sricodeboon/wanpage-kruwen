// หน้าต่างทั้งหมดของหน้าครูเวร = SweetAlert2 (vendor ในเครื่อง ไม่พึ่ง CDN)
// Swal เปิดได้ทีละอัน: เปิดอันใหม่ = แทนอันเดิม (toast ก็นับ) — ห้ามยิง toast ขณะหน้ายืนยันเปิดอยู่
import Swal from '../vendor/sweetalert2.esm.min.js';

const PURPLE = '#5b2a9e';

// ปุ่มใช้คลาส Bootstrap · ไอคอนสีม่วง (ห้ามเขียว) · ธีมสว่าง
export const ui = Swal.mixin({
  buttonsStyling: false,
  iconColor: PURPLE,
  theme: 'light',
  reverseButtons: true,
  // เลื่อนขึ้น+จางเข้า (ไม่ย่อ/ขยาย: เบากับเครื่องถูก และขนาดปุ่มเท่าจริงตั้งแต่เฟรมแรก)
  showClass: { popup: 'wp-in', backdrop: 'swal2-backdrop-show', icon: 'swal2-icon-show' },
  hideClass: { popup: 'wp-out', backdrop: 'swal2-backdrop-hide', icon: 'swal2-icon-hide' },
  customClass: {
    popup: 'wp-swal',
    confirmButton: 'btn btn-primary btn-lg tap px-4',
    cancelButton: 'btn btn-outline-primary btn-lg tap px-4',
    denyButton: 'btn btn-outline-danger btn-lg tap px-4',
    actions: 'wp-actions',
  },
});

const toastMixin = Swal.mixin({
  toast: true, position: 'top', showConfirmButton: false, timer: 3500, timerProgressBar: true,
  iconColor: PURPLE, theme: 'light', customClass: { popup: 'wp-toast' },
});

export const isOpen = (cls) => Swal.isVisible() && Boolean(Swal.getPopup()?.classList.contains(cls));
export const closeAll = () => Swal.close();

// ข้อความสั้นมุมบน — ไม่บังปุ่ม (คอนเทนเนอร์ toast ไม่รับการแตะ)
export function toast(title, icon = 'info') {
  return toastMixin.fire({ title, icon });
}

// เล่นแอนิเมชันซ้ำได้ (เอาคลาสออก → reflow → ใส่ใหม่) แล้วถอดคลาสเมื่อจบ
export function pulse(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ---------- กำลังสร้างภาพ ----------
export function busyShow(text) {
  if (isOpen('wp-busy')) { setBusyText(text); return; }
  ui.fire({
    title: 'กำลังสร้างภาพ…',
    html: `<img class="busy-mascot" src="assets/brand/kruwan-wave.png" alt="" aria-hidden="true" width="38" height="96"><p id="busyText" class="mb-0"></p>`,
    allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false,
    customClass: { popup: 'wp-swal wp-busy' },
    didOpen: () => { setBusyText(text); Swal.showLoading(); },
  });
}

function setBusyText(text) {
  const el = document.getElementById('busyText');
  if (el) el.textContent = text;
}

// ปิดเฉพาะเมื่อยังเป็นหน้าต่าง busy (ถ้าเปิดหน้ายืนยันไปแล้ว อย่าไปปิด)
export function busyHide() {
  if (isOpen('wp-busy')) Swal.close();
}

/**
 * หน้าต่างที่มีปุ่มของเราเอง — ผูก listener ใน didOpen เพื่อให้ handler รันตรงจากการแตะจริง
 * (Web Share ต้องมี user activation ห้ามรอ promise ของ Swal ก่อน)
 * @returns Promise ผลของ Swal (ใช้ดู dismiss === 'esc' ฯลฯ)
 */
export function panel({ html, title, cls = '', position = 'center', onOpen, allowOutsideClick = true, width }) {
  return ui.fire({
    title, html, position, width,
    showConfirmButton: false, showCloseButton: false, allowOutsideClick, allowEscapeKey: true,
    focusConfirm: false, returnFocus: true,
    customClass: { popup: `wp-swal ${cls}`.trim(), container: cls ? `${cls}-c` : undefined, htmlContainer: 'wp-html' },
    didOpen: (popup) => onOpen?.(popup),
  });
}

/**
 * แผ่นเมนูจากล่าง: รายการปุ่ม {act, text, hidden} + ยกเลิก
 * @returns Promise<string|null> act ที่เลือก (null = ยกเลิก/ปิด) — onPick เรียกทันทีในการแตะ (ใช้เปิด file picker)
 */
export function sheet({ id, title, items, onPick }) {
  const buttons = items.filter((it) => !it.hidden)
    .map((it) => `<button type="button" class="list-group-item list-group-item-action sheet-item${it.danger ? ' text-danger' : ''}" data-act="${it.act}">${it.text}</button>`).join('');
  let picked = null;
  return panel({
    title, cls: 'wp-sheet', position: 'bottom',
    html: `<div id="${id}"><div class="list-group list-group-flush sheet-list">${buttons}</div>`
      + `<button type="button" class="btn btn-light btn-lg w-100 tap mt-2" data-act="cancel">ยกเลิก</button></div>`,
    onOpen: (popup) => popup.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      picked = b.dataset.act === 'cancel' ? null : b.dataset.act;
      Swal.close();
      if (picked) onPick?.(picked);
    }),
  }).then(() => picked);
}

// ยืนยันก่อนทำสิ่งที่ย้อนไม่ได้
export async function confirmDanger({ title, text, confirmText }) {
  const r = await ui.fire({
    title, text, icon: 'warning', showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'wp-swal', confirmButton: 'btn btn-danger btn-lg tap px-4', cancelButton: 'btn btn-outline-primary btn-lg tap px-4', actions: 'wp-actions' },
  });
  return r.isConfirmed;
}

export function info({ title, text, html, icon = 'info' }) {
  return ui.fire({ title, text, html, icon, confirmButtonText: 'ตกลง' });
}

export { Swal };
