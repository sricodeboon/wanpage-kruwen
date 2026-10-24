#!/usr/bin/env python3
"""ภาพแบรนด์ "ครูวัน" → site/assets/brand/ + ไอคอนแอป (สเปก docs/design/logo-ux-v1.md A4, C3)

ใช้:
  python3 tools/make-brand.py --sheet ภาพ.png   แผ่น 2x2 พื้นขาวจาก ChatGPT (พรอมต์ C1)
                                               ซ้ายบน=ครึ่งตัววันทยหัตถ์ ขวาบน=โบกมือ ซ้ายล่าง=ชูมือถือ+โป้ง ขวาล่าง=ชี้
  python3 tools/make-brand.py --bust ภาพ.png    (เสริม) ภาพ bust แยกจากพรอมต์ C2 ใช้แทนท่า 1
  python3 tools/make-brand.py                   ภาพชั่วคราวจาก assets/mascots/cut/teacher-m.png (ยังไม่มีแผ่นจริง)
  --dry-run                                     แยกท่า + เขียนภาพตรวจ (4 ท่าบนพื้นม่วง) ลงโฟลเดอร์ชั่วคราว ไม่เขียนทับ site/
  --keep-holes                                  ไม่ลบพื้นขาวที่ถูกตัวละครล้อม (ถ้าลบผิด เช่นกระดาษ/จอมือถือสีขาวล้วน)
  --no-icons                                    ไม่เรียก tools/make-icons.mjs ต่อ

ได้: kruwan-bust.png (512², โปร่งใส) + kruwan-wave/thumb/point.png (สูง 640) + .webp คู่
     ตำแหน่งตา/สีผิวสำหรับกะพริบตา (D2) เขียนลงบล็อก brand:eyes ใน site/styles.css
ชื่อไฟล์คงเดิมทุกครั้ง → สลับภาพจริงได้โดยไม่ต้องแก้โค้ดเว็บ"""
import argparse, io, os, re, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site/assets/brand')
CSS = os.path.join(ROOT, 'site/styles.css')
TEMP_SRC = os.path.join(ROOT, 'assets/mascots/cut/teacher-m.png')
BUST, FULL_H = 512, 640
POSES = ['bust', 'wave', 'thumb', 'point']  # ลำดับในแผ่น: ซ้ายบน ขวาบน ซ้ายล่าง ขวาล่าง
LIMIT = 60 * 1024


# ---------- ลบพื้นขาว (flood จากขอบภาพ เหมือน cut-mascots.py) ----------
def cut_white(rgb, hole_frac=0.002, keep_holes=False):
    """คืน mask ตัวละคร · พื้น = ขาว/เทาอ่อนอิ่มตัวต่ำที่ต่อถึงขอบภาพ — ตาขาว/ฟันไม่หลุดเพราะมีเส้นขอบเข้มล้อม
    พื้นที่ถูกล้อม (ช่องแขนวันทยหัตถ์ ช่องแขน-ลำตัว ช่องระหว่างท่าที่ชนกัน) ลบด้วยถ้า ≥ hole_frac ของภาพ และสีเท่าพื้น"""
    a = rgb.astype(np.int16)
    mx, mn = a.max(axis=2), a.min(axis=2)
    soft = (mn > 228) | ((mn > 200) & (mx - mn < 24))
    lab, n = ndimage.label(soft)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    bg = np.isin(lab, border)
    fg = ~bg
    if n and not keep_holes:
        bgc = np.median(rgb[bg], axis=0) if bg.any() else np.full(3, 255.0)
        idx = np.setdiff1d(np.arange(1, n + 1), border)
        sizes = ndimage.sum(soft, lab, idx)
        big = idx[sizes >= rgb.shape[0] * rgb.shape[1] * hole_frac]
        if big.size:
            means = np.stack([ndimage.mean(rgb[..., c], lab, big) for c in range(3)], axis=1)
            spread = ndimage.standard_deviation(mn, lab, big)
            holes = big[(np.abs(means - bgc).max(axis=1) <= 8) & (spread <= 8)]  # ขาวเรียบเท่าพื้น ไม่ใช่ตาขาว/ช้างบนตรา
            for i in holes:
                ys, xs = np.where(lab == i)
                print(f'ลบพื้นขาวที่ถูกล้อม: x {xs.min()}–{xs.max()} y {ys.min()}–{ys.max()} ({ys.size} px) — ถ้าลบผิดใช้ --keep-holes')
            fg &= ~np.isin(lab, holes)
    return ndimage.binary_opening(fg, iterations=2)


def alpha_from(mask):
    al = ndimage.gaussian_filter(mask.astype(np.float32), 0.8)
    return (np.clip((al - 0.15) / 0.7, 0, 1) * 255).astype(np.uint8)


def defringe(rgba):
    """ขอบกึ่งโปร่งใสที่ยังมีสีพื้นขาวปน → ดึงสีจากเนื้อในข้างเคียง (ไม่ให้เห็นขอบขาวบนพื้นม่วง #3b1470)"""
    a = rgba[..., 3]
    solid = a >= 250
    if not solid.any():
        return rgba
    idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    near = rgba[..., :3][idx[0], idx[1]]
    edge = (a > 0) & ~solid
    rgba[..., :3][edge] = near[edge]
    return rgba


def largest_parts(mask, min_frac=0.02):
    lab, n = ndimage.label(mask)
    if not n:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * min_frac]
    return np.isin(lab, keep)


def to_rgba(rgb, mask):
    rgba = np.dstack([rgb.astype(np.uint8), alpha_from(mask)])
    return defringe(rgba)


def trim(rgba):
    ys, xs = np.where(rgba[..., 3] > 8)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


# ---------- แยก 4 ท่าจากแผ่น 2x2 ----------
# แยกตาม "ก้อน" ไม่ใช่ผ่าครึ่งตายตัว: ท่าที่ล้ำเส้นกลาง (โบกมือสูง/เอียงตัวชี้) ไม่ถูกตัดแขนขา
# และชิ้นของท่าข้าง ๆ ไม่ติดมา · ก้อนใหญ่จัดเข้าช่องตามจุดศูนย์กลาง ก้อนเล็กเข้าท่าที่อยู่ใกล้ที่สุด
CELL_NAMES = ['ซ้ายบน', 'ขวาบน', 'ซ้ายล่าง', 'ขวาล่าง']


def quadrant(cy, cx, H, W):
    return (2 if cy >= H / 2 else 0) + (1 if cx >= W / 2 else 0)


def cut_merged(lab, comp, empty, H, W, big_px):
    """ท่าสองท่าแตะกันจนเป็นก้อนเดียว → กัดขอบก้อนทีละชั้นจนแยกเป็น 2 ก้อนใหญ่ แล้วแบ่งทุกพิกเซลตามก้อนที่ใกล้สุด
    แยกไม่ได้ (ทับกันมาก) → ผ่าตรงเส้นกึ่งกลางแผ่น · คืนส่วนที่อยู่ฝั่งช่องว่าง"""
    m = lab == comp
    ys, xs = np.where(m)
    home = quadrant(ys.mean(), xs.mean(), H, W)
    ey, ex = (0.75 if empty >= 2 else 0.25) * H, (0.75 if empty % 2 else 0.25) * W
    for k in range(1, 41):
        lab2, n2 = ndimage.label(ndimage.binary_erosion(m, iterations=k))
        if n2 < 2:
            continue
        sizes = ndimage.sum(lab2 > 0, lab2, range(1, n2 + 1))
        seeds = np.argsort(sizes)[::-1][:2] + 1
        if sizes[seeds[1] - 1] < big_px * 0.25:
            continue
        cents = [ndimage.center_of_mass(lab2 == i) for i in seeds]
        mine = seeds[int(np.argmin([(cy - ey) ** 2 + (cx - ex) ** 2 for cy, cx in cents]))]
        seed_map = np.where(np.isin(lab2, seeds), lab2, 0)
        idx = ndimage.distance_transform_edt(seed_map == 0, return_distances=False, return_indices=True)
        part = m & (seed_map[idx[0], idx[1]] == mine)
        print(f'เตือน: ท่า{CELL_NAMES[home]}กับท่า{CELL_NAMES[empty]}ชนกัน — แยกอัตโนมัติแล้ว แต่ส่วนที่ทับกัน (เช่นรองเท้าบนหมวก) อาจไปอยู่ผิดท่า'
              ' ตรวจภาพด้วย --dry-run หรือสั่ง ChatGPT ให้เว้นระยะระหว่างท่า')
        return part
    side = np.zeros_like(m)
    if (home ^ empty) == 2:
        side[H // 2:] = True
        low = empty >= 2
    else:
        side[:, W // 2:] = True
        low = empty % 2 == 1
    print(f'เตือน: ท่า{CELL_NAMES[home]}กับท่า{CELL_NAMES[empty]}ทับกันมาก — ผ่าตรงกลางแผ่น แขน/เท้าอาจขาด (ตรวจภาพด้วย --dry-run)')
    return m & (side if low else ~side)


def split_sheet(path, keep_holes=False):
    im = Image.open(path)
    rgb = np.asarray(im.convert('RGB'))
    H, W = rgb.shape[:2]
    alpha = np.asarray(im.convert('RGBA'))[..., 3]
    if alpha.min() >= 250:
        alpha = None
        fg = cut_white(rgb, hole_frac=0.0005, keep_holes=keep_holes)  # ช่องละ 1/4 แผ่น → 0.2% ของช่อง
    else:
        fg = alpha > 127  # แผ่นโปร่งใสอยู่แล้ว (ChatGPT) — ใช้ alpha เดิม ช่องระหว่างแขนกับหัวจึงหายเอง
    lab, n = ndimage.label(fg)
    if not n:
        sys.exit('แยกท่าไม่ได้: ไม่พบตัวละครบนพื้นขาว')
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    big_px, speck_px = H * W * 0.02, H * W * 0.00005
    poses = [np.zeros((H, W), bool) for _ in range(4)]
    for i in np.flatnonzero(sizes >= big_px) + 1:
        cy, cx = ndimage.center_of_mass(lab == i)
        poses[quadrant(cy, cx, H, W)] |= lab == i
    for q in range(4):
        if poses[q].any():
            continue
        # ช่องว่าง: ก้อนใหญ่ของช่องข้าง ๆ กินเข้ามามากพอ = ท่าชนกัน → ผ่า
        qy, qx = (slice(H // 2, H) if q >= 2 else slice(0, H // 2)), (slice(W // 2, W) if q % 2 else slice(0, W // 2))
        cnt = np.bincount(lab[qy, qx].ravel(), minlength=n + 1)
        cnt[0] = 0
        comp = int(np.argmax(cnt))
        if cnt[comp] < big_px * 0.5:
            sys.exit(f'แยกท่าไม่ได้: ช่อง{CELL_NAMES[q]}ไม่มีตัวละคร — แผ่นต้องเป็นกริด 2x2 พื้นขาว 4 ท่า')
        part = cut_merged(lab, comp, q, H, W, big_px)
        for p in poses:
            p &= ~part
        poses[q] = part
    for q, p in enumerate(poses):
        if not p.any():
            sys.exit(f'แยกท่าไม่ได้: ช่อง{CELL_NAMES[q]}ว่างหลังผ่าก้อน — ตรวจแผ่นด้วยตา')
    # ก้อนเล็ก (มือ/ปลายเท้าที่ขาดจากตัว ประกายดาว) → ท่าที่ใกล้สุดภายในระยะ 3% ของด้านยาว ไกลกว่านั้น = ขยะ ทิ้ง
    dists = [ndimage.distance_transform_edt(~p) for p in poses]
    near = max(H, W) * 0.03
    taken = np.logical_or.reduce(poses)
    for i in np.flatnonzero((sizes >= speck_px) & (sizes < big_px)) + 1:
        m = (lab == i) & ~taken
        if not m.any():
            continue
        d = [float(dd[m].min()) for dd in dists]
        q = int(np.argmin(d))
        if d[q] <= near:
            poses[q] |= m
    out = []
    for q, p in enumerate(poses):
        ys, xs = np.where(p)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        edge = y0 == 0 or x0 == 0 or y1 == H or x1 == W
        print(f'ท่า {q + 1} ({CELL_NAMES[q]}): x {x0}–{x1} y {y0}–{y1} ({x1 - x0}x{y1 - y0})'
              + ('  ⚠ แตะขอบแผ่น อาจถูกตัด' if edge else ''))
        if alpha is None:
            out.append(trim(to_rgba(rgb[y0:y1, x0:x1], p[y0:y1, x0:x1])))
        else:
            a = np.where(p, alpha, 0)[y0:y1, x0:x1].astype(np.uint8)
            out.append(trim(np.dstack([rgb[y0:y1, x0:x1], a])))
    return out


def load_cutout(path, keep_holes=False):
    im = Image.open(path)
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 250:
        return trim(np.asarray(im.convert('RGBA')).copy())  # โปร่งใสอยู่แล้ว
    rgb = np.asarray(im.convert('RGB'))
    return trim(to_rgba(rgb, largest_parts(cut_white(rgb, keep_holes=keep_holes))))


# ---------- จัดขนาด ----------
def bust_square(rgba, frac):
    """ครอปจัตุรัสจากยอดหมวกลงมา frac ของความสูง (ถึงกลางอก) กึ่งกลางตามแนวนอน เติมโปร่งใสถ้าแคบกว่า"""
    h, w = rgba.shape[:2]
    side = max(w, int(round(h * frac)))
    side = min(side, max(w, h))
    canvas = np.zeros((side, side, 4), np.uint8)
    part = rgba[:side]
    ox = (side - w) // 2
    canvas[:part.shape[0], ox:ox + w] = part
    return Image.fromarray(canvas).resize((BUST, BUST), Image.LANCZOS)


def full_body(rgba):
    im = Image.fromarray(rgba)
    w, h = im.size
    return im.resize((max(1, round(w * FULL_H / h)), FULL_H), Image.LANCZOS)


# ---------- ตา + สีผิว (สำหรับกะพริบตา D2) ----------
def measure_face(bust):
    a = np.asarray(bust.convert('RGBA')).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    skin = (al > 200) & (r > 200) & (g > 160) & (b > 130) & (r - b > 15) & (r - b < 90)
    lab, n = ndimage.label(skin)
    if not n:
        return None
    sizes = ndimage.sum(skin, lab, range(1, n + 1))
    face = lab == (int(np.argmax(sizes)) + 1)
    color = '#%02x%02x%02x' % tuple(int(np.median(c[face])) for c in (r, g, b))
    ys, xs = np.where(face)
    fy0, fy1, fx0, fx1 = ys.min(), ys.max(), xs.min(), xs.max()
    # ตา = ก้อนสีเข้มที่มีผิวล้อม (รูในหน้า) ครึ่งบนของหน้า ซ้าย/ขวา ขนาดใกล้กัน
    holes = ndimage.binary_fill_holes(face) & ~face
    dark = holes & ((r + g + b) < 360)
    lab2, n2 = ndimage.label(dark)
    cands = []
    for i, sl in enumerate(ndimage.find_objects(lab2)):
        cnt = int((lab2[sl] == i + 1).sum())
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        if cnt < 20 or not (fy0 < cy < fy0 + (fy1 - fy0) * 0.75):
            continue
        cands.append((cnt, cx, cy, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start))
    cands.sort(reverse=True)
    mid = (fx0 + fx1) / 2
    left = next((c for c in cands if c[1] < mid), None)
    right = next((c for c in cands if c[1] > mid), None)
    if not left or not right or abs(left[0] - right[0]) > max(left[0], right[0]) * 0.6:
        return {'skin': color}
    S = bust.size[0] / 100
    # จุดกึ่งกลาง/ขนาดตา (%) — เปลือกตาคลุมกว้าง/สูงกว่าก้อนตาเล็กน้อย (รวมเส้นขอบตา)
    eye = lambda c: (round(c[1] / S, 1), round(c[2] / S, 1), round(c[3] * 1.12 / S, 1), round(c[4] * 1.1 / S, 1))
    return {'skin': color, 'l': eye(left), 'r': eye(right)}


def write_eye_css(face):
    if not face:
        print('เตือน: หาใบหน้าไม่เจอ — คงค่า --eye-*/--skin เดิมใน styles.css')
        return
    css = open(CSS, encoding='utf-8').read()
    lines = [f'--skin: {face["skin"]};']
    if 'l' in face:
        for k in ('l', 'r'):
            x, y, w, h = face[k]
            lines.append(f'--eye-{k}-x: {x}%; --eye-{k}-y: {y}%; --eye-{k}-w: {w}%; --eye-{k}-h: {h}%;')
    else:
        print('เตือน: หาตา 2 ข้างไม่เจอ — คงตำแหน่งตาเดิม (ตรวจกะพริบตาด้วยตา)')
        old = re.search(r'/\* brand:eyes \*/(.*?)/\* /brand:eyes \*/', css, re.S)
        lines += [l.strip() for l in (old.group(1).splitlines() if old else []) if '--eye-' in l]
    block = '/* brand:eyes */\n  ' + '\n  '.join(lines) + '\n  /* /brand:eyes */'
    new, n = re.subn(r'/\* brand:eyes \*/.*?/\* /brand:eyes \*/', block, css, flags=re.S)
    if not n:
        print('เตือน: ไม่พบบล็อก brand:eyes ใน styles.css — ไม่ได้เขียนตำแหน่งตา')
        return
    open(CSS, 'w', encoding='utf-8').write(new)
    print('ตา/ผิว →', ' '.join(lines))


# ---------- บีบอัด ----------
def save_png(im, path):
    tmp = path + '.tmp.png'
    im.save(tmp, optimize=True)
    q = shutil.which('pngquant') and subprocess.run(
        ['pngquant', '--quality', '70-90', '--force', '--skip-if-larger', '--output', path, tmp], check=False).returncode == 0
    if not q:
        # ไม่มี pngquant: ลดเป็น 256 สี (คงความโปร่งใส) ด้วย PIL ถ้าเล็กกว่าเดิม
        buf = io.BytesIO()
        im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(buf, 'PNG', optimize=True)
        raw = open(tmp, 'rb').read()
        open(path, 'wb').write(buf.getvalue() if len(buf.getvalue()) < len(raw) else raw)
    os.remove(tmp)
    webp = path[:-4] + '.webp'
    if shutil.which('cwebp'):
        subprocess.run(['cwebp', '-quiet', '-q', '82', '-alpha_q', '90', path, '-o', webp], check=True)
    else:
        im.save(webp, 'WEBP', quality=82)
    kb = os.path.getsize(path) / 1024
    print(f'{os.path.relpath(path, ROOT)} {im.size[0]}x{im.size[1]} {kb:.0f} KB / webp {os.path.getsize(webp) / 1024:.0f} KB'
          + ('  ⚠ เกิน 60 KB' if kb * 1024 > LIMIT else ''))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sheet', help='แผ่น 2x2 พื้นขาว')
    ap.add_argument('--bust', help='ภาพ bust แยก (พรอมต์ C2) แทนท่า 1')
    ap.add_argument('--dry-run', action='store_true', help='ไม่เขียนทับ site/ แค่ทำภาพตรวจ')
    ap.add_argument('--keep-holes', action='store_true', help='ไม่ลบพื้นขาวที่ถูกตัวละครล้อม')
    ap.add_argument('--no-icons', action='store_true')
    o = ap.parse_args()

    if o.sheet:
        poses = split_sheet(o.sheet, o.keep_holes)
        bust = bust_square(poses[0], 0.78)  # ท่า 1 = ครึ่งตัวถึงเอว → ยอดหมวกถึงกลางอก
        fulls = poses[1:]
    else:
        print('ไม่มี --sheet: ใช้ภาพชั่วคราว', os.path.relpath(TEMP_SRC, ROOT))
        cut = load_cutout(TEMP_SRC)
        bust = bust_square(cut, 0.47)  # เต็มตัว → ยอดหมวกถึงกลางอก
        fulls = [cut, cut, cut]
    if o.bust:
        bust = bust_square(load_cutout(o.bust, o.keep_holes), 1.0)
    fulls = [full_body(rgba) for rgba in fulls]

    if o.dry_run:
        # ภาพตรวจ: 4 ท่าบนพื้นม่วงหัวแอป (#3b1470) เห็นขอบขาว/แขนขาขาดชัด
        ims = [bust] + fulls
        sheet = Image.new('RGBA', (sum(i.size[0] for i in ims) + 24 * (len(ims) + 1), FULL_H + 48), (59, 20, 112, 255))
        x = 24
        for im in ims:
            sheet.alpha_composite(im, (x, 24))
            x += im.size[0] + 24
        path = os.path.join(tempfile.gettempdir(), 'kruwan-check.png')
        sheet.save(path)
        print('ภาพตรวจ →', path, '(ไม่ได้เขียนทับ site/ — ถ้าเรียบร้อย รันซ้ำโดยไม่ใส่ --dry-run)')
        return

    os.makedirs(OUT, exist_ok=True)
    save_png(bust, os.path.join(OUT, 'kruwan-bust.png'))
    for name, im in zip(POSES[1:], fulls):
        save_png(im, os.path.join(OUT, f'kruwan-{name}.png'))
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.png'))
    print(f'รวม PNG {total / 1024:.0f} KB' + ('  ⚠ เกิน 250 KB' if total > 250 * 1024 else ''))
    write_eye_css(measure_face(bust))

    if not o.no_icons:
        subprocess.run(['node', os.path.join(ROOT, 'tools/make-icons.mjs')], check=True, cwd=ROOT)


if __name__ == '__main__':
    main()
