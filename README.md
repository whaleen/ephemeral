# Ephemeral

Ephemeral is a minimalist text editor built with Tauri. It intentionally never auto-saves and never prompts on close. Text persists only when you explicitly export it.

Legacy Electron snapshot:
- https://github.com/whaleen/ephemeral-text/tree/legacy-electron-snapshot

## Screenshots

![Ephemeral editor](./ephemeral.png)
![Ephemeral info pane](./ephemeral-info.png)

## Philosophy

- No auto-save
- No save prompts
- Manual export only
- Non-destructive exports (auto-incremented names)

## Features

- Markdown editing with rich formatting
- Export to `.md` or `.txt`
- Custom filename on export
- Configurable export directory
- Last export quick-reveal in Finder
- System theme support

## Usage

1. Open the app and start writing.
2. Press `Cmd/Ctrl + S` to export.
3. Enter a filename, then choose `Markdown` or `Text`.
4. Use the export directory control in the footer to change destination.

## Keyboard Shortcuts

- Save / Export: `Cmd/Ctrl + S`
- Info Pane: `Cmd/Ctrl + /`
- Toggle Markdown Mode: `Cmd/Ctrl + M`
- Set Export Folder: `Cmd/Ctrl + E`
- Close/Quit: `Cmd/Ctrl + W` or `Cmd/Ctrl + Q`
- Fullscreen: `Cmd/Ctrl + Shift + F`
- Bold: `Cmd/Ctrl + B`
- Headings: `Cmd/Ctrl + 1-6`
- Link: `Cmd/Ctrl + K`
- Image: `Cmd/Ctrl + Shift + I`
- Table: `Cmd/Ctrl + Shift + X`

For development setup, build, and release workflow, see `DEVELOPER.md`.
