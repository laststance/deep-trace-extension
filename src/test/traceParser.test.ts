import { describe, expect, test } from "vitest";

import {
  DEFAULT_TRACE_COLUMN,
  parseTraceMarkdown
} from "../parser/traceParser";

const SAMPLE_TRACE_MARKDOWN = `
| file | line | col | reason |
| --- | --- | --- | --- |
| src/extension.ts | 12 | 4 | Activate the extension |
| src/parser/traceParser.ts | 44 | 2 | Parse trace rows |
`;

const TRACE_WITHOUT_COLUMN = `
| path | line | reason |
| --- | --- | --- |
| src/views/traceTreeProvider.ts | 18 | Render the tree item |
`;

const FENCED_TRACE_MARKDOWN = `
\`\`\`markdown
| file | line | reason |
| --- | --- | --- |
| src/services/navigationService.ts | 33 | Reveal the active step |
\`\`\`
`;

describe("parseTraceMarkdown", () => {
  test("parses a standard deep trace markdown table", () => {
    const parsedSteps = parseTraceMarkdown(SAMPLE_TRACE_MARKDOWN);

    expect(parsedSteps).toHaveLength(2);
    expect(parsedSteps[0]).toMatchObject({
      file: "src/extension.ts",
      line: 12,
      column: 4,
      reason: "Activate the extension"
    });
  });

  test("defaults the column when the markdown table omits it", () => {
    const parsedSteps = parseTraceMarkdown(TRACE_WITHOUT_COLUMN);

    expect(parsedSteps).toHaveLength(1);
    expect(parsedSteps[0]?.column).toBe(DEFAULT_TRACE_COLUMN);
  });

  test("accepts a fenced markdown block", () => {
    const parsedSteps = parseTraceMarkdown(FENCED_TRACE_MARKDOWN);

    expect(parsedSteps).toHaveLength(1);
    expect(parsedSteps[0]?.file).toBe("src/services/navigationService.ts");
  });

  test("throws a helpful error when the file column is missing", () => {
    const missingFileTrace = `
| line | reason |
| --- | --- |
| 21 | Missing the file column |
`;

    expect(() => parseTraceMarkdown(missingFileTrace)).toThrowError(
      "The trace table must include a file or path column."
    );
  });

  test("throws a helpful error when the line column is missing", () => {
    const missingLineTrace = `
| file | reason |
| --- | --- |
| src/extension.ts | Missing the line column |
`;

    expect(() => parseTraceMarkdown(missingLineTrace)).toThrowError(
      "The trace table must include a line column."
    );
  });
});
