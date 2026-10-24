// สถานะสำเนา Drive บนหน้าเว็บ — upload_url ว่าง = ไม่มีคิว ไม่มี UI
import { openQueue, drainQueue, startUpload, installTriggers } from './upload.js';

/**
 * @param ctx {app, $, log, esc, school()}
 */
export function createDrive(ctx) {
  const { app, $, log, esc } = ctx;
  const on = () => Boolean(app.config.upload_url) && Boolean(app.queue);
  // รายงานล่าสุดที่ครูยังไม่ส่ง LINE/บันทึก = พักไว้ (กด "แก้ไข" แล้วลบทิ้งได้ ไม่เกิดไฟล์ซ้ำ) — เปิดแอปใหม่ = ส่งตามปกติ
  const isHeld = (id) => !app.lastReportShared && id === app.lastReport?.report_id;
  const deps = () => ({ queue: app.queue, config: app.config, settings: app.model.settings, onStatus, isHeld });
  const lastStatus = new Map(); // report_id → kind ล่าสุด (ใช้เติมการ์ดหน้า "ส่งแล้ว" ทีหลัง)

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
    const n = (await app.queue.all().catch(() => [])).filter((i) => !isHeld(i.report_id)).length;
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

  function onStatusLines(item) {
    const s = ctx.school();
    return {
      sending: 'กำลังเก็บเข้า Drive… อย่าเพิ่งปิด',
      sent: `☁ เก็บเข้า Google Drive แล้ว<small>โฟลเดอร์ ${esc(s?.short_name || '')}</small>`,
      retry: 'ส่งเข้า LINE แล้ว ส่วนการเก็บเข้า Drive จะลองใหม่ให้เองเมื่อต่อเน็ต',
      dropped: `ส่งเข้า LINE แล้ว แต่เก็บเข้า Drive ไม่ได้ (รหัส ${esc(item?.last_error || '-')}) ช่วยแจ้งครูแจ็ก`,
      gave_up: 'เก็บเข้า Drive ไม่สำเร็จ ช่วยแจ้งครูแจ็ก',
      disabled: 'ปิดการบันทึก Drive ชั่วคราว',
    };
  }

  function onStatus(kind, item) {
    log('drive', kind, item?.last_error || '');
    const lines = onStatusLines(item);
    if (!lines[kind]) { updateCount(); return; }
    const mine = !item || item.report_id === app.lastReport?.report_id;
    if (mine && app.lastReport) lastStatus.set(app.lastReport.report_id, { kind, item: { last_error: item?.last_error } });
    if (app.phase === 'done' && mine) $('doneDrive').innerHTML = lines[kind];
    else if (kind !== 'sending') updateCount();
  }

  // เข้าหน้า "ส่งแล้ว": แสดงสถานะของรายงานนี้เท่านั้น (ไม่ค้างข้อความของรายงานก่อน)
  function renderDone() {
    const st = app.lastReport && lastStatus.get(app.lastReport.report_id);
    $('doneDrive').innerHTML = (st && onStatusLines(st.item)[st.kind]) || 'กำลังเก็บเข้า Drive…';
  }

  return { on, setup, kick, retryTap, updateCount, renderDone };
}
