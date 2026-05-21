# Kilo Code VS Code Extension — Build Guide

The extension source lives in `packages/kilo-vscode/`. The monorepo uses **Bun** as the package manager and **esbuild** to bundle the extension.

## Prerequisites

- [Bun](https://bun.sh/) `>= 1.3.13` (`bun --version`)
- Node.js (for `node esbuild.js` calls invoked by the scripts)
- `vsce` is only needed if packaging a `.vsix` for distribution

## 1. Install dependencies

From the repo root:

```bash
bun install
```

This also runs `postinstall`, which fixes `node-pty` and sets up git hooks.

## 2. Build the extension (development)

```bash
cd packages/kilo-vscode
bun run compile
```

What this does, in order:
1. **`prepare:cli-binary`** — copies or symlinks the local CLI binary into `bin/`
2. **`rebuild-sdk`** — builds the JS SDK (`packages/sdk/js`) so type definitions are up to date
3. **`typecheck`** — runs `tsc --noEmit` on both the extension and the webview
4. **`lint`** — runs `eslint src webview-ui`
5. **`node esbuild.js`** — bundles the extension to `dist/extension.js`

Output lands in `packages/kilo-vscode/dist/`.

## 3. Build for production (pre-packaging)

```bash
cd packages/kilo-vscode
bun run package
```

Same pipeline as `compile`, but passes `--production` to esbuild (minified, no source maps).

## 4. Watch mode (iterative development)

```bash
cd packages/kilo-vscode
bun run watch
```

Runs `esbuild --watch` and `tsc --noEmit --watch` in parallel. Rebuilds on every file change.

To also watch the CLI binary when working on `packages/opencode`:

```bash
bun run watch:cli
```

## 5. Run the extension locally in VS Code

```bash
# From the repo root
bun run extension
# or from packages/kilo-vscode
bun run extension
```

This calls `script/launch.ts`, which opens a VS Code Extension Development Host with the built extension loaded.

## 6. Package a `.vsix` (optional)

Install `vsce` if you haven't already:

```bash
npm install -g @vscode/vsce
```

Then, after running `bun run package`:

```bash
cd packages/kilo-vscode
vsce package --no-dependencies
```

> **Note:** `--no-dependencies` is required in this monorepo. Without it, vsce follows Bun workspace symlinks in `node_modules` that resolve to paths outside the package root (e.g. `.changeset/`) and errors out. This is safe because esbuild already bundles all dependencies into `dist/extension.js`.

The `.vsix` file will be created in `packages/kilo-vscode/`.

## Key build files

| File | Purpose |
|---|---|
| `packages/kilo-vscode/esbuild.js` | esbuild config — bundles extension + webview, solid-js deduplication |
| `packages/kilo-vscode/script/build.ts` | Full CI build script (multi-target, copies CLI binaries per platform) |
| `packages/kilo-vscode/script/local-bin.ts` | Prepares the local CLI binary for development builds |
| `packages/kilo-vscode/tsconfig.json` | TypeScript config for the extension host code |
| `packages/kilo-vscode/webview-ui/tsconfig.json` | TypeScript config for the webview (SolidJS UI) |
| `turbo.json` | Turborepo pipeline — used by CI for caching and task ordering |
