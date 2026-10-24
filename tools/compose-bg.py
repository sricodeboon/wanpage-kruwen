#!/usr/bin/env python3
"""ประกอบพื้นหลังวันเพจจากชิ้นส่วน — เลย์เอาต์คุมด้วยโค้ด ไม่ต้องพึ่ง AI วางตำแหน่ง
  ส่วนบน   : ลายมุมจากภาพต้นแบบ (donor) ตัดช่วงบนแล้วไล่จางลงพื้น
  ส่วนกลาง : พื้นไล่สีเรียบ (ที่วางรูป/ข้อความ)
  ส่วนล่าง : ฉากสถานที่จริง (ภาพกว้าง) — เลื่อนลงอัตโนมัติจนยอดจุดเด่น ≥ y 905
  มาสคอต   : ครู ตชด. ชาย/หญิง + นักเรียน ซ้าย-ขวา (assets/mascots/cut)
  แถบล่าง  : คลื่นสีเข้ม + ริบบิ้นทอง (วาดด้วยโค้ด)
ใช้: python3 tools/compose-bg.py assets/backgrounds/compose.json [id ...]
ผล: assets/backgrounds/out/<id>.png (2048×3072 = 2× หน่วยออกแบบ)"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 2                     # สเกลเรนเดอร์ (หน่วยออกแบบ 1024×1536)
W, H = 1024 * S, 1536 * S
LANDMARK_MIN = 905        # ยอดจุดเด่นต้องไม่สูงกว่านี้ (check-bg ต้องการ ≥ 895)
MASCOT_DIR = os.path.join(ROOT, 'assets/mascots/cut')


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def object_top(arr, x0, x1, thr=3.0, start=0):
    """แถวแรกที่มีวัตถุ (วิธีเดียวกับ check-bg: ลบค่าเฉลี่ยเลื่อน ±K แล้ววัด std)"""
    L = lum(arr.astype(np.float32))
    K = 20 * S
    for y in range(start, L.shape[0]):
        row = L[y]
        c = np.concatenate([[0], np.cumsum(row)])
        xs = np.arange(x0, x1)
        a = np.maximum(0, xs - K); b = np.minimum(len(row), xs + K + 1)
        d = row[xs] - (c[b] - c[a]) / (b - a)
        if math.sqrt(float((d * d).mean())) > thr:
            return y
    return None


def load_rgb(p, size=None):
    im = Image.open(os.path.join(ROOT, p)).convert('RGB')
    if size:
        im = im.resize(size, Image.LANCZOS)
    return im


def compose(t, defaults):
    cfg = {**defaults, **t}
    canvas = np.zeros((H, W, 3), np.float32)
    light = hexrgb(cfg['light'])

    # ---- ฉาก: ย่อ/ขยายให้กว้างเต็ม (หรือ scene_scale) วางก้นที่ scene_bottom ----
    sc = load_rgb(cfg['scene'])
    if 'scene_crop' in cfg:  # [l,t,r,b] สัดส่วน
        l, tp, r, b = cfg['scene_crop']
        sc = sc.crop((int(l * sc.width), int(tp * sc.height), int(r * sc.width), int(b * sc.height)))
    sw = int(W * cfg.get('scene_scale', 1.0))
    sh = int(sc.height * sw / sc.width)
    sc = sc.resize((sw, sh), Image.LANCZOS)
    sa = np.asarray(sc).astype(np.float32)
    sx = (W - sw) // 2 + int(cfg.get('scene_dx', 0) * S)
    # ยอดจุดเด่นในฉาก (กรอบ x 230–800 ของหน้า)
    cx0 = max(0, 230 * S - sx); cx1 = min(sw, 800 * S - sx)
    lt = object_top(sa, cx0, cx1, start=int(sh * 0.02))
    lt = lt if lt is not None else 0
    lt = max(0, lt - int(cfg.get('landmark_pad', 0) * S))
    # สีท้องฟ้าของฉาก (แถวบนสุด) ไว้ไล่สีพื้นให้ต่อเนียน
    sky = sa[:max(4, int(lt * 0.5) or 4)].reshape(-1, 3).mean(axis=0)
    dark = float(lum(sky)) < 150
    lmin = cfg.get('landmark_min', 1000 if dark else LANDMARK_MIN) * S
    sy = cfg['scene_bottom'] * S - sh
    if sy + lt < lmin:
        sy = lmin - lt
    # ช่วงไล่จางของฉาก (พิกัดหน้า): เริ่มไม่สูงกว่า y 870 เพื่อให้โซนกลางสว่างเรียบ จบเหนือยอดจุดเด่นเล็กน้อย
    fs = max(sy, 870 * S)
    fe = max(fs + (120 if dark else 30) * S, sy + lt - 4 * S)

    # ---- พื้นไล่สี: บน (สีจาก donor) → light → (ช่วงจางของฉาก) sky ----
    top_c = light
    donor = None
    if cfg.get('donor'):
        donor = np.asarray(load_rgb(cfg['donor'], (W, H))).astype(np.float32)
        fy = int(cfg['donor_fade'][1] * H)
        top_c = donor[fy - 6 * S:fy, :].reshape(-1, 3).mean(axis=0)
    ys = np.arange(H, dtype=np.float32)[:, None]
    y_a = cfg['donor_fade'][1] * H if donor is not None else 0
    y_b = 620 * S
    g = np.empty((H, 3), np.float32)
    for i in range(3):
        g[:, i] = np.interp(np.arange(H), [0, y_a, y_b, fs, fe, H], [top_c[i], top_c[i], light[i], light[i], sky[i], sky[i]])
    canvas[:] = g[:, None, :]

    # ---- ส่วนบนจาก donor ไล่จาง ----
    if donor is not None:
        f0, f1 = cfg['donor_fade'][0] * H, cfg['donor_fade'][1] * H
        a = 1 - smooth((ys - f0) / (f1 - f0))
        canvas = donor * a[..., None] + canvas * (1 - a[..., None])

    # ---- วางฉาก ไล่จางช่วง fs→fe ----
    a = smooth((np.arange(sh, dtype=np.float32) + sy - fs) / (fe - fs))[:, None]
    if sw < W:
        xr = np.arange(sw, dtype=np.float32)
        e = 40 * S
        a = a * smooth(np.minimum(xr, sw - 1 - xr) / e)[None, :]
    y0, y1 = max(0, sy), min(H, sy + sh)
    x0, x1 = max(0, sx), min(W, sx + sw)
    part = sa[y0 - sy:y1 - sy, x0 - sx:x1 - sx]
    aa = np.broadcast_to(a, (sh, sw))[y0 - sy:y1 - sy, x0 - sx:x1 - sx][..., None]
    canvas[y0:y1, x0:x1] = part * aa + canvas[y0:y1, x0:x1] * (1 - aa)
    img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).convert('RGBA')

    # ---- มาสคอต ----
    draw_mascots(img, cfg)
    # ---- แถบคลื่นล่าง ----
    draw_band(img, cfg)
    return img.convert('RGB'), (sy + lt) / S


def draw_mascots(img, cfg):
    m = cfg.get('mascots', 'default')
    if m == 'none':
        return
    pairs = {'default': (['teacher-m', 'student-f'], ['teacher-f', 'student-m']),
             'swap': (['teacher-f', 'student-m'], ['teacher-m', 'student-f'])}[m]
    foot = cfg.get('mascot_foot', 1398) * S
    hts = {'teacher-m': 232, 'teacher-f': 228, 'student-m': 192, 'student-f': 190}
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    placed = []
    for side, names in zip(('L', 'R'), pairs):
        ims = []
        for n in names:
            im = Image.open(os.path.join(MASCOT_DIR, n + '.png'))
            h = hts[n] * S
            ims.append(im.resize((int(im.width * h / im.height), h), Image.LANCZOS))
        if side == 'R':
            ims = ims[::-1]
        total = sum(i.width for i in ims) - 14 * S
        x = (16 * S) if side == 'L' else (W - 16 * S - total)
        for k, im in enumerate(ims):
            # ครูยืนหลังนักเรียนเล็กน้อย (เท้าสูงกว่า 6)
            dy = -6 * S if im.height > 200 * S else 0
            placed.append((im, x, foot + dy - im.height))
            sd.ellipse((x + im.width * 0.12, foot + dy - 7 * S, x + im.width * 0.88, foot + dy + 7 * S), fill=(20, 10, 40, 70))
            x += im.width - 14 * S
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(5 * S)))
    # วาดครูก่อน (อยู่หลัง)
    for im, x, y in sorted(placed, key=lambda p: -p[0].height):
        img.alpha_composite(im, (int(x), int(y)))


def wave(x, base, amp, phase, k=1.0):
    return base + amp * np.sin(2 * math.pi * (x / W) * k + phase)


def draw_band(img, cfg):
    d1, d2, gold = cfg['dark'], cfg.get('dark2', cfg['dark']), cfg.get('gold', '#d9a93a')
    c1, c2, cg = (tuple(hexrgb(c).astype(int)) for c in (d1, d2, gold))
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(lay)
    xs = np.linspace(0, W, 240)
    # คลื่นหลัง (สีรอง โปร่งเล็กน้อย) สูงทางขวา
    back = wave(xs, 1404 * S, 20 * S, 3.6, 1.0)
    dr.polygon([(0, H)] + list(zip(xs, back)) + [(W, H)], fill=c2 + (225,))
    # ริบบิ้นทองเส้นบาง ลอยเหนือคลื่นหน้า
    rib = wave(xs, 1426 * S, 22 * S, 0.9, 0.85)
    dr.line(list(zip(xs, rib - 9 * S)), fill=cg + (150,), width=2 * S, joint='curve')
    # คลื่นหน้า (เข้มสุด) ขอบทองหนา
    front = rib
    dr.polygon([(0, H)] + list(zip(xs, front)) + [(W, H)], fill=c1 + (255,))
    dr.line(list(zip(xs, front)), fill=cg + (255,), width=5 * S, joint='curve')
    dr.line(list(zip(xs, front - 1.5 * S)), fill=(255, 238, 180, 190), width=1 * S, joint='curve')
    img.alpha_composite(lay)


def main():
    spec = json.load(open(sys.argv[1]))
    only = set(sys.argv[2:])
    out = os.path.join(ROOT, 'assets/backgrounds/out')
    os.makedirs(out, exist_ok=True)
    for t in spec['templates']:
        if only and t['id'] not in only:
            continue
        if not t.get('scene') or not os.path.exists(os.path.join(ROOT, t['scene'])):
            print(t['id'], 'ข้าม (ยังไม่มีฉาก)')
            continue
        img, top = compose(t, spec['defaults'])
        p = os.path.join(out, t['id'] + '.png')
        img.save(p)
        print(t['id'], f'ยอดจุดเด่น ≈ {top:.0f}', p)


if __name__ == '__main__':
    main()
