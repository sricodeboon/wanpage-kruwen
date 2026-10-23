// นโยบายตัดสิน golden: เข้มเฉพาะ linux (CI ubuntu ที่สร้าง golden ชุดจริง) หรือเมื่อสั่ง --strict
export const isStrict = (args, platform = process.platform) => args.includes('--strict') || platform === 'linux';

// วาดไม่สำเร็จ = ล้มเสมอ; ภาพต่างจาก golden = ล้มเฉพาะโหมดเข้ม
export const goldenExitCode = ({ failed, errored, strict }) => (errored || (failed && strict) ? 1 : 0);
