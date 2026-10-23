// แชร์ PNG ไป LINE ผ่าน Web Share + ตัวช่วยเมื่อเปิดใน LINE in-app browser
// ค่าทั้งหมดของเบราว์เซอร์เป็นพารามิเตอร์ที่ฉีดได้ เพื่อเทสต์ใน Node

export function isLineInApp(ua) {
  return / Line\//i.test(ua || '');
}

export function isIOS(ua) {
  return /iPhone|iPad|iPod/i.test(ua || '');
}

// บันทึกรูป: <a download> ของ blob ใช้ไม่ได้ใน LINE in-app (Android) และ iOS → ให้กดค้างที่รูปแทน
export function saveMode(ua) {
  return isLineInApp(ua) || isIOS(ua) ? 'longpress' : 'download';
}

// เพิ่ม openExternalBrowser=1 (ไม่ซ้ำ) เพื่อให้ LINE เด้งไปเบราว์เซอร์ภายนอก
export function externalBrowserUrl(href) {
  if (/[?&]openExternalBrowser=1(?:&|#|$)/.test(href)) return href;
  const hashAt = href.indexOf('#');
  const base = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  return base + (base.includes('?') ? '&' : '?') + 'openExternalBrowser=1' + hash;
}

export function canShareFile(file, nav = globalThis.navigator) {
  try {
    return !!(nav && typeof nav.share === 'function' && typeof nav.canShare === 'function'
      && nav.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

// ไม่ส่ง url เพราะบางแอปจะเลือกแชร์ลิงก์แทนไฟล์
export async function sharePng(file, { title, text } = {}, nav = globalThis.navigator) {
  try {
    await nav.share({ files: [file], title, text });
    return 'shared';
  } catch (e) {
    return e && e.name === 'AbortError' ? 'aborted' : 'failed';
  }
}

export function downloadFile(file, doc = globalThis.document, urlApi = globalThis.URL) {
  const url = urlApi.createObjectURL(file);
  const a = doc.createElement('a');
  a.href = url;
  a.download = file.name;
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  if (a.remove) a.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 1000);
}

export function buildShareText(template, { short_name, date_th }) {
  return template.replaceAll('{short_name}', () => short_name).replaceAll('{date_th}', () => date_th);
}
