import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPayload, openQueue, enqueue, classifyResponse, nextTryAt, drainQueue, startUpload, installTriggers, stopUploadTimers, archiveCopy } from '../../site/js/upload.js';

const config = { upload_url: 'https://script.example/exec', app_key: 'wp_k', app_version: 3, archive_mime: 'image/png', upload_timeout_ms: 90000 };
const NOW = 1_800_000_000_000;
const mkReport = (id, extra = {}) => ({
  report_id: id, created: NOW, school_id: 'changkon8', report_date: '2026-10-23',
  teacher_ids: ['changkon8-01'], teacher_names: ['ครู ก'], template_id: 'np-01', template_version: 1,
  file_name: 'วันเพจ_ช่างกล8_2026-10-23_0742.png', mime: 'image/png', blob: new Blob(['png-bytes'], { type: 'image/png' }), ...extra,
});
const resp = (json) => Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
let queue;
const deps = (fetchFn, extra = {}) => ({
  queue, fetchFn, config, settings: { upload_enabled: 'TRUE' }, now: NOW, onStatus: vi.fn(),
  toBase64: async () => 'QUJD', toJpeg: async () => new Blob(['jpg'], { type: 'image/jpeg' }), ua: 'Test', ...extra,
});

beforeEach(async () => { queue = await openQueue(new IDBFactory()); });
afterEach(() => { stopUploadTimers(); vi.useRealTimers(); });

describe('buildPayload', () => {
  it('has exactly the spec keys', () => {
    const r = mkReport('r1');
    const p = buildPayload(r, config, 'QUJD', 'Android Chrome 130');
    expect(Object.keys(p).sort()).toEqual(['app_key','app_version','data_b64','file_name','mime','report_date','report_id','school_id','teacher_ids','teacher_names','template_id','template_version','ua','v'].sort());
    expect(p.v).toBe(1);
    expect(p.data_b64).toBe('QUJD');
    expect(p.ua.length).toBeLessThanOrEqual(40);
  });
});

describe('classifyResponse / nextTryAt', () => {
  it('classifies', () => {
    expect(classifyResponse({ ok: true })).toBe('done');
    expect(classifyResponse({ ok: false, dup: true })).toBe('done');
    for (const e of ['BAD_KEY','DISABLED','INVALID','RATE_LIMIT','UNKNOWN_SCHOOL']) expect(classifyResponse({ ok: false, error: e })).toBe('drop');
    expect(classifyResponse({ ok: false, error: 'TOO_LARGE' })).toBe('jpeg');
    expect(classifyResponse({ ok: false, error: 'DRIVE_ERROR' })).toBe('retry');
    expect(classifyResponse({ ok: false, error: 'RATE_LIMIT_MINUTE' })).toBe('retry');
    expect(classifyResponse(null)).toBe('retry');
  });
  it('schedules', () => {
    expect(nextTryAt(0, 100)).toBe(100);
    expect(nextTryAt(1, 100)).toBe(30100);
    expect(nextTryAt(2, 100)).toBe(300100);
    expect(nextTryAt(3, 100)).toBe(Infinity);
  });
});

describe('queue', () => {
  it('enqueue sets attempts/next_try', async () => {
    await enqueue(queue, mkReport('r1'));
    const [it1] = await queue.all();
    expect(it1.attempts).toBe(0); expect(it1.next_try).toBe(0);
  });
  it('prune keeps <=10 newest and drops >7 days', async () => {
    for (let i = 0; i < 13; i++) await enqueue(queue, mkReport('r' + i, { created: NOW - i * 1000 }));
    await enqueue(queue, mkReport('old', { created: NOW - 8 * 86400000 }));
    await queue.prune({ maxItems: 10, maxAgeDays: 7, now: NOW });
    const ids = (await queue.all()).map((x) => x.report_id);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain('old');
    expect(ids).toContain('r0'); expect(ids).not.toContain('r12');
  });
});

describe('drainQueue', () => {
  it('network error keeps item, attempts 1, next_try +30s', async () => {
    await enqueue(queue, mkReport('r1'));
    const d = deps(() => Promise.reject(new Error('net')));
    const res = await drainQueue(d);
    const [it1] = await queue.all();
    expect(it1.attempts).toBe(1); expect(it1.next_try).toBe(NOW + 30000);
    expect(res.failed).toBe(1);
    expect(d.onStatus).toHaveBeenCalledWith('retry', expect.anything());
  });
  it('BAD_KEY drops without retry', async () => {
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => resp({ ok: false, error: 'BAD_KEY' }));
    const d = deps(f);
    const res = await drainQueue(d);
    expect(await queue.all()).toHaveLength(0);
    expect(f).toHaveBeenCalledTimes(1);
    expect(res.dropped).toBe(1);
    expect(d.onStatus).toHaveBeenCalledWith('dropped', expect.objectContaining({ last_error: 'BAD_KEY' }));
  });
  it('dup is success', async () => {
    await enqueue(queue, mkReport('r1'));
    const res = await drainQueue(deps(() => resp({ ok: true, dup: true })));
    expect(await queue.all()).toHaveLength(0); expect(res.sent).toBe(1);
  });
  it('sends fetch with spec options', async () => {
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => resp({ ok: true }));
    await drainQueue(deps(f));
    const [url, opt] = f.mock.calls[0];
    expect(url).toBe(config.upload_url);
    expect(opt.method).toBe('POST'); expect(opt.redirect).toBe('follow');
    expect(opt.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(opt.body).report_id).toBe('r1');
    expect(opt.signal).toBeDefined();
  });
  it('TOO_LARGE resends once as jpeg', async () => {
    await enqueue(queue, mkReport('r1'));
    const bodies = [];
    const f = vi.fn((u, o) => { bodies.push(JSON.parse(o.body)); return resp(bodies.length === 1 ? { ok: false, error: 'TOO_LARGE' } : { ok: true }); });
    await drainQueue(deps(f));
    expect(f).toHaveBeenCalledTimes(2);
    expect(bodies[1].mime).toBe('image/jpeg');
    expect(bodies[1].file_name.endsWith('.jpg')).toBe(true);
    expect(await queue.all()).toHaveLength(0);
  });
  it('TOO_LARGE twice does not loop', async () => {
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => resp({ ok: false, error: 'TOO_LARGE' }));
    await drainQueue(deps(f));
    expect(f).toHaveBeenCalledTimes(2);
    expect(await queue.all()).toHaveLength(0);
  });
  it('concurrent drains call fetch once per item', async () => {
    await enqueue(queue, mkReport('r1')); await enqueue(queue, mkReport('r2', { created: NOW + 1 }));
    const f = vi.fn(() => resp({ ok: true }));
    const d = deps(f);
    const [a, b] = await Promise.all([drainQueue(d), drainQueue(d)]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(a).toBe(b);
  });
  it('oldest first; skips future next_try', async () => {
    await enqueue(queue, mkReport('new', { created: NOW }));
    await enqueue(queue, mkReport('old', { created: NOW - 5000 }));
    await enqueue(queue, mkReport('wait', { created: NOW - 9000 }));
    const w = (await queue.all()).find((x) => x.report_id === 'wait'); w.next_try = NOW + 10000; await queue.put(w);
    const ids = [];
    await drainQueue(deps((u, o) => { ids.push(JSON.parse(o.body).report_id); return resp({ ok: true }); }));
    expect(ids).toEqual(['old', 'new']);
  });
  it('isHeld: รายการที่ยังไม่ยืนยันไม่ถูกส่ง (แม้ appOpen) จนกว่าจะปล่อย', async () => {
    await enqueue(queue, mkReport('held'));
    await enqueue(queue, mkReport('free', { created: NOW + 1 }));
    let hold = 'held';
    const fetchFn = vi.fn(() => resp({ ok: true }));
    const d = deps(fetchFn, { isHeld: (id) => id === hold });
    await drainQueue({ ...d, appOpen: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((await queue.all()).map((i) => i.report_id)).toEqual(['held']);
    hold = null;
    await drainQueue(d);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(await queue.all()).toEqual([]);
  });
  it('disabled: no fetch, status disabled', async () => {
    await enqueue(queue, mkReport('r1'));
    for (const v of ['FALSE', 'false', '0', false]) {
      const f = vi.fn(); const d = deps(f, { settings: { upload_enabled: v } });
      await drainQueue(d);
      expect(f).not.toHaveBeenCalled();
      expect(d.onStatus).toHaveBeenCalledWith('disabled');
    }
    expect(await queue.all()).toHaveLength(1);
  });
  it('gives up after 8 attempts or 7 days', async () => {
    await enqueue(queue, mkReport('a')); await enqueue(queue, mkReport('b', { created: NOW - 8 * 86400000 }));
    const a = (await queue.all()).find((x) => x.report_id === 'a'); a.attempts = 8; await queue.put(a);
    const f = vi.fn(); const d = deps(f);
    await drainQueue(d);
    expect(f).not.toHaveBeenCalled();
    expect(await queue.all()).toHaveLength(0);
    expect(d.onStatus.mock.calls.filter((c) => c[0] === 'gave_up')).toHaveLength(2);
  });
  it('Infinity item untouched by non-appOpen drains, retried on appOpen', async () => {
    await enqueue(queue, mkReport('r1'));
    const it1 = (await queue.all())[0]; it1.attempts = 3; it1.next_try = Infinity; await queue.put(it1);
    const f = vi.fn(() => Promise.reject(new Error('net')));
    for (let i = 0; i < 3; i++) await drainQueue(deps(f));
    expect(f).not.toHaveBeenCalled();
    expect((await queue.all())[0].attempts).toBe(3);
    await drainQueue(deps(f, { appOpen: true }));
    expect(f).toHaveBeenCalledTimes(1);
    expect((await queue.all())[0].attempts).toBe(4);
  });
  it('one item failing in put/remove does not abort the rest', async () => {
    await enqueue(queue, mkReport('a', { created: NOW - 2000 })); await enqueue(queue, mkReport('b'));
    const realRemove = queue.remove;
    queue.remove = async (id) => { if (id === 'a') throw new Error('idb'); return realRemove(id); };
    const f = vi.fn(() => resp({ ok: true }));
    await drainQueue(deps(f));
    expect(f).toHaveBeenCalledTimes(2);
    expect((await queue.all()).map((x) => x.report_id)).toEqual(['a']);
  });
  it('appOpen drain prunes once at start', async () => {
    const spy = vi.spyOn(queue, 'prune');
    await drainQueue(deps(vi.fn(), { appOpen: true }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ maxItems: 10, maxAgeDays: 7, now: NOW });
    await drainQueue(deps(vi.fn()));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('archiveCopy (config.archive_mime)', () => {
  it('image/png (default) keeps the PNG report as-is', async () => {
    const r = mkReport('r1');
    const toJpeg = vi.fn();
    expect(await archiveCopy(r, config, toJpeg)).toBe(r);
    expect(await archiveCopy(r, {}, toJpeg)).toBe(r);
    expect(toJpeg).not.toHaveBeenCalled();
  });
  it('image/jpeg enqueues a q0.9 JPEG copy named .jpg; the shared PNG is untouched', async () => {
    const r = mkReport('r1');
    const jpg = new Blob(['jpg'], { type: 'image/jpeg' });
    const toJpeg = vi.fn(async () => jpg);
    const a = await archiveCopy(r, { ...config, archive_mime: 'image/jpeg' }, toJpeg);
    expect(toJpeg).toHaveBeenCalledWith(r.blob, 0.9);
    expect(a.blob).toBe(jpg);
    expect(a.mime).toBe('image/jpeg');
    expect(a.file_name).toBe('วันเพจ_ช่างกล8_2026-10-23_0742.jpg');
    expect(r.mime).toBe('image/png');
    expect(r.file_name.endsWith('.png')).toBe(true);
    await enqueue(queue, a);
    const sent = [];
    await drainQueue(deps((u, o) => { sent.push(JSON.parse(o.body)); return resp({ ok: true }); }));
    expect(sent[0].mime).toBe('image/jpeg');
    expect(sent[0].file_name.endsWith('.jpg')).toBe(true);
  });
});

describe('drain coalescing + backoff wake-up', () => {
  it('a drain requested while running re-runs and picks up an item enqueued mid-run', async () => {
    await enqueue(queue, mkReport('old', { created: NOW - 1000 }));
    let release; const gate = new Promise((r) => { release = r; });
    const sent = [];
    const f = vi.fn(async (u, o) => { sent.push(JSON.parse(o.body).report_id); if (sent.length === 1) await gate; return { ok: true, json: async () => ({ ok: true }) }; });
    const d = deps(f);
    const first = drainQueue(d);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    await enqueue(queue, mkReport('today')); // รายการวันนี้มาระหว่างรอบเก่ากำลังส่ง
    const second = drainQueue({ ...d, appOpen: false });
    expect(second).toBe(first);
    release();
    await second;
    expect(sent).toEqual(['old', 'today']);
    expect(await queue.all()).toHaveLength(0);
  });

  it('no re-run when nothing was requested during the run', async () => {
    await enqueue(queue, mkReport('r1'));
    const spy = vi.spyOn(queue, 'all');
    await drainQueue(deps(vi.fn(() => resp({ ok: true }))));
    expect(spy).toHaveBeenCalledTimes(2); // อ่านคิว 1 ครั้ง + ตรวจหาเวลาปลุก 1 ครั้ง
  });

  it('after a failed send, one timer wakes the drain at next_try (30 s, then 5 min)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(NOW);
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => Promise.reject(new Error('net')));
    const d = deps(f, { now: () => Date.now() });
    await drainQueue(d);
    expect(f).toHaveBeenCalledTimes(1);
    expect((await queue.all())[0].next_try).toBe(NOW + 30000);
    await vi.advanceTimersByTimeAsync(29999);
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect((await queue.all())[0].attempts).toBe(2));
    await vi.advanceTimersByTimeAsync(300000);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(3));
    await vi.waitFor(async () => expect((await queue.all())[0].next_try).toBe(Infinity));
    await vi.advanceTimersByTimeAsync(3600000); // Infinity = รอเปิดแอป ไม่ตั้งปลุก
    expect(f).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a new run replaces the pending wake-up timer (single timer)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(NOW);
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => Promise.reject(new Error('net')));
    const d = deps(f, { now: () => Date.now() });
    await drainQueue(d);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(10000);
    await drainQueue(d); // ยังไม่ถึง next_try: ไม่ส่ง แต่ตั้งปลุกใหม่แทนตัวเดิม
    expect(f).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(20000);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(2));
  });
});

describe('startUpload / installTriggers', () => {
  it('startUpload returns undefined and drains', async () => {
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => resp({ ok: true }));
    expect(startUpload(deps(f))).toBeUndefined();
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
  });
  it('installTriggers wires online and visible', async () => {
    const h = {}; const win = { addEventListener: (n, fn) => { h[n] = fn; } };
    const doc = { visibilityState: 'visible', addEventListener: (n, fn) => { h['doc:' + n] = fn; } };
    await enqueue(queue, mkReport('r1'));
    const f = vi.fn(() => resp({ ok: true }));
    installTriggers(deps(f), win, doc);
    expect(typeof h.online).toBe('function');
    h['doc:visibilitychange']();
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
  });
});
