export interface BuiltinDeepLink {
  source: 'builtin';
  shortId: string;
}

export interface CloudDeepLink {
  source: 'cloud';
  cloudId: string;
}

export type ParsedDeepLink = BuiltinDeepLink | CloudDeepLink;

const BUILTIN_PREFIX = 'Built-in-';

/**
 * 將字串轉換為 URL 安全的 English Slug
 * 規則：
 * 1. 若包含中文字元，回傳空字串 (不顯示 Slug)
 * 2. 拉丁語系轉譯 (ö -> o)
 * 3. 符號轉為連字號
 */
export const getEnglishSlug = (name: string): string => {
  // 1. 中文字元檢測 (CJK 範圍)
  if (/[\u4e00-\u9fa5]/.test(name)) return '';

  return name
    .normalize('NFD') // 分解音符字母
    .replace(/[\u0300-\u036f]/g, '') // 移除音符標記
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // 非英數 (包含空格、冒號、分號) 轉為連字號
    .replace(/^-+|-+$/g, '') // 修剪首尾連字號
    .replace(/-+/g, '-'); // 緊裝連續連字號
};

export const toBuiltinShortId = (fullTemplateId: string): string => {
  if (fullTemplateId.startsWith(BUILTIN_PREFIX)) {
    return fullTemplateId.slice(BUILTIN_PREFIX.length);
  }
  return fullTemplateId;
};

export const toBuiltinFullId = (shortId: string): string => {
  if (shortId.startsWith(BUILTIN_PREFIX)) return shortId;
  return `${BUILTIN_PREFIX}${shortId}`;
};

export const buildBuiltinHash = (id: string): string => {
  const shortId = toBuiltinShortId(id);
  // 使用 encodeURIComponent 確保特殊字元安全
  return `#${encodeURIComponent(shortId)}`;
};

export const buildBuiltinShareUrl = (id: string): string => {
  const { origin, pathname, search } = window.location;
  const hash = buildBuiltinHash(id);
  return `${origin}${pathname}${search}${hash}`;
};

export const buildCloudHash = (cloudId: string, englishName?: string): string => {
  const slug = englishName ? getEnglishSlug(englishName) : '';
  return slug ? `#${slug}/s/${cloudId}` : `#s/${cloudId}`;
};

/**
 * 解析 Hash 為深層連結對象
 * 支援格式：
 * 1. #Agricola (內建)
 * 2. #agricola/s/abc1234567 (雲端)
 * 3. #s/abc1234567 (雲端無 slug)
 */
export const parseDeepLinkFromHash = (hash: string): ParsedDeepLink | null => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  // 拒絕舊格式 (v=1&...)
  if (raw.includes('v=1') || raw.includes('src=') || raw.includes('id=')) {
    return null;
  }

  // 1. 檢查是否為雲端網址 (包含 /s/)
  if (raw.includes('/s/')) {
    const parts = raw.split('/s/');
    const cloudId = parts[parts.length - 1];
    if (cloudId) {
      return { source: 'cloud', cloudId };
    }
  }

  // 2. 檢查是否為無 Slug 的雲端網址 (s/ 開頭)
  if (raw.startsWith('s/')) {
    const cloudId = raw.slice(2);
    if (cloudId) {
      return { source: 'cloud', cloudId };
    }
  }

  // 3. 預設為內建模板 (需解碼)
  try {
    const decodedId = decodeURIComponent(raw);
    // 排除包含參數特徵或路徑符號的字串 (增強穩健性)
    if (raw.includes('=') || raw.includes('&')) return null;

    return { source: 'builtin', shortId: decodedId };
  } catch (e) {
    return null;
  }
};
