# TODOs

Tracked follow-ups for the extension and its release automation.

## Release

### Publish from CI with provenance

**What:** Move `pnpm publish:stores` into a Release workflow that runs after Test succeeds on `main`.

**Why:** Releases currently run from a maintainer machine through the 1Password CLI. A CI release would tie each VSIX to a reviewed commit and a green test run.

**Context:** Both stores still require long-lived tokens (`VSCE_PAT`, `OVSX_PAT`); neither supports OIDC trusted publishing. Storing them as Actions secrets trades the local 1Password boundary for repository secrets, so decide that trade-off before adding the workflow. See [docs/releasing.md](docs/releasing.md).

**Effort:** M
**Priority:** P3
**Depends on:** A decision on token storage

## Repository

### Protect main with a ruleset

**What:** Add a branch ruleset that requires the Test, Build, TypeCheck, Lint and Format checks, a pull request, and blocks force pushes.

**Why:** OpenSSF Scorecard's Branch-Protection and Code-Review checks stay low without it, and a direct push can currently skip CI.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

## Testing

### Exercise the extension in a real VS Code instance

**What:** Add `@vscode/test-electron` integration tests that load a trace and assert CodeLens placement and Tab navigation.

**Why:** The Vitest suite uses a mocked `vscode` module, so rendering and keybinding dispatch are verified only manually (see [TESTING.md](TESTING.md#manual-verification)).

**Effort:** M
**Priority:** P3
**Depends on:** Nothing
