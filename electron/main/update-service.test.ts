import { describe, expect, it } from 'vitest';
import { compareVersions } from './update-service.js';

describe('compareVersions', () => {
  it('recognizes newer semantic versions', () => expect(compareVersions('v1.0.4', '1.0.3')).toBe(1));
  it('recognizes matching versions', () => expect(compareVersions('v1.0.4', '1.0.4')).toBe(0));
  it('recognizes older versions', () => expect(compareVersions('1.0.3', '1.0.4')).toBe(-1));
  it('rejects invalid release tags', () => expect(() => compareVersions('latest', '1.0.4')).toThrow('invalid'));
});
