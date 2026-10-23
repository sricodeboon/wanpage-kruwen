import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../../site/config.json', import.meta.url), 'utf8'));
test('config has all keys', () => {
  for (const k of ['app_version','sheet_id','sheet_csv_gviz','sheet_csv_published','upload_url','app_key','archive_mime','csv_timeout_ms','upload_timeout_ms'])
    expect(cfg).toHaveProperty(k);
  expect(Number.isInteger(cfg.app_version) && cfg.app_version >= 1).toBe(true);
  expect(cfg.sheet_csv_gviz).toContain('{sheet}');
});
