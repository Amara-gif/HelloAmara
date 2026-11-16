# Importing a JSON backup

The import screen lives at **Settings → Backup → Import a backup** (`#/settings`). It uses the
browser's normal file picker (`accept="application/json,.json"`). The file is read in the page;
nothing is uploaded.

## Validation happens first

Import rejects a file before any write when:

- the text is empty or is not valid JSON;
- the top level is not an object with a numeric `schemaVersion` equal to the installed schema;
- `exportedAt` or `deviceId` is missing or invalid;
- `stores` is missing, has an unknown store, or is missing one of the required store arrays;
- a row is not an object, has no key (`id`, or `key` for `meta`), or repeats a key;
- `updatedAt` or `deletedAt` is not an ISO 8601 timestamp.

The error toast states which check failed. File-extension checks are not used; the JSON content
is the source of truth.

## Merge (the default)

1. Match rows by their object-store key: `id` for data stores, `key` for `meta`.
2. **Added** — the file has a key that does not exist locally. The file row is written.
3. **Updated** — the key exists and the file row has a strictly newer `updatedAt`. The whole
   file row is written, including its `deletedAt`.
4. **Skipped** — the key exists and the file row is the same age or older, or the key is one of
   the device-only `meta` keys. The local row wins.

Equal timestamps keep the local row. This makes a repeated import of the same file harmless.

Before a write, a confirmation dialog shows per-store and total **added / updated / skipped**
counts. The import only runs when the user presses **Import backup**.

### Soft deletes

Every data row carries `updatedAt` and `deletedAt`. A tombstone is simply a row with a
non-null `deletedAt`, and it is exported and merged like any other row:

- A newer tombstone marks the local row deleted (it disappears from lists, but stays in
  IndexedDB for future merges).
- A newer live row can restore an older local tombstone.
- An older live row cannot resurrect a newer local tombstone.
- The confirmation dialog reports how many incoming tombstones are part of the updated count.

The app never physically deletes imported rows during a merge.

## Replace all (explicit only)

**Replace all** is a separate radio choice and is never the default. When selected and
confirmed, it clears every store in the current account, writes every non-device row from the
file, then restores the local device-only `meta` rows. This is the only path that removes
local-only rows; ordinary **Merge** never does.

The following local `meta` keys are always preserved in both modes:

`deviceId`, `lastExportAt`, `seedVersion`, `storagePersist`, `storagePersistSupported`,
`storagePersistCheckedAt`

They describe this browser and device rather than the data being moved, so an import cannot
silently change device identity, demo-seed state, persistent-storage status or export-age
warnings.

## Tests

`tests/import-json.test.js` covers validation failures, export→empty-account row counts, the
newer-`updatedAt` merge rule, soft-delete/tombstone behaviour, explicit replace all, and the
Settings file picker.
