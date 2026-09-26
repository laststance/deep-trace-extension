# Publishing

This extension is prepared for the Visual Studio Marketplace. The package is built with `@vscode/vsce` and contains only the compiled extension entry points, Marketplace metadata, README, CHANGELOG, LICENSE, and extension media assets.

## Preflight

Run this before creating or uploading a VSIX:

```bash
pnpm verify
```

The verification script runs:

- `pnpm typecheck`
- `pnpm test`
- `pnpm audit --prod`
- `pnpm package`

## Package locally

```bash
pnpm package
```

The generated file is:

```text
deep-trace-navigation-0.0.1.vsix
```

## Publish

First authenticate the Marketplace publisher account:

```bash
pnpm exec vsce login laststance
pnpm exec vsce verify-pat laststance
```

Then publish:

```bash
pnpm vsce:publish
```

## Marketplace notes

- Publisher: `laststance`
- Extension ID: `laststance.deep-trace-navigation`
- VS Code compatibility: `^1.138.0`
- Runtime dependencies: none
- Package icon: `media/icon.png` (PNG, not SVG)
- Excluded by `.vscodeignore`: source files, tests, docs, logs, local VS Code settings, source maps, existing VSIX files, and local Codex/Claude files
