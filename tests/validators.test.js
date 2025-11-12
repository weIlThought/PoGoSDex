import { jest } from '@jest/globals';
import {
  validateDevicePayload,
  validateNewsPayload,
  validateCoordPayload,
  validateIssuePayload,
} from '../server/validators.js';

describe('Validators', () => {
  describe('validateDevicePayload', () => {
    it('should reject payload without model', () => {
      const result = validateDevicePayload({});
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('model or name required');
    });

    it('should accept valid device payload', () => {
      const result = validateDevicePayload({
        model: 'Pixel 8',
        brand: 'Google',
        type: 'Phone',
        os: 'Android 14',
        compatible: true,
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid compatible value', () => {
      const result = validateDevicePayload({
        model: 'Test Device',
        compatible: 'invalid',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('validateNewsPayload', () => {
    it('should reject payload without title', () => {
      const result = validateNewsPayload({ content: 'Test content' });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('title required');
    });

    it('should reject payload without content', () => {
      const result = validateNewsPayload({ title: 'Test Title' });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('content required');
    });

    it('should accept valid news payload', () => {
      const result = validateNewsPayload({
        title: 'Breaking News',
        content: 'This is the content',
        published: true,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('validateCoordPayload', () => {
    it('should reject payload without name', () => {
      const result = validateCoordPayload({ lat: 51.5074, lng: -0.1278 });
      expect(result.ok).toBe(false);
    });

    it('should reject invalid latitude', () => {
      const result = validateCoordPayload({
        name: 'Test Location',
        lat: 'invalid',
        lng: -0.1278,
      });
      expect(result.ok).toBe(false);
    });

    it('should accept valid coord payload', () => {
      const result = validateCoordPayload({
        name: 'London',
        lat: 51.5074,
        lng: -0.1278,
        category: 'top10',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('validateIssuePayload', () => {
    it('should reject payload without title', () => {
      const result = validateIssuePayload({ content: 'Issue description' });
      expect(result.ok).toBe(false);
    });

    it('should accept valid issue payload', () => {
      const result = validateIssuePayload({
        title: 'Bug Report',
        content: 'Description of the bug',
        status: 'open',
      });
      expect(result.ok).toBe(true);
    });
  });
});
