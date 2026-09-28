import { useState } from 'react'
import { WORKFLOW_STEPS, getTotalStepCount } from './steps'
import './App.css'

export function App() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const totalSteps = getTotalStepCount()
  const activeStep = WORKFLOW_STEPS[currentStepIndex]

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <h1 className="app-title">PicBatch</h1>
          <span className="badge local-badge" aria-label="Local-first privacy status">
            Local-first (Client-only)
          </span>
        </div>
        <p className="app-tagline">
          Deterministic product image matching and renaming utility. Files never leave your browser.
        </p>
      </header>

      <main className="app-main">
        {/* Step Navigation Bar */}
        <nav className="step-navigation" aria-label="Workflow Steps">
          <ol className="step-list">
            {WORKFLOW_STEPS.map((step, index) => {
              const isActive = index === currentStepIndex
              const isPast = index < currentStepIndex
              return (
                <li
                  key={step.id}
                  className={`step-item ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''}`}
                >
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => handleStepClick(index)}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="step-number">{index + 1}</span>
                    <span className="step-name">{step.title.replace(/^\d+\.\s*/, '')}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Step Placeholder Content */}
        {activeStep && (
          <section className="step-card" aria-labelledby={`step-title-${activeStep.id}`}>
            <div className="step-card-header">
              <span className="step-counter">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <h2 id={`step-title-${activeStep.id}`} className="step-title">
                {activeStep.title}
              </h2>
              <p className="step-description">{activeStep.shortDescription}</p>
            </div>

            <div className="placeholder-box" role="status">
              <div className="placeholder-badge">Placeholder (MVP-01)</div>
              <p className="placeholder-message">{activeStep.placeholderNotice}</p>
              <div className="placeholder-details">
                <h3>Planned Capabilities:</h3>
                <ul>
                  {activeStep.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Wizard Controls */}
            <div className="wizard-controls">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrevious}
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
                onClick={handleNext}
                disabled={currentStepIndex === totalSteps - 1}
              >
                Next &rarr;
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>
          PicBatch is completely client-side. No images or spreadsheet contents are uploaded to any server.
        </p>
      </footer>
    </div>
  )
}

export default App
