import { describe, it, expect, beforeAll } from 'vitest';
import { loadGs } from '../helpers/load-gs.mjs';

let g;
beforeAll(() => { g = loadGs('apps-script/Validate.gs'); });

const TODAY = '2026-10-23';
const SCHOOLS = ['changkon8', 'demo'];
const props = {
  APP_KEY: 'wp_new', APP_KEY_PREV: 'wp_old', UPLOAD_ENABLED: 'true',
  MAX_BYTES: '12000000', ARCHIVE_ALLOWED_MIME: 'image/png,image/jpeg',
};
const good = () => ({
  v: 1, app_key: 'wp_new', report_id: '123e4567-e89b-42d3-a456-426614174000',
  school_id: 'changkon8', report_date: '2026-10-23', teacher_ids: ['changkon8-01'],
  teacher_names: ['ส.ต.ท.ทดสอบ'], template_id: 'np-01', template_version: 1, app_version: 3,
  file_name: 'วันเพจ_ช่างกล8_2026-10-23_0742.png', mime: 'image/png', data_b64: 'AAAA', ua: 'Android Chrome 130',
});
const run = (p, pr = props) => g.validatePayload(p, pr, TODAY, SCHOOLS);

describe('validatePayload', () => {
  it('ผ่านเมื่อถูกต้องทั้งหมด', () => { expect(run(good())).toEqual({ ok: true }); });
  it('v != 1 -> INVALID', () => { expect(run({ ...good(), v: 2 }).error).toBe('INVALID'); });
  it('ไม่ใช่ object -> INVALID', () => { expect(run(null).error).toBe('INVALID'); });
  it('UPLOAD_ENABLED ไม่ใช่ true -> DISABLED', () => {
    expect(run(good(), { ...props, UPLOAD_ENABLED: 'false' }).error).toBe('DISABLED');
  });
  it('key ผิด -> BAD_KEY', () => { expect(run({ ...good(), app_key: 'nope' }).error).toBe('BAD_KEY'); });
  it('key ว่าง และ APP_KEY_PREV ว่าง ต้องไม่ผ่าน', () => {
    expect(run({ ...good(), app_key: '' }, { ...props, APP_KEY_PREV: '' }).error).toBe('BAD_KEY');
  });
  it('APP_KEY_PREV ผ่าน', () => { expect(run({ ...good(), app_key: 'wp_old' }).ok).toBe(true); });
  it('school ไม่อยู่ในรายการ -> UNKNOWN_SCHOOL', () => {
    expect(run({ ...good(), school_id: 'other' }).error).toBe('UNKNOWN_SCHOOL');
  });
  it('school_id รูปแบบผิด -> INVALID', () => {
    expect(run({ ...good(), school_id: 'Bad ID' }).error).toBe('INVALID');
  });
  it('report_date พรุ่งนี้ -> INVALID', () => {
    expect(run({ ...good(), report_date: '2026-10-24' }).error).toBe('INVALID');
  });
  it('report_date 8 วันก่อน -> INVALID, 7 วันก่อน ผ่าน', () => {
    expect(run({ ...good(), report_date: '2026-10-15' }).error).toBe('INVALID');
    expect(run({ ...good(), report_date: '2026-10-16' }).ok).toBe(true);
  });
  it('วันที่ไม่มีจริง -> INVALID', () => {
    expect(run({ ...good(), report_date: '2026-02-31' }).error).toBe('INVALID');
  });
  it('report_id ไม่ใช่ UUID -> INVALID', () => {
    expect(run({ ...good(), report_id: 'abc' }).error).toBe('INVALID');
  });
  it('ชื่อไฟล์มี / -> INVALID', () => {
    expect(run({ ...good(), file_name: 'วันเพจ_ช่าง/กล_2026-10-23_0742.png' }).error).toBe('INVALID');
  });
  it('ชื่อไฟล์ผิดแบบ / นามสกุลไม่ตรง mime -> INVALID', () => {
    expect(run({ ...good(), file_name: 'x.png' }).error).toBe('INVALID');
    expect(run({ ...good(), file_name: 'วันเพจ_ช่างกล8_2026-10-23_0742.jpg' }).error).toBe('INVALID');
  });
  it('mime ที่ไม่อนุญาต -> INVALID', () => {
    expect(run({ ...good(), mime: 'image/gif' }).error).toBe('INVALID');
  });
  it('JPEG ผ่านเมื่อชื่อไฟล์ .jpg', () => {
    expect(run({ ...good(), mime: 'image/jpeg', file_name: 'วันเพจ_ช่างกล8_2026-10-23_0742.jpg' }).ok).toBe(true);
  });
  it('data_b64 ใหญ่เกิน MAX_BYTES x 1.37 -> TOO_LARGE', () => {
    const big = 'A'.repeat(Math.floor(1000 * 1.37) + 1);
    expect(run({ ...good(), data_b64: big }, { ...props, MAX_BYTES: '1000' }).error).toBe('TOO_LARGE');
    expect(run({ ...good(), data_b64: 'A'.repeat(1370) }, { ...props, MAX_BYTES: '1000' }).ok).toBe(true);
  });
  it('data_b64 ว่าง -> INVALID', () => {
    expect(run({ ...good(), data_b64: '' }).error).toBe('INVALID');
  });
});

const png = (w, h) => {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  for (const n of [w, h]) b.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  return b;
};

describe('checkImageHeader', () => {
  it('PNG 1536x2304 -> true', () => { expect(g.checkImageHeader(png(1536, 2304), 'image/png')).toBe(true); });
  it('PNG 1024x1536 -> false', () => { expect(g.checkImageHeader(png(1024, 1536), 'image/png')).toBe(false); });
  it('PNG สั้นเกินไป / magic ผิด -> false', () => {
    expect(g.checkImageHeader(png(1536, 2304).slice(0, 20), 'image/png')).toBe(false);
    const bad = png(1536, 2304); bad[1] = 0;
    expect(g.checkImageHeader(bad, 'image/png')).toBe(false);
  });
  it('เลขไบต์ติดลบ (signed byte จาก Utilities.base64Decode) ก็อ่านถูก', () => {
    const signed = png(1536, 2304).map((x) => (x > 127 ? x - 256 : x));
    expect(g.checkImageHeader(signed, 'image/png')).toBe(true);
  });
  it('JPEG magic -> true; magic ผิด -> false', () => {
    expect(g.checkImageHeader([0xff, 0xd8, 0xff, 0xe0, 0], 'image/jpeg')).toBe(true);
    expect(g.checkImageHeader([0xff, 0xd8, 0x00], 'image/jpeg')).toBe(false);
  });
  it('mime แปลก -> false', () => { expect(g.checkImageHeader(png(1536, 2304), 'image/gif')).toBe(false); });
});

describe('rateLimitVerdict', () => {
  const limits = [8, 100, 6];
  it('ยังไม่เต็ม -> null', () => { expect(g.rateLimitVerdict([7, 99, 5], limits)).toBe(null); });
  it('โควตารายวันเต็ม -> RATE_LIMIT (ไม่ retry)', () => {
    expect(g.rateLimitVerdict([8, 0, 0], limits).error).toBe('RATE_LIMIT');
    expect(g.rateLimitVerdict([0, 100, 6], limits).error).toBe('RATE_LIMIT');
  });
  it('โควตานาทีเต็ม -> RATE_LIMIT_MINUTE ข้อความลองใหม่อัตโนมัติ', () => {
    const v = g.rateLimitVerdict([1, 1, 6], limits);
    expect(v).toEqual({ ok: false, error: 'RATE_LIMIT_MINUTE', message: 'ระบบกำลังคับคั่ง ลองใหม่อัตโนมัติ' });
  });
});

describe('rateKeys', () => {
  it('คืนคีย์ school / all / min', () => {
    expect(g.rateKeys('changkon8', '2026-10-23', '202610230742')).toEqual([
      'rl:school:changkon8:2026-10-23', 'rl:all:2026-10-23', 'rl:min:202610230742',
    ]);
  });
});
