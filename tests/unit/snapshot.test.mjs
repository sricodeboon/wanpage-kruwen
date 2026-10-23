import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildModel, REQUIRED_COLUMNS } from '../../site/js/data.js';
import { toSnapshot } from '../../tools/snapshot.mjs';

const model = buildModel({
  schools: [{ school_id: 'a1', short_name: 'ก', name_full: 'ก', address: 'x', province: 'np', sort_order: '1', active: 'TRUE' }],
  teachers: [
    { teacher_id: 'a1-01', school_id: 'a1', display_name: 'ครู ก', phone: '0812345678', sort_order: '1', active: 'TRUE' },
    { teacher_id: 'a1-02', school_id: 'a1', display_name: 'ครู ข', phone: '', sort_order: '2', active: 'TRUE' },
  ],
  photo_labels: [{ label: 'อาคาร', icon: 'building', sort_order: '1', active: 'TRUE' }],
  settings: [{ key: 'data_version', value: '1' }],
});

describe('toSnapshot', () => {
  it('ไม่มี key phone ในครูทุกคน และไม่มีเบอร์หลุดในข้อความ JSON', () => {
    const snap = toSnapshot(model);
    const all = Object.values(snap.teachersBySchool).flat();
    expect(all).toHaveLength(2);
    for (const t of all) expect('phone' in t).toBe(false);
    expect(JSON.stringify(snap)).not.toMatch(/081-?234-?5678|0812345678/);
    expect(all[0].display_name).toBe('ครู ก');
  });
  it('ไม่แก้ model เดิม และคง schools/labels/settings', () => {
    const snap = toSnapshot(model);
    expect(model.teachersBySchool.a1[0].phone).toBeTruthy();
    expect(snap.schools[0].school_id).toBe('a1');
    expect(snap.labels).toHaveLength(1);
    expect(snap.settings.data_version).toBe('1');
  });
});

describe('snapshot.mjs shares the web column checks', () => {
  const src = readFileSync(new URL('../../tools/snapshot.mjs', import.meta.url), 'utf8');
  it('imports REQUIRED_COLUMNS logic from data.js (no private copy) and asks gviz for headers=1', () => {
    expect(src).toMatch(/tabRowsToObjects/);
    expect(src).not.toMatch(/const REQUIRED\b/);
    expect(src).toMatch(/headers=1/);
    expect(Object.keys(REQUIRED_COLUMNS).sort()).toEqual(['photo_labels', 'schools', 'settings', 'teachers']);
  });
});
