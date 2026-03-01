import { describe, expect, it } from 'vitest';
import {
  buildBuiltinHash,
  parseDeepLinkFromHash,
  parseBuiltinDeepLinkFromHash,
  toBuiltinFullId,
  toBuiltinShortId
} from './deepLink';

describe('deepLink', () => {
  it('parses builtin link hash', () => {
    const parsed = parseBuiltinDeepLinkFromHash('#v=1&src=builtin&id=Agricola');
    expect(parsed).toEqual({
      version: '1',
      source: 'builtin',
      shortId: 'Agricola'
    });
  });

  it('rejects invalid hash', () => {
    expect(parseBuiltinDeepLinkFromHash('#foo=bar')).toBeNull();
  });

  it('parses cloud link hash', () => {
    expect(parseDeepLinkFromHash('#v=1&src=cloud&id=abc123')).toEqual({
      version: '1',
      source: 'cloud',
      cloudId: 'abc123'
    });
  });

  it('builds stable builtin hash', () => {
    expect(buildBuiltinHash('A Feast for Odin')).toBe('#v=1&src=builtin&id=A+Feast+for+Odin');
  });

  it('converts between full and short built-in ids', () => {
    expect(toBuiltinShortId('Built-in-Agricola')).toBe('Agricola');
    expect(toBuiltinFullId('Agricola')).toBe('Built-in-Agricola');
    expect(toBuiltinFullId('Built-in-Agricola')).toBe('Built-in-Agricola');
  });
});
