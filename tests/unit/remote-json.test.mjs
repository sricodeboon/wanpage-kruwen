import { describe, it, expect, vi } from 'vitest';
import { loadJsonCached, validConfig, validTemplates } from '../../site/js/remote-json.js';
import { MSG, validateForm } from '../../site/js/form.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), _m: m };
}
const okJson = (data) => vi.fn(async () => ({ ok: true, json: async () => data }));
const offline = () => vi.fn(async () => { throw new Error('offline'); });

describe('loadJsonCached (wp.config / wp.templates)', () => {
  it('fresh fetch is returned and stored as last-known-good', async () => {
    const storage = memStorage();
    const r = await loadJsonCached({ url: 'config.json', key: 'wp.config', storage, fetchFn: okJson({ app_version: 2, upload_url: 'u' }), validate: validConfig });
    expect(r).toEqual({ data: { app_version: 2, upload_url: 'u' }, source: 'fresh' });
    expect(JSON.parse(storage.getItem('wp.config')).upload_url).toBe('u');
  });

  it('offline -> last-known-good copy', async () => {
    const storage = memStorage({ 'wp.config': JSON.stringify({ app_version: 1, upload_url: 'u' }) });
    const r = await loadJsonCached({ url: 'config.json', key: 'wp.config', storage, fetchFn: offline(), validate: validConfig });
    expect(r.source).toBe('cache');
    expect(r.data.upload_url).toBe('u');
  });

  it('HTTP error or invalid body does not overwrite the stored copy', async () => {
    const storage = memStorage({ 'wp.templates': JSON.stringify({ templates: [{ id: 'np-01' }] }) });
    const bad = vi.fn(async () => ({ ok: true, json: async () => ({ nope: 1 }) }));
    const r = await loadJsonCached({ url: 'templates.json', key: 'wp.templates', storage, fetchFn: bad, validate: validTemplates });
    expect(r.source).toBe('cache');
    expect(r.data.templates[0].id).toBe('np-01');
    const r2 = await loadJsonCached({ url: 'templates.json', key: 'wp.templates', storage, fetchFn: vi.fn(async () => ({ ok: false, status: 404 })), validate: validTemplates });
    expect(r2.source).toBe('cache');
    expect(JSON.parse(storage.getItem('wp.templates')).templates[0].id).toBe('np-01');
  });

  it('nothing stored + offline -> data null, source none', async () => {
    const r = await loadJsonCached({ url: 'config.json', key: 'wp.config', storage: memStorage({ 'wp.config': '{bad' }), fetchFn: offline(), validate: validConfig });
    expect(r).toEqual({ data: null, source: 'none' });
  });

  it('blocked storage still returns the fresh data', async () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const r = await loadJsonCached({ url: 'x', key: 'k', storage, fetchFn: okJson({ templates: [] }), validate: validTemplates });
    expect(r.source).toBe('fresh');
  });
});

describe('validateForm when templates.json failed to load', () => {
  const model = { teachersBySchool: { s: [{ teacher_id: 't' }] }, phonesMissing: false };
  const state = { schoolId: 's', selectedTeacherIds: ['t'], photos: [{}, {}, {}, {}] };
  it('null templates = load failure message (not "no background for this province")', () => {
    const v = validateForm(state, model, null);
    expect(v.ok).toBe(false);
    expect(v.message).toBe(MSG.templatesFail);
    expect(v.message).not.toBe(MSG.noTemplates);
    expect(v.target).toBe('background');
  });
  it('empty list still means no background for this province', () => {
    expect(validateForm(state, model, []).message).toBe(MSG.noTemplates);
  });
});
