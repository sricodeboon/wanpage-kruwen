// เรขาคณิตของแม่แบบชุดเดิม (v1/v2) × 6 เคส golden — ใช้ทำ snapshot tests/unit/fixtures/layout-v2.json
// แม่แบบที่ไม่มี scene (หรือ scene 'bottom') ต้องได้ผลเท่าเดิมทุกตัวเลขหลังเพิ่มฉาก side
import { casesFor } from '../golden/cases.mjs';
import { measure } from './measure.mjs';

export function layoutSnapshot(all, { mergeTemplate, computeLayout, photoRects, validateTemplate }, ids) {
  const out = {};
  for (const id of ids) {
    const t = all.templates.find(x => x.id === id);
    const r = mergeTemplate(all.common, t);
    out[id] = {
      validate: validateTemplate(r),
      rects: Object.fromEntries([0, 26, 28, 54].map(dy => [dy, photoRects(r, dy)])),
      cases: Object.fromEntries(casesFor(id).map(c => [c.name, computeLayout(r, c.model, measure)])),
    };
  }
  return JSON.parse(JSON.stringify(out));
}
