export interface BuiltinDeepLink {
  version: '1';
  source: 'builtin';
  shortId: string;
}

export interface CloudDeepLink {
  version: '1';
  source: 'cloud';
  cloudId: string;
}

export type ParsedDeepLink = BuiltinDeepLink | CloudDeepLink;

const BUILTIN_PREFIX = 'Built-in-';

const normalizeShortId = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};

export const toBuiltinShortId = (fullTemplateId: string): string => {
  if (fullTemplateId.startsWith(BUILTIN_PREFIX)) {
    return fullTemplateId.slice(BUILTIN_PREFIX.length);
  }
  return fullTemplateId;
};

export const toBuiltinFullId = (shortId: string): string => {
  const normalized = normalizeShortId(shortId);
  if (normalized.startsWith(BUILTIN_PREFIX)) return normalized;
  return `${BUILTIN_PREFIX}${normalized}`;
};

export const buildBuiltinHash = (shortId: string): string => {
  const params = new URLSearchParams({
    v: '1',
    src: 'builtin',
    id: normalizeShortId(shortId)
  });
  return `#${params.toString()}`;
};

export const buildBuiltinShareUrl = (shortId: string): string => {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${buildBuiltinHash(shortId)}`;
};

export const parseBuiltinDeepLinkFromHash = (hash: string): BuiltinDeepLink | null => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const version = params.get('v');
  const source = params.get('src');
  const id = params.get('id');

  if (version !== '1' || source !== 'builtin' || !id) return null;

  const shortId = normalizeShortId(id);
  if (!shortId) return null;

  return {
    version: '1',
    source: 'builtin',
    shortId
  };
};

export const parseDeepLinkFromHash = (hash: string): ParsedDeepLink | null => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const version = params.get('v');
  const source = params.get('src');
  const id = params.get('id');
  if (version !== '1' || !id) return null;

  if (source === 'builtin') {
    const shortId = normalizeShortId(id);
    if (!shortId) return null;
    return { version: '1', source: 'builtin', shortId };
  }

  if (source === 'cloud') {
    const cloudId = normalizeShortId(id);
    if (!cloudId) return null;
    return { version: '1', source: 'cloud', cloudId };
  }

  return null;
};
