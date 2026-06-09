# Ephemeral

Ephemeral is a minimalist writing tool built with Tauri. It intentionally never auto-saves and never prompts on close. Text persists only when you explicitly export it.

This may seem silly, but I assure you it is not. I need a text editor that will open/close for me without asking me any questions or trying to do anything other than let me write. I want it to just nuke everything when I close. That is all for now. I will be making it allow for optionally "turning on" various features when I have time. Or not.. It does what I needed it to do.

## Installation

### Download

Download the latest version from [GitHub Releases](https://github.com/whaleen/ephemeral/releases/latest).

### Build from source

Requires [Vite+](https://viteplus.dev/) and the [Rust toolchain](https://www.rust-lang.org/tools/install).

```bash
vp install
vp exec tauri build
```

The app bundle will be generated in `src-tauri/target/release/bundle/`.

## Screenshots

![Ephemeral editor](./ephemeral.png)
![Ephemeral info pane](./ephemeral-info.png)

## Philosophy

- No auto-save
- No save prompts
- Manual export only
- Non-destructive exports (auto-incremented names)

## Features

- Markdown writing with rich formatting
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

For development setup and release workflow details, see `DEVELOPER.md`.
