import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ensureFonts } from '../../site/js/fonts.js';

describe('ensureFonts', () => {
  it('resolves false within timeout when check is false', async () => {
    const fontFaceSet = { load: vi.fn(() => new Promise(() => {})), check: vi.fn(() => false) };
    const t = Date.now();
    expect(await ensureFonts({ timeoutMs: 50, fontFaceSet })).toBe(false);
    expect(Date.now() - t).toBeLessThan(500);
  });
  it('resolves false when load done but check false', async () => {
    const fontFaceSet = { load: vi.fn(async () => []), check: vi.fn(() => false) };
    expect(await ensureFonts({ timeoutMs: 500, fontFaceSet })).toBe(false);
  });
  it('resolves true and loads thai+latin samples', async () => {
    const fontFaceSet = { load: vi.fn(async () => []), check: vi.fn(() => true) };
    expect(await ensureFonts({ timeoutMs: 500, fontFaceSet })).toBe(true);
    const texts = fontFaceSet.load.mock.calls.map(c => c[1]).join('');
    expect(texts).toMatch(/0123456789/);
    expect(texts).toMatch(/ปิ่น/);
  });
});

describe('font subsets cover the ellipsis drawn by layout.js', () => {
  const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
  it('U+2026 is in the latin subset script and every latin @font-face unicode-range', () => {
    expect(read('site/js/layout.js')).toContain('…');
    expect(read('tools/subset-fonts.sh')).toMatch(/LATIN='[^']*U\+2026/);
    const latin = read('site/fonts.css').split('@font-face').filter((b) => b.includes('-latin.woff2'));
    expect(latin).toHaveLength(2);
    for (const b of latin) expect(b).toMatch(/unicode-range:[^;]*U\+2026/);
  });
});
