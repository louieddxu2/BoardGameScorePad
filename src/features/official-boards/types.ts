/** One official (cloud built-in) scoreboard as listed in the catalog: metadata only. */
export interface OfficialCatalogEntry {
  id: string;
  bggId: string;
  lang: string;
  name: string;
  enName?: string | null;
  /** Latest published version; 0 means only the copy bundled with the app exists. */
  version: number;
  bundled: boolean;
  updatedAt: number;
  /** The game's names from the rules site, shared by every language's board of this BGG ID, when known. */
  game?: OfficialGameInfo | null;
}

/** Names of an official game kept by the cloud: the rules site's English name and aliases. */
export interface OfficialGameInfo {
  name?: string;
  altNames?: string[];
}

/** First-run download: the latest content of every bundled official scoreboard of one language. */
export interface OfficialPackPayload {
  lang: string;
  throughVersion: number;
  builtAt: number;
  templates: { id: string; bggId: string; name: string; version: number; payload: Record<string, unknown> }[];
}

/** One user-shared cloud scoreboard as listed in the share catalog. */
export interface ShareCatalogEntry {
  id: string;
  name: string;
  lang?: string | null;
  bggId?: string | null;
  bggName?: string | null;
  createdAt: number;
  /** Present only in weekly snapshots. */
  downloadCount?: number;
}

export type CatalogKind = 'official' | 'share';

/** Local sync position for one catalog. */
export interface CatalogSyncState {
  kind: CatalogKind;
  throughVersion: number;
  generation: number;
  /** When the full snapshot was last downloaded. */
  snapshotAt: number;
  /** When changes were last checked successfully. */
  checkedAt: number;
}

/** An official version kept for offline use. Only downloads are reapplied after a rebuild. */
export interface OfficialVersionRecord {
  id: string;
  version: number;
  template: import('../../types').GameTemplate;
  downloadedAt?: number;
}

export interface CatalogSnapshotPayload<T> {
  generation: number;
  throughVersion: number;
  generatedAt: number;
  templates: T[];
}

export interface CatalogChangesPayload<T> {
  changes: { templateId: string; catalogVersion: number; deleted: boolean; template?: T }[];
  throughVersion: number;
  hasMore: boolean;
}

/** Worker answer for "what would publishing this BGG ID + language update?" */
export interface OfficialPublishTarget {
  exists: boolean;
  bggId: string;
  lang: string;
  id?: string;
  name?: string;
  enName?: string | null;
  version?: number;
  bundled?: boolean;
  nextVersion: number;
  latestPayload?: { columns?: { id: string; name: string }[] } | null;
}

export interface OfficialPublishResult {
  id: string;
  version: number;
  created?: boolean;
  unchanged?: boolean;
}

export interface OfficialVersionSummary {
  version: number;
  name: string;
  createdAt: number;
  restoredFrom?: number;
}
