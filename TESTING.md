# Testing

Tests must prove observable editor behavior, including failure paths. Source coverage is a useful signal, not proof that every VS Code interaction works.

## Commands

```sh
pnpm test              # Vitest, mocked vscode module
pnpm test:coverage     # Same run with V8 coverage (coverage/lcov.info, coverage/coverage-final.json)
pnpm check             # Complete local gate
```

## Test layers

| Layer                  | Location                                         | What it proves                                                                              |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Pure logic             | `src/test/traceParser.test.ts`, `stepAnnotation` | Table parsing, header aliases, lens titles, truncation, Tab hints                           |
| State                  | `src/test/traceSessionStore.test.ts`             | Step movement, clamping, persistence and restore through workspace state                    |
| Services with `vscode` | `src/test/*Service.test.ts`, provider tests      | Breakpoints, definitions, CodeLens placement and keybinding context keys against a fake API |
| Extension wiring       | `src/test/extension.test.ts`                     | Registered commands and the messages, reveals and breakpoints they produce                  |

`vscode` is not an installable module. `src/test/support/fakeVscode.ts` is an in-memory fake that records messages, opened editors, context keys, registered commands, tree reveals, breakpoints and clipboard input; test files load it with `vi.mock('vscode', async () => import('./support/fakeVscode.js'))`. Extend the fake only with API surface the code actually uses. `breakpointService.test.ts` keeps its own smaller fake for the debug API.

CI runs the suite on Linux, Windows and macOS. Codecov receives one Linux report to avoid duplicate uploads. The upload passes the organization `CODECOV_TOKEN` and sets `fail_ci_if_error`; a fork PR cannot read that secret.

## Manual verification

Unit tests cannot render CodeLenses or dispatch real keybindings. Before a release, press `F5` to open an Extension Development Host and check:

1. **Load Trace from Clipboard** with the sample table in [README.md](README.md#supported-trace-format).
2. The annotation appears above the current step line with `prev` / `next` actions.
3. `Tab` / `Shift+Tab` move between steps only while the cursor is on the current step line, and `Tab` indents elsewhere.
4. **Set / Clear Trace Breakpoints** leave manually added breakpoints untouched.

## Regression expectations

Use `test`, observable names, literal expected values, and Arrange/Act/Assert. Assert what a user would notice (messages, opened locations, breakpoints, context keys) rather than private fields. Await asynchronous work and dispose what the test creates.
