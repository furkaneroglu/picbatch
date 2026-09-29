import { useState } from 'react'
import { WORKFLOW_STEPS, getTotalStepCount } from './steps'
import type { ColumnMapping, ParsedSpreadsheet } from './types/spreadsheet'
import type { ImageInventory } from './types/image'
import { suggestColumnMapping, validatePrimaryIdentifierColumn } from './core/table'
import { ProductFileStep } from './components/ProductFileStep'
import { ColumnMappingStep } from './components/ColumnMappingStep'
import { ImageIngestionStep } from './components/ImageIngestionStep'
import { PlaceholderStep } from './components/PlaceholderStep'
import './App.css'

export function App() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [spreadsheet, setSpreadsheet] = useState<ParsedSpreadsheet | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    primaryKeyColumn: '',
    skuColumn: null,
    barcodeColumn: null,
    currentFilenameColumn: null,
  })
  const [imageInventory, setImageInventory] = useState<ImageInventory | null>(null)

  const totalSteps = getTotalStepCount()
  const activeStep = WORKFLOW_STEPS[currentStepIndex]

  const handleSpreadsheetLoaded = (data: ParsedSpreadsheet) => {
    setSpreadsheet(data)
    const suggested = suggestColumnMapping(data.currentSheet.headers)
    setColumnMapping(suggested)
  }

  // Check if user is allowed to navigate to a specific step
  const canAccessStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) return true
    if (!spreadsheet) return false
    if (stepIndex === 1) return true

    // For step 2 (Images) onwards, primary identifier must be valid
    const validation = validatePrimaryIdentifierColumn(
      columnMapping.primaryKeyColumn,
      spreadsheet.currentSheet.headers,
      spreadsheet.currentSheet.rows,
    )
    if (!validation.isValid) return false
    if (stepIndex === 2) return true

    // For step 3 (Match review) onwards, at least 1 supported image is required
    if (!imageInventory || imageInventory.supportedFileCount === 0) return false

    return true
  }

  const handleStepClick = (index: number) => {
    if (canAccessStep(index)) {
      setCurrentStepIndex(index)
    }
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
              const isAccessible = canAccessStep(index)

              return (
                <li
                  key={step.id}
                  className={`step-item ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''}`}
                >
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => handleStepClick(index)}
                    disabled={!isAccessible}
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

        {/* Active Step Container */}
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

            {/* Step 1: Product File */}
            {currentStepIndex === 0 && (
              <ProductFileStep
                spreadsheet={spreadsheet}
                onSpreadsheetLoaded={handleSpreadsheetLoaded}
                onNext={() => setCurrentStepIndex(1)}
              />
            )}

            {/* Step 2: Column Mapping */}
            {currentStepIndex === 1 && spreadsheet && (
              <ColumnMappingStep
                spreadsheet={spreadsheet}
                mapping={columnMapping}
                onMappingChange={setColumnMapping}
                onPrevious={() => setCurrentStepIndex(0)}
                onNext={() => setCurrentStepIndex(2)}
              />
            )}

            {/* Fallback if Step 2 is accessed directly without spreadsheet */}
            {currentStepIndex === 1 && !spreadsheet && (
              <div className="alert-banner alert-warning">
                Please load a product spreadsheet in Step 1 first.
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: '1rem' }}
                  onClick={() => setCurrentStepIndex(0)}
                >
                  Go to Step 1
                </button>
              </div>
            )}

            {/* Step 3: Images */}
            {currentStepIndex === 2 && (
              <ImageIngestionStep
                inventory={imageInventory}
                onInventoryLoaded={setImageInventory}
                onClearInventory={() => setImageInventory(null)}
                onPrevious={() => setCurrentStepIndex(1)}
                onNext={() => setCurrentStepIndex(3)}
              />
            )}

            {/* Steps 4 to 6: Placeholders */}
            {currentStepIndex >= 3 && (
              <PlaceholderStep
                step={activeStep}
                currentStepIndex={currentStepIndex}
                totalSteps={totalSteps}
                onPrevious={() => setCurrentStepIndex((prev) => prev - 1)}
                onNext={() => setCurrentStepIndex((prev) => prev + 1)}
              />
            )}
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
