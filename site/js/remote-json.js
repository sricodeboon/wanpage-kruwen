// โหลด JSON ของเว็บ (config.json / templates.json) พร้อมสำเนาล่าสุดที่ใช้ได้ใน storage
// fetch ล้ม/ได้ของเสีย → ใช้สำเนาเดิม (source 'cache'); ไม่มีสำเนา → data null (source 'none')

export const isPlainObject = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
export const validConfig = (x) => isPlainObject(x) && Number.isFinite(Number(x.app_version));
export const validTemplates = (x) => isPlainObject(x) && Array.isArray(x.templates);

export async function loadJsonCached({ url, key, storage, fetchFn, validate = isPlainObject, fetchOpts }) {
  try {
    const res = await fetchFn(url, fetchOpts);
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    if (!validate(data)) throw new Error('invalid ' + url);
    try { storage.setItem(key, JSON.stringify(data)); } catch { /* เต็ม/ถูกบล็อก */ }
    return { data, source: 'fresh' };
  } catch {
    try {
      const c = JSON.parse(storage.getItem(key));
      if (validate(c)) return { data: c, source: 'cache' };
    } catch { /* สำเนาเสีย = ไม่มี */ }
    return { data: null, source: 'none' };
  }
}
