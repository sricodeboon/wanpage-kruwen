import { todayBangkok, formatThaiDate, thaiWeekday, stampHHmm, addDaysISO, daysBetweenISO } from '../../site/js/thaidate.js';
test('formats spec example', () => expect(formatThaiDate('2026-10-23')).toBe('23 ตุลาคม พ.ศ. 2569'));
test('all 12 months', () => expect(['01','02','03','04','05','06','07','08','09','10','11','12'].map(m=>formatThaiDate(`2026-${m}-01`).split(' ')[1]))
  .toEqual(['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']));
test('weekday (2026-10-23 is Friday; 22 is Thursday)', () => expect(thaiWeekday('2026-10-23')).toBe('ศุกร์'));
test('weekday', () => expect(thaiWeekday('2026-10-22')).toBe('พฤหัสบดี'));
test('23:30 UTC is next day in Bangkok', () => expect(todayBangkok(new Date('2026-10-22T23:30:00Z'))).toBe('2026-10-23'));
test('16:59 UTC still same day', () => expect(todayBangkok(new Date('2026-10-23T16:59:00Z'))).toBe('2026-10-23'));
test('stamp Bangkok time', () => expect(stampHHmm(new Date('2026-10-23T00:42:00Z'))).toBe('0742'));
test('leap day', () => expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29'));
test('days between', () => expect(daysBetweenISO('2026-10-16','2026-10-23')).toBe(7));
