import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createImageLoader, hasLogo, logoSrc, loadFinalAssets, loadPreviewAssets, AssetError, MSG_ASSET, IMAGE_TIMEOUT_MS,
} from '../../site/js/assets.js';

// ภาพปลอม: src ที่อยู่ใน ok โหลดสำเร็จ, ใน bad ล้ม, อื่น ๆ ค้าง (ไม่ตอบ)
function fakeImages({ ok = [], bad = [] } = {}) {
  const made = [];
  const createImage = () => {
    const img = { set src(v) { this._src = v; made.push(v); queueMicrotask(() => { if (ok.includes(v)) this.onload?.(); else if (bad.includes(v)) this.onerror?.(); }); }, get src() { return this._src; } };
    return img;
  };
  return { createImage, made };
}

afterEach(() => vi.useRealTimers());

describe('hasLogo / logoSrc (_default = ไม่มีตรา)', () => {
  it('empty or _default* logo_file = no logo', () => {
    for (const f of ['', '  ', '_default.v1.webp', '_default.png', undefined]) expect(hasLogo({ logo_file: f })).toBe(false);
    expect(hasLogo(null)).toBe(false);
    expect(logoSrc({ logo_file: '_default.v1.webp' })).toBe(null);
  });
  it('real file = path under assets/logos', () => {
    expect(hasLogo({ logo_file: 'changkon8.v1.webp' })).toBe(true);
    expect(logoSrc({ logo_file: 'changkon8.v1.webp' })).toBe('assets/logos/changkon8.v1.webp');
  });
  it('the borrowed _default emblem file is gone from the site', () => {
    expect(existsSync(fileURLToPath(new URL('../../site/assets/logos/_default.v1.webp', import.meta.url)))).toBe(false);
  });
});

describe('createImageLoader', () => {
  it('default timeout is about 10 s', () => expect(IMAGE_TIMEOUT_MS).toBe(10000));

  it('hanging image rejects after the timeout and can be retried', async () => {
    vi.useFakeTimers();
    const { createImage, made } = fakeImages();
    const load = createImageLoader({ timeoutMs: 10000, createImage });
    const p = load('bg.webp');
    const seen = p.then(() => 'ok', (e) => e.message);
    await vi.advanceTimersByTimeAsync(9999);
    let settled = false; seen.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await seen).toBe('timeout bg.webp');
    load('bg.webp').catch(() => {});
    expect(made).toEqual(['bg.webp', 'bg.webp']); // ไม่จำผลที่ล้ม
  });

  it('successful load is cached', async () => {
    const { createImage, made } = fakeImages({ ok: ['a.webp'] });
    const load = createImageLoader({ createImage });
    const a = await load('a.webp');
    expect(await load('a.webp')).toBe(a);
    expect(made).toEqual(['a.webp']);
  });
});

describe('loadFinalAssets (ภาพจริง)', () => {
  const tpl = { file: 'assets/bg/np-01.v1.webp' };
  const school = { logo_file: 'changkon8.v1.webp' };
  it('needs background and logo', async () => {
    const { createImage } = fakeImages({ ok: [tpl.file, 'assets/logos/changkon8.v1.webp'] });
    const r = await loadFinalAssets({ tpl, school, loadImage: createImageLoader({ createImage }) });
    expect(r.bg).toBeTruthy();
    expect(r.logo).toBeTruthy();
  });
  it('background failure -> AssetError("bg") with the retry message, no fallback', async () => {
    const { createImage } = fakeImages({ ok: ['assets/logos/changkon8.v1.webp'], bad: [tpl.file] });
    const e = await loadFinalAssets({ tpl, school, loadImage: createImageLoader({ createImage }) }).catch((x) => x);
    expect(e).toBeInstanceOf(AssetError);
    expect(e.kind).toBe('bg');
    expect(e.message).toBe('ยังโหลดพื้นหลังไม่ได้ ลองใหม่');
  });
  it('background timeout -> AssetError("bg")', async () => {
    vi.useFakeTimers();
    const { createImage } = fakeImages({ ok: ['assets/logos/changkon8.v1.webp'] });
    const p = loadFinalAssets({ tpl, school, loadImage: createImageLoader({ createImage }) }).catch((x) => x);
    await vi.advanceTimersByTimeAsync(IMAGE_TIMEOUT_MS);
    expect((await p).kind).toBe('bg');
  });
  it('logo failure -> AssetError("logo")', async () => {
    const { createImage } = fakeImages({ ok: [tpl.file], bad: ['assets/logos/changkon8.v1.webp'] });
    const e = await loadFinalAssets({ tpl, school, loadImage: createImageLoader({ createImage }) }).catch((x) => x);
    expect(e.kind).toBe('logo');
    expect(e.message).toBe(MSG_ASSET.logo);
  });
  it('school without a logo (_default) renders with logo null and never loads one', async () => {
    const { createImage, made } = fakeImages({ ok: [tpl.file] });
    const r = await loadFinalAssets({ tpl, school: { logo_file: '_default.v1.webp' }, loadImage: createImageLoader({ createImage }) });
    expect(r.logo).toBe(null);
    expect(made).toEqual([tpl.file]);
  });
});

describe('loadPreviewAssets (พรีวิวยอมขาด)', () => {
  it('missing background/logo become null', async () => {
    const { createImage } = fakeImages({ bad: ['x.webp', 'assets/logos/s.webp'] });
    const r = await loadPreviewAssets({ tpl: { file: 'x.webp' }, school: { logo_file: 's.webp' }, loadImage: createImageLoader({ createImage }) });
    expect(r).toEqual({ bg: null, logo: null });
  });
});
