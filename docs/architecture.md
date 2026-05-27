# Ephemeral — Architecture

## Overview

Ephemeral is a Tauri v2 desktop app. The frontend is a vanilla TypeScript single-page app rendered in a WebView; the Rust backend handles all filesystem operations and window state. The two communicate exclusively via Tauri's `invoke` IPC.

## Components

### Frontend (`src/`)

| Component | Role |
|-----------|------|
| `main.ts` | Entry point. Instantiates all components, wires keyboard shortcuts and export buttons. |
| `MarkdownEditor` | Core editor. Tiptap instance with Markdown serialization, source mode (raw textarea), and grammar checking via harper.js. |
| `SaveModal` | Export dialog — prompts for filename and format (`.md` / `.txt`), then delegates to `FileExportService`. |
| `InfoModal` | Help overlay showing keyboard shortcuts. Toggle with Cmd+/. |
| `TitleBar` | Custom drag region and window controls (frameless window). |
| `ThemeManager` | Reads system `prefers-color-scheme` and applies light/dark class to document root. |
| `HarperCorrectionMenu` | Context menu shown when clicking a harper.js grammar error. Displays replacements and applies the chosen one. |
| `FileExportService` | Calls Tauri `invoke` to get/set export directory and write files. |
| `PromptModal` | Generic inline input modal used for link and image URL prompts. |

### Rust Backend (`src-tauri/src/lib.rs`)

| Command | Role |
|---------|------|
| `save_file` | Writes content to the export directory with auto-incremented filename if needed. |
| `get_export_directory` | Returns current export dir (defaults to `~/Documents`). |
| `set_export_directory` | Updates the in-memory export dir (`Mutex<Option<PathBuf>>`). |
| `select_export_directory` | Returns `~/Documents` as default — actual picker is triggered by the Tauri dialog plugin in `FileExportService`. |
| `show_item_in_folder` | Reveals exported file in Finder/Explorer. |
| `quit_app` | Exits the process. |

Window geometry (position + size) is persisted to Tauri's app config dir as `window-geometry.json` on every move/resize event, and restored on next launch.

## Data Flow

```
User types
  → Tiptap editor (rich text)
  → harper.js lints on 500ms debounce → decorations on error spans

User exports (Cmd+S)
  → SaveModal collects filename + format
  → FileExportService.saveFile()
  → invoke('save_file', { filename, content })
  → Rust: get_unique_filename() → fs::write()
  → returns saved path
  → FileExportService stores path for Finder reveal
```

## Key Decisions

- **No auto-save, no save prompt** — core product philosophy. Closing the window discards unsaved content by design.
- **Frameless window** — `decorations: false` in Tauri config; `TitleBar.ts` owns drag and close behavior.
- **Export directory state in Rust** — persisted in a `Mutex` for the process lifetime; frontend always queries Rust rather than caching locally.
- **Vanilla TypeScript, no framework** — the UI is simple enough that a framework would add overhead without benefit.
- **Source mode is a textarea** — toggling Cmd+M switches between the Tiptap rich editor and a raw `<textarea>`. Simpler and more reliable than a CodeMirror integration.

## Out of Scope

- Cloud sync or remote storage
- Multiple windows
- Auto-save or crash recovery
- Document history or versioning
