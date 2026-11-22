/**
 * Pure helpers for `npm run sync:builtins`: copy the cloud's bundled official
 * scoreboards (the content packs) into src/data/templates*.ts.
 *
 * The data files hold one JSON array. Entries that do not change keep their
 * exact source text, and the text around and between entries is reused, so an
 * unchanged file is written back byte for byte and a sync touches only the
 * boards that moved. A synced board records the cloud version it holds as
 * `officialVersion`, which the app treats as its local version.
 */

// Fields the Worker strips from published content but a bundled copy keeps.
const LOCAL_FIELDS = ['hasImage', 'lastPlayerCount', 'imageId', 'cloudImageId', 'supportedColors'];

/** Split a data file into its entries (source text and value) and the text around and between them. */
export const splitDataFile = (text) => {
  const head = /export const \w+\s*:\s*GameTemplate\[\]\s*=\s*\[/.exec(text);
  if (!head) throw new Error('data_array_not_found');
  const arrayStart = head.index + head[0].length; // just after '['
  const arrayEnd = text.lastIndexOf(']');
  if (arrayEnd < arrayStart) throw new Error('data_array_end_not_found');
  const entries = [];
  const positions = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = arrayStart; i < arrayEnd; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const source = text.slice(start, i + 1);
        try {
          entries.push({ source, value: JSON.parse(source) });
        } catch {
          throw new Error(`invalid_builtin_entry_json_at_offset_${start}`);
        }
        positions.push([start, i + 1]);
      }
    }
  }
  if (depth !== 0 || inString) throw new Error('invalid_builtin_data_array');
  // Each entry keeps the exact text before it (after the previous entry); new entries use the most common one.
  entries.forEach((e, i) => {
    if (i > 0) e.gap = text.slice(positions[i - 1][1], positions[i][0]);
  });
  const counts = new Map();
  for (const e of entries.slice(1)) counts.set(e.gap, (counts.get(e.gap) ?? 0) + 1);
  const separator = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',\n  ';
  const lead = entries.length ? text.slice(arrayStart, positions[0][0]) : '\n';
  const trail = entries.length ? text.slice(positions[positions.length - 1][1], arrayEnd) : '\n';
  return { prefix: text.slice(0, arrayStart), lead, separator, trail, entries, suffix: text.slice(arrayEnd) };
};

/** JSON with the data files' spacing: `{ "k": v, ... }`, `[a, b]`. */
export const formatEntry = (value) => {
  if (Array.isArray(value)) return value.length ? `[${value.map(formatEntry).join(', ')}]` : '[]';
  if (value && typeof value === 'object') {
    const parts = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}: ${formatEntry(v)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
};

export const renderDataFile = ({ prefix, lead, separator, trail, entries, suffix }) =>
  `${prefix}${lead}${entries.map((e, i) => (i === 0 ? e.source : `${e.gap ?? separator}${e.source}`)).join('')}${trail}${suffix}`;

/** The bundled template for a pack item, keeping what only the bundle knows. */
const toBundled = (item, existing, now) => {
  const local = Object.fromEntries(
    LOCAL_FIELDS.filter((k) => existing && existing[k] !== undefined && item.payload[k] === undefined).map((k) => [k, existing[k]])
  );
  const { id: _id, name: _name, bggId: _bggId, officialVersion: _v, createdAt: _c, updatedAt: _u, ...content } = item.payload;
  const bundled = { id: item.id, name: item.name, ...content, ...local, bggId: item.bggId, createdAt: existing?.createdAt ?? now, updatedAt: now };
  if (item.version > 0) bundled.officialVersion = item.version;
  return bundled;
};

const versionOf = (template) => template?.officialVersion ?? 0;

/**
 * Merge one language's content pack into its data file entries. A board is
 * written when the cloud holds a newer version than the bundle, or when the
 * bundle lacks it. Bundled boards missing from the pack (no longer marked
 * bundled in the cloud) are kept and reported.
 */
export const planSync = (entries, packItems, now = Date.now()) => {
  const next = entries.map((e) => ({ ...e }));
  const updated = [];
  const added = [];
  for (const item of packItems) {
    const index = next.findIndex((e) => e.value.id === item.id);
    const existing = index === -1 ? undefined : next[index].value;
    if (existing && versionOf(existing) >= item.version) continue;
    const value = toBundled(item, existing, now);
    const entry = { source: formatEntry(value), value, gap: index === -1 ? undefined : next[index].gap };
    if (index === -1) {
      // Keep the files roughly in ID order: before the first entry with a greater ID.
      const at = next.findIndex((e) => e.value.id > item.id);
      next.splice(at === -1 ? next.length : at, 0, entry);
      added.push({ id: item.id, version: item.version });
    } else {
      next[index] = entry;
      updated.push({ id: item.id, from: versionOf(existing), to: item.version });
    }
  }
  const inPack = new Set(packItems.map((i) => i.id));
  const notInPack = entries.map((e) => e.value.id).filter((id) => !inPack.has(id));
  return { entries: next, updated, added, notInPack };
};

/** Raise CURRENT_BUILTIN_VERSION by one so installed apps rebuild their built-ins. */
export const bumpBuiltinVersion = (migrationText) => {
  const match = /const CURRENT_BUILTIN_VERSION = (\d+);/.exec(migrationText);
  if (!match) throw new Error('builtin_version_not_found');
  const next = Number(match[1]) + 1;
  return { text: migrationText.replace(match[0], `const CURRENT_BUILTIN_VERSION = ${next};`), from: Number(match[1]), to: next };
};

/** Mark the catalog position verified for both languages without forcing a local data rebuild. */
export const setBundledCatalogVersion = (migrationText, version) => {
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('invalid_bundled_catalog_version');
  const declaration = /(const BUNDLED_OFFICIAL_CATALOG_VERSION: number \| null = )(?:null|\d+);/;
  if (!declaration.test(migrationText)) throw new Error('bundled_catalog_version_not_found');
  return migrationText.replace(declaration, (_, prefix) => `${prefix}${version};`);
};

/**
 * Detect catalog changes that affect a pack, including boards still in a pack
 * after the cloud stopped bundling them.
 */
export const staleBundledChanges = (changes, packs) => {
  const packedThrough = new Map();
  for (const pack of Object.values(packs)) {
    for (const item of pack.templates) packedThrough.set(item.id, pack.throughVersion);
  }
  return changes.filter(change => {
    const includedThrough = packedThrough.get(change.templateId);
    if (includedThrough !== undefined) return change.catalogVersion > includedThrough;
    if (change.deleted) return true;
    const pack = packs[change.template?.lang];
    return !!change.template?.bundled && !!pack && change.catalogVersion > pack.throughVersion;
  }).map(change => change.templateId);
};
