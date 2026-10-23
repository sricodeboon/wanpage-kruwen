import { describe, it, expect } from 'vitest';
import { parseCSV, rowsToObjects, parseBool, normalizePhone } from '../../site/js/csv.js';

describe('parseCSV', () => {
  it('handles quoted comma, escaped quote, CRLF', () => {
    expect(parseCSV('a,"b,c","d""e"\r\n1,2,3')).toEqual([['a', 'b,c', 'd"e'], ['1', '2', '3']]);
  });
  it('strips BOM', () => {
    expect(parseCSV('﻿x,y\n1,2')).toEqual([['x', 'y'], ['1', '2']]);
  });
  it('keeps newline inside quotes and ignores trailing newline', () => {
    expect(parseCSV('a,"b\nc"\n')).toEqual([['a', 'b\nc']]);
  });
});

describe('rowsToObjects', () => {
  it('uses header names and skips # rows', () => {
    const rows = [['id', 'name'], ['#คำอธิบาย', 'x'], ['1', 'a'], ['2', 'b']];
    expect(rowsToObjects(rows)).toEqual([{ id: '1', name: 'a' }, { id: '2', name: 'b' }]);
  });
  it('empty input gives []', () => {
    expect(rowsToObjects([])).toEqual([]);
  });
});

describe('parseBool / normalizePhone', () => {
  it('parseBool', () => {
    for (const v of ['TRUE', 'true', '1', 'ใช่']) expect(parseBool(v)).toBe(true);
    for (const v of ['FALSE', '', '0', undefined]) expect(parseBool(v)).toBe(false);
  });
  it('normalizePhone', () => {
    expect(normalizePhone('0812345678')).toBe('081-234-5678');
    expect(normalizePhone(' 02-123 ')).toBe('02-123');
    expect(normalizePhone(undefined)).toBe('');
  });
  it('normalizePhone restores the leading 0 a number-formatted Sheet column drops', () => {
    expect(normalizePhone('812345678')).toBe('081-234-5678');
    expect(normalizePhone('912345678')).toBe('091-234-5678');
    expect(normalizePhone('42123456')).toBe('42123456'); // ไม่เดา
  });
});
