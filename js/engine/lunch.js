// รายงานการประกอบเลี้ยงอาหารกลางวัน — แบบหนังสือรายงาน 1 หน้า (หน่วยออกแบบ 1024×1536 เหมือนวันเพจ)
// โครง: ตรา + หัวเรื่อง + ป้ายวันที่ → ชื่อโรงเรียน → เรียน… → รายการเมนู 2 คอลัมน์ → จึงเรียนมาเพื่อทราบ → รูป 2×2 → แถบติดต่อ
// model.kind === 'assembly' (รายงานหน้าแถว): เรียน… → วันที่ → ข้าฯ … ขอรายงานการ ปบ. ดังนี้ → ข้อ ๑. ๒. … → จึงเรียนมาเพื่อโปรดทราบ
const W = 1024, H = 1536;
const FK = 'Kanit, Tahoma, sans-serif';
const FS = 'Sarabun, Tahoma, sans-serif';
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

export const LUNCH_THEMES = {
  magenta: { name: 'บานเย็น', file: 'assets/lunch/magenta.v1.webp', asm: 'assets/assembly/magenta.v1.webp', bg0: '#FFF6FA', bg1: '#FBE3EF', accent: '#D63384', deep: '#8E1655', ink: '#3B1029', ribbon: ['#E24C9A', '#F07DB6', '#C2257A'], pill: '#FFF4CC' },
  plum:    { name: 'ม่วงทอง', file: 'assets/lunch/plum.v1.webp', asm: 'assets/assembly/plum.v1.webp', bg0: '#FAF6FF', bg1: '#EEE4FA', accent: '#6D3DB8', deep: '#3B1470', ink: '#2A1150', ribbon: ['#7D4BC4', '#A783DB', '#4A1F86'], pill: '#FFF1C7' },
  sky:     { name: 'ฟ้าคราม', file: 'assets/lunch/sky.v1.webp', asm: 'assets/assembly/sky.v1.webp',  bg0: '#F5FAFF', bg1: '#E1EEFB', accent: '#1F6FB5', deep: '#123F6B', ink: '#10283F', ribbon: ['#2F86CF', '#7FB6E6', '#195E9E'], pill: '#FFF3CF' },
  orange:  { name: 'แสดทอง', file: 'assets/lunch/orange.v1.webp', asm: 'assets/assembly/orange.v1.webp',  bg0: '#FFF8F2', bg1: '#FCE9D9', accent: '#D9661F', deep: '#8A3A0B', ink: '#3A1A08', ribbon: ['#E8803A', '#F4B07A', '#C2531A'], pill: '#FFF4D2' },
};

// ระยะจากจุดกึ่งกลางบรรทัดลงไปถึงเส้นฐาน (เท่าของขนาดฟอนต์) — ได้ค่าเท่ากับ textBaseline 'middle' ของ Chrome
const BASELINE = { Kanit: 0.23578, Sarabun: 0.32156 };

const TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export const thaiNum = s => String(s ?? '').replace(/[0-9]/g, d => TH_DIGITS[+d]);

const SEG_W = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
const words = s => (SEG_W ? Array.from(SEG_W.segment(s), x => x.segment) : (s.match(/\S+\s*|\s+/g) || []));
// ตัดเป็นกลุ่มอักษร: สระบน/ล่าง วรรณยุกต์ ไม้หันอากาศ ฯลฯ ต้องติดกับพยัญชนะหน้าเสมอ (เครื่องที่ไม่มี Segmenter จะได้ไม่ลอยแยกบรรทัด)
const clusters = s => String(s).match(/.[ัำ-ฺ็-๎]*/gsu) || [];
function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (let tk of words(String(text || ''))) {
    if (ctx.measureText(line + tk).width <= maxW) { line += tk; continue; }
    if (line.trim()) { out.push(line.trimEnd()); line = ''; tk = tk.trimStart(); }
    if (ctx.measureText(tk).width <= maxW) { line = tk; continue; }
    for (const ch of clusters(tk)) { if (line && ctx.measureText(line + ch).width > maxW) { out.push(line); line = ''; } line += ch; }
  }
  if (line.trim() || !out.length) out.push(line.trimEnd());
  return out;
}
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const dims = img => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
function cover(ctx, img, x, y, w, h, r) {
  const s = dims(img), k = Math.max(w / s.w, h / s.h);
  const sw = Math.min(w / k, s.w), sh = Math.min(h / k, s.h);
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.drawImage(img, (s.w - sw) / 2, Math.max(0, (s.h - sh) * 0.45), sw, sh, x, y, w, h);
  ctx.restore();
}
function shadow(ctx, k, y, blur, color) { ctx.shadowOffsetX = 0; ctx.shadowOffsetY = y * k; ctx.shadowBlur = blur * k; ctx.shadowColor = color; }
function noShadow(ctx) { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function fitFont(ctx, text, maxW, weight, size, min, fam) {
  let f = size; ctx.font = `${weight} ${f}px ${fam}`;
  while (f > min && ctx.measureText(text).width > maxW) { f -= 1; ctx.font = `${weight} ${f}px ${fam}`; }
  return f;
}

function background(ctx, T) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // แถบเฉียงขวา 3 ชั้น (แบบต้นฉบับ PowerPoint แต่บางและมีจังหวะกว่า)
  const band = (pts, color, a) => { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.restore(); };
  band([[W - 250, 0], [W - 160, 0], [W - 40, H], [W - 130, H]], T.ribbon[1], 0.35);
  band([[W - 150, 0], [W, 0], [W, H], [W - 30, H]], T.ribbon[0], 0.95);
  band([[W - 60, 0], [W, 0], [W, H], [W - 5, H]], T.ribbon[2], 1);
  // ขอบซ้ายบาง
  const gl = ctx.createLinearGradient(0, 0, 26, 0); gl.addColorStop(0, T.ribbon[1]); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.globalAlpha = 0.6; ctx.fillRect(0, 0, 26, H); ctx.globalAlpha = 1;
  // ประกายจุดจาง ๆ มุมบนซ้าย
  ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = T.deep;
  for (let x = 30; x < 420; x += 22) for (let y = 24; y < 260; y += 22) if ((x + y) % 44 === 2 || Math.hypot(x, y) < 330) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/**
 * @param model {school:{name_full}, title, dateISO, menu[], message, lunch:{to,line1,line2,email,phone,thaiNum,theme}}
 * @param assets {logo, photos[4]}
 */
export function renderLunch(ctx, model, scale, assets = {}) {
  const L = model.lunch || {};
  const T = LUNCH_THEMES[L.theme] || LUNCH_THEMES.magenta;
  const num = L.thaiNum === false ? (s => String(s ?? '')) : thaiNum;
  const X0 = 64, X1 = W - 176, CW = X1 - X0, CX = (X0 + X1) / 2;
  ctx.save(); ctx.scale(scale, scale);
  // วางตัวอักษรด้วยเส้นฐาน alphabetic + ระยะคงที่ของแต่ละฟอนต์ (วัดจาก Chrome)
  // ไม่ใช้ textBaseline 'middle' ตรง ๆ เพราะ Safari (iPhone) คิดจุดกึ่งกลางจากค่าในไฟล์ฟอนต์คนละชุด → ตัวอักษรเลื่อนขึ้น/ลง
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const dy = () => { const f = /(\d+(?:\.\d+)?)px\s*['"]?(\w+)/.exec(ctx.font); return f ? +f[1] * (BASELINE[f[2]] ?? 0.3) : 0; };
  const fill = (t, x, y) => ctx.fillText(t, x, y + dy());
  const stroke = (t, x, y) => ctx.strokeText(t, x, y + dy());
  if (assets.bg) { const d = dims(assets.bg); ctx.drawImage(assets.bg, 0, 0, d.w, d.h, 0, 0, W, H); }
  else background(ctx, T);

  // ---- ส่วนหัว ----
  const logo = assets.logo;
  const LS = 178;
  if (logo) {
    const d = dims(logo), k = Math.min(LS / d.w, LS / d.h);
    shadow(ctx, scale, 6, 14, 'rgba(0,0,0,.25)');
    ctx.drawImage(logo, X0 - 6 + (LS - d.w * k) / 2, 40 + (LS - d.h * k) / 2, d.w * k, d.h * k);
    noShadow(ctx);
  }
  // มีภาพพื้นหลัง: มุมขวาบน (x > ~720, y < ~230) เป็นกองอาหาร → หัวเรื่องและป้ายวันที่ต้องจบก่อน
  const HR = assets.bg ? 680 : X1;
  const hx = logo ? X0 + LS + 18 : X0, hw = HR - hx;
  const asm = model.kind === 'assembly';
  const title = model.title || (asm ? 'รายงานการประชุมหน้าแถว' : 'รายงานการประกอบเลี้ยงอาหารกลางวัน');
  ctx.fillStyle = T.deep; ctx.textAlign = logo ? 'left' : 'center';
  const tx = logo ? hx : (X0 + HR) / 2;
  let tf = fitFont(ctx, title, hw, 700, 44, 30, FK);
  let tLines = [title];
  if (ctx.measureText(title).width > hw) { tf = 40; ctx.font = `700 ${tf}px ${FK}`; tLines = wrap(ctx, title, hw).slice(0, 2); }
  const tlh = tf * 1.22, ty0 = tLines.length > 1 ? 66 : 92;
  const halo = (txt, x, yy) => { if (assets.bg) { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,.85)'; stroke(txt, x, yy); ctx.restore(); } fill(txt, x, yy); };
  tLines.forEach((ln, i) => halo(ln, tx, ty0 + i * tlh));
  // ป้ายวันที่
  const [y, m, dd] = String(model.dateISO).split('-').map(Number);
  const dateText = num(`วันที่ ${dd} ${MONTHS[m - 1]} ${y + 543}`);
  ctx.font = `700 32px ${FK}`;
  const pw = ctx.measureText(dateText).width + 64, ph = 64, px = (logo ? hx : HR - (ctx.measureText(dateText).width + 64)), py = tLines.length > 1 ? 150 : 132;
  shadow(ctx, scale, 6, 14, 'rgba(0,0,0,.18)');
  rr(ctx, px, py, pw, ph, ph / 2);
  const pg = ctx.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, T.accent); pg.addColorStop(1, T.deep);
  ctx.fillStyle = pg; ctx.fill(); noShadow(ctx);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.55)'; rr(ctx, px + 4, py + 4, pw - 8, ph - 8, (ph - 8) / 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; fill(dateText, px + pw / 2, py + ph / 2 + 1);


  // ---- ชื่อโรงเรียน ----
  const school = num(model.school?.name_full || '');
  // พื้นหลังหน้าแถว: ธงชาติอยู่มุมขวาบน (x > ~770) → ชื่อโรงเรียนต้องจบก่อนธง
  const SR = asm && assets.bg ? 760 : X1;
  fitFont(ctx, school, SR - X0, 700, 46, 20, FK);
  ctx.fillStyle = T.ink; halo(school, (X0 + SR) / 2, 268);
  const lg = ctx.createLinearGradient(X0, 0, X1, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(.5, T.accent); lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg; ctx.fillRect(X0 + 40, 306, CW - 80, 3);

  // ---- ตัวหนังสือรายงาน (ย่ออัตโนมัติให้เหลือที่สำหรับรูป) ----
  const items = ((asm ? model.items : model.menu) || []).map(s => String(s ?? '').trim()).filter(Boolean);
  const hasFoot = !!(String(L.email || '').trim() || String(L.phone || '').trim());
  // มีภาพพื้นหลัง: อาหารวาดไว้ที่ขอบล่าง ~15% → จบเนื้อหาที่ y 1306 ให้อาหารโผล่เป็นกรอบล่าง
  const limit = assets.bg ? 1306 : H - 40;
  const footTop = hasFoot ? limit - 72 : limit;
  const IND = 44, MENU_X = X0 + 110;
  let menuTop = 0, menuBot = 0;
  function body(s, draw) {
    const fs = Math.round(29 * s), lh = Math.round(fs * 1.5);
    let yy = 340;
    const put = (text, x, w, { bold = false, color = T.ink } = {}) => {
      ctx.font = `${bold ? 600 : 400} ${fs}px ${FS}`;
      const lines = wrap(ctx, text, w);
      if (draw) { ctx.fillStyle = color; ctx.textAlign = 'left'; lines.forEach((ln, i) => fill(ln, x, yy + lh * i + lh / 2)); }
      yy += lines.length * lh;
    };
    // เรียน …
    ctx.font = `600 ${fs}px ${FS}`;
    const lw = ctx.measureText('เรียน').width + 14;
    if (draw) { ctx.fillStyle = T.deep; ctx.textAlign = 'left'; fill('เรียน', X0, yy + lh / 2); }
    put(num(L.to || 'ผู้บังคับบัญชา'), X0 + lw, CW - lw);
    if (asm) return asmBody(fs, lh, put, () => yy, v => { yy = v; }, draw);
    if (L.line1) put(num(L.line1), X0 + IND, CW - IND);
    if (L.line2) put(num(L.line2), X0, CW);
    yy += Math.round(lh * 0.3);
    put(num(L.intro || 'รายงานการประกอบเลี้ยงอาหารกลางวันนักเรียน ดังนี้'), X0 + IND, CW - IND);
    // เมนู 2 คอลัมน์ (เรียงแถว: ๑ ๒ / ๓ ๔ แบบต้นฉบับ)
    const colW = (X1 - MENU_X) / 2;
    menuTop = yy;
    ctx.font = `500 ${fs}px ${FS}`;
    for (let i = 0; i < items.length; i += 2) {
      let rowH = lh;
      [0, 1].forEach(c => {
        const it = items[i + c]; if (!it) return;
        const label = num(`${i + c + 1}.`);
        const x = MENU_X + c * colW, tw = ctx.measureText(label).width + 12;
        const lines = wrap(ctx, num(it), colW - tw - 16);
        if (draw) {
          ctx.fillStyle = T.accent; ctx.font = `600 ${fs}px ${FS}`; fill(label, x, yy + lh / 2);
          ctx.fillStyle = T.ink; ctx.font = `500 ${fs}px ${FS}`; lines.forEach((ln, k) => fill(ln, x + tw, yy + lh * k + lh / 2));
        }
        rowH = Math.max(rowH, lines.length * lh);
      });
      yy += rowH;
    }
    if (!items.length) { if (draw) { ctx.fillStyle = T.accent; ctx.font = `400 ${fs}px ${FS}`; fill('(ยังไม่ได้ใส่เมนู)', MENU_X, yy + lh / 2); } yy += lh; }
    if (String(model.message || '').trim()) { yy += Math.round(lh * 0.15); put(num(model.message.trim()), X0 + IND, CW - IND); }
    menuBot = yy;
    ctx.font = `400 ${fs}px ${FS}`;
    put('จึงเรียนมาเพื่อทราบ', X0 + IND * 2, CW - IND * 2);
    return yy;
  }
  // หน้าแถว: วันที่ → ข้าฯ … → ข้อรายงาน (เลขห้อยหน้า) → จึงเรียนมาเพื่อโปรดทราบ
  function asmBody(fs, lh, put, getY, setY, draw) {
    put(num(`วันที่ ${dd} ${MONTHS[m - 1]} ${y + 543}`), X0 + IND * 2, CW - IND * 2);
    setY(getY() + Math.round(lh * 0.2));
    const who = String(L.reporter || '').trim();
    put(num(`ข้าฯ ${who} ${String(L.intro || 'ขอรายงานการ ปบ. ดังนี้').trim()}`.replace(/\s+/g, ' ')), X0 + IND, CW - IND);
    menuTop = getY();
    ctx.font = `500 ${fs}px ${FS}`;
    items.forEach((it, i) => {
      const label = num(`${i + 1}.`), x = X0 + IND, tw = ctx.measureText(num('10.')).width + 14;
      const lines = wrap(ctx, num(it), CW - IND - tw);
      if (draw) {
        ctx.textAlign = 'left';
        ctx.fillStyle = T.accent; ctx.font = `600 ${fs}px ${FS}`; fill(label, x, getY() + lh / 2);
        ctx.fillStyle = T.ink; ctx.font = `500 ${fs}px ${FS}`; lines.forEach((ln, k) => fill(ln, x + tw, getY() + lh * k + lh / 2));
      }
      setY(getY() + lines.length * lh + Math.round(lh * 0.1));
    });
    if (!items.length) { if (draw) { ctx.fillStyle = T.accent; ctx.font = `400 ${fs}px ${FS}`; fill('(ยังไม่ได้ใส่รายการ)', X0 + IND, getY() + lh / 2); } setY(getY() + lh); }
    if (String(model.message || '').trim()) put(num(model.message.trim()), X0 + IND, CW - IND);
    menuBot = getY();
    ctx.font = `400 ${fs}px ${FS}`;
    put('จึงเรียนมาเพื่อโปรดทราบ', X0 + IND * 2, CW - IND * 2);
    return getY();
  }
  let s = 1, end = body(s, false);
  const minPhotos = assets.bg ? 520 : 600;
  while (s > 0.72 && footTop - 24 - (end + 22) < minPhotos) { s -= 0.03; end = body(s, false); }
  // พื้นขาวโปร่งรองข้อความหนังสือ
  shadow(ctx, scale, 4, 16, 'rgba(0,0,0,.08)');
  rr(ctx, X0 - 22, 322, CW + 44, end - 322 + 16, 24);
  ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.fill(); noShadow(ctx);
  ctx.lineWidth = 1.5; ctx.strokeStyle = T.ribbon[1]; ctx.globalAlpha = .6; rr(ctx, X0 - 22, 322, CW + 44, end - 322 + 16, 24); ctx.stroke(); ctx.globalAlpha = 1;
  end = body(s, true) + 16;

  // ---- รูป 2×2 ----
  const top = end + 24, bottom = footTop - 24, gap = 22;
  const ph2 = (bottom - top - gap) / 2, pw2 = (CW - gap) / 2;
  const photos = assets.photos || [];
  const photoR = [];
  for (let i = 0; i < 4; i++) {
    const x = X0 + (i % 2) * (pw2 + gap), yy = top + Math.floor(i / 2) * (ph2 + gap);
    photoR.push({ x, y: yy, w: pw2, h: ph2 });
    if (ph2 < 40) break;
    shadow(ctx, scale, 10, 22, 'rgba(0,0,0,.22)');
    rr(ctx, x, yy, pw2, ph2, 18); ctx.fillStyle = '#fff'; ctx.fill(); noShadow(ctx);
    const b = 8;
    if (photos[i]) cover(ctx, photos[i], x + b, yy + b, pw2 - 2 * b, ph2 - 2 * b, 12);
    else { rr(ctx, x + b, yy + b, pw2 - 2 * b, ph2 - 2 * b, 12); ctx.fillStyle = T.bg1; ctx.fill(); }
  }

  // ---- แถบติดต่อ ----
  let footR = null;
  if (hasFoot) {
    const parts = [];
    if (String(L.email || '').trim()) parts.push(['อีเมล : ', String(L.email).trim()]);
    if (String(L.phone || '').trim()) parts.push(['โทร : ', num(String(L.phone).trim())]);
    const fs = 27; ctx.font = `500 ${fs}px ${FK}`;
    const gapP = 56;
    const widths = parts.map(([a, b]) => ctx.measureText(a + b).width);
    const tw = widths.reduce((p, c) => p + c, 0) + gapP * (parts.length - 1);
    const fw = Math.min(CW + 40, tw + 90), fh = 66, fx = (X0 + X1) / 2 - fw / 2, fy = footTop + 10;
    footR = { x: fx, y: fy, w: fw, h: fh };
    shadow(ctx, scale, 6, 14, 'rgba(0,0,0,.15)');
    rr(ctx, fx, fy, fw, fh, fh / 2); ctx.fillStyle = T.pill; ctx.fill(); noShadow(ctx);
    ctx.lineWidth = 2.5; ctx.strokeStyle = T.accent; rr(ctx, fx, fy, fw, fh, fh / 2); ctx.stroke();
    let x = fx + (fw - tw) / 2; ctx.textAlign = 'left';
    parts.forEach(([a, b], i) => {
      ctx.fillStyle = T.deep; ctx.font = `700 ${fs}px ${FK}`; fill(a, x, fy + fh / 2 + 1);
      const aw = ctx.measureText(a).width;
      ctx.fillStyle = T.accent; ctx.font = `500 ${fs}px ${FK}`; fill(b, x + aw, fy + fh / 2 + 1);
      x += widths[i] + gapP;
    });
  }
  ctx.restore();
  // ตำแหน่งแต่ละส่วน (หน่วยออกแบบ 1024×1536) ให้หน้าเว็บวางจุดแตะแก้ไข
  return {
    logo: { x: X0 - 6, y: 40, w: LS, h: LS },
    title: { x: logo ? hx : X0, y: ty0 - tlh / 2 - 6, w: hw, h: tlh * tLines.length + 8 },
    date: { x: px, y: py, w: pw, h: ph },
    school: { x: X0, y: 240, w: CW, h: 58 },
    memo: { x: X0 - 22, y: 322, w: CW + 44, h: end - 322 },
    menu: asm ? { x: X0 + IND - 16, y: menuTop - 4, w: X1 - X0 - IND + 16, h: menuBot - menuTop + 8 } : { x: MENU_X - 16, y: menuTop - 4, w: X1 - MENU_X + 16, h: menuBot - menuTop + 8 },
    photos: photoR,
    foot: footR,
  };
}
