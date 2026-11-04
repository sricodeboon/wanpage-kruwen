import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mergeTemplate, photoRects, validateTemplate } from '../../site/js/layout.js';
const all = JSON.parse(readFileSync(new URL('../../site/templates.json', import.meta.url), 'utf8'));
const overlaps = (a,b) => a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
describe('พื้นที่ภาพคู่พระธาตุ', () => {
  it.each(Array.from({ length: 8 }, (_, i) => `np-${i + 21}`))('%s แยกรูปออกจากพระธาตุและแถบครูเวร แม้หัวข้อยาว', id => {
    const r = mergeTemplate(all.common, all.templates.find(t => t.id === id));
    expect(validateTemplate(r)).toEqual({ ok: true, errors: [] });
    for (const dy of [0, 54]) {
      const photos = photoRects(r, dy);
      expect(photos).toHaveLength(4);
      for (const photo of photos) {
        expect(overlaps(photo, r.landmark)).toBe(false);
        expect(photo.y + photo.h).toBeLessThanOrEqual(r.band.top_y - 16);
      }
      expect(photos[2].x).toBeGreaterThanOrEqual(r.landmark.x + r.landmark.w + r.photos.landmarkGap);
      expect(photos[3].x).toBe(photos[2].x);
    }
  });
  it('ปฏิเสธพระธาตุที่ขยายจนทับพื้นที่รูป', () => {
    const t = all.templates.find(t => t.id === 'np-28');
    const r = mergeTemplate(all.common, { ...t, landmark: { ...t.landmark, y: 600 } });
    expect(validateTemplate(r).ok).toBe(false);
  });
});
