import { describe, it, expect, vi } from 'vitest';
import { processPhoto, processPhotosSequential } from '../../site/js/photos.js';

function mkDeps({ w = 4000, h = 3000, failFirst = false, failEncode = false } = {}) {
  const bitmap = { width: w, height: h, close: vi.fn() };
  let calls = 0;
  const cib = vi.fn(async (file, opts) => {
    calls++;
    if (failFirst && calls === 1) throw new TypeError('unsupported option');
    if (opts && opts.resizeWidth) return { width: opts.resizeWidth, height: opts.resizeHeight, close: bitmap.close };
    return bitmap;
  });
  const ctx = { drawImage: vi.fn() };
  const canvas = { getContext: () => ctx };
  return {
    bitmap, cib,
    deps: {
      createImageBitmap: cib,
      createCanvas: vi.fn(() => canvas),
      canvasToBlob: vi.fn(async () => { if (failEncode) throw new Error('enc'); return new Blob(['x'], { type: 'image/jpeg' }); }),
      loadImage: vi.fn(),
    },
  };
}
const img = () => ({ type: 'image/jpeg', name: 'a.jpg' });

describe('processPhoto', () => {
  it('rejects non-image with DecodeError', async () => {
    const { deps } = mkDeps();
    await expect(processPhoto({ type: 'application/pdf', name: 'a.pdf' }, { deps })).rejects.toMatchObject({ name: 'DecodeError' });
  });
  it('retries without imageOrientation after TypeError', async () => {
    const { deps, cib } = mkDeps({ w: 800, h: 600, failFirst: true });
    await processPhoto(img(), { deps });
    expect(cib).toHaveBeenCalledTimes(2);
    expect(cib.mock.calls[0][1].imageOrientation).toBe('from-image');
    expect(cib.mock.calls[1][1].imageOrientation).toBeUndefined();
  });
  it('requests 1600x1200 for 4000x3000', async () => {
    const { deps, cib } = mkDeps();
    const r = await processPhoto(img(), { deps });
    const opt = cib.mock.calls.find(c => c[1] && c[1].resizeWidth)[1];
    expect([opt.resizeWidth, opt.resizeHeight]).toEqual([1600, 1200]);
    expect([r.w, r.h]).toEqual([1600, 1200]);
  });
  it('does not resize 800x600', async () => {
    const { deps, cib } = mkDeps({ w: 800, h: 600 });
    const r = await processPhoto(img(), { deps });
    expect(cib.mock.calls.every(c => !(c[1] && c[1].resizeWidth))).toBe(true);
    expect([r.w, r.h]).toEqual([800, 600]);
  });
  it('closes bitmap on success and on encode failure', async () => {
    const a = mkDeps({ w: 800, h: 600 });
    await processPhoto(img(), { deps: a.deps });
    expect(a.bitmap.close).toHaveBeenCalled();
    const b = mkDeps({ w: 800, h: 600, failEncode: true });
    await expect(processPhoto(img(), { deps: b.deps })).rejects.toBeTruthy();
    expect(b.bitmap.close).toHaveBeenCalled();
  });
  it('falls back to img element when createImageBitmap fails', async () => {
    const { deps } = mkDeps({ w: 800, h: 600 });
    deps.createImageBitmap = vi.fn(async () => { throw new Error('nope'); });
    deps.loadImage = vi.fn(async () => ({ naturalWidth: 3200, naturalHeight: 2400 }));
    const r = await processPhoto(img(), { deps });
    expect([r.w, r.h]).toEqual([1600, 1200]);
  });
  it('DecodeError when all paths fail', async () => {
    const { deps } = mkDeps();
    deps.createImageBitmap = vi.fn(async () => { throw new Error('x'); });
    deps.loadImage = vi.fn(async () => { throw new Error('y'); });
    await expect(processPhoto(img(), { deps })).rejects.toMatchObject({ name: 'DecodeError' });
  });
});

describe('processPhotosSequential', () => {
  it('calls onEach in order with results or errors', async () => {
    const out = [];
    const files = [{ type: 'application/pdf', name: 'a' }, { type: 'application/pdf', name: 'b' }];
    await processPhotosSequential(files, (i, r) => out.push([i, r instanceof Error]));
    expect(out).toEqual([[0, true], [1, true]]);
  });
});

describe('HEIC (Chrome/Android ถอดเองไม่ได้)', () => {
  // ถอดรหัสไฟล์ HEIC ล้มทุกเส้นทาง แต่ JPEG ที่แปลงแล้วถอดได้
  function heicDeps() {
    const base = mkDeps({ w: 4032, h: 3024 });
    const jpeg = new Blob(['j'], { type: 'image/jpeg' });
    base.deps.createImageBitmap = vi.fn(async (f, o) => {
      if (f !== jpeg) throw new DOMException('bad', 'InvalidStateError');
      return o && o.resizeWidth ? { width: o.resizeWidth, height: o.resizeHeight, close() {} } : { width: 4032, height: 3024, close() {} };
    });
    base.deps.loadImage = vi.fn(async () => { throw new Error('no heic'); });
    base.deps.heicToJpeg = vi.fn(async () => jpeg);
    return { ...base, jpeg };
  }
  it('isHeic รู้จักจาก type หรือนามสกุล', async () => {
    const { isHeic } = await import('../../site/js/photos.js');
    expect(isHeic({ type: 'image/heic', name: 'x' })).toBe(true);
    expect(isHeic({ type: '', name: 'IMG_9113.HEIC' })).toBe(true);
    expect(isHeic({ type: 'image/jpeg', name: 'a.jpg' })).toBe(false);
  });
  it('ถอดเองไม่ได้ → แปลงเป็น JPEG แล้วย่อเป็น 1600x1200', async () => {
    const { deps } = heicDeps();
    const r = await processPhoto({ type: 'image/heic', name: 'IMG_9113.HEIC' }, { deps });
    expect(deps.heicToJpeg).toHaveBeenCalledTimes(1);
    expect([r.w, r.h]).toEqual([1600, 1200]);
  });
  it('ไฟล์ .HEIC ที่ type ว่าง (บาง OS) ไม่ถูกปัดว่า "ไม่ใช่รูปภาพ"', async () => {
    const { deps } = heicDeps();
    const r = await processPhoto({ type: '', name: 'IMG_9114.HEIC' }, { deps });
    expect(r.w).toBe(1600);
  });
  it('แปลงไม่สำเร็จ → DecodeError', async () => {
    const { deps } = heicDeps();
    deps.heicToJpeg = vi.fn(async () => { throw new Error('boom'); });
    await expect(processPhoto({ type: 'image/heic', name: 'a.heic' }, { deps })).rejects.toMatchObject({ name: 'DecodeError' });
  });
  it('JPEG ธรรมดาไม่เรียกตัวแปลง HEIC', async () => {
    const { deps } = mkDeps();
    deps.heicToJpeg = vi.fn();
    await processPhoto(img(), { deps });
    expect(deps.heicToJpeg).not.toHaveBeenCalled();
  });
});
