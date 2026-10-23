// ส่วน ② รูปถ่าย 4 ภาพ — ช่องรูปวางตาม photo_layout ของแม่แบบที่เลือก (spec 7.2, 17.1)
// รูปอยู่ใน memory เท่านั้น (blob + objectURL ของ thumbnail)
import { processPhoto } from './photos.js';
import { mergeTemplate, photoRects } from './layout.js';

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
    const input = `<input type="file" accept="image/*" ${i === 0 ? 'multiple' : ''} aria-label="เลือกรูป ${hint}" data-index="${i}">`;
    if (p) {
      slot.innerHTML = `<img src="${thumbUrls[i]}" alt="">`
        + `<button type="button" class="slot-tap" data-slot="${i}" aria-label="${hint}: เปลี่ยนหรือจัดการรูป"></button>`
        + (i === 0 ? '<span class="x">✕ เปลี่ยน</span>' : '')
        + `<button type="button" class="lbl${p.label ? '' : ' add'}" data-label="${i}"><span class="lbl-text">${p.label ? esc(p.label) : '+ ป้ายชื่อ'}</span></button>${input}`;
    } else {
      slot.innerHTML = `<span><span class="slot-plus">+</span>${hint}</span>${input}`;
    }
    return slot;
  }

  async function onFilesChosen(startIndex, files) {
    const list = [...files].slice(0, 4 - startIndex);
    showMsg('photoMsg', null);
    for (let k = 0; k < list.length; k++) {
      const i = startIndex + k;
      const slot = $('photoGrid').querySelector(`.slot[data-index="${i}"]`);
      slot?.classList.add('busy');
      if (list[k].size > 25 * 1024 * 1024) showMsg('photoMsg', 'ไฟล์ใหญ่กว่า 25 MB กำลังลองย่อ…');
      try {
        const r = await processPhoto(list[k]);
        setPhoto(i, { ...r, label: state.photos[i]?.label || '', icon: state.photos[i]?.icon || null });
        showMsg('photoMsg', null);
      } catch (e) {
        log('photo error', e.name, e.message);
        showMsg('photoMsg', MSG_DECODE);
      }
      slot?.classList.remove('busy');
      await new Promise((res) => setTimeout(res, 0));
    }
    render();
    ctx.onChange();
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

  function openSlotSheet(i) {
    const sheet = $('slotSheet');
    $('slotSheetTitle').textContent = hintFor(layout(), i);
    sheet.querySelector('[data-act="swap"]').hidden = !(layout() === '1+3' && i > 0);
    sheet.dataset.index = i;
    sheet.showModal();
  }

  function onSlotAction(act) {
    const sheet = $('slotSheet');
    const i = Number(sheet.dataset.index);
    sheet.close();
    if (act === 'replace') { $('photoGrid').querySelector(`input[data-index="${i}"]`)?.click(); return; }
    if (act === 'label') { openLabelSheet(i); return; }
    if (act === 'swap') swapToMain(i);
    else if (act === 'remove') setPhoto(i, null);
    else return;
    render();
    ctx.onChange();
  }

  function openLabelSheet(i) {
    const sheet = $('labelSheet');
    sheet.dataset.index = i;
    $('labelList').innerHTML = (app.model.labels || [])
      .map((l, k) => `<button type="button" data-k="${k}">${esc(l.label)}</button>`).join('');
    $('labelInput').value = '';
    sheet.showModal();
  }

  function applyLabel(label, icon) {
    const sheet = $('labelSheet');
    const i = Number(sheet.dataset.index);
    sheet.close();
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
    $('slotSheet').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) onSlotAction(b.dataset.act); });
    $('labelList').onclick = (e) => {
      const b = e.target.closest('[data-k]');
      if (b) { const l = app.model.labels[Number(b.dataset.k)]; applyLabel(l.label, l.icon); }
    };
    $('labelForm').onsubmit = (e) => { e.preventDefault(); const v = $('labelInput').value.trim(); if (v) applyLabel(v, 'camera'); };
    $('labelNone').onclick = () => applyLabel('', null);
    $('labelCancel').onclick = () => $('labelSheet').close();
  }

  return { render, clear, bind };
}
