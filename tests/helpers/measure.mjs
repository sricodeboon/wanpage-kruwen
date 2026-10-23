// ตัวแทน ctx.measureText ใน Node: กว้าง = จำนวนตัวอักษร × 0.55 × ขนาดฟอนต์
export const measure = (text, font) => String(text).length * 0.55 * font;
