#!/usr/bin/env python3
"""เกลี่ยม่านสว่างช่วงกลางภาพ (โซนที่วางรูป/ข้อความ) ให้ผ่าน check-bg โดยไม่แตะฉากล่างและลายมุมบนสุด
ใช้: python3 tools/veil-bg.py <in.png> <out.png> [strength|auto]"""
import sys
import numpy as np
from PIL import Image

def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)

def veil(src, dst, k=0.45):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    y = np.arange(H, dtype=np.float32) / H
    # ขึ้นจาก 0 ที่ 10% → เต็มที่ 20–54% → จางหายที่ 62% (ก่อนยอดจุดเด่น)
    alpha = k * smooth((y - 0.10) / 0.10) * (1 - smooth((y - 0.54) / 0.08))
    # สีม่าน = สีพื้นกลางภาพเดิมยกสว่างขึ้น (คงโทนธีม)
    mid = a[int(.30 * H):int(.50 * H), int(.3 * W):int(.7 * W)].reshape(-1, 3).mean(axis=0)
    tint = mid + (255 - mid) * 0.75
    out = a * (1 - alpha[:, None, None]) + tint * alpha[:, None, None]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst)



def middle_stats(path):
    """ค่าเฉลี่ย/std ความสว่างโซน 15–59% ที่ 1024×1536 (เหมือน check-bg)"""
    a = np.asarray(Image.open(path).convert('RGB').resize((1024, 1536), Image.LANCZOS)).astype(np.float32)
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    z = L[round(.15 * 1536):round(.59 * 1536)]
    return float(z.mean()), float(z.std())


def auto(src, dst):
    """ม่านอ่อนที่สุดที่ทำให้โซนกลาง mean ≥ 217, std ≤ 13.5 (เผื่อจาก 215/14)"""
    for k in [0.0, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]:
        veil(src, dst, k)
        m, s = middle_stats(dst)
        if m >= 217 and s <= 13.5:
            return k, m, s
    return k, m, s


if __name__ == '__main__':
    if len(sys.argv) > 3 and sys.argv[3] != 'auto':
        veil(sys.argv[1], sys.argv[2], float(sys.argv[3]))
    else:
        print('veil k=%.2f mean=%.1f std=%.1f' % auto(sys.argv[1], sys.argv[2]))
