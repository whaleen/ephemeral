# Developer Guide

This file contains setup, development, build, and release notes for Ephemeral.

## Prerequisites

- [Vite+](https://viteplus.dev/) (`vp` CLI — manages Node.js and the package manager)
- Rust toolchain (required for Tauri desktop builds)
- macOS tooling for app bundling (if building Mac artifacts)

## Install

```bash
vp install
```

## Local Development

Desktop app (Tauri):

```bash
vp exec tauri dev
```

Web-only frontend:

```bash
vp dev
```

## Build

Frontend build:

```bash
vp run build
```

Desktop bundle:

```bash
vp exec tauri build
```

## Quality Checks

Format, lint, and type check:

```bash
vp check
```

TypeScript + Vite production build:

```bash
vp run build
```

Rust compile check:

```bash
cd src-tauri
cargo check
```

## Release Flow

1. Commit changes:

```bash
git add -A
git commit -m "Your message"
```

2. Push to main:

```bash
git push origin main
```

3. Create GitHub release (example):

```bash
gh release create v0.1.1 --target main --title "v0.1.1" --generate-notes
```

## Notes

- The `.app` bundle is generated at:
  `src-tauri/target/release/bundle/macos/Ephemeral.app`
- If DMG generation fails, you can still install the `.app` directly:

```bash
ditto "src-tauri/target/release/bundle/macos/Ephemeral.app" "/Applications/Ephemeral.app"
```
