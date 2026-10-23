// เลย์เอาต์ภาพรายงาน 1 หน้า — pure ไม่แตะ DOM
// พิกัดทั้งหมดเป็นหน่วยออกแบบ 1024×1536; ค่าคงที่มาจาก templates.json.common (+ overrides ต่อแบบ)
// measure(text, font, weight) → ความกว้างข้อความ (ตอนรันจริงใช้ ctx.measureText, ตอนทดสอบใช้ stub)
import { formatThaiDate } from './thaidate.js';

const DESIGN_W = 1024;
const DESIGN_H = 1536;
const LAYOUTS = ['1+3', '2x2', '2+2'];
const PROVINCES = ['np', 'sn', 'mdh'];
const KEEP = ['id', 'version', 'active', 'name', 'province', 'landmark', 'band', 'file', 'thumb', 'approvedAt'];

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (isObj(v) && isObj(target[k])) deepMerge(target[k], v);
    else target[k] = clone(v);
  }
  return target;
}

export function mergeTemplate(common, tpl) {
  const out = clone(common) || {};
  for (const k of KEEP) if (tpl[k] !== undefined) out[k] = clone(tpl[k]);
  out.palette = clone(tpl.palette) || {};
  out.photo_layout = tpl.photo_layout || '1+3';
  return deepMerge(out, tpl.overrides);
}

// ---------- ข้อความไทย ----------

// สระบน/ล่าง วรรณยุกต์ ต้องติดกับพยัญชนะหน้า ห้ามขึ้นบรรทัดใหม่ด้วยตัวเหล่านี้
const isCombining = ch => {
  const c = ch.codePointAt(0);
  return c === 0x0e31 || (c >= 0x0e34 && c <= 0x0e3a) || (c >= 0x0e47 && c <= 0x0e4e);
};

// ห้ามขึ้นบรรทัดด้วย ะ า ำ ๅ และห้ามจบบรรทัดด้วยสระหน้า เ แ โ ใ ไ
const isFollowVowel = ch => ['ะ', 'า', 'ำ', 'ๅ'].includes(ch);
const isLeadVowel = ch => { const c = ch.codePointAt(0); return c >= 0x0e40 && c <= 0x0e44; };
const canBreakAt = (text, i) => i > 0 && i < text.length
  && !isCombining(text[i]) && !isFollowVowel(text[i]) && !isLeadVowel(text[i - 1]);

// ตัวตัดคำไทยของเบราว์เซอร์ (Chrome/Safari/Node full-ICU); ไม่มี → null แล้วใช้กติกาตัวอักษร
const DEFAULT_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('th', { granularity: 'word' }) : null;

// ตำแหน่งขอบคำ (index ใน text) ที่ตัดได้ — ภายใน 1..len-1 และผ่านกติกาสระ
export function wordBoundaries(text, segmenter = DEFAULT_SEGMENTER) {
  if (!segmenter) return [];
  const out = [];
  for (const { index } of segmenter.segment(text)) {
    if (index > 0 && canBreakAt(text, index)) out.push(index);
  }
  return out;
}

// แบ่ง 2 บรรทัดที่ฟอนต์ font ตามลำดับ:
// 1) ช่องว่างใกล้กลางที่สุด ที่ทั้งสองครึ่งพอดี maxW
// 2) ขอบคำไทย (Intl.Segmenter) ที่ทั้งสองครึ่งพอดีและกว้างสมดุลที่สุด
// 3) ขอบตัวอักษรที่สมดุลที่สุด (ไม่มี Segmenter หรือไม่มีขอบคำที่พอดี)
function splitTwo(measure, text, font, weight, maxW, segmenter) {
  const mid = text.length / 2;
  const fits = s => measure(s, font, weight) <= maxW;
  let best = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') continue;
    const a = text.slice(0, i).trim(), b = text.slice(i + 1).trim();
    if (!a || !b || !fits(a) || !fits(b)) continue;
    if (!best || Math.abs(i - mid) < Math.abs(best.i - mid)) best = { i, lines: [a, b] };
  }
  if (best) return best.lines;
  const cost = i => Math.max(measure(text.slice(0, i).trim(), font, weight), measure(text.slice(i).trim(), font, weight));
  let bestWord = null;
  for (const i of wordBoundaries(text, segmenter)) {
    const a = text.slice(0, i).trim(), b = text.slice(i).trim();
    if (!a || !b || !fits(a) || !fits(b)) continue;
    const c = cost(i);
    if (!bestWord || c < bestWord.c) bestWord = { c, lines: [a, b] };
  }
  if (bestWord) return bestWord.lines;
  let bestCost = Infinity, lines = [text];
  for (let i = 1; i < text.length; i++) {
    if (!canBreakAt(text, i)) continue;
    const a = text.slice(0, i).trim(), b = text.slice(i).trim();
    if (!a || !b) continue;
    const c = cost(i);
    if (c < bestCost) { bestCost = c; lines = [a, b]; }
  }
  return lines;
}

// segmenter: ไม่ส่ง = Intl.Segmenter('th') ถ้ามี; null = ปิด (ใช้กติกาตัวอักษร)
export function fitText(measure, text, { maxW, font, minFont, weight = 700, maxLines = 2, segmenter = DEFAULT_SEGMENTER }) {
  const t = String(text ?? '').trim();
  for (let f = font; f >= minFont; f--) {
    if (measure(t, f, weight) <= maxW) return { font: f, lines: [t] };
  }
  if (maxLines < 2) return { font: minFont, lines: [t] };
  return { font: minFont, lines: splitTwo(measure, t, minFont, weight, maxW, segmenter) };
}

// ตัดท้ายด้วย "…" ให้พอดี maxW (ไม่ตัดกลางสระ/วรรณยุกต์)
function ellipsize(measure, text, font, weight, maxW) {
  if (measure(text, font, weight) <= maxW) return text;
  for (let n = text.length - 1; n > 0; n--) {
    if (isCombining(text[n])) continue;
    const s = text.slice(0, n).trimEnd() + '…';
    if (measure(s, font, weight) <= maxW) return s;
  }
  return '…';
}

// ยศบรรทัดแรก ชื่อ-สกุลบรรทัดสอง: "ส.ต.ท.รัชเดช ศรีแก้ว" → ["ส.ต.ท.", "รัชเดช ศรีแก้ว"]
export function splitRank(name) {
  const t = String(name ?? '').trim();
  const m = t.match(/^((?:[ก-ฮ][ก-๎]{0,3}\.)+)\s*([ก-ฮเ-ไ].*)$/u);
  if (m) return [m[1], m[2].trim()];
  const sp = t.indexOf(' ');
  return sp > 0 ? [t.slice(0, sp), t.slice(sp + 1).trim()] : [t];
}

// ---------- ช่องรูป ----------

function photoGeometry(r, dy = 0) {
  const P = r.photos;
  const limit = r.landmark.y - P.landmarkGap; // ขอบล่างสุดที่รูปลงได้
  const errors = [];
  let rects;
  if (r.photo_layout === '1+3') {
    let mainH = P.main.h;
    let smallY = P.small.y + dy;
    let smallH = Math.min(P.small.h, limit - smallY);
    if (smallH < P.minSmallH) {
      const cut = Math.min(P.minSmallH - smallH, mainH - P.minMainH);
      if (cut > 0) { mainH -= cut; smallY -= cut; smallH = Math.min(P.small.h, limit - smallY); }
    }
    if (smallH < P.minSmallH) errors.push(`รูปเล็กสูง ${smallH} < ${P.minSmallH} (landmark.y ${r.landmark.y})`);
    rects = [{ x: P.main.x, y: P.main.y + dy, w: P.main.w, h: mainH },
      ...P.small.xs.map(x => ({ x, y: smallY, w: P.small.w, h: smallH }))];
  } else {
    // 2x2 / 2+2 ใช้กรอบเดียวกับ 1+3: x 46..978, บน = main.y, ล่าง = min(landmark−16, ขอบล่างรูปเล็กเดิม)
    const x0 = P.main.x, W = P.main.w, g = P.gap;
    const top = P.main.y + dy;
    const bottom = Math.min(limit, P.small.y + P.small.h + dy);
    const avail = bottom - top - g;
    const ratio = r.photo_layout === '2+2' ? P.topRatio2plus2 : 0.5;
    let upper = avail * ratio, lower = avail - upper;
    if (lower < P.minSmallH) { lower = P.minSmallH; upper = avail - lower; }
    if (upper < P.minMainH) { upper = P.minMainH; lower = avail - upper; }
    if (upper < P.minMainH || lower < P.minSmallH) {
      errors.push(`พื้นที่รูป ${avail} ไม่พอ (ต้อง ≥ ${P.minMainH + P.minSmallH})`);
      upper = Math.max(0, avail * ratio); lower = Math.max(0, avail - upper);
    }
    const cw = (W - g) / 2;
    const y2 = top + upper + g;
    rects = [
      { x: x0, y: top, w: cw, h: upper }, { x: x0 + cw + g, y: top, w: cw, h: upper },
      { x: x0, y: y2, w: cw, h: lower }, { x: x0 + cw + g, y: y2, w: cw, h: lower },
    ];
  }
  return { rects, errors };
}

export function photoRects(resolved, dy = 0) {
  return photoGeometry(resolved, dy).rects;
}

// ---------- เลย์เอาต์เต็มหน้า ----------

function logoRect(L, size) {
  if (size && size.w > 0 && size.h > 0) {
    const k = Math.min(L.maxW / size.w, L.maxH / size.h);
    const w = size.w * k, h = size.h * k;
    return { x: (DESIGN_W - w) / 2, y: L.top, w, h };
  }
  return { x: (DESIGN_W - L.maxW) / 2, y: L.top, w: L.maxW, h: L.maxH };
}

function labelFor(measure, C, photo, item, isMain) {
  if (!item || !item.label) return null;
  const h = isMain ? C.mainH : C.h;
  const font0 = isMain ? C.mainFont : C.font;
  const circle = h - 10;
  const chrome = C.padL + circle + C.gap + C.padR;
  const maxText = photo.w - 2 * C.offset - chrome;
  const fit = fitText(measure, item.label, { maxW: maxText, font: font0, minFont: C.minFont, maxLines: 1 });
  const text = ellipsize(measure, fit.lines[0], fit.font, 700, maxText);
  const w = chrome + measure(text, fit.font, 700);
  return {
    rect: { x: photo.x + C.offset, y: photo.y + photo.h - C.offset - h, w, h },
    font: fit.font, text, icon: item.icon ?? null, circle,
  };
}

const hasPhone = t => Boolean(t && String(t.phone ?? '').trim());

function dutyLayout(measure, D, model) {
  const teachers = (model.teachers || []).slice(0, 3);
  const variant = Math.max(1, teachers.length);
  const V = D.variants[String(variant)];
  const headerText = 'ครูเวรประจำวันที่ ' + formatThaiDate(model.dateISO);
  const headerFit = fitText(measure, headerText, {
    maxW: V.w - 2 * D.headerPadX, font: V.header.font, minFont: D.headerMinFont, maxLines: 1,
  });
  let h = V.h;
  let cols;
  const cxBox = V.x + V.w / 2;

  if (variant === 1) {
    const t = teachers[0] || { display_name: '' };
    const name = String(t.display_name ?? '').trim();
    const phone = hasPhone(t) ? String(t.phone).trim() : null;
    const P = V.phone;
    const phoneW = f => (phone ? P.icon + P.iconGap + measure(phone, f, 700) : 0);
    const rowW = (nf, pf) => measure(name, nf, 700) + (phone ? V.rowGap + phoneW(pf) : 0);
    let nf = V.name.font, pf = P.font;
    while (rowW(nf, pf) > V.rowMaxW && (nf > V.name.minFont || pf > P.minFont)) {
      if (nf > V.name.minFont) nf--;
      if (pf > P.minFont) pf--;
    }
    if (rowW(nf, pf) <= V.rowMaxW || !phone) { // ไม่มีเบอร์ = ไม่ต้องแยกบรรทัด
      const total = rowW(nf, pf);
      const start = cxBox - total / 2;
      const nw = measure(name, nf, 700);
      cols = [{
        name: { font: nf, lines: [name], y: V.name.dy, cx: start + nw / 2 },
        phone: phone ? { font: pf, y: P.dy, text: phone, cx: start + nw + V.rowGap + phoneW(pf) / 2, w: phoneW(pf), icon: P.icon, iconGap: P.iconGap } : null,
      }];
    } else {
      // ชื่อบรรทัด 1 เบอร์บรรทัด 2
      h = V.twoLine.h;
      const nfit = fitText(measure, name, { maxW: V.rowMaxW, font: V.name.font, minFont: V.name.minFont, maxLines: 1 });
      const pfit = fitText(measure, phone, { maxW: V.rowMaxW - P.icon - P.iconGap, font: P.font, minFont: P.minFont, maxLines: 1 });
      cols = [{
        name: { font: nfit.font, lines: nfit.lines, y: V.twoLine.nameDy, cx: cxBox },
        phone: { font: pfit.font, y: V.twoLine.phoneDy, text: phone, cx: cxBox, w: phoneW(pfit.font), icon: P.icon, iconGap: P.iconGap },
      }];
    }
  } else {
    const maxW = V.colW - 2 * V.colPad;
    const names = teachers.map(t => String(t.display_name ?? '').trim());
    // ฟอนต์เดียวกันทุกคอลัมน์ = ขนาดใหญ่สุดที่ทุกชื่อพอดี
    let nf = V.name.font;
    while (nf > V.name.minFont && names.some(n => measure(n, nf, 700) > maxW)) nf--;
    const needSplit = names.map(n => measure(n, nf, 700) > maxW);
    const twoLine = variant === 3 && V.twoLine && needSplit.some(Boolean);
    if (twoLine) h = V.twoLine.h;
    cols = teachers.map((t, i) => {
      const cx = V.x + V.colXs[i] + V.colW / 2;
      let name;
      if (twoLine && needSplit[i]) name = { font: nf, lines: splitRank(names[i]), y: [...V.twoLine.nameDy], cx };
      else name = { font: nf, lines: [names[i]], y: twoLine ? V.twoLine.singleDy : V.name.dy, cx };
      const P = V.phone;
      const phone = hasPhone(t)
        ? { font: P.font, y: twoLine ? V.twoLine.phoneDy : P.dy, text: String(t.phone).trim(), cx,
          w: P.icon + P.iconGap + measure(String(t.phone).trim(), P.font, 700), icon: P.icon, iconGap: P.iconGap }
        : null;
      return { name, phone };
    });
  }

  const y = DESIGN_H - D.bottom - h;
  for (const c of cols) {
    c.name.y = Array.isArray(c.name.y) ? c.name.y.map(v => y + v) : y + c.name.y;
    if (c.phone) c.phone.y = y + c.phone.y;
  }
  return {
    rect: { x: V.x, y, w: V.w, h },
    variant,
    header: { font: headerFit.font, y: y + V.header.dy, text: headerText },
    cols,
    // เส้นคั่นอยู่กึ่งกลางช่องว่างระหว่างคอลัมน์
    dividers: variant > 1 ? V.colXs.slice(1, variant).map((cx, i) => V.x + (V.colXs[i] + V.colW + cx) / 2) : [],
  };
}

/**
 * @typedef {{x:number,y:number,w:number,h:number}} Rect
 * @typedef {{rect:Rect, font:number, lines:string[]}} TextBox
 * @typedef {Object} Layout
 * @property {Rect} logo
 * @property {TextBox} title
 * @property {TextBox} school
 * @property {TextBox|null} address  null เมื่อโรงเรียนไม่มีที่อยู่ (ไม่วาด pill และไม่เพิ่ม dy)
 * @property {number} dy  ระยะที่ทุกอย่างใต้ป้ายโรงเรียนเลื่อนลง (0 / 26 / 28 / 54)
 * @property {Rect[]} photos  4 ช่องตาม photo_layout
 * @property {({rect:Rect,font:number,text:string,icon:string|null,circle:number}|null)[]} labels
 * @property {{rect:Rect, variant:number, header:{font:number,y:number,text:string},
 *   cols:{name:{font:number,lines:string[],y:number|number[],cx:number},
 *         phone:({font:number,y:number,text:string,cx:number,w:number,icon:number,iconGap:number}|null)}[],
 *   dividers:number[]}} duty
 * @property {string[]} warnings  ปัญหาเรขาคณิตตอนรัน (เช่น รูปเล็กเตี้ยกว่า minSmallH เมื่อ dy มาก) — ว่าง = ปกติ
 */

/** @returns {Layout} */
export function computeLayout(resolved, model, measure) {
  const r = resolved;
  const s = model.school || {};
  let dy = 0;

  const title = fitText(measure, model.title, { maxW: r.title.maxW, font: r.title.font, minFont: r.title.minFont, maxLines: 1 });

  const S = r.school;
  const sf = fitText(measure, s.name_full, { maxW: S.maxW, font: S.font, minFont: S.minFont });
  const sTwo = sf.lines.length > 1;
  const school = { rect: { x: S.x, y: S.y, w: S.w, h: sTwo ? S.twoLineH : S.h }, font: sf.font, lines: sf.lines };
  if (sTwo) dy += S.twoLineDy;

  let address = null;
  const A = r.address;
  if (String(s.address ?? '').trim()) {
    const af = fitText(measure, s.address, { maxW: A.maxW, font: A.font, minFont: A.minFont, weight: 500 });
    const aTwo = af.lines.length > 1;
    const textW = Math.max(...af.lines.map(l => measure(l, af.font, 500)));
    const w = textW + A.pin.w + A.pin.gap + A.padX;
    address = { rect: { x: (DESIGN_W - w) / 2, y: A.y + dy, w, h: aTwo ? A.twoLineH : A.h }, font: af.font, lines: af.lines };
    if (aTwo) dy += A.twoLineDy;
  }

  const { rects: photos, errors: warnings } = photoGeometry(r, dy);
  const items = model.photos || [];
  const labels = photos.map((p, i) => labelFor(measure, r.label, p, items[i], r.photo_layout === '1+3' && i === 0));

  return {
    logo: logoRect(r.logo, model.logoSize),
    title: { rect: { x: r.title.x, y: r.title.y, w: r.title.w, h: r.title.h }, font: title.font, lines: title.lines },
    school,
    address,
    dy,
    photos,
    labels,
    duty: dutyLayout(measure, r.duty, model),
    warnings,
  };
}

// ---------- ตรวจแม่แบบ ----------

const inCanvas = q => q.x >= 0 && q.y >= 0 && q.x + q.w <= DESIGN_W + 1e-6 && q.y + q.h <= DESIGN_H + 1e-6;

export function validateTemplate(r) {
  const errors = [];
  if (!LAYOUTS.includes(r.photo_layout)) errors.push(`photo_layout "${r.photo_layout}" ไม่ถูกต้อง`);
  if (!PROVINCES.includes(r.province)) errors.push(`province "${r.province}" ไม่ถูกต้อง`);
  if (!r.landmark || !r.band) {
    errors.push('ไม่มี landmark/band');
    return { ok: false, errors };
  }

  const rects = { logo: logoRect(r.logo), title: r.title, school: { ...r.school, h: Math.max(r.school.h, r.school.twoLineH || 0) },
    address: { x: (DESIGN_W - r.address.maxW) / 2, y: r.address.y, w: r.address.maxW, h: r.address.h } };

  if (LAYOUTS.includes(r.photo_layout)) {
    // ตรวจทั้งกรณีปกติ (dy 0) และกรณีเลื่อนมากสุด (ชื่อโรงเรียน 2 บรรทัด + ที่อยู่ 2 บรรทัด)
    const maxDy = (r.school.twoLineDy || 0) + (r.address.twoLineDy || 0);
    for (const dy of [0, maxDy]) {
      const g = photoGeometry(r, dy);
      errors.push(...g.errors.map(e => `dy ${dy}: ${e}`));
      g.rects.forEach((q, i) => {
        if (dy === 0) rects[`photo${i}`] = q;
        if (q.y + q.h + r.photos.landmarkGap > r.landmark.y + 1e-6) errors.push(`dy ${dy}: รูป ${i} ทับจุดเด่น (ล่าง ${q.y + q.h})`);
        if (dy !== 0 && !inCanvas(q)) errors.push(`dy ${dy}: photo${i} อยู่นอกภาพ 1024×1536`);
      });
    }
  }

  const D = r.duty;
  for (const [k, V] of Object.entries(D.variants)) {
    const hMax = Math.max(V.h, V.twoLine?.h || 0);
    rects[`duty${k}`] = { x: V.x, y: DESIGN_H - D.bottom - hMax, w: V.w, h: hMax };
  }
  if (DESIGN_H - D.bottom - D.maxH < r.band.top_y - 4) {
    errors.push(`กล่องครูเวรสูงเกินแถบคลื่น (ขอบบน ${DESIGN_H - D.bottom - D.maxH} < band.top_y−4 ${r.band.top_y - 4})`);
  }

  for (const [k, q] of Object.entries(rects)) {
    if (!inCanvas(q)) errors.push(`${k} อยู่นอกภาพ 1024×1536`);
  }
  return { ok: errors.length === 0, errors };
}

export function filterTemplates(templates, province) {
  const list = Array.isArray(templates)
    ? templates
    : (templates.templates || []).map(t => mergeTemplate(templates.common, t));
  return list.filter(t => t.active !== false && t.province === province);
}
