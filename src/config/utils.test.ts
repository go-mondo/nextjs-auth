import { describe, expect, it } from 'vitest';
import { bool, num } from './utils';

describe('config utils', () => {
  describe('bool', () => {
    it('uses the default for missing and empty values', () => {
      expect(bool(undefined, true)).toBe(true);
      expect(bool('', false)).toBe(false);
    });

    it('parses false-like string values', () => {
      expect(bool('n')).toBe(false);
      expect(bool('No')).toBe(false);
      expect(bool(' false ')).toBe(false);
      expect(bool('0')).toBe(false);
      expect(bool('off')).toBe(false);
    });

    it('treats other provided values as truthy or falsey normally', () => {
      expect(bool('yes')).toBe(true);
      expect(bool(1)).toBe(true);
      expect(bool(0)).toBe(false);
    });
  });

  describe('num', () => {
    it('returns undefined for missing and empty values', () => {
      expect(num()).toBeUndefined();
      expect(num('')).toBeUndefined();
    });

    it('coerces numeric strings', () => {
      expect(num('42')).toBe(42);
      expect(num('3.5')).toBe(3.5);
    });
  });
});
