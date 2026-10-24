// ส่วน ② รูปถ่าย 4 ภาพ — ช่องรูปวางตาม photo_layout ของแม่แบบที่เลือก (spec 7.2, 17.1)
// รูปอยู่ใน memory เท่านั้น (blob + objectURL ของ thumbnail)
import { processPhoto } from './photos.js';
import { mergeTemplate, photoRects } from './layout.js';
import { sheet, panel, confirmDanger, closeAll } from './ui.js';

// ไอคอนกล้องในช่องว่าง (ใช้ currentColor)
const CAMERA = '<svg class="slot-cam" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM8 13a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM10 13a2 2 0 1 0 4 0a2 2 0 1 0-4 0z"/></svg>';
const MSG_DECODE = 'รูปนี้เปิดไม่ได้ ลองเลือกรูปอื่นหรือถ่ายใหม่';

/**
 * @param ctx {app, state, $, log, esc, showMsg, template(), preview, onChange()}
 */
export function createPhotos(ctx) {
  const { app, state, $, log, esc, showMsg } = ctx;
  const thumbUrls = [null, null, null, null];

  const layout = () => ctx.template()?.photo_layout || '1+3';
  const hintFor = (lay, i) => (lay === '1+3' ? (i === 0 ? 'ภาพใหญ่ (บนสุด)' : 'ภาพเล็ก') : `ภาพที่ ${i + 1}`);

  function slotTemplate() {
    return ctx.template()
      || (app.templatesAll && mergeTemplate(app.templatesAll.common, { photo_layout: '1+3', landmark: { y: 1536 } }));
  }

  function render() {
    const grid = $('photoGrid');
    const tpl = slotTemplate();
    if (!tpl) return;
    const rects = photoRects(tpl, 0);
    const minX = Math.min(...rects.map((r) => r.x)), minY = Math.min(...rects.map((r) => r.y));
    const W = Math.max(...rects.map((r) => r.x + r.w)) - minX, H = Math.max(...rects.map((r) => r.y + r.h)) - minY;
    grid.style.aspectRatio = `${W} / ${H}`;
    grid.dataset.layout = tpl.photo_layout;
    grid.innerHTML = '';
    rects.forEach((r, i) => grid.appendChild(slotEl(r, i, tpl.photo_layout, { minX, minY, W, H })));
  }

  function slotEl(r, i, lay, box) {
    const p = state.photos[i];
    const slot = document.createElement('div');
    slot.className = 'slot' + (p ? ' filled' : '');
    slot.dataset.index = i;
    Object.assign(slot.style, {
      left: `${((r.x - box.minX) / box.W) * 100}%`, top: `${((r.y - box.minY) / box.H) * 100}%`,
      width: `${(r.w / box.W) * 100}%`, height: `${(r.h / box.H) * 100}%`,
    });
    const hint = hintFor(lay, i);
    const input = `<input type="file" accept="image/*,.heic,.heif" ${i === 0 ? 'multiple' : ''} aria-label="เลือกรูป ${hint}" data-index="${i}">`;
    if (p) {
      slot.innerHTML = `<img src="${thumbUrls[i]}" alt="">`
        + `<button type="button" class="slot-tap" data-slot="${i}" aria-label="${hint}: เปลี่ยนหรือจัดการรูป"></button>`
        + (i === 0 ? '<span class="x">✕ เปลี่ยน</span>' : '')
        + `<button type="button" class="lbl${p.label ? '' : ' add'}" data-label="${i}"><span class="lbl-text">${p.label ? esc(p.label) : '+ ป้ายชื่อ'}</span></button>${input}`;
    } else {
      slot.innerHTML = `<span class="slot-empty">${CAMERA}<b>เพิ่มรูป</b><small>${hint}</small></span>${input}`;
    }
    return slot;
  }

  async function onFilesChosen(startIndex, files) {
    const list = [...files].slice(0, 4 - startIndex);
    showMsg('photoMsg', null);
    for (let k = 0; k < list.length; k++) {
      const i = startIndex + k;
      // ช่องที่ยังรอทำ (รวมช่องนี้) ขึ้น "กำลังเตรียมรูป…" — render() รอบก่อนสร้างช่องใหม่ จึงต้องใส่ซ้ำทุกรอบ
      for (let j = i; j < startIndex + list.length; j++) {
        $('photoGrid').querySelector(`.slot[data-index="${j}"]`)?.classList.add('loading');
      }
      if (list[k].size > 25 * 1024 * 1024) showMsg('photoMsg', 'ไฟล์ใหญ่กว่า 25 MB กำลังลองย่อ…');
      try {
        const r = await processPhoto(list[k]);
        setPhoto(i, { ...r, label: state.photos[i]?.label || '', icon: state.photos[i]?.icon || null });
        showMsg('photoMsg', null);
      } catch (e) {
        log('photo error', e.name, e.message);
        showMsg('photoMsg', MSG_DECODE);
      }
      // แสดงทีละรูปทันทีที่เสร็จ (HEIC ใช้เวลารูปละ ~2–3 วิ ห้ามรอครบทุกรูปแล้วค่อยแสดง)
      render();
      ctx.onChange();
      await new Promise((res) => setTimeout(res, 0));
    }
  }

  function setPhoto(i, p) {
    if (thumbUrls[i]) URL.revokeObjectURL(thumbUrls[i]);
    ctx.preview.forget(i);
    thumbUrls[i] = p ? URL.createObjectURL(p.blob) : null;
    state.photos[i] = p;
  }

  function swapToMain(i) {
    [state.photos[0], state.photos[i]] = [state.photos[i], state.photos[0]];
    [thumbUrls[0], thumbUrls[i]] = [thumbUrls[i], thumbUrls[0]];
    ctx.preview.swap(0, i);
  }

  function clear() { for (let i = 0; i < 4; i++) setPhoto(i, null); }

  // เมนูช่องรูป (แผ่นจากล่าง) — "เปลี่ยนรูป" ต้องกด input ในการแตะเดียวกัน (file picker ต้องมี user activation)
  function openSlotSheet(i) {
    sheet({
      id: 'slotSheet', title: hintFor(layout(), i),
      items: [
        { act: 'replace', text: 'เปลี่ยนรูป' },
        { act: 'swap', text: '⇄ สลับเป็นภาพใหญ่', hidden: !(layout() === '1+3' && i > 0) },
        { act: 'label', text: 'ป้ายชื่อรูป' },
        { act: 'remove', text: '✕ เอารูปออก', danger: true },
      ],
      onPick: (act) => onSlotAction(act, i),
    });
  }

  async function onSlotAction(act, i) {
    if (act === 'replace') { $('photoGrid').querySelector(`input[data-index="${i}"]`)?.click(); return; }
    if (act === 'label') { openLabelSheet(i); return; }
    if (act === 'swap') swapToMain(i);
    else if (act === 'remove') {
      const ok = await confirmDanger({ title: 'เอารูปนี้ออก?', text: `${hintFor(layout(), i)} จะว่าง ต้องเลือกรูปใหม่`, confirmText: 'เอารูปออก' });
      if (!ok || !state.photos[i]) return;
      setPhoto(i, null);
    } else return;
    render();
    ctx.onChange();
  }

  // ป้ายชื่อรูป: รายการจาก Sheet + พิมพ์เอง (≤ 24 ตัว) + ไม่ใส่ป้าย
  function openLabelSheet(i) {
    const items = (app.model.labels || [])
      .map((l, k) => `<button type="button" class="list-group-item list-group-item-action sheet-item" data-k="${k}">${esc(l.label)}</button>`).join('');
    panel({
      title: 'ป้ายชื่อรูป', cls: 'wp-sheet', position: 'bottom',
      html: `<div id="labelSheet">`
        + `<div id="labelList" class="list-group list-group-flush sheet-list label-list">${items}</div>`
        + `<form id="labelForm" class="input-group input-group-lg my-2">`
        + `<input id="labelInput" type="text" class="form-control" maxlength="24" placeholder="พิมพ์เอง (ไม่เกิน 24 ตัว)" aria-label="พิมพ์ป้ายชื่อเอง">`
        + `<button type="submit" class="btn btn-primary px-4">ใช้</button></form>`
        + `<button type="button" id="labelNone" class="btn btn-outline-primary btn-lg w-100 tap">ไม่ใส่ป้าย</button>`
        + `<button type="button" id="labelCancel" class="btn btn-light btn-lg w-100 tap mt-2">ยกเลิก</button></div>`,
      onOpen: () => {
        $('labelList').onclick = (e) => {
          const b = e.target.closest('[data-k]');
          if (b) { const l = app.model.labels[Number(b.dataset.k)]; applyLabel(i, l.label, l.icon); }
        };
        $('labelForm').onsubmit = (e) => { e.preventDefault(); const v = $('labelInput').value.trim(); if (v) applyLabel(i, v, 'camera'); };
        $('labelNone').onclick = () => applyLabel(i, '', null);
        $('labelCancel').onclick = () => closeAll();
      },
    });
  }

  function applyLabel(i, label, icon) {
    closeAll();
    if (!state.photos[i]) return;
    state.photos[i] = { ...state.photos[i], label: label ? label.trim().slice(0, 24) : '', icon: label ? (icon || 'camera') : null };
    render();
    ctx.onChange();
  }

  function bind() {
    const grid = $('photoGrid');
    grid.addEventListener('change', (e) => {
      const inp = e.target.closest('input[type=file]');
      if (inp?.files?.length) { const files = [...inp.files]; inp.value = ''; onFilesChosen(Number(inp.dataset.index), files); }
    });
    grid.addEventListener('click', (e) => {
      const lbl = e.target.closest('[data-label]');
      if (lbl) { openLabelSheet(Number(lbl.dataset.label)); return; }
      const tap = e.target.closest('[data-slot]');
      if (tap) openSlotSheet(Number(tap.dataset.slot));
    });
  }

  return { render, clear, bind };
}
