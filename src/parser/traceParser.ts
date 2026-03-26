import path from "node:path";

import type { TraceStep } from "../models/traceStep";

const MARKDOWN_CODE_FENCE = "```";
const MARKDOWN_TABLE_DELIMITER = "|";
const MINIMUM_TABLE_ROWS = 2;
const HEADER_ROW_INDEX = 0;
const SEPARATOR_ROW_INDEX = 1;
const FIRST_TRACE_STEP_NUMBER = 1;
const MINIMUM_ALLOWED_POSITION = 1;

const FILE_HEADER_ALIASES = new Set(["file", "path"]);
const LINE_HEADER_ALIASES = new Set(["line", "ln"]);
const COLUMN_HEADER_ALIASES = new Set(["col", "column"]);
const REASON_HEADER_ALIASES = new Set(["reason", "why", "summary"]);

export const DEFAULT_TRACE_COLUMN = 1;

/**
 * Converts a deep-trace Markdown table into ordered trace steps.
 */
export function parseTraceMarkdown(markdown: string): TraceStep[] {
  const tableRows = getTableRows(markdown);

  if (tableRows.length < MINIMUM_TABLE_ROWS) {
    return [];
  }

  const headerCells = tableRows[HEADER_ROW_INDEX] ?? [];
  const dataRows = tableRows
    .slice(SEPARATOR_ROW_INDEX + 1)
    .filter((rowCells) => rowCells.some((cell) => cell.length > 0));
  const headerIndexes = resolveHeaderIndexes(headerCells);

  return dataRows.map((rowCells, rowIndex) => {
    const rawValues = buildRawValues(headerCells, rowCells);
    const file = getRequiredCellValue(
      rowCells,
      headerIndexes.file,
      "The trace table must include a file or path column."
    );
    const line = parseTracePosition(
      getRequiredCellValue(
        rowCells,
        headerIndexes.line,
        "The trace table must include a line column."
      ),
      `line for row ${rowIndex + FIRST_TRACE_STEP_NUMBER}`
    );
    const column = parseOptionalTracePosition(
      getOptionalCellValue(rowCells, headerIndexes.column),
      DEFAULT_TRACE_COLUMN,
      `column for row ${rowIndex + FIRST_TRACE_STEP_NUMBER}`
    );
    const reason = getOptionalCellValue(rowCells, headerIndexes.reason) ?? "";

    return {
      id: createTraceStepId(rowIndex, file, line, column),
      index: rowIndex,
      title: buildTraceTitle(file, line, reason),
      file,
      line,
      column,
      reason,
      raw: rawValues
    };
  });
}

/**
 * Extracts only the Markdown table rows from pasted content.
 */
function getTableRows(markdown: string): string[][] {
  const normalizedLines = stripCodeFence(markdown)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.includes(MARKDOWN_TABLE_DELIMITER));

  if (normalizedLines.length < MINIMUM_TABLE_ROWS) {
    return [];
  }

  return normalizedLines
    .map(splitMarkdownRow)
    .filter((rowCells) => rowCells.length > 0)
    .filter((rowCells, rowIndex) => {
      if (rowIndex !== SEPARATOR_ROW_INDEX) {
        return true;
      }

      return isMarkdownSeparatorRow(rowCells);
    });
}

/**
 * Removes a surrounding fenced code block so the raw table can be parsed.
 */
function stripCodeFence(markdown: string): string {
  const trimmedMarkdown = markdown.trim();

  if (!trimmedMarkdown.startsWith(MARKDOWN_CODE_FENCE)) {
    return trimmedMarkdown;
  }

  const markdownLines = trimmedMarkdown.split(/\r?\n/u);

  if (markdownLines.length < MINIMUM_TABLE_ROWS) {
    return trimmedMarkdown;
  }

  const firstLine = markdownLines[HEADER_ROW_INDEX]?.trim() ?? "";
  const lastLine = markdownLines.at(-1)?.trim() ?? "";

  if (!firstLine.startsWith(MARKDOWN_CODE_FENCE) || lastLine !== MARKDOWN_CODE_FENCE) {
    return trimmedMarkdown;
  }

  return markdownLines.slice(1, -1).join("\n");
}

/**
 * Breaks a Markdown table row into trimmed cells.
 */
function splitMarkdownRow(row: string): string[] {
  const trimmedRow = row.trim();
  const withoutLeadingDelimiter = trimmedRow.startsWith(MARKDOWN_TABLE_DELIMITER)
    ? trimmedRow.slice(1)
    : trimmedRow;
  const withoutOuterDelimiters = withoutLeadingDelimiter.endsWith(MARKDOWN_TABLE_DELIMITER)
    ? withoutLeadingDelimiter.slice(0, -1)
    : withoutLeadingDelimiter;

  return withoutOuterDelimiters
    .split(MARKDOWN_TABLE_DELIMITER)
    .map((cell) => cell.trim());
}

/**
 * Checks whether a row is the Markdown separator line.
 */
function isMarkdownSeparatorRow(rowCells: string[]): boolean {
  return rowCells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

/**
 * Finds the canonical header indexes used by the parser.
 */
function resolveHeaderIndexes(headerCells: string[]): {
  file: number | undefined;
  line: number | undefined;
  column: number | undefined;
  reason: number | undefined;
} {
  let fileIndex: number | undefined;
  let lineIndex: number | undefined;
  let columnIndex: number | undefined;
  let reasonIndex: number | undefined;

  headerCells.forEach((headerCell, index) => {
    const normalizedHeader = normalizeHeader(headerCell);

    if (FILE_HEADER_ALIASES.has(normalizedHeader)) {
      fileIndex = index;
      return;
    }

    if (LINE_HEADER_ALIASES.has(normalizedHeader)) {
      lineIndex = index;
      return;
    }

    if (COLUMN_HEADER_ALIASES.has(normalizedHeader)) {
      columnIndex = index;
      return;
    }

    if (REASON_HEADER_ALIASES.has(normalizedHeader)) {
      reasonIndex = index;
    }
  });

  if (fileIndex === undefined) {
    throw new Error("The trace table must include a file or path column.");
  }

  if (lineIndex === undefined) {
    throw new Error("The trace table must include a line column.");
  }

  return {
    file: fileIndex,
    line: lineIndex,
    column: columnIndex,
    reason: reasonIndex
  };
}

/**
 * Normalizes a header name so small wording differences map to the same meaning.
 */
function normalizeHeader(headerCell: string): string {
  return headerCell
    .replace(/`/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "");
}

/**
 * Builds a raw value map so the original cells remain available for later UI use.
 */
function buildRawValues(
  headerCells: string[],
  rowCells: string[]
): Record<string, string> {
  return headerCells.reduce<Record<string, string>>((accumulator, headerCell, index) => {
    accumulator[headerCell] = rowCells[index] ?? "";
    return accumulator;
  }, {});
}

/**
 * Reads a required cell by column index and throws a friendly error when it is absent.
 */
function getRequiredCellValue(
  rowCells: string[],
  columnIndex: number | undefined,
  errorMessage: string
): string {
  const cellValue = getOptionalCellValue(rowCells, columnIndex);

  if (!cellValue) {
    throw new Error(errorMessage);
  }

  return cellValue;
}

/**
 * Reads an optional cell by column index.
 */
function getOptionalCellValue(
  rowCells: string[],
  columnIndex: number | undefined
): string | undefined {
  if (columnIndex === undefined) {
    return undefined;
  }

  const cellValue = rowCells[columnIndex]?.trim();
  return cellValue ? cellValue : undefined;
}

/**
 * Parses a required trace position such as a line number.
 */
function parseTracePosition(value: string, label: string): number {
  const parsedNumber = Number.parseInt(value, 10);

  if (Number.isNaN(parsedNumber) || parsedNumber < MINIMUM_ALLOWED_POSITION) {
    throw new Error(`The ${label} must be a positive integer.`);
  }

  return parsedNumber;
}

/**
 * Parses an optional trace position and falls back to a default when absent.
 */
function parseOptionalTracePosition(
  value: string | undefined,
  fallbackValue: number,
  label: string
): number {
  if (!value) {
    return fallbackValue;
  }

  return parseTracePosition(value, label);
}

/**
 * Creates a stable identifier for one trace step.
 */
function createTraceStepId(
  rowIndex: number,
  file: string,
  line: number,
  column: number
): string {
  const normalizedFile = file.replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, "");
  return `trace-step-${rowIndex + FIRST_TRACE_STEP_NUMBER}-${normalizedFile}-${line}-${column}`;
}

/**
 * Builds the title displayed in the trace view.
 */
function buildTraceTitle(file: string, line: number, reason: string): string {
  const fallbackTitle = `${path.basename(file)}:${line}`;
  return reason.trim() || fallbackTitle;
}
