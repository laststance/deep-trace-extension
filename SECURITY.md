# Security policy

## Supported versions

Deep Trace Navigation is published to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=laststance.deep-trace-navigation) and [Open VSX](https://open-vsx.org/extension/laststance/deep-trace-navigation). Security fixes are developed on `main` and reach users in the next release, so keep the extension updated. There is no commitment to backport a fix to an earlier version.

## Report a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/laststance/deep-trace-extension/security/advisories/new) to contact the maintainers without publishing exploit details. Include the extension and VS Code versions, a minimal reproduction, impact, and any proposed mitigation. Do not put secrets or private source code in reports.

If the private reporting form is unavailable, use the contact options on the [maintainer's GitHub profile](https://github.com/ryota-murakami) to arrange a private report. Do not open a public issue containing an unpatched exploit.

## Runtime model

The extension runs inside the VS Code extension host with the same permissions as any other workspace extension. It reads a trace table from the clipboard only when you run **Load Trace from Clipboard**, parses it locally, and stores the active session in VS Code workspace state. It makes no network requests and ships no runtime dependencies.

A trace table is untrusted input: it decides which files open and where breakpoints are set. The extension only opens files and sets breakpoints; it never executes trace content. Relative paths resolve against the first workspace folder, and absolute paths open as given, so review traces from unknown sources before loading them. Clearing breakpoints only removes breakpoints the extension added itself.

The bundled `deep-trace` agent skill runs in your chat agent, which may execute shell commands such as `git` and `gh` and a clipboard helper script under `skills/deep-trace/scripts/`. The agent's own tool-approval settings govern those commands.

CI uses CodeQL, dependency review, a production dependency audit, Socket dependency scanning, and OpenSSF Scorecard. Socket requires a configured API token and skips fork PRs; see [Contribute and release](README.md#contribute-and-release). These checks help identify problems; they do not establish that the project is vulnerability-free.
