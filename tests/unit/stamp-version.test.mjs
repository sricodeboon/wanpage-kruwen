import { describe, it, expect } from 'vitest';
import { stamp } from '../../tools/stamp-version.mjs';

describe('stamp-version', () => {
  it('ต่อ ?v= ท้าย import / dynamic import / script / css', () => {
    const src = `import { a } from './js/layout.js';\nconst m = await import('./render.js');\n<script type="module" src="app.js"></script>\n<link rel="stylesheet" href="styles.css">`;
    const out = stamp(src, 'abc');
    expect(out).toContain(`from './js/layout.js?v=abc'`);
    expect(out).toContain(`import('./render.js?v=abc')`);
    expect(out).toContain(`src="app.js?v=abc"`);
    expect(out).toContain(`href="styles.css?v=abc"`);
  });
  it('ไม่แตะ URL ภายนอกหรือที่มี query อยู่แล้ว และรันซ้ำไม่ซ้อน', () => {
    const src = `<link href="https://fonts.googleapis.com/x.css"><script src="a.js?x=1"></script>`;
    expect(stamp(src, 'v')).toBe(src);
    expect(stamp(stamp(`from './a.js'`, 'v'), 'v')).toBe(`from './a.js?v=v'`);
  });
});
