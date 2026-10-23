// พรีวิวสด (scale 0.25) + guard เครื่องช้า (spec 7.3)
// รูปย่อสำหรับพรีวิวอยู่ใน memory เท่านั้น ปิดทิ้งเมื่อรูปเปลี่ยน
import { renderOnePage } from './render.js';

const SLOW_MS = 250;
const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 50));

/**
 * @param ctx {state, $, ls, log, ready():boolean, template(), gatherAssets(photoFn), renderModel()}
 */
export function createPreview(ctx) {
  const { state, $, ls, log } = ctx;
  const bitmaps = [null, null, null, null];
  const p = { timer: 0, slow: 0, lowPower: ls.get('wp.lowPower') === '1', seq: 0 };

  function schedule() {
    if (!ctx.ready()) return;
    $('tapPreview').hidden = !p.lowPower;
    if (p.lowPower) return;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => idle(() => draw()), 150);
  }

  async function bitmap(i) {
    const photo = state.photos[i];
    if (!photo) return null;
    if (bitmaps[i]) return bitmaps[i];
    const k = Math.min(1, 480 / Math.max(photo.w, photo.h));
    const bmp = await createImageBitmap(photo.blob, {
      resizeWidth: Math.round(photo.w * k), resizeHeight: Math.round(photo.h * k), resizeQuality: 'low',
    });
    // ระหว่างรอ รูปในช่องอาจถูกเปลี่ยน/สลับ/ลบ — อย่าผูก bitmap เก่ากับช่อง
    if (state.photos[i] !== photo || bitmaps[i]) { bmp.close(); return bitmaps[i] || null; }
    bitmaps[i] = bmp;
    return bmp;
  }

  async function draw(canvas = $('preview'), scale = 0.25, manual = false) {
    const tpl = ctx.template();
    if (!tpl) return;
    const seq = ++p.seq;
    const assets = await ctx.gatherAssets((i) => bitmap(i).catch(() => null));
    if (seq !== p.seq && !manual) return; // มีรอบใหม่กว่าแล้ว
    const c2d = canvas.getContext('2d');
    const t0 = performance.now();
    c2d.setTransform(1, 0, 0, 1, 0, 0);
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    renderOnePage(c2d, ctx.renderModel(), tpl, scale, assets);
    const dt = performance.now() - t0;
    if (manual || scale !== 0.25) return;
    p.slow = dt > SLOW_MS ? p.slow + 1 : 0;
    if (p.slow >= 3) {
      log('preview slow → lowPower', Math.round(dt));
      p.lowPower = true;
      ls.set('wp.lowPower', '1');
      $('tapPreview').hidden = false;
    }
  }

  return {
    schedule,
    draw,
    forget(i) { bitmaps[i]?.close?.(); bitmaps[i] = null; },
    swap(i, j) { [bitmaps[i], bitmaps[j]] = [bitmaps[j], bitmaps[i]]; },
  };
}
