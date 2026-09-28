import type { WorkflowStep } from '../steps'

interface PlaceholderStepProps {
  readonly step: WorkflowStep
  readonly currentStepIndex: number
  readonly totalSteps: number
  readonly onPrevious: () => void
  readonly onNext: () => void
}

export function PlaceholderStep({
  step,
  currentStepIndex,
  totalSteps,
  onPrevious,
  onNext,
}: PlaceholderStepProps) {
  return (
    <div className="placeholder-step-container">
      <div className="placeholder-box" role="status">
        <div className="placeholder-badge">Placeholder (Future Issue)</div>
        <p className="placeholder-message">{step.placeholderNotice}</p>
        <div className="placeholder-details">
          <h3>Planned Capabilities:</h3>
          <ul>
            {step.details.map((detail, idx) => (
              <li key={idx}>{detail}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="wizard-controls">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onPrevious}
          disabled={currentStepIndex === 0}
        >
          &larr; Previous
        </button>
        <span className="step-indicator-text">
          {currentStepIndex + 1} / {totalSteps}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          disabled={currentStepIndex === totalSteps - 1}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  )
}
