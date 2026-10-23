import { describe, it, expect } from 'vitest';
import { qrMatrix, pickVersion } from '../../site/js/qr.js';

describe('qr', () => {
  it('picks the smallest version for ECC M byte mode', () => {
    expect(pickVersion(10)).toBe(1);
    expect(pickVersion(14)).toBe(1);
    expect(pickVersion(15)).toBe(2);
    expect(pickVersion(106)).toBe(6);
    expect(pickVersion(107)).toBe(null);
  });
  it('produces size 4v+17 with finder patterns', () => {
    const m = qrMatrix('https://x.io/?s=a');
    expect(m.length).toBe(25); // 17 ไบต์ -> v2
    expect(m.every((r) => r.length === 25)).toBe(true);
    expect(m[0].slice(0, 7)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(m[3][3]).toBe(1);
    expect(m[1][1]).toBe(0);
  });
  it('a real pinned link fits in version <= 6', () => {
    const m = qrMatrix('https://sricodeboon.github.io/wanpage-kruwen/?s=changkon8&openExternalBrowser=1');
    expect((m.length - 17) / 4).toBeLessThanOrEqual(6);
  });
  it('is deterministic', () => {
    expect(qrMatrix('abc')).toEqual(qrMatrix('abc'));
  });
});
