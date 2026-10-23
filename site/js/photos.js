// ย่อรูปที่ครูเลือกทันทีให้เป็น JPEG blob เล็ก ๆ — ไม่เก็บ ImageBitmap/ต้นฉบับไว้ (ปิดทุกเส้นทาง)
import { createCanvas, canvasToBlob } from './render.js';

function decodeError(msg, cause) {
  const e = new Error(msg);
  e.name = 'DecodeError';
  if (cause) e.cause = cause;
  return e;
}

function defaultLoadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดรูปไม่ได้')); };
    img.src = url;
  });
}

function defaultDeps() {
  return {
    createImageBitmap: typeof createImageBitmap === 'function' ? (f, o) => createImageBitmap(f, o) : undefined,
    createCanvas,
    canvasToBlob,
    loadImage: defaultLoadImage,
  };
}

// ขนาดปลายทางโดยไม่ upscale
function fitSize(w, h, maxSide) {
  const long = Math.max(w, h);
  if (long <= maxSide) return { w, h, scaled: false };
  const k = maxSide / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: true };
}

// ถอดรหัสเป็น bitmap ที่ไม่ใหญ่เกิน maxSide; ลองตัวเลือก imageOrientation ก่อน ถ้า TypeError ลองแบบไม่มี
async function bitmapPath(file, maxSide, cib) {
  const variants = [{ imageOrientation: 'from-image' }, {}];
  let lastErr;
  for (const base of variants) {
    try {
      let bmp = await cib(file, base);
      const t = fitSize(bmp.width, bmp.height, maxSide);
      if (t.scaled) {
        bmp.close();
        bmp = await cib(file, { ...base, resizeWidth: t.w, resizeHeight: t.h, resizeQuality: 'medium' });
      }
      return bmp;
    } catch (e) {
      lastErr = e;
      if (!(e instanceof TypeError)) break; // ไม่ใช่ปัญหา option → ไปเส้นทางสำรอง
    }
  }
  throw lastErr;
}

async function encode(source, w, h, deps, quality) {
  const canvas = deps.createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await deps.canvasToBlob(canvas, 'image/jpeg', quality);
  return { blob, w, h };
}

export async function processPhoto(file, { maxSide = 1600, quality = 0.85, deps = {} } = {}) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw decodeError('ไฟล์นี้ไม่ใช่รูปภาพ');
  }
  const d = { ...defaultDeps(), ...deps };

  if (typeof d.createImageBitmap === 'function') {
    let bmp = null;
    try {
      bmp = await bitmapPath(file, maxSide, d.createImageBitmap);
    } catch (e) {
      bmp = null; // ลองเส้นทาง <img>
    }
    if (bmp) {
      try {
        return await encode(bmp, bmp.width, bmp.height, d, quality);
      } finally {
        bmp.close();
      }
    }
  }

  let img;
  try {
    img = await d.loadImage(file);
    if (typeof img.decode === 'function') await img.decode();
  } catch (e) {
    throw decodeError('เปิดรูปนี้ไม่ได้', e);
  }
  const t = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide);
  if (!t.w || !t.h) throw decodeError('รูปไม่มีขนาด');
  return encode(img, t.w, t.h, d, quality);
}

// ทีละไฟล์ คั่น setTimeout 0 ให้เบราว์เซอร์คืนหน่วยความจำ/วาดหน้าจอ
export async function processPhotosSequential(files, onEach, opts = {}) {
  for (let i = 0; i < files.length; i++) {
    let r;
    try {
      r = await processPhoto(files[i], opts);
    } catch (e) {
      r = e;
    }
    onEach(i, r);
    await new Promise(res => setTimeout(res, 0));
  }
}
