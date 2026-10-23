// CSV แบบ RFC4180 อย่างง่าย: ช่องมีเครื่องหมายคำพูด, "" = ", CRLF/LF, ตัด BOM

export function parseCSV(text) {
  let s = String(text ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  let any = false; // มีข้อมูลในแถวปัจจุบันหรือไม่ (กันแถวว่างท้ายไฟล์)
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQ = true; any = true; }
    else if (c === ',') { row.push(field); field = ''; any = true; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      if (any || field !== '') { row.push(field); rows.push(row); }
      row = []; field = ''; any = false;
    } else { field += c; any = true; }
  }
  if (any || field !== '') { row.push(field); rows.push(row); }
  return rows;
}

// แถว 1 = หัว; ข้ามแถวที่ช่องแรกขึ้นต้น # (คำอธิบาย); อ้างตามชื่อหัว
export function rowsToObjects(rows) {
  if (!rows || !rows.length) return [];
  const head = rows[0].map((h) => String(h).trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (String(row[0] ?? '').trimStart().startsWith('#')) continue;
    if (row.every((v) => String(v).trim() === '')) continue;
    const o = {};
    head.forEach((h, i) => { if (h) o[h] = row[i] ?? ''; });
    out.push(o);
  }
  return out;
}

export function parseBool(v) {
  return ['true', '1', 'ใช่'].includes(String(v ?? '').trim().toLowerCase());
}

export function normalizePhone(s) {
  let t = String(s ?? '').trim();
  // คอลัมน์ไม่ได้ตั้งเป็นข้อความ → Sheet ตัด 0 หน้าเบอร์มือถือ (0812345678 → 812345678): เติมคืน
  if (/^[689]\d{8}$/.test(t)) t = '0' + t;
  return /^\d{10}$/.test(t) ? `${t.slice(0, 3)}-${t.slice(3, 6)}-${t.slice(6)}` : t;
}
