import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildModel, loadData, refreshData, tabRowsToObjects, REQUIRED_COLUMNS } from '../../site/js/data.js';
import { parseCSV } from '../../site/js/csv.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 23);

const raw = {
  schools: [
    { school_id: 'b', short_name: 'B', sort_order: '2', active: 'TRUE' },
    { school_id: 'a', short_name: 'A', sort_order: '1', active: 'TRUE', province: 'np' },
    { school_id: 'z', short_name: 'Z', sort_order: '3', active: 'FALSE' },
    { school_id: 'empty', short_name: 'E', sort_order: '4', active: 'TRUE' },
  ],
  teachers: [
    { teacher_id: 'a-2', school_id: 'a', display_name: 'T2', phone: '0812345678', sort_order: '2', active: 'TRUE' },
    { teacher_id: 'a-1', school_id: 'a', display_name: 'T1', phone: '', sort_order: '1', active: 'ใช่' },
    { teacher_id: 'a-3', school_id: 'a', display_name: 'T3', sort_order: '3', active: 'FALSE' },
    { teacher_id: 'x-1', school_id: 'nope', display_name: 'X', sort_order: '1', active: 'TRUE' },
    { teacher_id: 'z-1', school_id: 'z', display_name: 'Z', sort_order: '1', active: 'TRUE' },
  ],
  photo_labels: [
    { label: 'L2', icon: '', sort_order: '2', active: 'TRUE' },
    { label: 'L1', icon: 'farm', sort_order: '1', active: 'TRUE' },
    { label: 'Lx', icon: 'farm', sort_order: '3', active: 'FALSE' },
  ],
  settings: [{ key: 'notice_text', value: 'hi' }, { key: 'data_version', value: '5' }],
};

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    _m: m,
  };
}

const config = {
  sheet_id: 'SID',
  sheet_csv_gviz: 'https://g/SHEET_ID/gviz?sheet={sheet}',
  sheet_csv_published: {},
  csv_timeout_ms: 50,
};

const CSV = {
  schools: 'school_id,short_name,name_full,address,province,logo_file,default_bg,sort_order,active\r\nq,Q,Full,Addr,np,q.webp,np-01,1,TRUE\r\n',
  teachers: 'teacher_id,school_id,display_name,phone,sort_order,active\r\nq-1,q,Teacher,0812345678,1,TRUE\r\n',
  photo_labels: 'label,icon,sort_order,active\r\nอาคาร,building,1,TRUE\r\n',
  settings: 'key,value\r\ndata_version,9\r\n',
};
const okFetch = () =>
  vi.fn(async (url) => {
    const tab = Object.keys(CSV).find((t) => url.includes('sheet=' + t) || url.endsWith(t));
    return { ok: true, headers: { get: () => 'text/csv; charset=utf-8' }, text: async () => CSV[tab] };
  });

describe('buildModel', () => {
  const m = buildModel(raw);
  it('keeps active schools sorted', () => {
    expect(m.schools.map((s) => s.school_id)).toEqual(['a', 'b', 'empty']);
    expect(m.schools[0]).toMatchObject({ short_name: 'A', province: 'np', sort_order: 1 });
  });
  it('drops inactive teachers, orphans and teachers of inactive schools; sorted; phone normalized', () => {
    expect(m.teachersBySchool.a.map((t) => t.teacher_id)).toEqual(['a-1', 'a-2']);
    expect(m.teachersBySchool.a[1].phone).toBe('081-234-5678');
    expect(m.teachersBySchool.nope).toBeUndefined();
    expect(m.teachersBySchool.z).toBeUndefined();
  });
  it('school without active teachers -> []', () => {
    expect(m.teachersBySchool.empty).toEqual([]);
    expect(m.teachersBySchool.b).toEqual([]);
  });
  it('labels/settings/phonesMissing', () => {
    expect(m.labels).toEqual([{ label: 'L1', icon: 'farm' }, { label: 'L2', icon: 'camera' }]);
    expect(m.settings).toEqual({ notice_text: 'hi', data_version: '5' });
    expect(m.phonesMissing).toBe(false);
  });
  it('phonesMissing true when no teacher has phone', () => {
    const r = { ...raw, teachers: raw.teachers.map((t) => ({ ...t, phone: '' })) };
    expect(buildModel(r).phonesMissing).toBe(true);
  });
});

describe('loadData', () => {
  const snapshot = {
    schools: [{ school_id: 's', short_name: 'S' }],
    teachersBySchool: { s: [{ teacher_id: 's-1', school_id: 's', display_name: 'N', phone: '' }] },
    labels: [], settings: {},
  };

  it('fresh cache (2 days) -> cache, does not await fetch', async () => {
    const storage = memStorage({ 'wp.data': JSON.stringify({ fetched_at: NOW - 2 * DAY, data_version: '5', ...rawCache() }) });
    const fetchFn = vi.fn(() => new Promise(() => {})); // never settles
    const r = await loadData({ config, storage, fetchFn, now: NOW, snapshot });
    expect(r.source).toBe('cache');
    expect(r.stale).toBe(false);
    expect(r.model.schools.map((s) => s.school_id)).toEqual(['a', 'b', 'empty']);
    expect(fetchFn).toHaveBeenCalled();
  });

  it('fresh cache exposes the background refresh as refreshed (resolves new model)', async () => {
    const storage = memStorage({ 'wp.data': JSON.stringify({ fetched_at: NOW - 2 * DAY, data_version: '5', ...rawCache() }) });
    const r = await loadData({ config, storage, fetchFn: okFetch(), now: NOW, snapshot });
    expect(r.source).toBe('cache');
    const fresh = await r.refreshed;
    expect(fresh.schools.map((s) => s.school_id)).toEqual(['q']);
    expect(fresh.settings.data_version).toBe('9');
  });

  it('refreshed resolves null when the background refresh fails or was not started', async () => {
    const storage = memStorage({ 'wp.data': JSON.stringify({ fetched_at: NOW - 2 * DAY, ...rawCache() }) });
    const off = vi.fn(async () => { throw new Error('offline'); });
    expect(await (await loadData({ config, storage, fetchFn: off, now: NOW, snapshot })).refreshed).toBe(null);
    expect(await (await loadData({ config, storage: memStorage(), fetchFn: okFetch(), now: NOW, snapshot })).refreshed).toBe(null);
    expect(await (await loadData({ config, storage: memStorage(), fetchFn: off, now: NOW, snapshot })).refreshed).toBe(null);
  });

  it('no cache + fetch reject -> snapshot, phonesMissing', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('offline'); });
    const r = await loadData({ config, storage: memStorage(), fetchFn, now: NOW, snapshot });
    expect(r.source).toBe('snapshot');
    expect(r.model.phonesMissing).toBe(true);
    expect(r.model.schools[0].school_id).toBe('s');
  });

  it('no cache + CSV ok -> fresh and writes wp.data', async () => {
    const storage = memStorage();
    const r = await loadData({ config, storage, fetchFn: okFetch(), now: NOW, snapshot });
    expect(r.source).toBe('fresh');
    expect(r.model.teachersBySchool.q[0].phone).toBe('081-234-5678');
    const saved = JSON.parse(storage.getItem('wp.data'));
    expect(saved.fetched_at).toBe(NOW);
    expect(saved.data_version).toBe('9');
    expect(saved.teachers[0].phone).toBe('0812345678');
  });

  it('stale cache + offline -> stale cache', async () => {
    const storage = memStorage({ 'wp.data': JSON.stringify({ fetched_at: NOW - 9 * DAY, ...rawCache() }) });
    const fetchFn = vi.fn(async () => { throw new Error('x'); });
    const r = await loadData({ config, storage, fetchFn, now: NOW, snapshot });
    expect(r.source).toBe('cache');
    expect(r.stale).toBe(true);
  });

  it('corrupt cache is ignored', async () => {
    const r = await loadData({ config, storage: memStorage({ 'wp.data': '{bad' }), fetchFn: okFetch(), now: NOW, snapshot });
    expect(r.source).toBe('fresh');
  });

  it('timeout aborts a hanging fetch -> snapshot', async () => {
    const fetchFn = vi.fn((url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort')))));
    const r = await loadData({ config, storage: memStorage(), fetchFn, now: NOW, snapshot });
    expect(r.source).toBe('snapshot');
  });
});

describe('refreshData', () => {
  it('falls back to published URL when gviz is not text/csv', async () => {
    const cfg = { ...config, sheet_csv_published: { schools: 'https://pub/schools', teachers: 'https://pub/teachers', photo_labels: 'https://pub/photo_labels', settings: 'https://pub/settings' } };
    const fetchFn = vi.fn(async (url) => {
      if (url.includes('gviz')) return { ok: true, headers: { get: () => 'text/html' }, text: async () => '<html>login</html>' };
      const tab = url.split('/').pop();
      return { ok: true, headers: { get: () => 'text/csv' }, text: async () => CSV[tab] };
    });
    const storage = memStorage();
    const m = await refreshData({ config: cfg, storage, fetchFn, now: NOW });
    expect(m.schools[0].school_id).toBe('q');
    expect(fetchFn.mock.calls.some(([u]) => u.startsWith('https://pub/'))).toBe(true);
    expect(fetchFn.mock.calls[0][0]).toBe('https://g/SID/gviz?sheet=schools');
  });
  it('returns null when everything fails', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('x'); });
    expect(await refreshData({ config, storage: memStorage(), fetchFn })).toBeNull();
  });
  it('null when gviz not csv and no published url', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => 'x' }));
    expect(await refreshData({ config, storage: memStorage(), fetchFn })).toBeNull();
  });
});

describe('gviz quirks: headers=1 + column check', () => {
  it('site/config.json gviz template asks for headers=1', () => {
    const cfg = JSON.parse(readFileSync(new URL('../../site/config.json', import.meta.url), 'utf8'));
    expect(cfg.sheet_csv_gviz).toContain('&headers=1');
    expect(cfg.sheet_csv_gviz).toContain('{sheet}');
  });

  it('tabRowsToObjects throws when a required column is missing', () => {
    expect(() => tabRowsToObjects('settings', parseCSV('key #คำอธิบาย,value\r\na,1\r\n'))).toThrow(/key/);
    expect(tabRowsToObjects('settings', parseCSV('key,value\r\na,1\r\n'))).toEqual([{ key: 'a', value: '1' }]);
    for (const [tab, cols] of Object.entries(REQUIRED_COLUMNS)) expect(() => tabRowsToObjects(tab, [cols])).not.toThrow();
  });

  it('a fetch with merged/missing headers does NOT overwrite wp.data and returns null', async () => {
    const good = JSON.stringify({ fetched_at: NOW - 9 * DAY, ...rawCache() });
    const storage = memStorage({ 'wp.data': good });
    const fetchFn = vi.fn(async (url) => {
      const tab = Object.keys(CSV).find((t) => url.includes('sheet=' + t));
      // gviz รวมแถวคำอธิบายเข้ากับหัว → หัวคอลัมน์เพี้ยน
      const body = tab === 'teachers' ? 'teacher_id #slug,school_id #id,display_name #ยศ ชื่อ\r\nq-1,q,T\r\n' : CSV[tab];
      return { ok: true, headers: { get: () => 'text/csv' }, text: async () => body };
    });
    expect(await refreshData({ config, storage, fetchFn, now: NOW })).toBeNull();
    expect(storage.getItem('wp.data')).toBe(good);
    const r = await loadData({ config, storage, fetchFn, now: NOW, snapshot: {} });
    expect(r.source).toBe('cache');
    expect(r.stale).toBe(true);
  });

  it('a header-only schools tab (no schools) does not overwrite wp.data', async () => {
    const good = JSON.stringify({ fetched_at: NOW - 9 * DAY, ...rawCache() });
    const storage = memStorage({ 'wp.data': good });
    const fetchFn = vi.fn(async (url) => {
      const tab = Object.keys(CSV).find((t) => url.includes('sheet=' + t));
      const body = tab === 'schools' ? CSV.schools.split('\r\n')[0] + '\r\n' : CSV[tab];
      return { ok: true, headers: { get: () => 'text/csv' }, text: async () => body };
    });
    expect(await refreshData({ config, storage, fetchFn, now: NOW })).toBeNull();
    expect(storage.getItem('wp.data')).toBe(good);
  });
});

function rawCache() {
  return { schools: raw.schools, teachers: raw.teachers, labels: raw.photo_labels, settings: raw.settings };
}
