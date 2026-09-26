import { describe, expect, test } from 'vitest'

import type { TraceStep } from '../models/traceStep'
import {
  buildStepAnnotationLenses,
  truncateAnnotationText,
} from '../views/stepAnnotation'

/**
 * Creates a trace step fixture at the given zero-based index.
 */
function createStep(index: number, reason: string): TraceStep {
  return {
    id: `trace-step-${index + 1}`,
    index,
    title: reason,
    file: 'app/keybinds/page.tsx',
    line: 7,
    column: 1,
    reason,
    raw: {},
  }
}

describe('buildStepAnnotationLenses', () => {
  test('shows step number and description above the first step with only a next action', () => {
    // Arrange
    const step = createStep(
      0,
      'Next.js App Router metadata for SEO, OG tags, and page title',
    )

    // Act
    const lenses = buildStepAnnotationLenses(step, 3, true)

    // Assert
    expect(lenses).toEqual([
      {
        title:
          '1/3  Next.js App Router metadata for SEO, OG tags, and page title',
        tooltip: 'Next.js App Router metadata for SEO, OG tags, and page title',
        commandId: '',
      },
      {
        title: '$(arrow-right) next',
        tooltip: 'Tab/Shift+Tab to navigate between steps',
        commandId: 'deepTrace.nextStep',
      },
    ])
  })

  test('offers both prev and next actions on a middle step', () => {
    // Arrange
    const step = createStep(1, 'Keybinds client renders')

    // Act
    const lenses = buildStepAnnotationLenses(step, 3, true)

    // Assert
    expect(lenses.map((lens) => lens.title)).toEqual([
      '2/3  Keybinds client renders',
      '$(arrow-left) prev',
      '$(arrow-right) next',
    ])
  })

  test('hides the next action on the last step', () => {
    // Arrange
    const step = createStep(2, 'Page is returned')

    // Act
    const lenses = buildStepAnnotationLenses(step, 3, true)

    // Assert
    expect(lenses.map((lens) => lens.commandId)).toEqual([
      '',
      'deepTrace.previousStep',
    ])
  })

  test('drops the Tab hint from action tooltips when Tab navigation is disabled', () => {
    // Arrange
    const step = createStep(0, 'Entry point')

    // Act
    const lenses = buildStepAnnotationLenses(step, 2, false)

    // Assert
    expect(lenses[1]?.tooltip).toBe('')
  })
})

describe('truncateAnnotationText', () => {
  test('keeps long descriptions on one line with an ellipsis so actions stay visible', () => {
    // Arrange
    const longText = `${'a'.repeat(100)}\n${'b'.repeat(100)}`

    // Act
    const truncatedText = truncateAnnotationText(longText)

    // Assert
    expect(truncatedText).toBe(`${'a'.repeat(100)} ${'b'.repeat(18)}…`)
  })
})
