// โหลดไฟล์ .gs ที่เป็น pure (ไม่เรียก service ของ Apps Script) เข้า vm context ของ Node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadGs(relPath) {
  const code = readFileSync(resolve(root, relPath), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx, { filename: relPath });
  return ctx; // function declaration ระดับบนสุดกลายเป็นคุณสมบัติของ ctx
}
