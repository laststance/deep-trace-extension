/**
 * Describes one location in a deep trace that the editor can navigate to.
 */
export type TraceStep = {
  id: string;
  index: number;
  title: string;
  file: string;
  line: number;
  column: number;
  reason: string;
  raw: Record<string, string>;
};
