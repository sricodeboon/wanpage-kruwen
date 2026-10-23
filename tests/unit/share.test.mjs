import { describe, it, expect, vi } from 'vitest';
import { saveMode, isLineInApp, externalBrowserUrl, canShareFile, sharePng, downloadFile, isIOS, buildShareText } from '../../site/js/share.js';

describe('saveMode', () => {
  it('LINE in-app (Android/iOS) and iOS Safari -> long-press overlay; others -> download', () => {
    expect(saveMode('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 Line/13.5.0')).toBe('longpress');
    expect(saveMode('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Mobile/15E148 Safari/604.1')).toBe('longpress');
    expect(saveMode('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36')).toBe('download');
  });
});

describe('isLineInApp', () => {
  it('detects LINE Android/iOS, not Chrome', () => {
    expect(isLineInApp('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 Line/13.5.0')).toBe(true);
    expect(isLineInApp('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Mobile/15E148 Safari Line/13.5.0')).toBe(true);
    expect(isLineInApp('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36')).toBe(false);
  });
});

describe('externalBrowserUrl', () => {
  it('appends with & when query exists', () => {
    expect(externalBrowserUrl('https://x/?s=a')).toContain('s=a&openExternalBrowser=1');
  });
  it('appends with ? when none, and not duplicated', () => {
    expect(externalBrowserUrl('https://x/')).toBe('https://x/?openExternalBrowser=1');
    const u = externalBrowserUrl('https://x/?s=a&openExternalBrowser=1');
    expect(u.match(/openExternalBrowser=1/g)).toHaveLength(1);
  });
  it('keeps hash', () => {
    expect(externalBrowserUrl('https://x/?a=1#h')).toBe('https://x/?a=1&openExternalBrowser=1#h');
  });
});

describe('canShareFile', () => {
  it('uses canShare with files', () => {
    const f = { name: 'a.png' };
    expect(canShareFile(f, { share() {}, canShare: (d) => d.files.length === 1 })).toBe(true);
    expect(canShareFile(f, { share() {} })).toBe(false);
    expect(canShareFile(f, { canShare: () => true })).toBe(false);
    expect(canShareFile(f, undefined)).toBe(false);
  });
});

describe('sharePng', () => {
  const f = { name: 'a.png' };
  it('resolves shared, payload has no url', async () => {
    const share = vi.fn().mockResolvedValue();
    expect(await sharePng(f, { title: 't', text: 'x' }, { share })).toBe('shared');
    const arg = share.mock.calls[0][0];
    expect(arg).toEqual({ files: [f], title: 't', text: 'x' });
    expect('url' in arg).toBe(false);
  });
  it('AbortError -> aborted', async () => {
    const e = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(await sharePng(f, {}, { share: () => Promise.reject(e) })).toBe('aborted');
  });
  it('other reject or sync throw or no share -> failed', async () => {
    expect(await sharePng(f, {}, { share: () => Promise.reject(new Error('n')) })).toBe('failed');
    expect(await sharePng(f, {}, { share: () => { throw new Error('n'); } })).toBe('failed');
    expect(await sharePng(f, {}, {})).toBe('failed');
  });
});

describe('downloadFile', () => {
  it('clicks anchor with download and revokes url', () => {
    vi.useFakeTimers();
    const a = { click: vi.fn(), remove: vi.fn(), style: {} };
    const doc = { createElement: () => a, body: { appendChild: vi.fn() } };
    const urlApi = { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() };
    downloadFile({ name: 'วัน.png' }, doc, urlApi);
    expect(a.download).toBe('วัน.png');
    expect(a.href).toBe('blob:1');
    expect(a.click).toHaveBeenCalled();
    vi.runAllTimers();
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    vi.useRealTimers();
  });
});

describe('isIOS / buildShareText', () => {
  it('isIOS', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(true);
    expect(isIOS('Mozilla/5.0 (Linux; Android 13)')).toBe(false);
  });
  it('buildShareText', () => {
    expect(buildShareText('วันเพจ {short_name} {date_th}', { short_name: 'ช่างกล8', date_th: '23 ตุลาคม พ.ศ. 2569' }))
      .toBe('วันเพจ ช่างกล8 23 ตุลาคม พ.ศ. 2569');
  });
});
