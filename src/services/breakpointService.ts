import * as vscode from "vscode";

import type { TraceStep } from "../models/traceStep";
import type { SessionStorage } from "../state/traceSessionStore";
import type { NavigationService } from "./navigationService";

export const TRACE_BREAKPOINT_STORAGE_KEY = "deepTrace.breakpoints";

const ONE_BASED_INDEX_OFFSET = 1;
const FIRST_CHARACTER_INDEX = 0;
const MINIMUM_LINE_INDEX = 0;

type TraceBreakpointSnapshot = {
  ids: string[];
};

type TraceBreakpointTarget = {
  uri: vscode.Uri;
  zeroBasedLine: number;
  locationKey: string;
};

type TraceLocationResolver = Pick<NavigationService, "resolveTraceUri">;

/**
 * Manages source breakpoints that were created from the active Deep Trace session.
 */
export class BreakpointService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * Creates a service that can translate trace steps into VS Code source breakpoints.
   * @param storage - Persistent workspace storage for breakpoint IDs created by Deep Trace.
   * @param traceLocationResolver - Shared resolver that turns trace file paths into VS Code URIs.
   * @returns A service instance that can set and clear Deep Trace breakpoints.
   * @example
   * new BreakpointService(context.workspaceState, navigationService)
   */
  public constructor(
    private readonly storage: SessionStorage,
    private readonly traceLocationResolver: TraceLocationResolver
  ) {
    this.disposables.push(
      vscode.debug.onDidChangeBreakpoints(() => {
        void this.pruneMissingManagedBreakpointIds();
      })
    );
  }

  /**
   * Sets breakpoints for every unique file and line pair in the given trace steps.
   * @param steps - Trace steps that describe the source lines to mark.
   * @returns
   * - When new breakpoints are needed: the number of breakpoints added
   * - When every trace line already has a breakpoint: `0`
   * @example
   * await service.setBreakpointsForSteps([{ file: "src/app.ts", line: 3 }])
   * // => 1
   */
  public async setBreakpointsForSteps(
    steps: readonly TraceStep[]
  ): Promise<number> {
    await this.pruneMissingManagedBreakpointIds();

    const traceTargets = this.createUniqueTraceTargets(steps);
    const existingLocationKeys = new Set(
      this.getSourceBreakpoints().map((breakpoint) =>
        createLocationKey(
          breakpoint.location.uri,
          breakpoint.location.range.start.line
        )
      )
    );
    const breakpointsToAdd = traceTargets
      .filter((target) => !existingLocationKeys.has(target.locationKey))
      .map((target) => createSourceBreakpoint(target.uri, target.zeroBasedLine));

    if (breakpointsToAdd.length === 0) {
      return 0;
    }

    vscode.debug.addBreakpoints(breakpointsToAdd);
    await this.saveManagedBreakpointIds(
      new Set([
        ...this.getManagedBreakpointIds(),
        ...getBreakpointIds(breakpointsToAdd)
      ])
    );

    return breakpointsToAdd.length;
  }

  /**
   * Clears every source breakpoint that was previously created by Deep Trace.
   * @returns
   * - When managed breakpoints still exist: the number of breakpoints removed
   * - When only stale IDs or no IDs exist: `0`
   * @example
   * await service.clearManagedBreakpoints()
   * // => 3
   */
  public async clearManagedBreakpoints(): Promise<number> {
    const managedBreakpointIds = this.getManagedBreakpointIds();

    if (managedBreakpointIds.size === 0) {
      return 0;
    }

    const breakpointsToRemove = this.getSourceBreakpoints().filter((breakpoint) =>
      managedBreakpointIds.has(breakpoint.id)
    );

    if (breakpointsToRemove.length > 0) {
      vscode.debug.removeBreakpoints(breakpointsToRemove);
    }

    await this.saveManagedBreakpointIds(new Set());
    return breakpointsToRemove.length;
  }

  /**
   * Releases VS Code event subscriptions owned by the breakpoint service.
   * @returns Nothing.
   * @example
   * service.dispose()
   * // => undefined
   */
  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  /**
   * Creates a deduplicated list of breakpoint targets from trace steps.
   * @param steps - Trace steps from the active session.
   * @returns Unique breakpoint targets keyed by file URI and zero-based line.
   * @example
   * service["createUniqueTraceTargets"]([{ file: "src/app.ts", line: 1 }])
   * // => [{ uri, zeroBasedLine: 0, locationKey }]
   */
  private createUniqueTraceTargets(
    steps: readonly TraceStep[]
  ): TraceBreakpointTarget[] {
    const targets = new Map<string, TraceBreakpointTarget>();

    for (const step of steps) {
      const uri = this.traceLocationResolver.resolveTraceUri(step.file);
      const zeroBasedLine = toZeroBasedLine(step.line);
      const locationKey = createLocationKey(uri, zeroBasedLine);

      if (!targets.has(locationKey)) {
        targets.set(locationKey, {
          uri,
          zeroBasedLine,
          locationKey
        });
      }
    }

    return [...targets.values()];
  }

  /**
   * Reads the managed breakpoint IDs from workspace storage.
   * @returns A set of breakpoint IDs that Deep Trace previously created.
   * @example
   * service["getManagedBreakpointIds"]()
   * // => new Set(["breakpoint-1"])
   */
  private getManagedBreakpointIds(): Set<string> {
    const snapshot = this.storage.get<TraceBreakpointSnapshot | undefined>(
      TRACE_BREAKPOINT_STORAGE_KEY
    );

    return new Set(snapshot?.ids ?? []);
  }

  /**
   * Persists the currently managed breakpoint IDs.
   * @param breakpointIds - Breakpoint IDs that should remain managed by Deep Trace.
   * @returns Nothing after storage is updated.
   * @example
   * await service["saveManagedBreakpointIds"](new Set(["breakpoint-1"]))
   * // => undefined
   */
  private async saveManagedBreakpointIds(
    breakpointIds: ReadonlySet<string>
  ): Promise<void> {
    const snapshot =
      breakpointIds.size > 0
        ? {
            ids: [...breakpointIds]
          }
        : undefined;

    await this.storage.update(TRACE_BREAKPOINT_STORAGE_KEY, snapshot);
  }

  /**
   * Removes managed IDs for breakpoints that no longer exist in VS Code.
   * @returns Nothing after stale IDs are pruned.
   * @example
   * await service["pruneMissingManagedBreakpointIds"]()
   * // => undefined
   */
  private async pruneMissingManagedBreakpointIds(): Promise<void> {
    const managedBreakpointIds = this.getManagedBreakpointIds();

    if (managedBreakpointIds.size === 0) {
      return;
    }

    const existingBreakpointIds = new Set(
      getBreakpointIds(this.getSourceBreakpoints())
    );
    const remainingManagedBreakpointIds = new Set(
      [...managedBreakpointIds].filter((breakpointId) =>
        existingBreakpointIds.has(breakpointId)
      )
    );

    if (remainingManagedBreakpointIds.size !== managedBreakpointIds.size) {
      await this.saveManagedBreakpointIds(remainingManagedBreakpointIds);
    }
  }

  /**
   * Returns every source breakpoint currently known by VS Code.
   * @returns Source breakpoints, excluding function breakpoints and other breakpoint types.
   * @example
   * service["getSourceBreakpoints"]()
   * // => [SourceBreakpoint]
   */
  private getSourceBreakpoints(): vscode.SourceBreakpoint[] {
    return vscode.debug.breakpoints.filter(isSourceBreakpoint);
  }
}

/**
 * Converts a one-based trace line into a zero-based editor line.
 * @param line - One-based line number parsed from the trace table.
 * @returns A zero-based line number that never falls below the first line.
 * @example
 * toZeroBasedLine(3)
 * // => 2
 */
function toZeroBasedLine(line: number): number {
  return Math.max(line - ONE_BASED_INDEX_OFFSET, MINIMUM_LINE_INDEX);
}

/**
 * Creates a source breakpoint at the start of a line.
 * @param uri - File URI where the breakpoint should be placed.
 * @param zeroBasedLine - Zero-based line where the breakpoint should be placed.
 * @returns A new enabled VS Code source breakpoint.
 * @example
 * createSourceBreakpoint(vscode.Uri.file("/tmp/app.ts"), 0)
 * // => SourceBreakpoint
 */
function createSourceBreakpoint(
  uri: vscode.Uri,
  zeroBasedLine: number
): vscode.SourceBreakpoint {
  return new vscode.SourceBreakpoint(
    new vscode.Location(
      uri,
      new vscode.Position(zeroBasedLine, FIRST_CHARACTER_INDEX)
    ),
    true
  );
}

/**
 * Creates a stable key for comparing breakpoint locations.
 * @param uri - File URI for a source location.
 * @param zeroBasedLine - Zero-based source line.
 * @returns A string key in the form `uri#line`.
 * @example
 * createLocationKey(vscode.Uri.file("/tmp/app.ts"), 4)
 * // => "file:///tmp/app.ts#4"
 */
function createLocationKey(uri: vscode.Uri, zeroBasedLine: number): string {
  return `${uri.toString()}#${zeroBasedLine}`;
}

/**
 * Reads IDs from a list of VS Code breakpoints.
 * @param breakpoints - Breakpoints whose IDs should be collected.
 * @returns Breakpoint IDs in the same order as the input.
 * @example
 * getBreakpointIds([breakpoint])
 * // => ["breakpoint-1"]
 */
function getBreakpointIds(
  breakpoints: readonly vscode.Breakpoint[]
): string[] {
  return breakpoints.map((breakpoint) => breakpoint.id);
}

/**
 * Checks whether a VS Code breakpoint points at a source location.
 * @param breakpoint - Any VS Code breakpoint.
 * @returns `true` for source breakpoints, otherwise `false`.
 * @example
 * isSourceBreakpoint(new vscode.SourceBreakpoint(location))
 * // => true
 */
function isSourceBreakpoint(
  breakpoint: vscode.Breakpoint
): breakpoint is vscode.SourceBreakpoint {
  return breakpoint instanceof vscode.SourceBreakpoint;
}
