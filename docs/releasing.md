# Releasing

This extension is prepared for the Visual Studio Marketplace. The package is built with `@vscode/vsce` and contains only the compiled extension entry points, Marketplace metadata, README, CHANGELOG, LICENSE, and extension media assets.

## Preflight

Run this before creating or uploading a VSIX:

```bash
pnpm verify
```

`pnpm verify` runs `pnpm check` (format, documentation links, lint, types, tests with coverage, Fallow and VSIX packaging) followed by `pnpm audit --prod`. Update `version` in `package.json` and add a CHANGELOG.md entry first.

## Package locally

```bash
pnpm package
```

The generated file is:

```text
deep-trace-navigation-<version>.vsix
```

## Publish

Publishing uploads the same VSIX to both the VS Code Marketplace and Open VSX. Tokens are never stored in the repo: `.env.1password` only holds `op://` references, and the [1Password CLI](https://developer.1password.com/docs/cli/) injects `VSCE_PAT` and `OVSX_PAT` for the duration of the command.

Check what would run without publishing:

```bash
pnpm package
pnpm publish:stores:dry-run
```

Then publish:

```bash
pnpm publish:stores
```

`scripts/publish-stores.mjs` stops at the first failed upload, so a release never ends up on only one store without an error.

After publishing, push the release commit, tag it `v<version>`, and create a GitHub Release with the VSIX attached:

```bash
gh release create v<version> deep-trace-navigation-<version>.vsix --title v<version> --notes-file <notes>
```

Automating this in CI is tracked in [TODOS.md](../TODOS.md).

## Marketplace notes

- Publisher: `laststance`
- Extension ID: `laststance.deep-trace-navigation`
- VS Code compatibility: `^1.138.0`
- Runtime dependencies: none
- Package icon: `media/icon.png` (PNG, not SVG)
- Excluded by `.vscodeignore`: source files, tests, docs, contributor guides, CI and tool configuration, coverage, logs, local editor settings, source maps, existing VSIX files, and local agent files
