#!/usr/bin/env node
// ไอคอนแอปจากภาพ bust ครูวัน (site/assets/brand/kruwan-bust.png) — สเปก docs/design/logo-ux-v1.md A4
//   node tools/make-icons.mjs   (tools/make-brand.py เรียกให้เองหลังสร้างภาพ)
// วาด tools/icon.html ด้วย Playwright Chromium แล้วบีบอัด PNG ด้วย sharp (palette)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(path.join(ROOT, 'tools/icon.html')).href;
const OUT = path.join(ROOT, 'site/icons');
const LIMIT = 60 * 1024;

const ICONS = [
  { file: 'icon-512.png', size: 512, v: 'any' },
  { file: 'icon-192.png', size: 192, v: 'any' },
  { file: 'icon-512-maskable.png', size: 512, v: 'maskable' },
  { file: 'icon-180.png', size: 180, v: 'apple' },
  { file: 'favicon-48.png', size: 48, v: 'fav' },
];

const browser = await chromium.launch();
try {
  for (const ic of ICONS) {
    const ctx = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: ic.size / 512 });
    const page = await ctx.newPage();
    await page.goto(`${PAGE}?v=${ic.v}`);
    await page.locator('.bust').evaluate((img) => img.decode());
    const shot = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
    await ctx.close();
    // palette PNG (≈ pngquant) — ถ้าใหญ่กว่า PNG เต็มสีให้ใช้เต็มสี
    const img = sharp(shot).resize(ic.size, ic.size);
    const pal = await img.clone().png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toBuffer();
    const full = await img.clone().png({ compressionLevel: 9 }).toBuffer();
    const buf = pal.length < full.length ? pal : full;
    fs.writeFileSync(path.join(OUT, ic.file), buf);
    console.log(`site/icons/${ic.file} ${ic.size}² ${(buf.length / 1024).toFixed(0)} KB${buf.length > LIMIT ? '  ⚠ เกิน 60 KB' : ''}`);
  }
} finally {
  await browser.close();
}
