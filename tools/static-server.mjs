#!/usr/bin/env node
// เซิร์ฟเวอร์ static สำหรับ dev/e2e — แทน python http.server (คิวรับการเชื่อมต่อแค่ 5 → ERR_CONNECTION_RESET เมื่อเบราว์เซอร์โหลดโมดูลพร้อมกัน)
// ใช้: node tools/static-server.mjs [dir=site] [port=8080] [host=127.0.0.1]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [dirArg = 'site', portArg = '8080', host = '127.0.0.1'] = process.argv.slice(2);
const ROOT = path.resolve(dirArg);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
  let f = path.join(ROOT, path.normalize(p));
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(f).pipe(res);
});
server.listen(Number(portArg), host, 511, () => console.log(`serving ${ROOT} at http://${host}:${portArg}/`));
