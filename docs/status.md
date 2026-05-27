# Ephemeral — Status

## What's working

Everything in SPEC.md is shipped. The core loop — open, write, export — works end to end. Grammar checking, source mode, theme switching, window geometry persistence, and Finder reveal all function correctly.

## Known rough edges

- `select_export_directory` in `lib.rs` does not open a native folder picker — it returns `~/Documents` as a hardcoded default. The actual picker is triggered separately via the Tauri dialog plugin from `FileExportService`. The naming is misleading.
- Harper.js initializes asynchronously on first load; grammar checking is unavailable for a brief moment after launch.
- No visual indicator when harper.js fails to initialize (silent fallback to no grammar checking).

## What's next

No open issues. The project is feature-complete relative to its stated philosophy. Potential future work:

- Native folder picker wired directly to `select_export_directory` (fixing the naming/behavior mismatch)
- Word/character count display
- Export history (list of recently exported files)
