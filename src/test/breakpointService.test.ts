import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as vscode from 'vscode'

import type { TraceStep } from '../models/traceStep'
import {
  BreakpointService,
  TRACE_BREAKPOINT_STORAGE_KEY,
} from '../services/breakpointService'
import type { SessionStorage } from '../state/traceSessionStore'

vi.mock('vscode', () => {
  let breakpoints: Breakpoint[] = []
  let nextBreakpointNumber = 1
  const breakpointChangeListeners = new Set<
    (event: {
      added: Breakpoint[]
      removed: Breakpoint[]
      changed: Breakpoint[]
    }) => void
  >()

  class Uri {
    public constructor(public readonly fsPath: string) {}

    public static file(filePath: string): Uri {
      return new Uri(filePath)
    }

    public toString(): string {
      return `file://${this.fsPath}`
    }
  }

  class Position {
    public constructor(
      public readonly line: number,
      public readonly character: number,
    ) {}
  }

  class Range {
    public constructor(
      public readonly start: Position,
      public readonly end: Position,
    ) {}
  }

  class Location {
    public readonly range: Range

    public constructor(
      public readonly uri: Uri,
      rangeOrPosition: Range | Position,
    ) {
      this.range =
        rangeOrPosition instanceof Range
          ? rangeOrPosition
          : new Range(rangeOrPosition, rangeOrPosition)
    }
  }

  class Breakpoint {
    public readonly id = `breakpoint-${nextBreakpointNumber}`

    public constructor(public readonly enabled = true) {
      nextBreakpointNumber += 1
    }
  }

  class SourceBreakpoint extends Breakpoint {
    public constructor(
      public readonly location: Location,
      enabled = true,
    ) {
      super(enabled)
    }
  }

  const debug = {
    get breakpoints(): readonly Breakpoint[] {
      return breakpoints
    },
    addBreakpoints(nextBreakpoints: readonly Breakpoint[]): void {
      breakpoints = [...breakpoints, ...nextBreakpoints]
    },
    removeBreakpoints(removedBreakpoints: readonly Breakpoint[]): void {
      const removedIds = new Set(
        removedBreakpoints.map((breakpoint) => breakpoint.id),
      )
      breakpoints = breakpoints.filter(
        (breakpoint) => !removedIds.has(breakpoint.id),
      )
    },
    onDidChangeBreakpoints(
      listener: (event: {
        added: Breakpoint[]
        removed: Breakpoint[]
        changed: Breakpoint[]
      }) => void,
    ): { dispose(): void } {
      breakpointChangeListeners.add(listener)

      return {
        dispose(): void {
          breakpointChangeListeners.delete(listener)
        },
      }
    },
    __reset(): void {
      breakpoints = []
      nextBreakpointNumber = 1
      breakpointChangeListeners.clear()
    },
    __setBreakpoints(nextBreakpoints: readonly Breakpoint[]): void {
      breakpoints = [...nextBreakpoints]
    },
    __fireDidChangeBreakpoints(): void {
      for (const listener of breakpointChangeListeners) {
        listener({
          added: [],
          removed: [],
          changed: [],
        })
      }
    },
  }

  return {
    Uri,
    Position,
    Range,
    Location,
    Breakpoint,
    SourceBreakpoint,
    debug,
  }
})

type TraceBreakpointSnapshot = {
  ids: string[]
}

type MutableDebug = typeof vscode.debug & {
  __fireDidChangeBreakpoints(): void
  __reset(): void
  __setBreakpoints(breakpoints: readonly vscode.Breakpoint[]): void
}

const SAMPLE_STEPS: TraceStep[] = [
  {
    id: 'step-1',
    index: 0,
    title: 'Auth provider mount',
    file: 'src/pages/_app.tsx',
    line: 108,
    column: 1,
    reason: 'Provider mount',
    raw: {},
  },
  {
    id: 'step-2',
    index: 1,
    title: 'Auth provider duplicate',
    file: 'src/pages/_app.tsx',
    line: 108,
    column: 20,
    reason: 'Same line appears again',
    raw: {},
  },
  {
    id: 'step-3',
    index: 2,
    title: 'Locale provider mount',
    file: 'src/pages/_app.tsx',
    line: 112,
    column: 1,
    reason: 'Next unique trace line',
    raw: {},
  },
]

/**
 * Creates a tiny storage implementation for checking workspace state writes.
 * @param initialSnapshot - Optional starting breakpoint snapshot.
 * @returns In-memory storage plus direct access to its backing values.
 * @example
 * createMemoryStorage({ ids: ["breakpoint-1"] })
 * // => { storage, values }
 */
function createMemoryStorage(initialSnapshot?: TraceBreakpointSnapshot): {
  storage: SessionStorage
  values: Map<string, unknown>
} {
  const values = new Map<string, unknown>()

  if (initialSnapshot) {
    values.set(TRACE_BREAKPOINT_STORAGE_KEY, initialSnapshot)
  }

  return {
    storage: {
      get<T>(key: string): T | undefined {
        return values.get(key) as T | undefined
      },
      async update(key: string, value: unknown): Promise<void> {
        values.set(key, value)
      },
    },
    values,
  }
}

/**
 * Creates a resolver that maps trace paths to deterministic file URIs.
 * @returns A resolver with the same shape as NavigationService's URI method.
 * @example
 * createTraceLocationResolver().resolveTraceUri("src/app.ts").toString()
 * // => "file:///workspace/src/app.ts"
 */
function createTraceLocationResolver(): {
  resolveTraceUri(filePath: string): vscode.Uri
} {
  return {
    resolveTraceUri(filePath: string): vscode.Uri {
      return vscode.Uri.file(`/workspace/${filePath}`)
    },
  }
}

/**
 * Creates a source breakpoint at a trace-like file and line.
 * @param filePath - Project-relative source file path.
 * @param oneBasedLine - One-based line number shown to users.
 * @returns A VS Code source breakpoint.
 * @example
 * createSourceBreakpoint("src/app.ts", 1)
 * // => SourceBreakpoint
 */
function createSourceBreakpoint(
  filePath: string,
  oneBasedLine: number,
): vscode.SourceBreakpoint {
  const zeroBasedLine = oneBasedLine - 1
  return new vscode.SourceBreakpoint(
    new vscode.Location(
      vscode.Uri.file(`/workspace/${filePath}`),
      new vscode.Position(zeroBasedLine, 0),
    ),
    true,
  )
}

/**
 * Reads the saved breakpoint snapshot from fake workspace storage.
 * @param values - Backing values from the test storage.
 * @returns The saved snapshot or `undefined` when no IDs are managed.
 * @example
 * getStoredSnapshot(values)
 * // => { ids: ["breakpoint-1"] }
 */
function getStoredSnapshot(
  values: Map<string, unknown>,
): TraceBreakpointSnapshot | undefined {
  return values.get(TRACE_BREAKPOINT_STORAGE_KEY) as
    TraceBreakpointSnapshot | undefined
}

describe('BreakpointService', () => {
  beforeEach(() => {
    ;(vscode.debug as MutableDebug).__reset()
  })

  test('sets one breakpoint for each unique file and line pair', async () => {
    const { storage, values } = createMemoryStorage()
    const service = new BreakpointService(
      storage,
      createTraceLocationResolver(),
    )

    const addedCount = await service.setBreakpointsForSteps(SAMPLE_STEPS)

    expect(addedCount).toBe(2)
    expect(vscode.debug.breakpoints).toHaveLength(2)
    expect(getStoredSnapshot(values)?.ids).toEqual([
      'breakpoint-1',
      'breakpoint-2',
    ])
  })

  test('skips a trace line when a source breakpoint already exists there', async () => {
    const existingBreakpoint = createSourceBreakpoint('src/pages/_app.tsx', 108)
    const { storage, values } = createMemoryStorage()
    const service = new BreakpointService(
      storage,
      createTraceLocationResolver(),
    )

    ;(vscode.debug as MutableDebug).__setBreakpoints([existingBreakpoint])

    const addedCount = await service.setBreakpointsForSteps([
      SAMPLE_STEPS[0] as TraceStep,
    ])

    expect(addedCount).toBe(0)
    expect(vscode.debug.breakpoints).toEqual([existingBreakpoint])
    expect(getStoredSnapshot(values)).toBeUndefined()
  })

  test('removes only source breakpoints whose IDs were saved by Deep Trace', async () => {
    const managedBreakpoint = createSourceBreakpoint('src/pages/_app.tsx', 108)
    const manualBreakpoint = createSourceBreakpoint('src/pages/_app.tsx', 112)
    const { storage, values } = createMemoryStorage({
      ids: [managedBreakpoint.id, 'stale-breakpoint'],
    })
    const service = new BreakpointService(
      storage,
      createTraceLocationResolver(),
    )

    ;(vscode.debug as MutableDebug).__setBreakpoints([
      managedBreakpoint,
      manualBreakpoint,
    ])

    const removedCount = await service.clearManagedBreakpoints()

    expect(removedCount).toBe(1)
    expect(vscode.debug.breakpoints).toEqual([manualBreakpoint])
    expect(getStoredSnapshot(values)).toBeUndefined()
  })

  test('clears stale managed IDs without removing manual breakpoints', async () => {
    const manualBreakpoint = createSourceBreakpoint('src/pages/_app.tsx', 112)
    const { storage, values } = createMemoryStorage({
      ids: ['missing-breakpoint'],
    })
    const service = new BreakpointService(
      storage,
      createTraceLocationResolver(),
    )

    ;(vscode.debug as MutableDebug).__setBreakpoints([manualBreakpoint])

    const removedCount = await service.clearManagedBreakpoints()

    expect(removedCount).toBe(0)
    expect(vscode.debug.breakpoints).toEqual([manualBreakpoint])
    expect(getStoredSnapshot(values)).toBeUndefined()
  })

  test('prunes stored IDs when managed breakpoints disappear outside the service', async () => {
    const remainingBreakpoint = createSourceBreakpoint(
      'src/pages/_app.tsx',
      108,
    )
    const removedBreakpoint = createSourceBreakpoint('src/pages/_app.tsx', 112)
    const { storage, values } = createMemoryStorage({
      ids: [remainingBreakpoint.id, removedBreakpoint.id],
    })

    new BreakpointService(storage, createTraceLocationResolver())
    ;(vscode.debug as MutableDebug).__setBreakpoints([remainingBreakpoint])
    ;(vscode.debug as MutableDebug).__fireDidChangeBreakpoints()
    await Promise.resolve()
    await Promise.resolve()

    expect(getStoredSnapshot(values)?.ids).toEqual([remainingBreakpoint.id])
  })
})
