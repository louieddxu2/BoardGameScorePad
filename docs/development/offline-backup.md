# Offline full-data backup

Settings provides ZIP export and destructive full-data replacement. The cloud
merge/restore flow is unchanged. Backups are local downloads; no Google request
is needed. The archive uses the same core layout as Drive:

```text
BoardGameScorePad/
  _Templates/<game-name>_<template-id>/data.json
                                      <image-id>.jpg
  _History/<game-name>_<record-id>/session.json
                                  <photo-id>[_<revision>].jpg
  _Active/<game-name>_<session-id>/session.json
                                  <photo-id>[_<revision>].jpg
  _System/settings_backup.json
          tables/<table-name>.json
          Images/<unreferenced-image-or-rotation-source>.jpg
          offline_manifest.json
```

Names are sanitized for portable filesystem paths. JSON is indented and photos
retain their original bytes (the `.jpg` naming matches Drive). The manifest
records actual MIME types, image ownership, rotation originals, per-file SHA-256
checksums and mappings back to database tables. Extra local tables preserve
saved games, BGG identities, recommendation weights and analytics state, beyond
the standard cloud settings document. User preferences use an explicit allowlist;
Google credentials, account identity, migration flags and device/room state are
not portable data.

Built-in scoreboards are excluded. Existing built-in tables and their local
image assets remain intact during replacement. History template snapshots stay
with their records, so historical scores remain interpretable even when the
original scoreboard no longer exists.

Import validates the entire archive, checksums, table keys, preferences and image
references before writing. A single IndexedDB read/write transaction clears and
replaces user data and clears transient room/delivery/share caches. Storage errors
abort the transaction; preference changes are also restored on failure. Import
does not merge with old data or resume old room identities. An active room blocks
replacement. Cloud folder/image mappings are detached to avoid reusing another
installation's account-specific IDs. Success reloads the app to reinitialize all
state owners from the restored snapshot. The confirmation asks users to close
other tabs; this operation cannot stop writes from other already-open clients.

ZIP support is bundled with the app for offline use. Compression runs through
fflate's asynchronous ZIP API; existing photos use STORE without recompression.
There are no full database/image reads until an export or import is requested.
Export holds a consistent database snapshot and ZIP buffers in memory, so very
large photo libraries can still be limited by available device memory. Missing
local photos/backgrounds stop export rather than producing an incomplete backup.

Archives currently support format version 1. Newer database versions are rejected
by older apps. Import bounds decompressed input size and rejects duplicate or
unsafe paths. Checksums detect corruption; they are not a signature or encryption.
