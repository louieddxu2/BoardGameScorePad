import type { IntegrationTranslationKey } from '../../i18n/integration';

/**
 * Supported export origins for the game-catalog CSV importer and its UI copy.
 * BGG Collection and GeekGroup provide game data, not BG Stats play records.
 * BG Stats JSON is a third supported origin in the app, but belongs to the
 * separate features/bgstats importer and must not be listed in this dialog.
 *
 * Uploads, public CSV URLs and Google Sheets are delivery methods, not origins.
 * The parser's permissive header matching is compatibility handling, not a
 * promise to support arbitrary user-authored CSV files or spreadsheets.
 */
export const GAME_CATALOG_IMPORT_SOURCES = [
  { id: 'bgg-collection', descriptionKey: 'catalog_source_bgg' },
  { id: 'geekgroup', descriptionKey: 'catalog_source_geekgroup' },
] as const satisfies readonly { id: string; descriptionKey: IntegrationTranslationKey }[];
