// สถานะสำเนา Drive บนหน้าเว็บ — upload_url ว่าง = ไม่มีคิว ไม่มี UI
import { openQueue, drainQueue, startUpload, installTriggers } from './upload.js';

/**
 * @param ctx {app, $, log, esc, school()}
 */
export function createDrive(ctx) {
  const { app, $, log, esc } = ctx;
  const on = () => Boolean(app.config.upload_url) && Boolean(app.queue);
  const deps = () => ({ queue: app.queue, config: app.config, settings: app.model.settings, onStatus });

  function setup() {
    if (!app.config.upload_url || typeof indexedDB === 'undefined') return;
    openQueue().then((q) => {
      app.queue = q;
      installTriggers(deps());
      updateCount();
      startUpload(deps()); // เปิดแอป = appOpen
    }).catch((e) => log('queue error', String(e)));
  }

  async function updateCount() {
    if (!on()) return;
    const n = (await app.queue.all().catch(() => [])).length;
    const bar = $('driveBar');
    bar.hidden = n === 0 || app.phase === 'done';
    bar.textContent = `มีรายการรอส่งเข้า Drive ${n} รายการ (แตะเพื่อส่งซ้ำ)`;
  }

  // หลังแชร์/บันทึกรูปเท่านั้น (ไม่ยิงก่อน share — iOS ระงับ request ระหว่าง share sheet)
  function kick() {
    if (!on()) return;
    app.lastReportShared = true;
    drainQueue({ ...deps(), appOpen: false }).then(updateCount, () => {});
  }

  function retryTap() { if (on()) startUpload(deps()); }

  function onStatus(kind, item) {
    log('drive', kind, item?.last_error || '');
    const s = ctx.school();
    const lines = {
      sending: 'กำลังเก็บเข้า Drive… อย่าเพิ่งปิด',
      sent: `☁ เก็บเข้า Google Drive แล้ว<small>โฟลเดอร์ ${esc(s?.short_name || '')}</small>`,
      retry: 'ส่งเข้า LINE แล้ว ส่วนการเก็บเข้า Drive จะลองใหม่ให้เองเมื่อต่อเน็ต',
      dropped: `ส่งเข้า LINE แล้ว แต่เก็บเข้า Drive ไม่ได้ (รหัส ${esc(item?.last_error || '-')}) ช่วยแจ้งครูแจ็ก`,
      gave_up: 'เก็บเข้า Drive ไม่สำเร็จ ช่วยแจ้งครูแจ็ก',
      disabled: 'ปิดการบันทึก Drive ชั่วคราว',
    };
    if (!lines[kind]) { updateCount(); return; }
    const mine = !item || item.report_id === app.lastReport?.report_id;
    if (app.phase === 'done' && mine) $('doneDrive').innerHTML = lines[kind];
    else if (kind !== 'sending') updateCount();
  }

  return { on, setup, kick, retryTap, updateCount };
}
