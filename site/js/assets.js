// โหลดภาพที่ canvas วาด (พื้นหลัง/ตรา) — same-origin, จำไว้, มีเวลาจำกัด
// ภาพจริงที่ส่งเข้ากลุ่มต้องมีพื้นหลังและตรา (ถ้าโรงเรียนมีตรา) ครบ; พรีวิวยอมวาดแบบขาดได้

export const IMAGE_TIMEOUT_MS = 10000;
export const MSG_ASSET = {
  bg: 'ยังโหลดพื้นหลังไม่ได้ ลองใหม่',
  logo: 'ยังโหลดตราโรงเรียนไม่ได้ ลองใหม่',
};

// logo_file ว่าง หรือ `_default…` = โรงเรียนยังไม่มีตรา → ไม่วาดตรา (ไม่ยืมตราโรงเรียนอื่น)
export function hasLogo(school) {
  const f = String(school?.logo_file || '').trim();
  return Boolean(f) && !f.startsWith('_default');
}
export const logoSrc = (school) => (hasLogo(school) ? 'assets/logos/' + String(school.logo_file).trim() : null);

export class AssetError extends Error {
  constructor(kind) { super(MSG_ASSET[kind]); this.kind = kind; }
}

/**
 * ตัวโหลดภาพที่จำผลไว้ (ล้ม/หมดเวลา = ลบออกจากที่จำ ลองใหม่ได้)
 * @param opts {timeoutMs, createImage} createImage ฉีดแทนได้ใน test
 */
export function createImageLoader({ timeoutMs = IMAGE_TIMEOUT_MS, createImage = () => new Image() } = {}) {
  const cache = new Map();
  return function loadImage(src) {
    if (!cache.has(src)) {
      cache.set(src, new Promise((resolve, reject) => {
        const img = createImage();
        const timer = setTimeout(() => fail(new Error('timeout ' + src)), timeoutMs);
        function fail(e) {
          clearTimeout(timer);
          img.onload = img.onerror = null;
          cache.delete(src);
          reject(e);
        }
        img.decoding = 'async';
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => fail(new Error('load ' + src));
        img.src = src;
      }));
    }
    return cache.get(src);
  };
}

// ภาพจริง: ต้องได้พื้นหลัง + ตรา (ถ้ามี) ไม่งั้นโยน AssetError ไม่สร้าง PNG
export async function loadFinalAssets({ tpl, school, loadImage }) {
  const [bg, logo] = await Promise.all([
    loadImage(tpl.file).catch(() => { throw new AssetError('bg'); }),
    hasLogo(school) ? loadImage(logoSrc(school)).catch(() => { throw new AssetError('logo'); }) : null,
  ]);
  return { bg, logo };
}

// พรีวิว: ขาดได้ (วาดพื้นสีอ่อน/ไม่มีตรา)
export async function loadPreviewAssets({ tpl, school, loadImage }) {
  const [bg, logo] = await Promise.all([
    tpl ? loadImage(tpl.file).catch(() => null) : null,
    hasLogo(school) ? loadImage(logoSrc(school)).catch(() => null) : null,
  ]);
  return { bg, logo };
}
