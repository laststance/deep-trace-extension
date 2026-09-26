# Changelog

## [Unreleased]

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
