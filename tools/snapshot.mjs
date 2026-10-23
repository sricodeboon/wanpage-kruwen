// สร้าง site/data/snapshot.json จาก Google Sheet (gviz) — ไม่มีเบอร์โทรครู
// ใช้: SHEET_ID=... node tools/snapshot.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildModel, TABS, tabRowsToObjects } from '../site/js/data.js';
import { parseCSV } from '../site/js/csv.js';

const OUT = fileURLToPath(new URL('../site/data/snapshot.json', import.meta.url));

// pure: ตัด phone ออกจากครูทุกคน และไม่ใส่ phonesMissing (หน้าเว็บคำนวณเองตอนโหลด)
export function toSnapshot(model) {
  const teachersBySchool = {};
  for (const [id, list] of Object.entries(model.teachersBySchool)) {
    teachersBySchool[id] = list.map(({ teacher_id, school_id, display_name }) => ({ teacher_id, school_id, display_name }));
  }
  return {
    schools: model.schools.map((s) => ({ ...s })),
    teachersBySchool,
    labels: model.labels.map((l) => ({ ...l })),
    settings: { ...model.settings },
  };
}

async function fetchTab(sheetId, tab) {
  // headers=1: บอก gviz ว่าแถวหัวมีแถวเดียว (ไม่งั้นอาจรวมแถวคำอธิบาย # เข้าไปในหัว)
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${tab}: HTTP ${res.status}`);
  // คอลัมน์ที่ต้องมี (REQUIRED_COLUMNS ใน data.js) ขาด = โยน error ไม่เขียนทับ snapshot
  return tabRowsToObjects(tab, parseCSV(await res.text()));
}

async function main() {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) { console.log('SHEET_ID ไม่ได้ตั้งค่า — ข้าม (ยังไม่ได้ติดตั้ง Sheet)'); return; }
  const [schools, teachers, photo_labels, settings] = await Promise.all(TABS.map((t) => fetchTab(sheetId, t)));
  const model = buildModel({ schools, teachers, photo_labels, settings });
  if (!model.schools.length) throw new Error('ไม่พบโรงเรียนใน Sheet — ไม่เขียนทับ snapshot');
  if (!Object.values(model.teachersBySchool).flat().length) throw new Error('ไม่พบครูใน Sheet — ไม่เขียนทับ snapshot');
  const text = JSON.stringify(toSnapshot(model), null, 2) + '\n';
  let old = '';
  try { old = await readFile(OUT, 'utf8'); } catch { /* ยังไม่มีไฟล์ */ }
  if (old === text) { console.log('snapshot ไม่เปลี่ยน'); return; }
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, text);
  console.log('เขียน snapshot แล้ว:', model.schools.length, 'โรงเรียน');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
