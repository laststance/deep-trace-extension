import { describe, expect, test } from 'vitest'

import type { TraceStep } from '../models/traceStep'
import {
  SESSION_STORAGE_KEY,
  TraceSessionStore,
  type SessionStorage,
} from '../state/traceSessionStore'

const SAMPLE_STEPS: TraceStep[] = [
  {
    id: 'step-1',
    index: 0,
    title: 'Activate extension',
    file: 'src/extension.ts',
    line: 10,
    column: 1,
    reason: 'Activate the extension',
    raw: {},
  },
  {
    id: 'step-2',
    index: 1,
    title: 'Navigate to the next step',
    file: 'src/services/navigationService.ts',
    line: 20,
    column: 2,
    reason: 'Reveal the next step',
    raw: {},
  },
]

/**
 * Creates a tiny in-memory storage object so the session store can be tested
 * without the real VS Code workspace state.
 */
function createMemoryStorage(initialValue?: {
  steps: TraceStep[]
  currentStepIndex: number
}): SessionStorage {
  const values = new Map<string, unknown>()

  if (initialValue) {
    values.set(SESSION_STORAGE_KEY, initialValue)
  }

  return {
    get<T>(key: string): T | undefined {
      return values.get(key) as T | undefined
    },
    async update(key: string, value: unknown): Promise<void> {
      values.set(key, value)
    },
  }
}

describe('TraceSessionStore', () => {
  test('loads steps and starts at the first item', async () => {
    const sessionStore = new TraceSessionStore(createMemoryStorage())

    await sessionStore.load(SAMPLE_STEPS)

    expect(sessionStore.getCurrentStep()).toMatchObject({
      id: 'step-1',
    })
  })

  test('moves forward and backward through the trace', async () => {
    const sessionStore = new TraceSessionStore(createMemoryStorage())

    await sessionStore.load(SAMPLE_STEPS)
    await sessionStore.goToNext()
    expect(sessionStore.getCurrentStep()?.id).toBe('step-2')

    await sessionStore.goToPrevious()
    expect(sessionStore.getCurrentStep()?.id).toBe('step-1')
  })

  test('clamps navigation at the ends of the trace', async () => {
    const sessionStore = new TraceSessionStore(createMemoryStorage())

    await sessionStore.load(SAMPLE_STEPS)
    await sessionStore.goToPrevious()
    expect(sessionStore.getCurrentStep()?.id).toBe('step-1')

    await sessionStore.goToNext()
    await sessionStore.goToNext()
    expect(sessionStore.getCurrentStep()?.id).toBe('step-2')
  })

  test('restores a saved session', async () => {
    const sessionStore = new TraceSessionStore(
      createMemoryStorage({
        steps: SAMPLE_STEPS,
        currentStepIndex: 1,
      }),
    )

    const didRestore = await sessionStore.restore()

    expect(didRestore).toBe(true)
    expect(sessionStore.getCurrentStep()?.id).toBe('step-2')
  })

  test('clears the current session', async () => {
    const sessionStore = new TraceSessionStore(createMemoryStorage())

    await sessionStore.load(SAMPLE_STEPS)
    await sessionStore.clear()

    expect(sessionStore.hasSession()).toBe(false)
    expect(sessionStore.getCurrentStep()).toBeUndefined()
  })
})
