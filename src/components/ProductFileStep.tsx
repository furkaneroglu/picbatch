import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import type { ParsedSpreadsheet } from '../types/spreadsheet'
import { parseSpreadsheetFile, switchSpreadsheetSheet } from '../core/spreadsheet'

interface ProductFileStepProps {
  readonly spreadsheet: ParsedSpreadsheet | null
  readonly onSpreadsheetLoaded: (data: ParsedSpreadsheet) => void
  readonly onNext: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ProductFileStep({
  spreadsheet,
  onSpreadsheetLoaded,
  onNext,
}: ProductFileStepProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const parsed = await parseSpreadsheetFile(file)
      onSpreadsheetLoaded(parsed)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) {
        void handleFile(file)
      }
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) {
        void handleFile(file)
      }
    }
  }

  const handleSheetChange = (sheetName: string) => {
    if (!spreadsheet) return
    try {
      const updated = switchSpreadsheetSheet(spreadsheet, sheetName)
      onSpreadsheetLoaded(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(message)
    }
  }

  return (
    <div className="product-file-step">
      {errorMessage && (
        <div className="alert-banner alert-error" role="alert">
          <div className="alert-content">
            <strong>Error reading file:</strong> {errorMessage}
          </div>
          <button
            type="button"
            className="alert-close-btn"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {!spreadsheet ? (
        <div
          className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${isLoading ? 'dropzone-loading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label="Select or drop product spreadsheet file"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          <div className="dropzone-icon">📄</div>
          <h3 className="dropzone-title">
            {isLoading ? 'Reading spreadsheet...' : 'Choose or drop your product spreadsheet'}
          </h3>
          <p className="dropzone-sub">
            Supported formats: <strong>.csv</strong> (auto-detects comma, semicolon, tab) and <strong>.xlsx</strong>
          </p>

          <button
            type="button"
            className="btn btn-primary dropzone-btn"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            {isLoading ? 'Processing...' : 'Browse files'}
          </button>

          <div className="dropzone-privacy-badge">
            🔒 Local-first: File stays strictly in your browser. No server upload.
          </div>
        </div>
      ) : (
        <div className="spreadsheet-details-container">
          {/* File summary bar */}
          <div className="file-summary-card">
            <div className="file-info-group">
              <span className="file-icon">📊</span>
              <div>
                <h3 className="file-name">{spreadsheet.fileName}</h3>
                <div className="file-meta">
                  <span>{formatBytes(spreadsheet.fileSize)}</span>
                  <span className="meta-separator">&bull;</span>
                  <span className="badge format-badge">
                    {spreadsheet.fileType.toUpperCase()}
                    {spreadsheet.detectedDelimiter && ` (Delimiter: "${spreadsheet.detectedDelimiter === '\t' ? '\\t' : spreadsheet.detectedDelimiter}")`}
                  </span>
                  <span className="meta-separator">&bull;</span>
                  <span>{spreadsheet.currentSheet.totalRowCount} data rows</span>
                  <span className="meta-separator">&bull;</span>
                  <span>{spreadsheet.currentSheet.headers.length} columns</span>
                </div>
              </div>
            </div>

            <div className="file-actions">
              {spreadsheet.fileType === 'xlsx' && spreadsheet.sheetNames.length > 1 && (
                <div className="sheet-selector-group">
                  <label htmlFor="sheet-select" className="sheet-label">Sheet:</label>
                  <select
                    id="sheet-select"
                    className="select-input"
                    value={spreadsheet.activeSheetName}
                    onChange={(e) => handleSheetChange(e.target.value)}
                  >
                    {spreadsheet.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleInputChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Columns Detected */}
          <div className="detected-columns-section">
            <h4 className="section-subtitle">
              Detected Columns ({spreadsheet.currentSheet.headers.length})
            </h4>
            <div className="column-pills-list">
              {spreadsheet.currentSheet.headers.map((header, idx) => (
                <span key={idx} className="column-pill" title={header}>
                  {header}
                </span>
              ))}
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="preview-table-section">
            <div className="preview-table-header">
              <h4 className="section-subtitle">
                Data Preview (Showing first {spreadsheet.currentSheet.previewRows.length} of {spreadsheet.currentSheet.totalRowCount} rows)
              </h4>
            </div>

            <div className="table-responsive-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th className="row-num-col">#</th>
                    {spreadsheet.currentSheet.headers.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spreadsheet.currentSheet.previewRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="row-num-cell">{rowIdx + 1}</td>
                      {spreadsheet.currentSheet.headers.map((h, colIdx) => (
                        <td key={colIdx} title={row[h] || ''}>
                          {row[h] || <span className="empty-cell-placeholder">&mdash;</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {spreadsheet.currentSheet.previewRows.length === 0 && (
                    <tr>
                      <td colSpan={spreadsheet.currentSheet.headers.length + 1} className="no-rows-cell">
                        No data rows found in this sheet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step Actions */}
          <div className="wizard-controls">
            <div />
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNext}
              disabled={spreadsheet.currentSheet.totalRowCount === 0}
            >
              Continue to Column Mapping &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
