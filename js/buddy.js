// ครูแจ็ก — มาสคอตผู้ช่วย: บอกขั้นต่อไป แตะแล้วทำให้เลย และดีใจไปกับผู้ใช้
// ท่า: wave ทักทาย · point แนะนำ · camera ใส่รูป · lunch เมนู · thumbs ผ่าน · cheer สำเร็จ
const POSES = ['wave', 'point', 'camera', 'lunch', 'thumbs', 'cheer'];
const src = p => `assets/mascot/${p}.v1.webp`;
const $ = s => document.querySelector(s);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => matchMedia('(max-width:959px)').matches;

let cur = { key: '', pose: '' }, hideT = 0, lockUntil = 0, pending = null, action = null;

export function initBuddy() {
  POSES.forEach(p => { const i = new Image(); i.src = src(p); }); // โหลดล่วงหน้า สลับท่าไม่กระพริบ
  $('#buddyBtn').addEventListener('click', () => {
    const b = $('#buddy');
    if (b.classList.contains('closed')) { open(); return; }
    if (action) action.fn(); else bounce();
  });
  $('#bubbleGo').addEventListener('click', () => action?.fn());
  $('#bubbleX').addEventListener('click', e => { e.stopPropagation(); close(); });
}

function setPose(p) {
  const img = $('#buddyImg');
  if (cur.pose === p) return;
  cur.pose = p;
  img.classList.remove('swap'); void img.offsetWidth;
  img.src = src(p); img.classList.add('swap');
}
function bounce() { const b = $('#buddyBtn'); b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop'); }
function open() { $('#buddy').classList.remove('closed'); scheduleHide(); }
function close() { $('#buddy').classList.add('closed'); clearTimeout(hideT); }
function scheduleHide() { clearTimeout(hideT); if (small()) hideT = setTimeout(close, 8000); }

// พูด: เปลี่ยนท่า + ข้อความ + ปุ่มลัด (ไม่ซ้ำถ้าเรื่องเดิม)
export function say({ key, pose, title, text, act }, force) {
  if (!force && key === cur.key) { action = act || null; return; }
  if (Date.now() < lockUntil && !force) { pending = { key, pose, title, text, act }; return; }
  cur.key = key; action = act || null;
  setPose(pose);
  const bub = $('#bubble');
  bub.classList.remove('show'); void bub.offsetWidth;
  $('#bubbleT').textContent = title;
  $('#bubbleS').textContent = text || '';
  const go = $('#bubbleGo');
  go.hidden = !act; if (act) go.textContent = act.label;
  bub.classList.add('show');
  $('#buddyBtn').setAttribute('aria-label', act ? `ครูแจ็ก: ${act.label}` : 'ครูแจ็ก');
  open(); bounce();
}
// ช่วงสั้น ๆ ที่ห้ามข้อความอื่นมาแทน (เช่น ชมหลังใส่รูป) แล้วค่อยกลับไปบอกขั้นต่อไป
export function react(msg, ms = 2200) {
  say({ ...msg, key: 'react:' + Date.now() }, true);
  lockUntil = Date.now() + ms;
  setTimeout(() => { if (pending) { const p = pending; pending = null; say(p, true); } }, ms + 30);
}
export function celebrate(msg) {
  react({ pose: 'cheer', ...msg }, 4000);
  confetti();
}

// คอนเฟตตีบน canvas เต็มจอ ~1.6 วินาที
export function confetti() {
  if (reduced()) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.hidden = false;
  const colors = ['#FF5DA2', '#FFD23F', '#3BCEAC', '#4D9DE0', '#9B5DE5', '#FF8C42'];
  const ps = Array.from({ length: 140 }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.75,
    vx: (Math.random() - 0.5) * 12, vy: -(9 + Math.random() * 10), r: 4 + Math.random() * 6,
    a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], s: Math.random() < 0.5,
  }));
  const t0 = performance.now();
  (function frame(t) {
    const k = (t - t0) / 1700;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      if (p.s) ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2.4, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.hidden = true; }
  })(t0);
}
