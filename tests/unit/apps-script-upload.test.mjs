// finalizeSuccess_: ไฟล์อยู่ใน Drive แล้ว — ห้ามโยน error (client จะ retry จนเกิดไฟล์ซ้ำ)
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadUpload(stubs) {
  const ctx = vm.createContext({ console: { error: vi.fn(), log() {} }, JSON, Date, ...stubs });
  for (const f of ['apps-script/Validate.gs', 'apps-script/Upload.gs']) {
    vm.runInContext(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

describe('finalizeSuccess_', () => {
  it('a failing cache.put does not throw; log + schools write-back still happen', () => {
    const lock = { waitLock: vi.fn(), releaseLock: vi.fn() };
    const g = loadUpload({
      CacheService: { getScriptCache: () => ({ put: () => { throw new Error('cache down'); } }) },
      LockService: { getScriptLock: () => lock },
    });
    g.logSafe_ = vi.fn();
    g.readSchools_ = vi.fn(() => ({}));
    g.findSchool_ = vi.fn(() => null);
    expect(() => g.finalizeSuccess_({}, {}, { report_id: 'r', school_id: 's' }, { file_id: 'f', file_url: 'u', bytes: 1 }, 0)).not.toThrow();
    expect(g.logSafe_).toHaveBeenCalledWith({}, expect.anything(), 'ok', '', 'f', 'u', 1, 0);
    expect(lock.releaseLock).toHaveBeenCalled();
    expect(g.console.error).toHaveBeenCalledWith(expect.stringContaining('cache rid failed'));
  });
});
