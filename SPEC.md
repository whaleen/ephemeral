# Ephemeral — Spec

Feature source of truth. Update this when features ship, change, or get cut.

## Editor

- ✅ Rich text editing via Tiptap (bold, italic, strikethrough, code block, blockquote)
- ✅ Headings H1–H6 (Cmd+1–6)
- ✅ Bullet lists, ordered lists, task lists
- ✅ Links (Cmd+K, with inline prompt modal)
- ✅ Images (Cmd+Shift+I, URL prompt)
- ✅ Tables (Cmd+Shift+X)
- ✅ Horizontal rule (Cmd+Shift+H)
- ✅ Markdown source mode toggle (Cmd+M) — raw textarea with list continuation on Enter
- ✅ Undo/redo (Cmd+Z / Cmd+Y / Cmd+Shift+Z)
- ✅ Placeholder text when editor is empty

## Grammar Checking

- ✅ Inline grammar checking via harper.js (debounced, 500ms)
- ✅ Click on underlined error to see correction menu with replacements
- ✅ Apply replacement replaces text in editor

## File Lifecycle

- ✅ Untitled ephemeral documents start blank and are never auto-saved
- ✅ Open `.md`, `.markdown`, or `.txt` files into file-backed editing mode
- ✅ Cmd+S saves file-backed documents in place
- ✅ Cmd+S exports untitled documents to `.md` or `.txt`
- ✅ Cmd+Shift+S exports/saves a copy for file-backed documents
- ✅ Custom filename prompt on export
- ✅ Auto-incrementing filenames to prevent overwrites on export
- ✅ Configurable export directory (Cmd+E)
- ✅ Reveal current/exported file in Finder

## Window & App

- ✅ Frameless custom title bar with drag region
- ✅ Fullscreen toggle (Cmd+Shift+F)
- ✅ System light/dark theme support
- ✅ Window geometry persisted and restored on reopen
- ✅ Info/help overlay (Cmd+/)
- ✅ Close/quit (Cmd+W or Cmd+Q)

## Philosophy / Non-features

- ❌ Auto-save — intentionally absent
- ❌ Save prompt for untitled ephemeral text — intentionally absent
- ✅ Save/discard/cancel prompt for dirty file-backed documents only
- ❌ Multiple windows — intentionally absent
