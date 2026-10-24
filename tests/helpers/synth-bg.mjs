// พื้นหลังสังเคราะห์สำหรับทดสอบเรขาคณิตฉาก v3 (ไม่ใช่ภาพจริง — ภาพจริงมาจาก Gemini/ChatGPT)
// พื้นไล่โทนอ่อนเรียบ + สถานที่ทรงเจดีย์ในคอลัมน์ (side-L/side-R) หรือกลางล่าง (bottom) + แถบคลื่นเข้มล่าง
// intrude: สถานที่ล้ำเข้า gutter กี่ px (หน่วยออกแบบ) · empty: คอลัมน์สถานที่ว่าง (ไว้ทดสอบเกณฑ์ landmark)
import sharp from 'sharp';

const COLS = { 'side-L': 210, 'side-R': 814, bottom: 512 }; // กึ่งกลางสถานที่ (x หน่วยออกแบบ)

export function synthSvg({ scene = 'side-L', intrude = 0, empty = false, p1 = '#3a1566', p2 = '#5a2a9a', gold = '#d9a93a' } = {}) {
  const cx = COLS[scene];
  const top = scene === 'bottom' ? 990 : 470; // ฐานยอดเจดีย์ (ปลายยอดสูงกว่านี้ 60)
  const base = 1380;
  const tiers = [];
  if (!empty) {
    // ฐานกว้าง 300 → ยอดแคบ: ซ้อนชั้นสลับสีทอง/ม่วง ให้ทุกแถวมีขอบ (std ต่อแถว > 3)
    const n = 9, step = (base - top) / n;
    for (let i = 0; i < n; i++) {
      const w = 300 - i * 28, y = base - (i + 1) * step;
      tiers.push(`<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${step + 1}" fill="${i % 2 ? gold : p2}"/>`,
        `<rect x="${cx - w / 2 + 12}" y="${y + step * 0.35}" width="${w - 24}" height="${step * 0.18}" fill="#f6d983" opacity=".8"/>`);
    }
    tiers.push(`<polygon points="${cx - 22},${top} ${cx + 22},${top} ${cx},${top - 60}" fill="${gold}"/>`);
    if (intrude > 0) {
      const x = scene === 'side-L' ? 400 - 30 : 624 - intrude;
      tiers.push(`<rect x="${x}" y="700" width="${intrude + 30}" height="500" fill="${p2}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1fc"/><stop offset="1" stop-color="#ece4f7"/></linearGradient></defs>
<rect width="1024" height="1536" fill="url(#sky)"/>
${tiers.join('\n')}
<path d="M0 1376 C 220 1352 380 1400 560 1380 S 880 1352 1024 1374 L 1024 1536 L 0 1536 Z" fill="${p1}"/>
<path d="M0 1376 C 220 1352 380 1400 560 1380 S 880 1352 1024 1374" fill="none" stroke="${gold}" stroke-width="6"/>
</svg>`;
}

// PNG ขนาด width×(width·1.5) — 1024 สำหรับ check-bg, 1536 สำหรับ golden/ภาพตัวอย่าง
export function synthBg(opts = {}, width = 1024) {
  return sharp(Buffer.from(synthSvg(opts)), { density: 72 * width / 1024 }).resize(width, width * 1.5).png().toBuffer();
}
