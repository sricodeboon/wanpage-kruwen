// QR encoder เขียนเอง: โหมดไบต์ (UTF-8) ECC ระดับ M เวอร์ชัน 1–6 (ลิงก์โรงเรียนยาวไม่เกิน 106 ไบต์)
// ไม่มี dependency; อ้างอิงอัลกอริทึมมาตรฐาน ISO/IEC 18004
// [version-1] = [ข้อมูล codeword ต่อบล็อก, EC codeword ต่อบล็อก, จำนวนบล็อก]
const M_TABLE = [[16, 10, 1], [28, 16, 1], [44, 26, 1], [32, 18, 2], [43, 24, 2], [27, 16, 4]];
const ALIGN = [null, 18, 22, 26, 30, 34]; // จุดกลาง alignment pattern (v2+)

export function pickVersion(byteLen) {
  for (let v = 1; v <= 6; v++) {
    const [d, , b] = M_TABLE[v - 1];
    if (byteLen + 2 <= d * b) return v; // 4 บิตโหมด + 8 บิตความยาว = 12 บิต ~ 2 ไบต์ (ปัดขึ้นปลอดภัย)
  }
  return null;
}

// ---- Reed-Solomon บน GF(256) พหุนาม 0x11D ----
const EXP = new Array(512), LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsRemainder(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= gmul(c, EXP[i]); });
    gen = next;
  }
  const rem = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < n; i++) rem[i] ^= gmul(gen[i + 1], f);
  }
  return rem;
}

function buildCodewords(bytes, v) {
  const [dPer, ePer, nb] = M_TABLE[v - 1];
  const cap = dPer * nb;
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, 8);
  bytes.forEach((b) => put(b, 8));
  for (let i = 0; i < 4 && bits.length < cap * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0xec; data.length < cap; p ^= 0xec ^ 0x11) data.push(p);
  const blocks = [];
  for (let i = 0; i < nb; i++) blocks.push(data.slice(i * dPer, (i + 1) * dPer));
  const ecs = blocks.map((b) => rsRemainder(b, ePer));
  const out = [];
  for (let i = 0; i < dPer; i++) blocks.forEach((b) => out.push(b[i]));
  for (let i = 0; i < ePer; i++) ecs.forEach((e) => out.push(e[i]));
  return out;
}

function baseMatrix(v) {
  const n = 4 * v + 17;
  const mod = Array.from({ length: n }, () => new Array(n).fill(0));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (x, y, d) => { if (x >= 0 && y >= 0 && x < n && y < n) { mod[y][x] = d ? 1 : 0; fn[y][x] = true; } };
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 4 && d !== 2);
    }
  };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  for (let i = 8; i < n - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
  if (v > 1) {
    const c = ALIGN[v - 1];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  return { n, mod, fn, set };
}

function setFormat(b, mask) {
  const { n, set } = b;
  let rem = mask; // ECC M = 00
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((mask << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
  set(8, n - 8, true);
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function penalty(m) {
  const n = m.length;
  let p = 0;
  const lines = [];
  for (let i = 0; i < n; i++) lines.push(m[i], m.map((r) => r[i]));
  for (const l of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && l[i] === l[i - 1]) run++;
      else { if (run >= 5) p += run - 2; run = 1; }
    }
    const s = l.join('');
    for (const pat of ['10111010000', '00001011101']) for (let i = s.indexOf(pat); i >= 0; i = s.indexOf(pat, i + 1)) p += 40;
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  }
  const dark = m.flat().reduce((a, c) => a + c, 0);
  p += Math.floor(Math.abs((dark * 20) / (n * n) - 10)) * 10;
  return p;
}

/** @returns {number[][]} เมทริกซ์ [y][x] ค่า 1 = โมดูลดำ */
export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const v = pickVersion(bytes.length);
  if (!v) throw new Error('QR: ข้อความยาวเกินไป');
  const cw = buildCodewords(bytes, v);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const b = baseMatrix(v);
    const { n, mod, fn } = b;
    const bitsAll = [];
    cw.forEach((c) => { for (let i = 7; i >= 0; i--) bitsAll.push((c >>> i) & 1); });
    // เติมบิตเศษ (v2–6 = 7 บิต) เป็น 0 โดยปริยายเมื่อหมดข้อมูล
    setFormat(b, mask); // จอง format area ก่อนวางข้อมูล
    let k = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let j = 0; j < n; j++) {
        for (let c = 0; c < 2; c++) {
          const x = right - c;
          const y = ((right + 1) & 2) === 0 ? n - 1 - j : j;
          if (fn[y][x]) continue;
          const bit = k < bitsAll.length ? bitsAll[k++] : 0;
          mod[y][x] = bit ^ (MASKS[mask](x, y) ? 1 : 0);
        }
      }
    }
    const pen = penalty(mod);
    if (!best || pen < best.pen) best = { pen, mod };
  }
  return best.mod;
}

/** วาด QR ลง canvas (ขอบเงียบ 4 โมดูล) */
export function drawQR(canvas, text, px = 8) {
  const m = qrMatrix(text);
  const size = (m.length + 8) * px;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  m.forEach((row, y) => row.forEach((d, x) => { if (d) ctx.fillRect((x + 4) * px, (y + 4) * px, px, px); }));
  return canvas;
}
