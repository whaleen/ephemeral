# Ephemeral — Agent Context

## What This Project Is

Ephemeral is a minimalist desktop writing tool built with Tauri v2. It intentionally never auto-saves and never prompts on close — text only persists when you explicitly export it. The philosophy is distraction-free writing with deliberate, non-destructive exports (filenames auto-increment to prevent overwrites).

## Stack

- **Runtime**: Tauri v2 (Rust backend, Vite/WebView frontend)
- **Frontend**: TypeScript (vanilla, no framework), Tiptap v2 (rich text/markdown editor), Tailwind CSS v4
- **Rust backend**: file I/O, export directory state, window geometry persistence
- **Package manager**: Bun
- **Bundler**: Vite
- **Linting/formatting**: ESLint + Prettier
- **Deployment**: GitHub Releases (macOS `.app` bundle)

## Running Locally

```bash
bun install
bun run tauri dev       # desktop app with hot reload
bun run dev             # web-only frontend (no Tauri APIs available)
npm run build           # type check + frontend build
cd src-tauri && cargo check  # Rust compile check
bun run tauri build     # release bundle → src-tauri/target/release/bundle/
```

## Key Files & Directories

```
src/
  main.ts                    — app entry; wires components and keyboard shortcuts
  components/
    MarkdownEditor.ts         — Tiptap editor, edit/preview mode toggle
    SaveModal.ts              — export dialog (filename input, format choice)
    InfoModal.ts              — help overlay (Cmd+/)
    TitleBar.ts               — custom frameless window title bar and drag region
    ThemeManager.ts           — system light/dark theme detection
    HarperCorrectionMenu.ts   — inline grammar correction context menu (harper.js)
  services/
    FileExportService.ts      — export directory picker and file save via Tauri invoke
src-tauri/src/lib.rs          — Tauri commands: save_file, export dir state,
                                show_item_in_folder, window geometry persistence
index.html                    — single-page shell; all UI injected into DOM
```

## Gotchas

- Frameless window (`decorations: false`) — `TitleBar.ts` handles drag and window controls manually.
- Export directory state lives in Rust (`Mutex<Option<PathBuf>>`), not the frontend — always query Rust for the current path.
- Window geometry persisted to Tauri's app config dir as `window-geometry.json`, restored on next open.
- `select_export_directory` in `lib.rs` doesn't open a picker — it just returns `~/Documents` as the default. The actual folder picker is triggered via the Tauri dialog plugin from `FileExportService`.
- `harper.js` provides inline grammar checking via a custom context menu component.


## Spec

See SPEC.md for the feature checklist.

## Docs

See `docs/` for architecture and status documentation.
