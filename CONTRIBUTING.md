# Contributing

Thank you for helping make execution traces easier to follow inside VS Code.

## Before changing behavior

Search [existing issues](https://github.com/laststance/deep-trace-extension/issues) before starting. Include a minimal trace table, the VS Code and extension versions, expected behavior, and actual behavior. Never include credentials or private source code. For vulnerabilities, use [SECURITY.md](SECURITY.md). Out-of-scope follow-ups live in [TODOS.md](TODOS.md).

## Local setup

Install Node.js 24.20.0 (see `.node-version`) and the pnpm version pinned with integrity in `package.json`. Follow [pnpm's installation guide](https://pnpm.io/installation).

```sh
pnpm install --frozen-lockfile
pnpm check
```

The workspace keeps a one-day minimum release age for new dependency versions and approves only the build scripts listed under `allowBuilds` in `pnpm-workspace.yaml`.

To try the extension, open this folder in VS Code and press `F5`. The **Run Extension** launch configuration builds the extension and opens an Extension Development Host.

## Make a change

1. Create a focused branch from `main`.
2. Add a regression test for the observable behavior; see [TESTING.md](TESTING.md).
3. Keep editor-independent logic (parsing, lens and label building) out of modules that import `vscode`, so it stays unit-testable.
4. Update README.md, CHANGELOG.md and `package.json` contributions when commands, settings, keybindings or supported behavior change.
5. Run `pnpm check` and open a PR describing the problem, the resulting behavior, and how you verified it.

Code and documentation use English. Test names use `test`, describe what breaks when they fail, and compare against literal expected values. Prefer independent readable test procedures, with Arrange/Act/Assert comments. Explain non-obvious functions concisely with JSDoc covering why they exist and what calls them. Refer to project symbols as `{@link Symbol}`. Prettier uses `semi: false` and `singleQuote: true`; ESLint uses `eslint-config-ts-prefixer`.

## Tooling

- `pnpm test`: Vitest unit and integration tests with a mocked `vscode` module.
- `pnpm test:coverage`: the same run with V8 coverage; writes `coverage/lcov.info` for Codecov and `coverage/coverage-final.json` for Fallow.
- `pnpm typecheck`: TypeScript 7 through the `typescript-compiler` alias, over source, tests and configs. TypeScript 6 stays installed because `typescript-eslint` uses its JavaScript API.
- `pnpm build`: compiles `src/` (without tests) to `out/` with `tsconfig.build.json`.
- `pnpm lint`, `pnpm format:check`: source consistency.
- `pnpm check:docs`: every relative link and heading anchor in the tracked documentation resolves.
- `pnpm health`, `pnpm dupes`, `pnpm dead-code`: Fallow checks. Run `pnpm test:coverage` first for health's measured coverage.
- `pnpm package`: builds the VSIX with `vsce`, which also validates the manifest and `.vscodeignore`.

Fallow treats members that VS Code calls through `vscode.Disposable`, `vscode.CodeLensProvider` and `vscode.TreeDataProvider` as used, and ignores `typescript-compiler`, which the scripts run by path. Do not add ignore entries without equivalent evidence.

## Releases

Maintainers publish from a clean `main`; see [docs/releasing.md](docs/releasing.md).

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.
