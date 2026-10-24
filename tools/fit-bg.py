#!/usr/bin/env python3
"""ปรับโปสเตอร์ AI ทั้งแผ่นให้ผ่าน check-bg
ไม่ระบุ --scene = ทางเดิมของชุด v2 (ผลเหมือนเดิมทุกบิต):
  1) ถ้ายอดจุดเด่นสูงเกิน (< 905 หน่วยออกแบบ): ยืดท้องฟ้าช่วงกลาง (shift_down) แล้วแปะแถบคลื่นล่างเดิมทับ
  2) หรี่แถบล่าง + เกลี่ยม่านสว่างโซนกลาง (veil-bg.auto)
ระบุ --scene (ชุด v3) = นโยบายซ่อมภาพอัตโนมัติ docs/design/templates-v3.md §8 — เกณฑ์ QA §2.1 ไม่ผ่อน:
  (0) ล้างเขียว → (1) ย่อฉาก uniform → (2) เลื่อนเฉพาะฉาก → (3) feather/เติมฟ้า/ม่านโซนตรา → (4) หรี่คลื่น → (5) veil เดิม
  side-L/side-R: ย่อฉากในคอลัมน์ยึดมุมล่างฝั่งขอบ (s ≥ 0.70) + เลื่อนฉาก ≤ 40 ให้ขอบแข็งของสถานที่ ≤ x 352 (L)
                 แล้วม่านพื้นสว่างสังเคราะห์ (หมอกขอบโค้ง x ≈ 331±9→400) · ซ่อมไม่ได้ → exit 1 ไม่บันทึกผล (ควรสร้างใหม่)
  bottom: ย่อแถบฉากเต็มกว้างยึดกลางล่าง (s ≥ 0.68) ช่องข้าง mirror · ยืดฟ้าเดิมเฉพาะขาด ≤ 24 · ไม่ผ่าน → exit 1
ใช้: python3 tools/fit-bg.py <in.png> <out.png> [--scene bottom|side-L|side-R] [--max-scale 0.8]"""
import importlib.util, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
veil = _load('veil_bg', 'veil-bg.py')
comp = _load('compose_bg', 'compose-bg.py')

TARGET = 908

# ---- ฉาก side: กรอบหน่วยออกแบบ (ตรงกับ tools/check-bg.mjs TS/SIDES) ----
SIDES = {'side-L': dict(photo=(424, 978), gutter=(400, 470), column=(0, 400)),
         'side-R': dict(photo=(46, 600), gutter=(554, 624), column=(624, 1024))}
HEADER = [(230, 794, 230, 300), (60, 964, 300, 400)]   # x0, x1, y0, y1 (เว้นดอกไม้มุมบน)
MAX_SHIFT = 40                                           # ล้ำเกินนี้ = สร้างภาพใหม่
MAX_VEIL_SIDE = 0.5                                      # ม่านแรงกว่านี้จะฟอกส่วนสถานที่ที่ล้ำเข้าคอลัมน์รูปจนดูเหมือนผ่าน


def landmark_top(img):
    """เหมือน check-bg: ที่ 1024×1536, กรอบ x 230–800, เริ่ม y 384, ±20 px, std > 3"""
    a = np.asarray(img.convert('RGB').resize((1024, 1536), Image.LANCZOS)).astype(np.float32)
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    xs = np.arange(230, 800); K = 20
    for y in range(384, 1382):
        row = L[y]; c = np.concatenate([[0], np.cumsum(row)])
        lo = np.maximum(0, xs - K); hi = np.minimum(1024, xs + K + 1)
        d = row[xs] - (c[hi] - c[lo]) / (hi - lo)
        if np.sqrt((d * d).mean()) > 3:
            return y
    return None


def shift_down(img, d_design):
    """ยืดท้องฟ้าช่วงกลางให้ฉากล่างเลื่อนลง แล้วแปะแถบล่างเดิม (คลื่น+ดอกไม้มุมล่าง) กลับทับขอบล่าง"""
    W, H = img.size
    s = H / 1536
    d = int(round(d_design * s))
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    ys = int(0.42 * H)                         # จุดตัดในโซนท้องฟ้าเรียบ
    band = int(40 * s)
    strip = Image.fromarray(a[ys - band:ys + band].astype(np.uint8)).resize((W, 2 * band + d), Image.BICUBIC)
    out = np.concatenate([a[:ys - band], np.asarray(strip).astype(np.float32), a[ys + band:H - d]], axis=0)
    # แถบล่างเดิม: แปะ 9% ล่าง ไล่จางขอบบน 40% ของแถบ (กันรอยต่อ)
    bh = int(0.09 * H)
    t = np.clip(np.arange(bh, dtype=np.float32) / (bh * 0.4), 0, 1)
    al = (t * t * (3 - 2 * t))[:, None, None]
    out[H - bh:] = a[H - bh:] * al + out[H - bh:] * (1 - al)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def darken_band(img, limit=112):
    """แถบล่าง (y ≥ 90%) ต้องเข้มพอให้ตัวอักษรขาวอ่าน (check-bg ≤ 120) — หรี่แบบไล่จากขอบบนแถบ"""
    a = np.asarray(img).astype(np.float32)
    H = a.shape[0]
    y0 = int(0.90 * H)
    L = 0.299 * a[y0:, :, 0] + 0.587 * a[y0:, :, 1] + 0.114 * a[y0:, :, 2]
    m = float(L.mean())
    if m <= limit:
        return img, None
    f = limit / m
    ramp = np.ones(H, np.float32)
    yr = np.arange(H, dtype=np.float32) / H
    t = veil.smooth((yr - 0.875) / 0.03)
    ramp = 1 - (1 - f * 0.97) * t
    a = a * ramp[:, None, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), m


def design_lum(img):
    a = np.asarray(img.convert('RGB').resize((1024, 1536), Image.LANCZOS)).astype(np.float32)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def row_dev(L, x0, x1, K=20):
    """std ต่อแถวหลังลบค่าเฉลี่ยเลื่อน ±K — หน้าต่างตัดอยู่ใน [x0, x1) เหมือน check-bg rowDev"""
    seg = L[:, x0:x1]
    n = x1 - x0
    c = np.concatenate([np.zeros((seg.shape[0], 1), np.float64), np.cumsum(seg, axis=1, dtype=np.float64)], axis=1)
    xs = np.arange(n); lo = np.maximum(0, xs - K); hi = np.minimum(n, xs + K + 1)
    d = seg - (c[:, hi] - c[:, lo]) / (hi - lo)
    return np.sqrt((d * d).mean(axis=1))


def gutter_clean(img, side):
    """สัดส่วนแถว y 400–1360 ในแถบ gutter ที่ std ≤ 3 (check-bg ต้อง ≥ 97%)"""
    g = SIDES[side]['gutter']
    return float((row_dev(design_lum(img)[400:1360], *g) <= 3).mean())


def zone_stats(L, side):
    """(mean, std) ของคอลัมน์รูป และของส่วนหัว"""
    x0, x1 = SIDES[side]['photo']
    ph = L[352:1360, x0:x1]
    hd = np.concatenate([L[y0:y1, a:b].ravel() for a, b, y0, y1 in HEADER])
    return (float(ph.mean()), float(ph.std())), (float(hd.mean()), float(hd.std()))


def shift_x(img, d_design):
    """เลื่อนภาพแนวนอน d หน่วยออกแบบ (+ ขวา / − ซ้าย) แล้วต่อขอบด้วยพิกเซลริม (edge-extend)"""
    a = np.asarray(img.convert('RGB'))
    W = a.shape[1]
    p = int(round(abs(d_design) * W / 1024))
    if p == 0:
        return img
    if d_design < 0:
        out = np.concatenate([a[:, p:], np.repeat(a[:, -1:], p, axis=1)], axis=1)
    else:
        out = np.concatenate([np.repeat(a[:, :1], p, axis=1), a[:, :W - p]], axis=1)
    return Image.fromarray(out)


def column_mask(size, side):
    """มาสก์ม่าน 0..1: คอลัมน์รูป (ขยายถึงขอบภาพฝั่งรูป) + ส่วนหัว ขอบนุ่ม ~40 px; ใต้ y 400 ไม่แตะคอลัมน์สถานที่"""
    from PIL import ImageDraw, ImageFilter
    m = Image.new('L', (1024, 1536), 0)
    d = ImageDraw.Draw(m)
    x0, x1 = (420, 1024) if side == 'side-L' else (0, 604)
    d.rectangle([x0, 300, x1 - 1, 1359], fill=255)
    for a, b, y0, y1 in HEADER:
        d.rectangle([a, y0, b - 1, y1 - 1], fill=255)
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
    c0, c1 = SIDES[side]['column']
    m[400:, c0:c1] = 0
    m = Image.fromarray((m * 255).astype(np.uint8)).resize(size, Image.BILINEAR)
    return np.asarray(m).astype(np.float32)[..., None] / 255


def veil_column(img, side, k):
    """ม่านสว่างเฉพาะคอลัมน์รูป + ส่วนหัว ความแรง k; สีม่าน = สีพื้นคอลัมน์รูปยกสว่าง (คงโทนธีม)"""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    H, W = a.shape[:2]
    x0, x1 = SIDES[side]['photo']
    mid = a[int(400 / 1536 * H):int(1300 / 1536 * H), int(x0 / 1024 * W):int(x1 / 1024 * W)].reshape(-1, 3).mean(axis=0)
    tint = mid + (255 - mid) * 0.75
    al = k * column_mask((W, H), side)
    return Image.fromarray(np.clip(a * (1 - al) + tint * al, 0, 255).astype(np.uint8))


def veil_column_auto(img, side):
    """ม่านอ่อนที่สุด (ไม่เกิน MAX_VEIL_SIDE) ที่ทำให้คอลัมน์รูปและส่วนหัว mean ≥ 217, std ≤ 13.5 (เผื่อจาก 215/14)
    คืน (k, mean, std, ok) — ok False = ถึงเพดานม่านแล้วยังไม่ผ่าน"""
    ok = False
    for k in [0.0, 0.2, 0.3, 0.4, 0.45, 0.5]:
        (pm, ps), (hm, hs) = zone_stats(design_lum(veil_column(img, side, k)), side)
        if pm >= 217 and ps <= 13.5 and hm >= 217 and hs <= 13.5:
            ok = True
            break
    return k, pm, ps, ok


# =====================================================================================
# ชุด v3 — นโยบายซ่อมภาพอัตโนมัติ docs/design/templates-v3.md §8
# ลำดับ: (0) ล้างเขียว → (1) ย่อฉาก uniform → (2) เลื่อน → (3) ม่านจาง/เติมฟ้า/ม่านโซนตรา → (4) หรี่แถบ → (5) veil เดิม
# เกณฑ์ QA (§2.1) ไม่ผ่อน: ค้นค่าที่หน่วยออกแบบ 1024×1536 ด้วย qa() (พอร์ตจาก check-bg) แล้วค่อยใช้กับภาพเต็ม
# ฉาก side-R ทำโดยกลับภาพซ้าย-ขวาแล้วใช้สูตร side-L (กรอบ side-R เป็นเงาสะท้อนของ side-L พอดีทุกค่า)
# =====================================================================================
MIN_SCALE_SIDE = 0.70        # §8.1 เพดานย่อฉาก side
MIN_SCALE_BOTTOM = 0.68      # §8.2 เพดานย่อฉาก bottom
SIDE_TIP_MIN = 420           # §8.1 ยอดหลังย่อ ≥ 420 (เกณฑ์ 390 + เผื่อวัด 30)
HARD_EDGE_X = 370            # §8.1 ขอบแข็งของสถานที่ต้องอยู่ใน x ≤ 370 (L)
HARD_EDGE_MAX = 0.15         # §8.1 ข้อ 4: แถว std > 3 ใน x 370–400 ≤ 15% ของแถว 420–1300
BOX_FADE = 24                # §8.1 ขนนุ่มขอบในของฉากที่ย่อ — ฉากจาง x 352→376 แล้วม่าน feather รับต่อ (ขอบแข็งต้อง ≤ 352)
FOG_END = 400                # ม่านหมอกเต็มที่ x ≥ 400 (L) — ขอบซ้ายของ gutter
FOG_START = 331              # จุดเริ่มหมอกเฉลี่ย (L) ± FOG_WOBBLE ต่อแถว → กว้าง 60–78 px (ไม่ใช่ ramp ตรง 30 px เดิม)
FOG_WOBBLE = 9               # ขอบหมอกโค้งตามธรรมชาติ: เลื่อนจุดเริ่มต่อแถวด้วย noise ความถี่ต่ำ (หน่วยออกแบบ)
FOG_NOISE = 0.18             # noise 2 มิติในเนื้อหมอก (เป็นศูนย์ที่ปลายทั้งสอง — ไม่เกิดรอยที่ x 400)
BOTTOM_TARGET = 908          # ยอดสถานที่ฉาก bottom หลังซ่อม (check-bg ต้องการ ≥ 895)
STRETCH_MAX_V3 = 24          # ยืดฟ้า (shift_down เดิม) ได้เมื่อขาด ≤ 24 — ฐานจมได้ไม่เกิน 24 ตาม §8.2 ข้อ 5
RESIDUAL_SHIFT_MAX = 40      # §8.2 ข้อ 5 เศษหลัง s ถึงเพดาน
TOP_FILL_MAX = 300           # §8.1 เพดานสวย: แถบบนที่เติมฟ้า ≤ 300 px


def _smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def _lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def _arr(img):
    return np.asarray(img.convert('RGB')).astype(np.float32)


def _img(a):
    return Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8))


def _design(a):
    """อาร์เรย์ใด ๆ → อาร์เรย์ที่หน่วยออกแบบ 1024×1536"""
    if a.shape[1] == 1024 and a.shape[0] == 1536:
        return a
    return _arr(_img(a).resize((1024, 1536), Image.LANCZOS))


class G:
    """แปลงหน่วยออกแบบ → พิกเซลของภาพจริง (1696×2528 สเกล x/y ต่างกันเล็กน้อย)"""
    def __init__(self, a):
        self.H, self.W = a.shape[:2]
        self.fx, self.fy = self.W / 1024, self.H / 1536

    def x(self, v):
        return int(round(v * self.fx))

    def y(self, v):
        return int(round(v * self.fy))


# ---------- (0) ล้างเขียว §8.4 ----------
def _rgb_to_hsv(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
    dd = np.where(d > 0, d, 1)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    h = np.where(d > 0, h, 0)
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    return h, s, mx


def _hsv_to_rgb(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h); f = h - i; i = i.astype(int) % 6
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=-1) * 255


def degreen(a):
    """hue 48–150° → 38° (อำพัน), 150–200° (teal) → 215° (น้ำเงิน) ผสมนุ่มที่ 150±10°, S' = 0.85S, V < 0.5 ยก 0.15(1−V)
    กรณี olive (hue 42–60°, S ≥ 0.35, V < 0.55) → hue 32° + V ยก 0.12 · คืน (อาร์เรย์ใหม่, สัดส่วนพิกเซลที่ถูกแก้ ≥ 0.5)"""
    h, s, v = _rgb_to_hsv(a)
    w = _smooth((h - 40) / 16) * (1 - _smooth((h - 192) / 16)) * _smooth((s - 0.12) / 0.13)
    tgt = 38 + (215 - 38) * _smooth((h - 140) / 20)
    h2 = h + w * (tgt - h)
    s2 = s * (1 - 0.15 * w)
    v2 = v + w * 0.15 * (1 - v) * (1 - _smooth((v - 0.45) / 0.10))
    wo = _smooth((h - 38) / 8) * (1 - _smooth((h - 56) / 8)) * _smooth((s - 0.30) / 0.10) * (1 - _smooth((v - 0.50) / 0.10))
    # ใบไม้ในลายมุม (ไม่ใช่ตัวสถานที่): olive ที่ hue ต่ำกว่าเกณฑ์ (np-13 ใบดาวเรือง hue ~37, V ~0.55–0.6 ตาเห็นขี้ม้า)
    # ขยายช่วงเป็น hue 34–60, V < 0.62 เฉพาะมุมบน (x < 300 / > 724, y < 340) และมุมล่าง (x < 260 / > 764, y > 1200)
    H_, W_ = a.shape[:2]
    xd = np.arange(W_) * 1024 / W_; yd = np.arange(H_) * 1536 / H_
    top = ((xd < 300) | (xd > 724))[None, :] & (yd < 340)[:, None]
    bot = ((xd < 260) | (xd > 764))[None, :] & (yd > 1200)[:, None]
    wc = (top | bot) * _smooth((h - 32) / 4) * (1 - _smooth((h - 56) / 8)) * _smooth((s - 0.30) / 0.10) * (1 - _smooth((v - 0.58) / 0.08))
    wo = np.maximum(wo, wc)
    h2 = h2 + wo * (32 - h2)
    v2 = np.clip(v2 + wo * 0.12, 0, 1)
    out = _hsv_to_rgb(h2, s2, v2)
    k = np.maximum(w, wo)[..., None]
    out = a * (1 - np.minimum(1, k * 4)) + out * np.minimum(1, k * 4)   # พิกเซลที่ไม่เกี่ยว (k = 0) คงค่าเดิมทุกบิต
    return out, float((np.maximum(w, wo) >= 0.5).mean())


# ---------- ตัววัดแบบ check-bg (หน่วยออกแบบ) ----------
def _row_dev(L, x0, x1, K=20):
    seg = L[:, x0:x1].astype(np.float64)
    n = x1 - x0
    c = np.concatenate([np.zeros((seg.shape[0], 1)), np.cumsum(seg, axis=1)], axis=1)
    xs = np.arange(n); lo = np.maximum(0, xs - K); hi = np.minimum(n, xs + K + 1)
    d = seg - (c[:, hi] - c[:, lo]) / (hi - lo)
    return np.sqrt((d * d).mean(axis=1))


def _row_dev_full(L, x0, x1, K=20):
    """หน้าต่างเลื่อนไม่ตัดกรอบ (เหมือน landmark ฉาก bottom ใน check-bg)"""
    W = L.shape[1]
    c = np.concatenate([np.zeros((L.shape[0], 1)), np.cumsum(L.astype(np.float64), axis=1)], axis=1)
    xs = np.arange(x0, x1); lo = np.maximum(0, xs - K); hi = np.minimum(W, xs + K + 1)
    d = L[:, x0:x1] - (c[:, hi] - c[:, lo]) / (hi - lo)
    return np.sqrt((d * d).mean(axis=1))


def _green(a):
    h, s, _ = _rgb_to_hsv(a)
    return (s >= 0.25) & (h >= 75) & (h <= 165)


def _stats(L, rects):
    v = np.concatenate([L[y0:y1, x0:x1].ravel() for x0, x1, y0, y1 in rects]).astype(np.float64)
    return float(v.mean()), float(v.std())


def qa(a, scene, v3=True):
    """พอร์ตเกณฑ์ tools/check-bg.mjs (ใช้ค้นค่า — ผลจริงต้องยืนยันด้วย check-bg) คืน dict ชื่อ → (ok, ค่า)"""
    d = _design(a)
    if scene == 'side-R':
        d = d[:, ::-1]
    L = _lum(d)
    g = _green(d)
    band = float(L[1382:].mean())
    orn = float(L[12:144, 352:672].mean())
    r = {'band': (band <= 120, round(band, 1))}
    if scene == 'bottom':
        m, s = _stats(L, [(0, 1024, 230, 906)])
        dev = _row_dev_full(L, 230, 800)
        objs = np.nonzero(dev[384:1382] > 3)[0]
        lt = int(objs[0] + 384) if len(objs) else None
        r.update(middle=(m >= 215 and s <= 14, (round(m, 1), round(s, 1))),
                 landmark=(lt is None or lt >= 895, lt),
                 green=(g.mean() <= 0.08 and g[906:1367].mean() <= 0.15, round(float(g.mean()) * 100, 2)))
    else:
        hm, hs = _stats(L, [(230, 794, 230, 300), (60, 964, 300, 400)])
        pm, ps = _stats(L, [(424, 978, 352, 1360)])
        gc = float((_row_dev(L[400:1360], 400, 470) <= 3).mean())
        dev = _row_dev(L, 40, 380) > 3
        objs = np.nonzero(dev[384:1382])[0]
        top = int(objs[0] + 384) if len(objs) else None
        rows = int(dev[420:1300].sum())
        gcol = float(g[400:1380, 0:400].mean())
        r.update(header=(hm >= 215 and hs <= 14, (round(hm, 1), round(hs, 1))),
                 photo=(pm >= 215 and ps <= 14, (round(pm, 1), round(ps, 1))),
                 gutter=(gc >= 0.97, round(gc * 100, 1)),
                 landmark=(rows >= 300 and (top is None or top >= 390), (top, rows)),
                 green=(g.mean() <= 0.08 and gcol <= 0.15, round(float(g.mean()) * 100, 2)))
    if v3 or scene != 'bottom':
        r['ornament'] = (orn >= 215, round(orn, 1))
    return r


def _fails(r):
    return [k for k, (ok, _) in r.items() if not ok]


# ---------- สีพื้นสังเคราะห์ ----------
def far_colors(a, g, x0=860, x1=960):
    """สีต่อแถวจากแถบไกลฝั่งรูป (L x 860–960) เฉพาะแถวที่เรียบ (std ≤ 3) แถวอื่น interpolate"""
    strip = a[:, g.x(x0):g.x(x1)]
    dev = _row_dev(_lum(strip), 0, strip.shape[1], K=max(1, g.x(20)))
    col = strip.mean(axis=1)
    ys = np.arange(a.shape[0])
    ok = np.nonzero((dev <= 3) & (ys < g.y(1240)))[0]   # ใต้ 1240 มักมีดอกไม้มุมล่าง — ต่อค่าแถวสุดท้ายที่เรียบ
    if len(ok) < 10:
        return col
    return np.stack([np.interp(ys, ok, col[ok, c]) for c in range(3)], axis=1)


def _sky_row(rows):
    """สีฟ้าต่อคอลัมน์จากกลุ่มแถว: ตัดพิกเซลที่ต่างจากมัธยฐานแถว > 10 (ลายทอง/ดอกไม้/ยอด) แล้วเกลี่ยแนวนอน"""
    from PIL import ImageFilter
    c = np.median(rows, axis=0)
    med = np.median(c, axis=0)
    good = np.sqrt(((c - med) ** 2).sum(axis=1)) <= 12
    if good.sum() < 4:
        good[:] = True
    xs = np.arange(len(c))
    c = np.stack([np.interp(xs, xs[good], c[good, k]) for k in range(3)], axis=1)
    blur = _arr(_img(np.repeat(c[None], 3, axis=0)).filter(ImageFilter.GaussianBlur(max(1, len(c) // 30))))
    return blur[1]


def _resample(a, x0, y0, x1, y1, s):
    crop = _img(a[y0:y1, x0:x1])
    nw, nh = max(1, int(round((x1 - x0) * s))), max(1, int(round((y1 - y0) * s)))
    return _arr(crop.resize((nw, nh), Image.LANCZOS))


def _paste_band(out, orig):
    """แปะแถบล่างเดิม 9% ล่าง ไล่จางขอบบน 40% ของแถบ (เหมือน shift_down เดิม)"""
    H = out.shape[0]
    bh = int(0.09 * H)
    t = np.clip(np.arange(bh, dtype=np.float32) / (bh * 0.4), 0, 1)
    al = (t * t * (3 - 2 * t))[:, None, None]
    out[H - bh:] = orig[H - bh:] * al + out[H - bh:] * (1 - al)
    return out


def ornament_veil(a, log, target=218):
    """§8.3 ม่านโซนตรา x 300–724, y 0–200 ขอบนุ่ม 60 px (ไม่แตะ x < 260 / > 764) สีฟ้าแถว 150–230 ยกสว่าง 0.75"""
    g = G(a)
    if float(_lum(_design(a))[12:144, 352:672].mean()) >= 215:
        return a
    xs = np.arange(g.W) / g.fx; ys = np.arange(g.H) / g.fy
    # ทรงรีนุ่ม (แสงเรืองหลังตรา) อยู่ในกรอบ x 300–724, y 0–200 — ขอบสี่เหลี่ยมจะเห็นเป็นกล่องบนท้องฟ้ามีเมฆ
    r = np.sqrt(((xs[None, :] - 512) / 235) ** 2 + ((ys[:, None] - 50) / 175) ** 2)
    m = (1 - _smooth((r - 0.55) / 0.50))[..., None]          # ศูนย์ที่ r ≥ 1.05 → x 265–759 (ไม่แตะดอกไม้มุม x < 260 / > 764)
    sky = a[g.y(150):g.y(230), g.x(300):g.x(724)].reshape(-1, 3).mean(axis=0)
    tint = sky + (255 - sky) * 0.75
    for k in np.arange(0.30, 0.701, 0.05):
        out = a * (1 - k * m) + tint * k * m
        orn = float(_lum(_design(out))[12:144, 352:672].mean())
        if orn >= target:
            break
    log.append(f'ม่านโซนตรา k {k:.2f} (ornament {orn:.0f})')
    return out


WAVE_KEEP_GOLD = 0.62        # คลื่นทอง/อำพัน (hue 22–60°): หรี่ได้ไม่ต่ำกว่านี้ก่อน (ต่ำกว่า = ทองกลายเป็นน้ำตาลเกือบดำ — Fable รอบ 1 np-13)
WAVE_KEEP_DEEP = 0.40        # คลื่นสีเข้ม (แดงเลือดหมู/ม่วง): หรี่ลึกได้ยังเป็นสีเดิม — ลดเงาเหนือสันที่ทับฉาก
ABOVE_MAX = 0.40             # เงาไล่แนวดิ่งเหนือสันสูงสุด


def darken_wave(a, limit=112, fallback=False, crest=None, ok=None):
    """หรี่แถบ y ≥ 90% ให้ mean ≤ limit โดยรักษาไล่เฉดทองของคลื่น
    · ตัวคลื่น (ใต้สัน ไล่นุ่ม 28 px) คูณค่าคงที่ f เท่ากันทั้งความกว้าง (อัตราส่วนไล่เฉดเดิมอยู่ครบ) — f ≥ เพดานตามสีก่อน
    · ที่ยังเกิน → เงาทองไล่แนวดิ่งนุ่มเหนือสัน (y 1320→สัน เท่ากันทั้งความกว้าง) k ≤ ABOVE_MAX แทนการกดคลื่นจนดำ
    · เพดาน f แยกตามสีคลื่น: ทอง/อำพัน ≥ 0.62 · สีเข้ม (แดง/ม่วง) ≥ 0.40
    · สัน = เส้นต่อเนื่องจาก wave_crest (ผู้เรียกส่ง crest ของต้นฉบับมาได้ — กันสันเพี้ยนตรงกล่องฉาก)
    คืน (อาร์เรย์, mean เดิม) — หาสันไม่ได้ (ฉาก bottom ที่สันถูกบัง) ใช้ darken_band เดิม"""
    darken_wave.last = None
    g = G(a)
    y0 = int(0.90 * g.H)
    m0 = float(_lum(a[y0:]).mean())
    if m0 <= limit:
        return a, None
    if crest is None:
        r = wave_crest(a, g, fallback, with_ok=True)
        if r is None:
            return _arr(darken_band(_img(a), limit)[0]), m0
        crest, ok = r
    ys = np.arange(g.H)[:, None]
    w = _smooth((ys - crest[None, :] + 8 * g.fy) / (28 * g.fy))
    if ok is not None:
        # คอลัมน์ที่สันเป็นค่าประมาณ (ใต้ดอกไม้มุม): ไม่หรี่ฟ้าสว่างจาง — น้ำหนักนุ่มตามแนวนอน ไม่เป็นริ้ว
        from scipy import ndimage
        guess = 1 - ndimage.gaussian_filter1d(ok.astype(np.float32), g.x(12), mode='nearest')
        _, sa, va = _rgb_to_hsv(a)
        e = _smooth((0.30 - sa) / 0.10) * _smooth((va - 0.75) / 0.10) * guess[None, :]
        w = w * (1 - ndimage.gaussian_filter(e, g.x(2)))
    yd = np.arange(g.H) / g.fy
    up = (_smooth((yd - 1320) / 110)[:, None] * (1 - w))           # เหนือสันเท่านั้น (ใต้สันคุมด้วย f) — ไล่กว้างจาง ไม่เป็นเงาเข้มชิดสัน
    Lb = _lum(a[y0:]); wb = w[y0:]; ub = up[y0:]
    n = Lb.size
    tgt = limit * 0.995 * n
    S_w = float((Lb * wb).sum()); S_u = float((Lb * ub).sum()); S_all = float(Lb.sum())
    body = (ys >= crest[None, :] + 12 * g.fy) & (ys < crest[None, :] + 40 * g.fy)
    hb, _, _ = _rgb_to_hsv(a[body])
    keep = WAVE_KEEP_GOLD if 22 <= float(np.median(hb)) <= 60 else WAVE_KEEP_DEEP
    for k in np.arange(0.0, ABOVE_MAX + 1e-6, 0.02):
        # mean = S_all − (1−f)·S_w − k·S_u  ≤ tgt
        f = 1 - (S_all - k * S_u - tgt) / max(1.0, S_w)
        if f >= keep:
            break
    f = float(np.clip(f, 0.30, 1.0))
    out = a * (1 - w * (1 - f))[..., None]
    if k > 0:
        # เงาเหนือสันเป็น "แสงทองไล่ลงคลื่น" (multiply ด้วยสีคลื่น) ไม่ใช่เทาหม่น — ความแรงปรับให้ลดความสว่างเท่า k
        wm = w[y0:] > 0.9
        tone = a[y0:][wm].mean(axis=0) if wm.any() else np.array([200., 150., 80.])
        lt = float(_lum(tone)) / 255
        kk = min(1.0, k / max(0.15, 1 - lt))
        gel = tone / 255
        out = out * (1 - kk * up[..., None]) + out * gel * (kk * up[..., None])
    darken_wave.last = (f, k)
    if float(_lum(out[y0:]).mean()) > limit:                      # สำรอง (ไม่ควรถึง): เงาไล่แนวดิ่งกว้างเดิม
        ramp = _smooth((yd - 1250) / 190)[:, None, None]
        for k2 in np.arange(0.02, 0.61, 0.02):
            o2 = out * (1 - k2 * ramp)
            if float(_lum(o2[y0:]).mean()) <= limit:
                break
        out = o2
    return out, m0


# ---------- ฉาก side §8.1 (ทำงานในพิกัด side-L) ----------
def side_tip(d, x1=470, thr=6, grow=3, with_mask=False):
    """ยอดจริงของสถานที่ฝั่งซ้าย (x 0–470): ส่วนที่ต่อเนื่อง (8 ทิศ หลังขยาย 3 px) กับวัตถุที่พื้น y 1200–1300
    วัตถุ = |L − ค่าเฉลี่ยเลื่อน ±20| > 6 — เมฆ/ดอกไม้มุมบนที่ไม่ต่อลงถึงพื้นจึงไม่นับ"""
    from scipy import ndimage
    L = _lum(d)[:, :x1].astype(np.float64)
    n = x1
    c = np.concatenate([np.zeros((L.shape[0], 1)), np.cumsum(L, axis=1)], axis=1)
    xs = np.arange(n); lo = np.maximum(0, xs - 20); hi = np.minimum(n, xs + 21)
    m = np.abs(L - (c[:, hi] - c[:, lo]) / (hi - lo)) > thr
    m[:100] = False; m[1300:] = False
    m = ndimage.binary_dilation(m, iterations=grow)
    lab, _ = ndimage.label(m, structure=np.ones((3, 3)))
    ids = np.unique(lab[1200:1300]); ids = ids[ids > 0]
    if not len(ids):
        return (None, None) if with_mask else None
    comp = np.isin(lab, ids)
    ys = np.nonzero(comp.any(axis=1))[0]
    tip = int(ys[0]) + grow
    return (tip, comp) if with_mask else tip


def corner_mask(d, comp, g):
    """มาสก์ลายมุมบนฝั่งสถานที่ (ดอกไม้/ลายทองใน x < 260, y < 330 — พิกเซลที่ต่างจากฟ้ารอบข้าง ขยาย 8 px)
    ไม่รวมตัวสถานที่ (comp ขยาย 12 px) ขอบนุ่ม — คืนขนาดภาพจริง"""
    from scipy import ndimage
    from PIL import ImageFilter
    L = _lum(d).astype(np.float64)
    c = np.concatenate([np.zeros((1536, 1)), np.cumsum(L, axis=1)], axis=1)
    xs = np.arange(1024); lo = np.maximum(0, xs - 20); hi = np.minimum(1024, xs + 21)
    obj = np.abs(L - (c[:, hi] - c[:, lo]) / (hi - lo)) > 4
    _, sat, _ = _rgb_to_hsv(d)
    sky = np.median(sat[200:330, 260:470])
    obj |= sat > sky + 0.12
    m = np.zeros((1536, 1024), bool)
    m[:330, :260] = obj[:330, :260]
    m = ndimage.binary_dilation(m, iterations=8)
    m[330:] = False
    if comp is not None:
        keep = np.zeros((1536, 1024), bool)
        keep[:, :comp.shape[1]] = ndimage.binary_dilation(comp, iterations=12)
        m &= ~keep
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)).resize((g.W, g.H), Image.BILINEAR)
    return (np.asarray(im).astype(np.float32) / 255)[..., None]


def _obj_map(d):
    """วัตถุ = ต่างจากค่าเฉลี่ยเลื่อน ±20 > 4 หรืออิ่มสีกว่าฟ้ากลางภาพ + 0.12 (หน่วยออกแบบ)"""
    L = _lum(d).astype(np.float64)
    c = np.concatenate([np.zeros((L.shape[0], 1)), np.cumsum(L, axis=1)], axis=1)
    n = L.shape[1]
    xs = np.arange(n); lo = np.maximum(0, xs - 20); hi = np.minimum(n, xs + 21)
    obj = np.abs(L - (c[:, hi] - c[:, lo]) / (hi - lo)) > 4
    _, sat, _ = _rgb_to_hsv(d)
    return obj | (sat > np.median(sat[500:1100, 450:950]) + 0.12)


def flower_mask_br(d, g):
    """ดอกไม้มุมล่างฝั่งรูป — กล่อง §8.2 (พิกัด side-L: x > 764, y > 1250) เฉพาะวัตถุที่ต่อถึงมุมล่างขวา
    ขอบกล่องนุ่ม 40 px (กิ่ง/พุ่มที่ล้ำออกนอกกล่องค่อย ๆ จางเข้าม่าน) — ไม่ให้ม่าน feather กิน"""
    from scipy import ndimage
    from PIL import ImageFilter
    m = np.zeros((1536, 1024), bool)
    m[1210:, 724:] = _obj_map(d)[1210:, 724:]
    m = ndimage.binary_closing(m, iterations=3)
    lab, _ = ndimage.label(m, structure=np.ones((3, 3)))
    ids = np.unique(lab[1380:1520, 980:]); ids = ids[ids > 0]
    m = np.isin(lab, ids) if len(ids) else np.zeros_like(m)
    m = ndimage.binary_fill_holes(ndimage.binary_dilation(m, iterations=2)).astype(np.float32)
    xs = np.arange(1024); ys = np.arange(1536)
    m *= _smooth((xs - 744) / 40)[None, :] * _smooth((ys - 1230) / 40)[:, None]
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)).resize((g.W, g.H), Image.BILINEAR)
    return np.asarray(im).astype(np.float32) / 255


ENV_DROP = 2                 # ซองคอลัมน์เริ่มใต้เส้นขอบฟ้ากว้าง 2 px (ขอบวัตถุเองใช้ obj + ขนนุ่ม — ไม่มีแสงเรืองเหนือขอบ)
ENV_PEAK = 61                # ยอดที่แคบกว่านี้ (หน่วยออกแบบ) ไม่เข้าซองคอลัมน์ — ใช้มาสก์รายพิกเซล
ENV_SOFT_DIST = (20, 50)     # ส่วนที่ขยายของซองโชว์เฉพาะเนื้อฉากที่สีห่างฟ้าเติม (RGB) 20→50 — ฟ้าของฉากไม่ขึ้นเป็นเงารอบวัตถุ
ENV_SOFT = 16                # ขนนุ่มแนวนอนของซองคอลัมน์ (หน่วยออกแบบ) — ไม่ให้ซองขาดเป็นเส้นตั้ง
OBJ_FEATHER = 7              # ขนนุ่มรอบวัตถุ (px หลังย่อ) — comp ขยายมาแล้ว 3 px ใน side_tip


def tight_objects(d, comp, thr=12, K=48):
    """วัตถุรายพิกเซล (หน่วยออกแบบ): ต่างจากสีฟ้าของแถว (มัธยฐานแนวนอน ±48 px) > 12 และอยู่ใน comp (ต่อถึงพื้น)
    — comp จาก side_tip วัดด้วยค่าเฉลี่ยเลื่อน ±20 จึงกินฟ้าข้างวัตถุคอนทราสต์สูงไป ~20 px (ที่มาของ "ฝาครอบ" รอบยอด)"""
    from scipy import ndimage
    w = comp.shape[1]
    sub = d[:, :w]
    med = np.stack([ndimage.median_filter(sub[..., c], size=(1, 2 * K + 1), mode='nearest') for c in range(3)], -1)
    diff = np.sqrt(((sub - med) ** 2).sum(-1)) > thr
    t = ndimage.binary_closing(diff & comp, iterations=2) & comp
    return ndimage.binary_fill_holes(ndimage.binary_dilation(t, iterations=2))


def scene_masks(comp, x1, y0):
    """มาสก์ "ตัวฉาก" (หน่วยออกแบบของต้นฉบับ กรอบ y0–1536, x 0–x1) แยก 2 ชั้น จากวัตถุรายพิกเซล (tight_objects):
    · obj = วัตถุรายพิกเซล — ยอดฉัตร/ปลายหอ/ขอบซุ้มได้ฟ้าเติมรอบตัว (ขนนุ่มหลังย่อ OBJ_FEATHER) ไม่มี "ฝาครอบ"
    · env = ซองคอลัมน์ใต้ "เส้นขอบฟ้ากว้าง" (ขอบบนวัตถุต่อคอลัมน์ หลังตัดยอดแคบ < 61 px ด้วย grey closing)
      — ภูเขา/พุ่มไม้/ฟ้าในช่องซุ้มและระหว่างหอ ยังติดมากับฉาก ส่วนยอดแคบใช้ obj อย่างเดียว
    คืน (env, obj)"""
    from scipy import ndimage
    x1 = int(np.ceil(x1)); y0 = int(y0)
    cm = np.zeros((1536, x1), bool)
    w = min(x1, comp.shape[1])
    cm[:, :w] = comp[:, :w]
    top = np.where(cm.any(axis=0), cm.argmax(axis=0), 1536).astype(np.float64)
    top = np.minimum(top, 1300)
    broad = ndimage.grey_closing(top, size=ENV_PEAK, mode='nearest')
    broad = ndimage.uniform_filter1d(broad, 9, mode='nearest')
    ys = np.arange(y0, 1536)[:, None]
    env = _smooth((ys - (broad[None, :] + ENV_DROP)) / 8).astype(np.float32)
    return env, cm[y0:].astype(np.float32)


def _feather_out(m, px):
    """มาสก์ 0/1 → ขนนุ่มออกด้านนอก px (1 ในวัตถุ ลดเป็น 0 ที่ระยะ px)"""
    from scipy import ndimage
    d = ndimage.distance_transform_edt(m < 0.5)
    return np.maximum(m, 1 - _smooth(d / max(1e-3, px))).astype(np.float32)


SEAM_R = 420                 # รัศมีโซนมุมล่างฝั่งสถานที่ (หน่วยออกแบบ จากมุม (0, 1536))


def corner_seam(comp, orig, crest, g):
    """ตะเข็บรอบมุมล่างซ้าย (พิกัด side-L) แบบ image quilting ในพิกัดเชิงขั้ว (ศูนย์ (0, 1536), มุม 0–90°)
    เลือกรัศมี r(θ) ต่อมุม (เปลี่ยน ≤ 3 px ต่อ 0.5°) อยู่เหนือสันคลื่นเสมอ ให้ผลรวม |ของเดิม − ฉากที่ย่อ| ตามตะเข็บต่ำสุด
    — ตะเข็บอ้อมดอกไม้มุมเดิม/ผ่านที่ที่สองภาพคล้ายกัน (ฟ้า สนาม) ไม่ผ่าดอกไม้ ไม่มีขนนุ่มกว้างที่ทำพุ่มไม้ซ้อนเป็นเงา
    คืนมาสก์ขนาดภาพจริง (1 = ใช้ของเดิม) ขนนุ่ม 3 px"""
    from scipy import ndimage
    cd = _design(comp); od = _design(orig)
    diff = np.sqrt(((cd - od) ** 2).sum(-1))
    diff = np.minimum(ndimage.gaussian_filter(diff, 1.5), 80.0)
    cr = np.interp(np.arange(1024), np.arange(g.W) / g.fx, crest / g.fy)
    th = np.radians(np.arange(0, 90.01, 0.5)); R = np.arange(0, SEAM_R + 1)
    X = np.cos(th)[:, None] * R[None, :]; Y = 1536 - np.sin(th)[:, None] * R[None, :]
    xi = np.clip(np.round(X).astype(int), 0, 1023); yi = np.clip(np.round(Y).astype(int), 0, 1535)
    above = Y < cr[xi]
    # ตะเข็บต้องอยู่เหนือสันเสมอ (คลื่นทั้งแถบ = คลื่นเดิม ไม่มีคลื่นที่ย่อโผล่เป็นเส้นทองซ้อน)
    hit = above.any(axis=1)
    rc = np.where(hit, above.argmax(axis=1), SEAM_R)
    cost = (diff[yi, xi] + 2.0) * np.maximum(R, 8)[None, :] * np.radians(0.5)
    cost = np.where(R[None, :] < rc[:, None], np.inf, cost)
    n, m = cost.shape; D = 3
    acc = cost[0].copy(); back = np.zeros((n, m), int)
    for i in range(1, n):
        best = np.full(m, np.inf); arg = np.zeros(m, int)
        for d in range(-D, D + 1):
            sh = np.full(m, np.inf)
            if d >= 0:
                sh[d:] = acc[:m - d] if d else acc
            else:
                sh[:d] = acc[-d:]
            better = sh < best
            best[better] = sh[better]; arg[better] = (np.arange(m) - d)[better]
        acc = best + cost[i]; back[i] = arg
    r = np.zeros(n, int); r[-1] = int(np.argmin(acc))
    for i in range(n - 1, 0, -1):
        r[i - 1] = back[i, r[i]]
    # มาสก์: จุด (x, y) ใน disk ที่รัศมี < r(มุมของจุด)
    yy, xx = np.mgrid[0:1536, 0:1024]
    ang = np.degrees(np.arctan2(1536 - yy, xx)); rad = np.hypot(xx, 1536 - yy)
    rr = np.interp(np.clip(ang, 0, 90), np.degrees(th), r.astype(float))
    md = ((rad < rr) & (ang >= 0)).astype(np.float32)
    md = ndimage.gaussian_filter(md, 1.5)
    im = Image.fromarray((md * 255).astype(np.uint8)).resize((g.W, g.H), Image.BILINEAR)
    return np.asarray(im).astype(np.float32) / 255


def _noise(rng, shape, sigma):
    """noise ความถี่ต่ำ (gaussian ของ white noise) ปรับให้ std = 1"""
    from scipy import ndimage
    n = ndimage.gaussian_filter(rng.standard_normal(shape), sigma, mode='wrap')
    return n / max(1e-6, n.std())


def fog_ramp(a, g):
    """alpha ม่านหมอกขอบในคอลัมน์สถานที่ (พิกัด side-L, ขนาดภาพจริง): 0 ฝั่งสถานที่ → 1 ที่ x ≥ FOG_END
    จุดเริ่มต่อแถว e(y) = FOG_START ± FOG_WOBBLE (noise 1 มิติ 2 ช่วงคลื่น) → กว้าง 60–78 px ไม่เป็นเส้นตั้งตรง
    + noise 2 มิติในเนื้อหมอก (คูณ sin(πt) จึงเป็นศูนย์ที่ปลาย) · seed จากเนื้อภาพ → รันซ้ำได้ผลเดิมทุกบิต"""
    import zlib
    d = _design(a)
    rng = np.random.default_rng(zlib.crc32(np.round(d[::16, ::16]).astype(np.uint8).tobytes()))
    n1 = _noise(rng, 1536, 36) * 0.8 + _noise(rng, 1536, 10) * 0.35
    n1 = np.clip(n1 / 2.0, -1, 1)
    n2 = np.clip(_noise(rng, (1536, 160), 14), -2.5, 2.5)          # x 280–440 หน่วยออกแบบ
    yd = np.clip(np.round(np.arange(g.H) / g.fy).astype(int), 0, 1535)
    xd = np.arange(g.W) / g.fx
    e = (FOG_START + FOG_WOBBLE * n1[yd])[:, None]
    t0 = np.clip((xd[None, :] - e) / (FOG_END - e), 0, 1)
    xi = np.clip(np.round(xd - 280).astype(int), 0, 159)
    t = np.clip(t0 + FOG_NOISE * n2[yd][:, xi] * np.sin(np.pi * t0), 0, 1)
    return _smooth(t).astype(np.float32)


def side_build(a, s, shift, tip, feather=True, log=None, comp=None, scomp=None, fmask=None):
    """a = ภาพพิกัด side-L (ล้างเขียวแล้ว) → ย่อฉาก s ยึดมุม (0, 1536) + เลื่อนเฉพาะฉากไปซ้าย shift + แถบเดิม + feather veil
    (เลื่อนเฉพาะกล่องฉาก ไม่เลื่อนทั้งภาพ — ดอกไม้มุมฝั่งรูปไม่ถูกตัด/ยืดขอบแบบ shift_x เดิม)"""
    g = G(a)
    out = a.copy()
    orig = a
    edge = None
    if s < 0.999 or shift:
        pad = 24 / s                                  # ขนนุ่ม 24 px หลังย่อ → ขยายกรอบต้นฉบับ 24/s
        # กล่องฉาก (§8.1 x 0–470): ตัดให้ขอบในหลังย่อ+เลื่อนอยู่ที่ 376 จางเข้า 352→376 ต่อด้วย ramp ม่าน 370→400 (ไม่มีช่องฟ้าคั่น)
        # feather=True: ขยายกล่องถึง FOG_END+4 ให้เนื้อฉาก (ของนุ่มข้างสถานที่) ต่อถึงหมอกเต็ม — ขอบกล่องตรงไม่โผล่เป็นเส้น
        # feather=False (ตัวตรวจขอบแข็ง x 370–400) ใช้กล่องเดิม 376 — เกณฑ์ §8.1 ข้อ 4 ไม่เปลี่ยน
        sx1 = min(1024, ((FOG_END + 4 if feather else HARD_EDGE_X + 6) + shift) / s)
        # ขอบบนกล่อง: เหนือวัตถุที่สูงสุดในกล่อง (ซุ้ม/ต้นไม้กว้างกว่าคอลัมน์ อาจสูงกว่ายอดที่วัดใน x < 470) — ไม่ให้ขนนุ่มขอบกล่องกินยอดซุ้ม
        btop = tip
        if scomp is not None:
            rows = np.nonzero(scomp[:, :int(sx1)].any(axis=1))[0]
            if len(rows):
                btop = min(tip, int(rows[0]))
        sy0 = max(0, btop - 30 - pad)
        X1, Y0 = g.x(sx1), g.y(sy0)
        XF = g.x(min(1024, max(470 + pad, sx1)))       # ช่วงที่ลบฉากเดิม (กว้างกว่ากล่องได้)
        # ลบฉากเดิม: ไล่จากสีแถว tip−60 ของคอลัมน์เอง (ตามความไล่แนวดิ่งของแถบไกล) → สีแถบไกลที่ y 1360
        far = far_colors(a, g)
        yr = max(0, min(g.y(tip - 60), Y0))
        ys = np.arange(yr, g.H)
        t = np.clip((ys - yr) / max(1, g.y(1360) - yr), 0, 1)[:, None, None]
        ref = _sky_row(a[max(0, yr - g.y(20)):yr + 1, :XF])
        trend = (far[yr:] - far[yr])[:, None, :]
        fill = (ref[None] + trend) * (1 - t) + far[yr:, None, :] * t
        # รอยต่อด้านใน (x ≈ 470+) เกลี่ยเข้าภาพเดิม 40 px
        xin = _smooth((XF - 1 - np.arange(XF)) / max(1, 40 * g.fx))[None, :, None]
        out[yr:, :XF] = fill * xin + a[yr:, :XF] * (1 - xin)
        # ลายมุมบน (x < 240, y < 320) ไม่ย่อตามฉาก: ต้นฉบับที่จะย่อ = ภาพที่ลบลายมุมออกแล้ว แล้วค่อยแปะลายเดิมกลับ
        # สีฟ้าที่ขอบในของคอลัมน์สถานที่ (x 345–370) ต่อแถว ก่อนวางฉาก — ให้ม่าน feather ต่อเนื่องกับฟ้าฝั่งสถานที่
        edge = out[:, g.x(345):g.x(370)].mean(axis=1)
        cmask = corner_mask(_design(a), comp, g)
        src = a * (1 - cmask) + out * cmask
        sc = _resample(src, 0, Y0, X1, g.H, s)
        p = g.x(shift)
        if scomp is not None:
            def scaled(mk):
                im = _arr(Image.fromarray((mk * 255).astype(np.uint8)).convert('RGB').resize((X1, g.H - Y0), Image.BILINEAR))
                return np.clip(_resample(im, 0, 0, X1, g.H - Y0, s)[..., 0] / 255, 0, 1)[:, p:]
            env, obj = scene_masks(scomp, sx1, Y0 / g.fy)
            env, core = scaled(env), scaled(obj)
            objm = _feather_out((core >= 0.5).astype(np.float32), OBJ_FEATHER * g.fx)
            # ซองคอลัมน์ขาดเป็นเส้นตั้งตรงที่คอลัมน์ซึ่งตัวตรวจไม่เจอวัตถุ (ภูเขา/น้ำจาง ๆ np-11) — ขยายออกด้านข้างแบบไล่จาง
            # (gaussian แนวนอน ~16 px) ให้เนื้อฉากเดิมจางลงเอง ไม่เป็นขอบตัด · ปรับโทนฟ้ายังใช้ env เดิม (ส่วนที่ขยายถูกปรับเข้าหาฟ้าเติม)
            from scipy import ndimage
            sg = ENV_SOFT * g.fx
            env_soft = ndimage.maximum_filter1d(env, int(4 * sg) + 1, axis=1, mode='nearest')   # ขยายออก 2σ ก่อน blur:
            env_soft = np.maximum(env, ndimage.gaussian_filter1d(env_soft, sg, axis=1, mode='nearest'))  # ด้านในคงเดิม ไล่ 0→1 ไม่มีขั้น
            sky = np.maximum(env, objm)
        else:
            env = core = np.zeros(sc.shape[:2], np.float32)
            sky = np.ones(sc.shape[:2], np.float32)
        sc = sc[:, p:]
        nh, nw = sc.shape[:2]
        if scomp is not None:
            # tone-match: ฟ้าของฉากที่ย่อ (รอบวัตถุ เหนือซอง) ปรับเข้าหาฟ้าที่เติม — ขนนุ่มรอบยอดไม่เป็นเงาสีต่าง
            from scipy import ndimage
            R = out[g.H - nh:, :nw]
            ws = (1 - env) * (1 - sky)                       # ฟ้าล้วนของฉากที่ย่อ (ไกลวัตถุ เหนือซอง)
            sig = 10 * g.fx
            den = ndimage.gaussian_filter(ws, sig)
            D = np.stack([ndimage.gaussian_filter(ws * (R[..., c] - sc[..., c]), sig) for c in range(3)], -1)
            D = D / np.maximum(den, 1e-3)[..., None] * _smooth(den / 0.05)[..., None]
            # ส่วนที่ขยายของซอง (env_soft − env): โชว์เฉพาะ "เนื้อฉากจริง" (สีต้นฉบับห่างฟ้าเติม — ภูเขา/น้ำจาง ๆ ที่ตัวตรวจไม่เจอ)
            # แบบไม่ปรับโทน (D ประเมินจากฟ้าจะกลืนเนื้อฉากเป็นสีฟ้าเติม = ขั้นสีตรงขอบซอง) · ฟ้าของฉากไม่โชว์ (ไม่เป็นเงารอบวัตถุ)
            lo, hi = ENV_SOFT_DIST
            content = (env_soft - env) * _smooth((np.sqrt(((R - sc) ** 2).sum(-1)) - lo) / (hi - lo))
            # เฉพาะแถบขอบในคอลัมน์ (x ≥ FOG_START − 31 → เต็มที่ FOG_START) ที่ซองขาดกลายเป็นเส้นตั้งข้างหมอก
            # — รอบตัวสถานที่ด้านในคงมาสก์เดิม (ไม่มีเงาฟ้ารอบซุ้ม np-16)
            xg = np.arange(nw) / g.fx                        # คอลัมน์ของ sc (ตัด p แล้ว) = คอลัมน์ภาพผล
            content = content * _smooth((xg - (FOG_START - 31)) / 31)[None, :]
            envc = env + content                             # ≤ env_soft ≤ 1 — ต่อเนื่องข้ามขอบซอง (ไม่มีเส้นสว่างบาง ๆ)
            sc = sc + D * ((1 - core) * (1 - envc))[..., None]
            sky = np.maximum(sky, envc)
        my = _smooth(np.arange(nh) / max(1, 24 * g.fy))[:, None]
        mx = _smooth((nw - 1 - np.arange(nw)) / max(1, BOX_FADE * g.fx))[None, :]
        m = (my * mx * sky)[..., None]
        out[g.H - nh:, :nw] = sc * m + out[g.H - nh:, :nw] * (1 - m)
        out = a * cmask + out * (1 - cmask)
    # ใต้สันคลื่น = คลื่นเดิม (แทน _paste_band ฝั่งสถานที่ ที่ซ้อนพุ่มไม้เดิมไม่ย่อทับพุ่มที่ย่อเป็นแถบเลอะ — Fable รอบ 1 np-18)
    crest = wave_crest(orig, g, fallback=True)
    yy = np.arange(g.H)[:, None]
    below = _smooth((yy - crest[None, :] + 2 * g.fy) / (6 * g.fy))
    keep = below[..., None]
    if s < 0.999 or shift:
        # มุมล่างฝั่งสถานที่: ตะเข็บต้นทุนต่ำสุดระหว่าง "ของเดิม" (ดอกไม้มุม+คลื่นเดิม) กับฉากที่ย่อ — ไม่ผ่าดอกไม้ที่สัน
        # ไม่ซ้อนพุ่มไม้เดิมกับพุ่มที่ย่อ (ไม่มีขนนุ่มกว้างแบบ _paste_band) · นอกมุม = สันคลื่นเป็นเส้นแบ่ง
        seam = corner_seam(out, orig, crest, g)
        keep = np.maximum(below, seam)[..., None]
        out = out * (1 - keep) + orig * keep
    if feather:
        far = far_colors(out, g)
        xs = np.arange(g.W) / g.fx; ys = np.arange(g.H)
        ax = fog_ramp(orig, g)
        # ล่าง: ม่านเต็มจนถึงสันคลื่น (จาง 10 px) — ของนุ่มที่อยู่หลังคลื่นถูกตัดตามแนวโค้งคลื่น ไม่เป็นเส้นตรง
        ay = _smooth((ys / g.fy - 300) / 40)[:, None] * (1 - _smooth((ys[:, None] - crest[None, :] + 8 * g.fy) / (10 * g.fy)))
        # ดอกไม้มุมล่างฝั่งรูป (ต่อลงถึงคลื่น) ไม่ถูกม่าน
        corner = fmask if fmask is not None else flower_mask_br(_design(orig), g)
        al = (ay * ax * (1 - corner))[..., None]
        base = np.repeat(far[:, None, :], g.W, axis=1)
        if edge is not None:
            # พื้นสังเคราะห์: สีแถบไกลต่อแถว ไล่จากสีฟ้าขอบคอลัมน์สถานที่ที่ x 370 → สีแถบไกลที่ x 910
            wx = (1 - _smooth((xs - HARD_EDGE_X) / (910 - HARD_EDGE_X)))[None, :, None]
            base = base + (edge - far)[:, None, :] * wx
        out = out * (1 - al) + base * al
    if s < 0.999 or shift:
        # ฝั่งสถานที่ (x < 370): แบ่งที่สันคลื่น + ดอกไม้มุมเดิม · ฝั่งรูป (x ≥ 400): แถบล่างเดิม 9% แบบ _paste_band (ผลเดิมที่ผ่านตาแล้ว)
        H = g.H; bh = int(0.09 * H)
        pb = np.zeros(H, np.float32)
        pb[H - bh:] = _smooth(np.arange(bh, dtype=np.float32) / (bh * 0.4))
        xs = np.arange(g.W) / g.fx
        ph = _smooth((xs - HARD_EDGE_X) / 30)[None, :, None]
        k2 = keep * (1 - ph) + np.maximum(pb[:, None, None], below[..., None]) * ph
        out = out * (1 - k2) + orig * k2
    else:
        out = _paste_band(out, orig)
    return out


def _fill_crest(first, ok, g):
    """คอลัมน์ที่ไม่น่าเชื่อ: ช่องในตีเส้นตรงระหว่างคอลัมน์ที่เชื่อได้ · ปลายสองข้าง (ใต้ดอกไม้มุม) ต่อเส้นตรงตามความชัน
    ของคอลัมน์ที่เชื่อได้ 120 px ใกล้สุด (|ชัน| ≤ 0.6) — คลื่นเป็นโค้งเรียบ ไม่กระโดดเป็นขั้นแบบใช้ขอบสีคลื่นแทน"""
    xs = np.arange(len(first)); idx = np.nonzero(ok)[0]
    out = np.interp(xs, idx, first[idx])
    span = g.x(120)
    for side in (0, 1):
        e = idx[0] if side == 0 else idx[-1]
        near = idx[idx <= e + span] if side == 0 else idx[idx >= e - span]
        if len(near) >= 8:
            sl = float(np.clip(np.polyfit(near, first[near], 1)[0], -0.6, 0.6))
        else:
            sl = 0.0
        sel = xs < e if side == 0 else xs > e
        out[sel] = first[e] + sl * (xs[sel] - e)
    return out


def _wave_top(isb, ok, first, g):
    """สันจากขอบบนของก้อนสีคลื่นที่ต่อถึงแถวล่างสุด (ชดเชยด้วยระยะต่างมัธยฐานกับคอลัมน์ ok)
    ใช้ได้เมื่อชดเชย ≤ 40 px และตรงกับคอลัมน์ ok (มัธยฐานคลาด ≤ 8 px) — ไม่งั้นคืน None (ใช้ _fill_crest)
    ช่วงริมภาพที่ก้อนคลื่นไปติดดอกไม้มุม (กระโดดขึ้น > 25 px) ตัดทิ้งแล้วต่อเส้นตรงตามความชันจากช่วงหลัก"""
    from scipy import ndimage
    lab, _ = ndimage.label(isb, structure=np.ones((3, 3)))
    cnt = np.bincount(lab[-1], minlength=lab.max() + 1); cnt[0] = 0
    if cnt.max() == 0:
        return None
    wm = lab == cnt.argmax()
    has = wm.any(axis=0)
    top = np.where(has, wm.argmax(axis=0), -1).astype(np.float64)
    sel = ok & has
    if sel.sum() < g.x(30):
        return None
    off = float(np.median(top[sel] - first[sel]))
    mad = float(np.median(np.abs(top[sel] - off - first[sel])))
    if abs(off) > 40 * g.fy or mad > 8 * g.fy:
        return None
    c = top - off
    xs = np.arange(len(c))
    good = has.copy()
    # แบ่งช่วงที่ต่อเนื่อง (กระโดด ≤ 25 px) — ช่วงริมที่สั้นกว่า 240 px และสูงกว่าช่วงข้างเคียง = ดอกไม้มุม
    jump = np.abs(np.diff(c)) > 25 * g.fy
    edges = np.concatenate([[0], np.nonzero(jump)[0] + 1, [len(c)]])
    for i in range(len(edges) - 1):
        a0, a1 = edges[i], edges[i + 1]
        if a1 - a0 >= g.x(240) or (a0 > 0 and a1 < len(c)):
            continue
        nb = c[a1] if a0 == 0 else c[a0 - 1]
        if np.median(c[a0:a1]) < nb - 25 * g.fy:
            good[a0:a1] = False
    if good.sum() < g.x(120):
        return None
    return _fill_crest(c, good, g)


def wave_crest(a, g, fallback=False, with_ok=False):
    """สันคลื่นต่อคอลัมน์ (พิกเซล): แถวแรกใต้ y 1320 ที่อิ่มสี (เส้นทอง) หรือเข้ม (ตัวคลื่น)
    ใช้เฉพาะคอลัมน์ที่เหนือสัน 24 px เป็นฟ้าสว่างจาง (ไม่ใช่ดอกไม้มุม) แล้วเติมคอลัมน์อื่นด้วยเส้นต่อเนื่อง (_fill_crest)
    + กรองมัธยฐาน 41 px + เกลี่ย gaussian 16 px (ไม่มีขั้นแนวดิ่ง) · with_ok → คืน (สัน, คอลัมน์ที่วัดได้จริง)"""
    y0, y1 = g.y(1320), g.y(1530)
    _, s, v = _rgb_to_hsv(a[y0:y1])
    hit = (s >= 0.30) | (v * 255 <= 150)
    has = hit.any(axis=0)
    first = np.where(has, hit.argmax(axis=0), y1 - y0 - 1)
    # คอลัมน์ที่เชื่อถือได้: ช่วง 24 px เหนือสันเป็นฟ้าสว่างจาง
    yy = np.arange(y1 - y0)[:, None]
    above = (yy < first[None, :]) & (yy >= first[None, :] - g.y(24))
    clean = ((s < 0.25) & (v > 0.70)) | ~above
    ok = has & clean.all(axis=0) & (first >= g.y(24))
    xs = np.arange(len(first))
    if ok.sum() < g.x(60) and not fallback:
        return None                       # สันคลื่นถูกฉาก/ดอกไม้บังเกือบทั้งแถบ (ฉาก bottom) — ผู้เรียกใช้ทางเดิม
    # คอลัมน์ที่ถูกบัง (ดอกไม้/พุ่มไม้หน้าคลื่น): ใช้ขอบบนของ "สีคลื่น" (เทียบสีแถว 1505–1530 ของคอลัมน์ใกล้เคียง)
    # ชดเชยด้วยระยะต่างเฉลี่ยกับสันจริงในคอลัมน์ที่เชื่อถือได้ (ขอบสีคลื่นอยู่ใต้เส้นทองราว 20–30 px)
    from scipy import ndimage
    band = ndimage.median_filter(np.median(a[g.y(1505):g.y(1530)], axis=0), size=(g.x(61), 1), mode='nearest')
    isb = np.sqrt(((a[y0:] - band[None]) ** 2).sum(-1)) < 55
    isb = ndimage.binary_opening(isb, structure=np.ones((5, 1)))
    rev = isb[::-1]
    run = np.where(rev.all(axis=0), isb.shape[0], np.argmin(rev, axis=0))   # จำนวนแถวต่อเนื่องจากล่าง
    btop = ndimage.median_filter((isb.shape[0] - run).astype(np.float64), g.x(41), mode='nearest')
    off = float(np.median(btop[ok] - first[ok])) if ok.sum() >= g.x(60) else 25 * g.fy
    ok &= np.abs(btop - off - first) <= 25 * g.fy        # ตัดคอลัมน์ที่เจอขอบดอกไม้แทนเส้นทอง
    wt = _wave_top(isb, ok, first, g)
    if wt is not None:
        # ขอบบนของ "ก้อนคลื่นใหญ่" (component เดียวกับแถวล่างสุด) ลบระยะชดเชย — ตามโค้งคลื่นจริงทั้งฝั่งฉาก
        # (ฝั่งฉากเหนือคลื่นไม่ใช่ฟ้า จึงไม่มีคอลัมน์ ok) · คอลัมน์ ok ที่ห่างเกิน 15 px = ขอบดอกไม้ ตัดทิ้ง
        ok &= np.abs(wt - first) <= 15 * g.fy
        first = np.where(ok, first, wt).astype(np.float64)
    elif ok.sum() >= 8:
        first = _fill_crest(first.astype(np.float64), ok, g)
    else:
        first = (btop - off).astype(np.float64)
    first = first + y0
    k = g.x(20)
    pad = np.pad(first, k, mode='edge')
    med = np.array([np.median(pad[i:i + 2 * k + 1]) for i in range(len(first))])
    med = ndimage.gaussian_filter1d(med, g.x(16), mode='nearest')
    med = np.clip(med, g.y(1330), g.y(1530))
    return (med, ok) if with_ok else med


# ขอบแข็งด้านในของสถานที่ (หน่วยออกแบบ พิกัดภาพจริง) ที่ Fable วัดด้วยตา §8.5 — ใช้ค่าที่กว้างกว่าระหว่างนี้กับตัวตรวจอัตโนมัติ
# side-L = ขอบขวาสุดของสิ่งก่อสร้าง · side-R = ขอบซ้ายสุด (ลานฐาน np-13 เป็นเส้นเฉียง ตัวตรวจเส้นตั้งมองไม่เห็น)
HARD_HINTS = {'np-11': 310, 'np-15': 500, 'np-18': 546, 'np-13': 589, 'np-16': 495, 'np-20': 563}


def hard_extent(d, thr=15, run=60):
    """ขอบขวาสุด (พิกัด side-L) ของเส้นตั้งยาว ≥ 60 px (|∂L/∂x| > 15 ต่อเนื่อง ≥ 90%) ใน y 300–1300, x < 800
    = สิ่งก่อสร้าง (องค์ธาตุ/อาคาร/ซุ้ม) — ใบไม้/เมฆ/น้ำไม่มีเส้นตั้งยาว"""
    from scipy import ndimage
    L = ndimage.gaussian_filter(_lum(d).astype(np.float64), 1.0)
    gx = np.pad(np.abs(L[:, 2:] - L[:, :-2]), ((0, 0), (1, 1))) > thr
    gx = ndimage.binary_dilation(gx, structure=np.ones((1, 3)))
    r = ndimage.uniform_filter1d(gx.astype(np.float32), run, axis=0) >= 0.9
    r[:300] = False; r[1300:] = False
    cols = np.nonzero(r[:, :800].any(axis=0))[0]
    return int(cols.max()) if len(cols) else 0


def hard_edge_frac(d):
    """§8.1 ข้อ 4: สัดส่วนแถว 420–1300 ที่ std > 3 ใน x 370–400 (ก่อน feather)"""
    return float((_row_dev(_lum(d)[420:1300], HARD_EDGE_X, 400) > 3).mean())


def fit_side_v3(src, dst, side, max_scale=None):
    full = _arr(Image.open(src))
    if side == 'side-R':
        full = full[:, ::-1].copy()
    log = []
    full, gfrac = degreen(full)
    log.append(f'ล้างเขียว {gfrac * 100:.2f}%')
    small = _design(full)
    tip, comp = side_tip(small, with_mask=True)
    _, scomp = side_tip(small, x1=760, with_mask=True)        # ตัวฉากกว้าง (รวมของนุ่ม) ไว้ทำมาสก์เส้นขอบฟ้า
    if scomp is not None:
        scomp = tight_objects(small, scomp)                    # รายพิกเซล — ไม่กินฟ้าข้างยอด
    fsmall = flower_mask_br(small, G(small))
    wcs = wave_crest(small, G(small), fallback=True, with_ok=True)   # สันคลื่นของต้นฉบับ — ใช้หรี่คลื่นให้ตรงกับที่แปะคลื่นเดิม
    if tip is None:
        print(f'{side} · ไม่พบสถานที่ในคอลัมน์ — สร้างใหม่ (ไม่บันทึก {dst})'); return 1
    s_tip = min(1.0, (1380 - SIDE_TIP_MIN) / max(1, 1380 - tip))
    if max_scale:
        s_tip = min(s_tip, max_scale)
    auto = hard_extent(small)
    hid = os.path.splitext(os.path.basename(src))[0]
    hint = HARD_HINTS.get(hid)
    if hint is not None and side == 'side-R':
        hint = 1024 - hint
    hard = max(auto, hint or 0)
    log.insert(0, f'ยอดจริง {tip} · ขอบแข็ง {hard if side == "side-L" else 1024 - hard}'
                  f' (ตัวตรวจ {auto if side == "side-L" else 1024 - auto}' + (f', Fable {HARD_HINTS[hid]})' if hint is not None else ')'))
    best, tried = None, None
    for s in np.round(np.arange(s_tip, MIN_SCALE_SIDE - 1e-6, -0.01), 2):
        need = max(0, int(np.ceil((hard * s - (HARD_EDGE_X - 18)) / 4)) * 4)   # ขอบแข็งหลังย่อ+เลื่อน ≤ 352 (ก่อนขนนุ่มขอบในฉาก)
        for shift in range(need, MAX_SHIFT + 1, 4):
            ef = hard_edge_frac(side_build(small, s, shift, tip, feather=False, comp=comp, scomp=scomp))
            if best is None or ef < best[0]:
                best = (ef, s, shift)
            if ef > HARD_EDGE_MAX:
                continue
            im = side_build(small, s, shift, tip, comp=comp, scomp=scomp, fmask=fsmall)
            im = ornament_veil(im, [])
            im = darken_wave(im, fallback=True, crest=wcs[0], ok=wcs[1])[0]
            k = veil_column_auto(_img(im), 'side-L')[0]
            r = qa(_arr(veil_column(_img(im), 'side-L', k)), 'side-L')
            if not _fails(r):
                return _finish_side(full, dst, side, s, shift, tip, ef, log, comp, scomp)
            tried = tried or (s, shift, _fails(r), r)
    if best is None:
        print(f'{side} · {" · ".join(log)} · ซ่อมไม่ได้: ขอบแข็ง {hard} ต้องย่อ {(HARD_EDGE_X + MAX_SHIFT) / hard:.2f} '
              f'< เพดาน {MIN_SCALE_SIDE} — สร้างใหม่ (ไม่บันทึก {dst})')
        return 1
    msg = f'ขอบแข็งใน x 370–400 ต่ำสุด {best[0] * 100:.0f}% ที่ s {best[1]:.2f} เลื่อน {best[2]} (เกณฑ์ ≤ {HARD_EDGE_MAX * 100:.0f}%)'
    if tried:
        msg += f' · ค่าแรกที่ขอบผ่าน s {tried[0]:.2f} เลื่อน {tried[1]} ยังตก ' + ', '.join(f'{k} {tried[3][k][1]}' for k in tried[2])
    print(f'{side} · {" · ".join(log)} · ซ่อมไม่ได้ภายใต้เพดาน s ≥ {MIN_SCALE_SIDE} เลื่อน ≤ {MAX_SHIFT}: {msg} — สร้างใหม่ (ไม่บันทึก {dst})')
    return 1


def _finish_side(full, dst, side, s, shift, tip, ef, log, comp=None, scomp=None):
    im = side_build(full, s, shift, tip, comp=comp, scomp=scomp)
    newtip = 1536 - s * (1536 - (tip))
    topfill = max(0, newtip - (tip - 60)) if s < 0.999 else 0
    log.append(f'ย่อ {s:.2f} (ยอด {tip} → {newtip:.0f})' if s < 0.999 else 'ไม่ย่อ')
    if shift:
        log.append(f'เลื่อนฉาก{"ซ้าย" if side == "side-L" else "ขวา"} {shift}')
    log.append(f'ขอบแข็งใน x 370–400 {ef * 100:.0f}% · หมอก x {FOG_START}±{FOG_WOBBLE}→{FOG_END}')
    if topfill > TOP_FILL_MAX:
        log.append(f'คำเตือน: เติมฟ้าบน {topfill:.0f} px > {TOP_FILL_MAX} (ดูตา)')
    im = ornament_veil(im, log)
    wc, wok = wave_crest(full, G(full), fallback=True, with_ok=True)
    im, bm = darken_wave(im, fallback=True, crest=wc, ok=wok)
    if bm:
        log.append(f'หรี่คลื่นล่าง ({bm:.0f}→≤112, คลื่น ×{darken_wave.last[0]:.2f}, เงาทองเหนือสัน {darken_wave.last[1]:.2f})')
    img = _img(im)
    k, m, sd, ok = veil_column_auto(img, 'side-L')
    out = _arr(veil_column(img, 'side-L', k))
    log.append(f'veil {k:.2f} (คอลัมน์รูป mean {m:.0f}, std {sd:.1f})')
    r = qa(out, 'side-L')
    if _fails(r):
        print(f'{side} · {" · ".join(log)} — ภาพเต็มยังตก {_fails(r)} (ไม่บันทึก {dst})'); return 1
    if side == 'side-R':
        out = out[:, ::-1]
    _img(out).save(dst)
    print(f'{side} · ' + ' · '.join(log))
    return 0


# ---------- ฉาก bottom §8.2 ----------
def bottom_build(a, lt, s, g=None):
    """§8.2 ย่อแถบเต็มกว้าง y lt−40 → 1536 ยึดกลางล่าง (512, 1536) · ช่องข้าง mirror-extend · ช่องบนไล่ฟ้า (ขนนุ่ม 80)
    · แปะแถบคลื่นเดิม (y ≥ 90%) + กล่องดอกไม้มุมล่างเดิม x < 260 / > 764, y > 1250 (ขนนุ่ม 40)"""
    g = g or G(a)
    out = a.copy()
    # ช่องบน: ไล่ฟ้าต่อจากแถว lt−60 ด้วย slope จาก 120 px เหนือขึ้นไป (ต่อคอลัมน์ ตัดลาย/วัตถุออกก่อน)
    yr = g.y(lt - 60)
    ref = _sky_row(a[max(0, yr - g.y(8)):yr + 1])
    pad = 80 / s
    Y0 = g.y(max(0, lt - 40 - pad))
    sc = _resample(a, 0, Y0, g.W, g.H, s)
    nh, nw = sc.shape[:2]
    x0 = (g.W - nw) // 2; rw = g.W - x0 - nw
    full = np.concatenate([sc[:, 1:x0 + 1][:, ::-1], sc, sc[:, nw - 1 - rw:nw - 1][:, ::-1]], axis=1)
    # ไล่ฟ้าแนวดิ่ง: จากแถว lt−60 เดิม → สีฟ้าแถวบนสุดของฉากที่ย่อ (ต่อเนื่องทั้งสองขอบ ไม่เกิดแถบสว่าง/มืด)
    ytop = g.H - nh
    top = _sky_row(full[:g.y(8)])
    ys = np.arange(yr, g.H)
    t = _smooth((ys - yr) / max(1, ytop + g.y(40) - yr))[:, None, None]
    out[yr:] = ref[None] * (1 - t) + top[None] * t
    my = _smooth(np.arange(nh) / max(1, 80 * g.fy))[:, None, None]
    out[g.H - nh:] = full * my + out[g.H - nh:] * (1 - my)
    out = _paste_band(out, a)
    xs = np.arange(g.W) / g.fx; yd = np.arange(g.H) / g.fy
    cx = np.maximum(1 - _smooth((xs - 220) / 40), _smooth((xs - 764) / 40))
    m = (_smooth((yd - 1250) / 40)[:, None] * cx[None, :])[..., None]
    return a * m + out * (1 - m)


def _lt_fast(d):
    """landmark_top แบบ check-bg ฉาก bottom (x 230–800 จาก y 384) — เวกเตอร์"""
    dev = _row_dev_full(_lum(d), 230, 800)
    o = np.nonzero(dev[384:1382] > 3)[0]
    return int(o[0] + 384) if len(o) else None


def fit_bottom_v3(src, dst):
    a = _arr(Image.open(src))
    log = []
    a, gfrac = degreen(a)
    log.append(f'ล้างเขียว {gfrac * 100:.2f}%')
    lt = landmark_top(_img(a))
    log.insert(0, f'landmark {lt}')
    img = a
    s = 1.0
    if lt is not None and lt < TARGET:
        d = TARGET - lt
        if d <= STRETCH_MAX_V3:
            img = _arr(shift_down(_img(a), d)); log.append(f'ยืดฟ้า {d}')
        else:
            g = G(a)
            small = _design(a)
            s0 = float(np.clip((1380 - BOTTOM_TARGET) / (1380 - lt), MIN_SCALE_BOTTOM, 1))
            # ค้นหา s ใหญ่สุด (ฉากเล็กลงน้อยสุด) ที่ landmark ใหม่ ≥ 900 (เผื่อ 5 จาก 895)
            chosen = None
            for s in np.round(np.arange(1.0, MIN_SCALE_BOTTOM - 1e-6, -0.01), 2):
                t = _lt_fast(bottom_build(small, lt, s))
                if t is None or t >= BOTTOM_TARGET - 8:
                    chosen = s; break
            s = MIN_SCALE_BOTTOM if chosen is None else chosen
            img = bottom_build(a, lt, s, g)
            nt = landmark_top(_img(img))
            log.append(f'ย่อ {s:.2f} (สูตร {s0:.2f}) ช่องข้าง {512 * (1 - s):.0f} px mirror → landmark {nt}')
            if nt is not None and nt < BOTTOM_TARGET - 8:
                r = min(RESIDUAL_SHIFT_MAX, BOTTOM_TARGET - nt)
                img = _arr(shift_down(_img(img), r))
                log.append(f'เศษ shift_down {r} (ฐานจมได้ ≤ 24 — ดูตา)')
    img = ornament_veil(img, log)
    img, bm = darken_wave(img)
    if bm:
        log.append(f'หรี่คลื่นล่าง ({bm:.0f}→≤112' + (f', คลื่น ×{darken_wave.last[0]:.2f}, เงาทองเหนือสัน {darken_wave.last[1]:.2f})' if darken_wave.last else ')'))
    img = _img(img)
    tmp = dst + '.tmp.png'
    img.save(tmp)
    k, m, sd = veil.auto(tmp, dst)
    os.remove(tmp)
    log.append(f'veil {k:.2f} (mean {m:.0f}, std {sd:.1f})')
    r = qa(_arr(Image.open(dst)), 'bottom')
    if _fails(r):
        os.remove(dst)   # ไม่บันทึกผลที่ไม่ผ่าน — กันขั้นถัดไปหยิบไปใช้
        print('bottom · ' + ' · '.join(log) + ' — ยังตก ' + ', '.join(f'{k} {r[k][1]}' for k in _fails(r)) + f' (ไม่บันทึก {dst})')
        return 1
    print('bottom · ' + ' · '.join(log))
    return 0


def fit(src, dst):
    img = Image.open(src).convert('RGB')
    lt = landmark_top(img)
    msg = f'landmark {lt}'
    if lt is not None and lt < TARGET:
        d = TARGET - lt
        if d > 170:
            print(f'{msg}: ต้องเลื่อน {d} มากเกินไป — ควรสร้างใหม่'); 
        img = shift_down(img, min(d, 170))
        msg += f' → เลื่อนลง {min(d, 170)}'
    img, bm = darken_band(img)
    if bm:
        msg += f' · หรี่แถบล่าง ({bm:.0f}→≤112)'
    tmp = dst + '.tmp.png'
    img.save(tmp)
    k, m, s = veil.auto(tmp, dst)
    os.remove(tmp)
    print(f'{msg} · veil {k:.2f} (mean {m:.0f}, std {s:.1f})')


if __name__ == '__main__':
    args = sys.argv[1:]
    scene = None
    if '--scene' in args:
        i = args.index('--scene'); scene = args[i + 1]; del args[i:i + 2]
    max_scale = None
    if '--max-scale' in args:
        i = args.index('--max-scale'); max_scale = float(args[i + 1]); del args[i:i + 2]
    if scene is None:
        fit(args[0], args[1])                          # ชุดเดิม (v2) — ผลเหมือนเดิมทุกบิต
    elif scene == 'bottom':
        sys.exit(fit_bottom_v3(args[0], args[1]))      # ระบุ --scene = ชุด v3 (§8)
    elif scene in SIDES:
        sys.exit(fit_side_v3(args[0], args[1], scene, max_scale))   # exit 1 = ซ่อมไม่ได้ ควรสร้างใหม่
    else:
        sys.exit(f'scene ไม่ถูกต้อง: {scene} (bottom | side-L | side-R)')
