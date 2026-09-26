import type { TraceStep } from "../models/traceStep";

export const NEXT_STEP_COMMAND = "deepTrace.nextStep";
export const PREVIOUS_STEP_COMMAND = "deepTrace.previousStep";
export const MAX_ANNOTATION_LENGTH = 120;
export const TAB_NAVIGATION_HINT = "Tab/Shift+Tab to navigate between steps";

const ONE_BASED_INDEX_OFFSET = 1;
const ELLIPSIS = "…";

/**
 * Editor-agnostic description of one CodeLens rendered above the current step line.
 */
export type StepAnnotationLens = {
  title: string;
  tooltip: string;
  /** Empty string renders the lens as plain, non-clickable text. */
  commandId: string;
};

/**
 * Builds the lenses shown above the current trace step: the description, then prev/next actions.
 *
 * Why: kept free of the `vscode` module so the annotation wording is unit-testable.
 * Called by {@link StepAnnotationProvider} whenever VS Code asks for CodeLenses.
 */
export function buildStepAnnotationLenses(
  step: TraceStep,
  stepCount: number,
  isTabNavigationEnabled: boolean
): StepAnnotationLens[] {
  const stepNumber = step.index + ONE_BASED_INDEX_OFFSET;
  const navigationTooltip = isTabNavigationEnabled ? TAB_NAVIGATION_HINT : "";
  const lenses: StepAnnotationLens[] = [
    {
      title: `${stepNumber}/${stepCount}  ${truncateAnnotationText(step.title)}`,
      tooltip: step.reason || step.title,
      commandId: ""
    }
  ];

  // First step has nowhere to go back to
  if (step.index > 0) {
    lenses.push({
      title: "$(arrow-left) prev",
      tooltip: navigationTooltip,
      commandId: PREVIOUS_STEP_COMMAND
    });
  }

  // Last step has nowhere to go forward to
  if (stepNumber < stepCount) {
    lenses.push({
      title: "$(arrow-right) next",
      tooltip: navigationTooltip,
      commandId: NEXT_STEP_COMMAND
    });
  }

  return lenses;
}

/**
 * Shortens long descriptions because a CodeLens never wraps and would push actions off-screen.
 */
export function truncateAnnotationText(text: string): string {
  const singleLineText = text.replace(/\s+/gu, " ").trim();

  if (singleLineText.length <= MAX_ANNOTATION_LENGTH) {
    return singleLineText;
  }

  return `${singleLineText.slice(0, MAX_ANNOTATION_LENGTH - ELLIPSIS.length)}${ELLIPSIS}`;
}
