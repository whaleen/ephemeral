# Developer Guide

This file contains setup, development, build, and release notes for Ephemeral.

## Prerequisites

- Node.js (LTS)
- Bun
- Rust toolchain (required for Tauri desktop builds)
- macOS tooling for app bundling (if building Mac artifacts)

## Install

```bash
bun install
```

## Local Development

Desktop app (Tauri):

```bash
bun run tauri dev
```

Web-only frontend:

```bash
bun run dev
```

## Build

Frontend build:

```bash
npm run build
```

Desktop bundle:

```bash
bun run tauri build
```

## Quality Checks

TypeScript + Vite production build:

```bash
npm run build
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
