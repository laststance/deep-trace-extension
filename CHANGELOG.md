# Changelog

## [0.1.1] - 2026-09-26

### Changed

- Lower the minimum VS Code version to 1.100.0 so the extension installs in forks such as Cursor (VS Code 1.128.0 base). The bundled `chatSkills` skill is only picked up by hosts that support it

## [0.1.0] - 2026-09-26

### Added

- Inline step annotation: the current step's description is shown right above its line, with prev/next actions
- Bundle the `deep-trace` agent skill via the `chatSkills` contribution point
- Tab / Shift+Tab moves between steps while the cursor is on the current step line (`deepTrace.tabNavigation`)

### Changed

- Require VS Code 1.138.0 or later (`engines.vscode` now matches `@types/vscode`)

## [0.0.1] - 2026-03-12

### Added

- Initial release
- Load deep-trace Markdown tables from clipboard
- Step-by-step forward/backward navigation
- Go to Definition from trace steps
- Activity bar panel with tree view
- Marketplace-ready package metadata, privacy notes, and publishing preflight script
