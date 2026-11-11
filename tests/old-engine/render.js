// วาดภาพรายงาน 1 หน้าลง canvas — พิกัดทั้งหมดเป็นหน่วยออกแบบ 1024×1536 แล้ว ctx.scale(scale) ครั้งเดียว
// ลำดับวาด (spec 8.2): พื้นหลัง → ตรา → แถบหัวเรื่อง → ป้ายโรงเรียน → ที่อยู่ → รูป → ป้ายชื่อรูป → กล่องครูเวร
// กติกา: fillText ทั้งสตริง, ไม่ใช้ letterSpacing / ctx.filter, เงาตั้งแล้วรีเซ็ตทุกครั้ง
import { computeLayout } from './layout.js';
import { ICONS } from './icons.js';

export { ICONS };

const DESIGN_W = 1024;
const DESIGN_H = 1536;
const FONT_FAMILY = 'Kanit';
// สตริงอ้างอิงที่มีทั้งสระบน วรรณยุกต์ และสระล่าง — ใช้หาจุดกึ่งกลางแนวตั้งให้ทุกข้อความขนาดเดียวกันอยู่แนวเดียวกัน
const V_REF = 'ปู่ทั้งฎีญ';

const DEFAULT_PALETTE = {
  p1: '#3b1470', p2: '#5b2a9e', p3: '#7d4bc4', gold: '#d9a93a', gold2: '#f6d983',
  pillBg: '#ffffffd9', pillText: '#3b1470', dutyTop: '#5b2a9ef2', dutyBottom: '#2e0f5cf5',
};

// ---------- ตัวช่วยทั่วไป ----------

export function createCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasToBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob(quality === undefined ? { type } : { type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob ได้ค่าว่าง'))), type, quality);
  });
}

// เงาใน canvas ไม่ถูก transform — ต้องคูณ offset/blur ด้วย scale เอง
export function setShadow(ctx, scale, x, y, blur, color) {
  ctx.shadowOffsetX = x * scale;
  ctx.shadowOffsetY = y * scale;
  ctx.shadowBlur = blur * scale;
  ctx.shadowColor = color;
}

export function clearShadow(ctx) {
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const sizeOf = img => {
  if (!img) return null;
  const w = img.naturalWidth || img.videoWidth || img.displayWidth || img.width;
  const h = img.naturalHeight || img.videoHeight || img.displayHeight || img.height;
  return w > 0 && h > 0 ? { w, h } : null;
};

// วาดภาพแบบ cover ลงกรอบมุมมน — focalY = ตำแหน่งแนวตั้งที่ต้องการเก็บไว้ (0 บน, 0.5 กลาง, 1 ล่าง)
export function drawCover(ctx, img, rect, focalY = 0.5, radius = 0) {
  const s = sizeOf(img);
  if (!s) return;
  const k = Math.max(rect.w / s.w, rect.h / s.h);
  // ตัดให้อยู่ในขอบภาพ: ทศนิยมเพี้ยนเล็กน้อยทำให้กรอบต้นทางเกินภาพ แล้ว Safari/WebKit จะไม่วาดอะไรเลย
  const sw = Math.min(rect.w / k, s.w), sh = Math.min(rect.h / k, s.h);
  const sx = Math.max((s.w - sw) / 2, 0);
  const sy = Math.min(Math.max((s.h - sh) * focalY, 0), s.h - sh);
  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

const fontStr = (px, weight = 700) => `${weight} ${px}px ${FONT_FAMILY}`;

// จุด y ที่ส่งให้ fillText (textBaseline middle) เพื่อให้กล่องตัวอักษรเต็มชุดอยู่กึ่งกลาง cy พอดี
function centerY(ctx, cy) {
  const m = ctx.measureText(V_REF);
  const a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
  return Number.isFinite(a) && Number.isFinite(d) ? cy + (a - d) / 2 : cy;
}

function text(ctx, str, x, cy, { px, weight = 700, color, align = 'center' }) {
  ctx.font = fontStr(px, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, centerY(ctx, cy));
}

// ระยะบรรทัดของข้อความ 2 บรรทัดในกล่องสูง h
const lineCenters = (cy, n, px) => {
  if (n <= 1) return [cy];
  const lh = px * 1.32;
  return Array.from({ length: n }, (_, i) => cy + (i - (n - 1) / 2) * lh);
};

function drawIcon(ctx, name, x, y, size, color) {
  const d = ICONS[name] || ICONS.camera;
  if (typeof Path2D === 'undefined') return; // ทดสอบใน Node ไม่มี Path2D
  const k = size / 24;
  ctx.save();
  ctx.transform(k, 0, 0, k, x, y);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(d), 'evenodd');
  ctx.restore();
}

function vGradient(ctx, y0, y1, c0, c1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

// วงขาวโปร่งรอบนอกกรอบ (box-shadow 0 0 0 Npx ในต้นแบบ)
function outerRing(ctx, r, radius, width, color) {
  roundRectPath(ctx, r.x - width / 2, r.y - width / 2, r.w + width, r.h + width, radius + width / 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

// ขอบด้านใน (border แบบ box-sizing:border-box)
function innerBorder(ctx, r, radius, width, color) {
  roundRectPath(ctx, r.x + width / 2, r.y + width / 2, r.w - width, r.h - width, radius - width / 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

// ---------- ส่วนต่าง ๆ ----------

function drawBackground(ctx, bg) {
  if (bg) {
    ctx.drawImage(bg, 0, 0, DESIGN_W, DESIGN_H);
  } else {
    ctx.fillStyle = '#f7f3fc';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }
}

function drawLogo(ctx, logo, rect, scale) {
  if (!logo) return;
  setShadow(ctx, scale, 0, 6, 10, 'rgba(59,20,112,.33)');
  ctx.drawImage(logo, rect.x, rect.y, rect.w, rect.h);
  clearShadow(ctx);
}

function drawTitle(ctx, t, pal, scale) {
  const r = t.rect;
  const radius = r.h / 2;
  const cy = r.y + r.h / 2;

  // เส้นทองซ้าย/ขวา 70×4 ห่างแถบ 8 (ไล่จากโปร่งเข้าหาแถบ)
  const lineY = cy - 2;
  const gl = ctx.createLinearGradient(r.x - 78, 0, r.x - 8, 0);
  gl.addColorStop(0, 'rgba(217,169,58,0)');
  gl.addColorStop(1, pal.gold);
  ctx.fillStyle = gl;
  ctx.fillRect(r.x - 78, lineY, 70, 4);
  const gr = ctx.createLinearGradient(r.x + r.w + 78, 0, r.x + r.w + 8, 0);
  gr.addColorStop(0, 'rgba(217,169,58,0)');
  gr.addColorStop(1, pal.gold);
  ctx.fillStyle = gr;
  ctx.fillRect(r.x + r.w + 8, lineY, 70, 4);

  setShadow(ctx, scale, 0, 10, 24, '#3b147066');
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = vGradient(ctx, r.y, r.y + r.h, pal.p3, pal.p1);
  ctx.fill();
  clearShadow(ctx);
  innerBorder(ctx, r, radius, 5, pal.gold);
  outerRing(ctx, r, radius, 3, '#ffffff88');

  setShadow(ctx, scale, 0, 2, 4, '#00000066');
  const ys = lineCenters(cy, t.lines.length, t.font);
  t.lines.forEach((ln, i) => text(ctx, ln, DESIGN_W / 2, ys[i], { px: t.font, color: '#ffffff' }));
  clearShadow(ctx);
}

function drawSchool(ctx, s, pal, scale) {
  const r = s.rect;
  const radius = Math.min(27, r.h / 2);
  setShadow(ctx, scale, 0, 6, 16, '#3b147033');
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  clearShadow(ctx);
  innerBorder(ctx, r, radius, 3, pal.p3);
  const ys = lineCenters(r.y + r.h / 2, s.lines.length, s.font);
  s.lines.forEach((ln, i) => text(ctx, ln, r.x + r.w / 2, ys[i], { px: s.font, color: pal.p1 }));
}

function drawAddress(ctx, a, A, pal) {
  if (!a) return;
  const r = a.rect;
  roundRectPath(ctx, r.x, r.y, r.w, r.h, Math.min(20, r.h / 2));
  ctx.fillStyle = pal.pillBg;
  ctx.fill();
  const x0 = r.x + A.padX / 2;
  const cy = r.y + r.h / 2;
  // หมุด 22×28: วาดไอคอนขนาด 28 (กว้างจริง ~22) ให้ฐานหมุดอยู่กลางบรรทัด
  const pinSize = A.pin.h;
  const pinX = x0 + A.pin.w / 2 - pinSize / 2;
  // วงขาวกลางหมุด (ช่องโปร่งของ path) ให้เห็นชัดบนพื้นโปร่ง
  ctx.beginPath();
  ctx.arc(pinX + pinSize / 2, cy - pinSize / 2 + 9.2 * pinSize / 24, 3.9 * pinSize / 24, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  drawIcon(ctx, 'pin', pinX, cy - pinSize / 2, pinSize, '#d6304a');
  const tx = x0 + A.pin.w + A.pin.gap;
  const tw = r.x + r.w - A.padX / 2 - tx;
  const ys = lineCenters(cy, a.lines.length, a.font);
  a.lines.forEach((ln, i) => text(ctx, ln, tx + tw / 2, ys[i], { px: a.font, weight: 500, color: pal.pillText }));
}

function drawPhoto(ctx, img, r, P, pal, scale) {
  const radius = P.radius;
  // วง p3 2px รอบนอก + เงา
  setShadow(ctx, scale, 0, 12, 26, '#3b147055');
  roundRectPath(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, radius + 2);
  ctx.fillStyle = pal.p3;
  ctx.fill();
  clearShadow(ctx);
  // ขอบขาว 6
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const b = P.border;
  const inner = { x: r.x + b, y: r.y + b, w: r.w - 2 * b, h: r.h - 2 * b };
  if (img) {
    const s = sizeOf(img);
    const focal = s && s.h > s.w ? 0.5 : 0.45;
    drawCover(ctx, img, inner, focal, radius - b);
  } else {
    roundRectPath(ctx, inner.x, inner.y, inner.w, inner.h, radius - b);
    ctx.fillStyle = '#e4dbf3';
    ctx.fill();
  }
}

function drawLabel(ctx, L, C, pal, scale) {
  if (!L) return;
  const r = L.rect;
  const radius = r.h / 2;
  setShadow(ctx, scale, 0, 3, 8, '#2e0f5c55');
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = vGradient(ctx, r.y, r.y + r.h, pal.p3, pal.p1);
  ctx.fill();
  clearShadow(ctx);
  innerBorder(ctx, r, radius, 2, pal.gold2);
  const cy = r.y + r.h / 2;
  const ccx = r.x + C.padL + L.circle / 2;
  ctx.beginPath();
  ctx.arc(ccx, cy, L.circle / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const is = Math.round(L.circle * 0.625);
  drawIcon(ctx, L.icon, ccx - is / 2, cy - is / 2, is, pal.p2);
  text(ctx, L.text, r.x + C.padL + L.circle + C.gap, cy, { px: L.font, color: '#ffffff', align: 'left' });
}

function drawPhone(ctx, p, color) {
  const x0 = p.cx - p.w / 2;
  drawIcon(ctx, 'phone', x0, p.y - p.icon / 2, p.icon, color);
  text(ctx, p.text, x0 + p.icon + p.iconGap, p.y, { px: p.font, color: '#ffffff', align: 'left' });
}

function drawDuty(ctx, d, pal, scale) {
  const r = d.rect;
  const radius = 26;
  setShadow(ctx, scale, 0, -6, 22, '#2e0f5c66');
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = vGradient(ctx, r.y, r.y + r.h, pal.dutyTop, pal.dutyBottom);
  ctx.fill();
  clearShadow(ctx);
  innerBorder(ctx, r, radius, 4, pal.gold);
  outerRing(ctx, r, radius, 3, '#ffffff66');

  setShadow(ctx, scale, 0, 1, 3, '#00000088');
  text(ctx, d.header.text, r.x + r.w / 2, d.header.y, { px: d.header.font, color: pal.gold2 });
  clearShadow(ctx);

  // เส้นคั่นทองโปร่ง 60% กว้าง 2 สูง 44 กึ่งกลางพื้นที่ชื่อ+เบอร์
  if (d.dividers.length) {
    const c0 = d.cols[0];
    const nameY = Array.isArray(c0.name.y) ? c0.name.y[0] : c0.name.y;
    const lastY = c0.phone ? c0.phone.y : (Array.isArray(c0.name.y) ? c0.name.y[c0.name.y.length - 1] : nameY);
    const midY = (nameY + lastY) / 2;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = pal.gold;
    for (const x of d.dividers) ctx.fillRect(x - 1, midY - 22, 2, 44);
    ctx.restore();
  }

  setShadow(ctx, scale, 0, 1, 3, '#00000055');
  for (const c of d.cols) {
    const ys = Array.isArray(c.name.y) ? c.name.y : [c.name.y];
    c.name.lines.forEach((ln, i) => {
      if (ln) text(ctx, ln, c.name.cx, ys[i] ?? ys[0], { px: c.name.font, color: '#ffffff' });
    });
    if (c.phone) drawPhone(ctx, c.phone, pal.gold2);
  }
  clearShadow(ctx);
}

// ---------- ภาพเต็มหน้า ----------

/**
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx  canvas ขนาด 1024·scale × 1536·scale
 * @param {object} model  RenderModel {school, title, dateISO, teachers, photos}
 * @param {object} resolved  ผลของ mergeTemplate(common, template)
 * @param {number} scale  1.5 = ภาพจริง 1536×2304, 0.25 = พรีวิว
 * @param {{bg:CanvasImageSource, logo:CanvasImageSource, photos:CanvasImageSource[]}} assets
 */
export function renderOnePage(ctx, model, resolved, scale, assets = {}) {
  const pal = { ...DEFAULT_PALETTE, ...(resolved.palette || {}) };
  const photos = assets.photos || [];
  const measure = (str, px, weight = 700) => {
    ctx.font = fontStr(px, weight);
    return ctx.measureText(String(str)).width;
  };
  const layout = computeLayout(resolved, { ...model, logoSize: model.logoSize ?? sizeOf(assets.logo) }, measure);

  ctx.save();
  ctx.scale(scale, scale);
  clearShadow(ctx);

  drawBackground(ctx, assets.bg);
  drawLogo(ctx, assets.logo, layout.logo, scale);
  drawTitle(ctx, layout.title, pal, scale);
  drawSchool(ctx, layout.school, pal, scale);
  drawAddress(ctx, layout.address, resolved.address, pal);
  layout.photos.forEach((r, i) => drawPhoto(ctx, photos[i], r, resolved.photos, pal, scale));
  layout.labels.forEach(L => drawLabel(ctx, L, resolved.label, pal, scale));
  drawDuty(ctx, layout.duty, pal, scale);

  clearShadow(ctx);
  ctx.restore();
}
