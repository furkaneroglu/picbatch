import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import type { ImageInventory } from '../types/image'
import {
  buildImageInventoryFromFiles,
  buildImageInventoryFromZip,
} from '../core/images'

interface ImageIngestionStepProps {
  readonly inventory: ImageInventory | null
  readonly onInventoryLoaded: (data: ImageInventory) => void
  readonly onClearInventory: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ImageIngestionStep({
  inventory,
  onInventoryLoaded,
  onClearInventory,
  onPrevious,
  onNext,
}: ImageIngestionStepProps) {
  const [activeTab, setActiveTab] = useState<'folder' | 'zip'>('folder')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const zipInputRef = useRef<HTMLInputElement | null>(null)

  const handleFolderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const fileList = Array.from(files)
      const newInventory = buildImageInventoryFromFiles(fileList)
      onInventoryLoaded(newInventory)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
    }
  }

  const handleZipFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please select a valid .zip archive file.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const newInventory = await buildImageInventoryFromZip(file)
      onInventoryLoaded(newInventory)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
      if (zipInputRef.current) {
        zipInputRef.current.value = ''
      }
    }
  }

  const handleZipInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) {
        void handleZipFile(file)
      }
    }
  }

  const handleZipDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleZipDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleZipDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) {
        void handleZipFile(file)
      }
    }
  }

  const previewItems = inventory ? inventory.supportedItems.slice(0, 20) : []

  return (
    <div className="image-ingestion-step">
      {errorMessage && (
        <div className="alert-banner alert-error" role="alert">
          <div className="alert-content">
            <strong>Image Ingestion Error:</strong> {errorMessage}
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

      {!inventory ? (
        <div className="image-input-selection-container">
          {/* Method Selection Tabs */}
          <div className="source-method-tabs" role="tablist" aria-label="Image input method">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'folder'}
              className={`source-tab-btn ${activeTab === 'folder' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('folder')
                setErrorMessage(null)
              }}
            >
              📁 Select Image Folder
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'zip'}
              className={`source-tab-btn ${activeTab === 'zip' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('zip')
                setErrorMessage(null)
              }}
            >
              📦 Upload ZIP Archive
            </button>
          </div>

          {/* Folder Ingestion Panel */}
          {activeTab === 'folder' && (
            <div
              className="dropzone"
              onClick={() => folderInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  folderInputRef.current?.click()
                }
              }}
              aria-label="Select folder containing product images"
            >
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderChange}
                style={{ display: 'none' }}
              />

              <div className="dropzone-icon">📁</div>
              <h3 className="dropzone-title">
                {isLoading ? 'Scanning folder images...' : 'Select your product image folder'}
              </h3>
              <p className="dropzone-sub">
                Supported formats: <strong>.jpg</strong>, <strong>.jpeg</strong>, <strong>.png</strong>, <strong>.webp</strong>
              </p>
              <p className="dropzone-sub-detail">
                Nested subdirectories are automatically scanned and preserved.
              </p>

              <button
                type="button"
                className="btn btn-primary dropzone-btn"
                disabled={isLoading}
                onClick={(e) => {
                  e.stopPropagation()
                  folderInputRef.current?.click()
                }}
              >
                {isLoading ? 'Scanning...' : 'Browse folder'}
              </button>

              <div className="dropzone-privacy-badge">
                🔒 Local-first: Files are read entirely in-memory in your browser. Nothing is uploaded.
              </div>
            </div>
          )}

          {/* ZIP Ingestion Panel */}
          {activeTab === 'zip' && (
            <div
              className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${isLoading ? 'dropzone-loading' : ''}`}
              onDragOver={handleZipDragOver}
              onDragLeave={handleZipDragLeave}
              onDrop={handleZipDrop}
              onClick={() => zipInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  zipInputRef.current?.click()
                }
              }}
              aria-label="Select or drop a ZIP archive containing images"
            >
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleZipInputChange}
                style={{ display: 'none' }}
              />

              <div className="dropzone-icon">📦</div>
              <h3 className="dropzone-title">
                {isLoading ? 'Extracting ZIP archive...' : 'Drop your image ZIP archive here or browse'}
              </h3>
              <p className="dropzone-sub">
                Upload a <strong>.zip</strong> file containing product photos (supports nested folders).
              </p>

              <button
                type="button"
                className="btn btn-primary dropzone-btn"
                disabled={isLoading}
                onClick={(e) => {
                  e.stopPropagation()
                  zipInputRef.current?.click()
                }}
              >
                {isLoading ? 'Extracting...' : 'Browse ZIP file'}
              </button>

              <div className="dropzone-privacy-badge">
                🔒 Local-first: ZIP archive is uncompressed in-memory in your browser. Nothing is uploaded.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="inventory-details-container">
          {/* Large Dataset Warning */}
          {inventory.hasLargeDatasetWarning && (
            <div className="alert-banner alert-warning" role="status">
              <div className="alert-content">
                <strong>Large catalog warning:</strong> You have selected over 1,000 images or over 1 GB ({inventory.supportedFileCount} images, {formatBytes(inventory.totalSupportedBytes)}). Processing performance may depend on your device memory.
              </div>
            </div>
          )}

          {/* Warning if no supported images */}
          {inventory.supportedFileCount === 0 && (
            <div className="alert-banner alert-warning" role="alert">
              <div className="alert-content">
                <strong>No supported images found:</strong> The selected source contains {inventory.unsupportedFileCount} file(s), but none match supported image extensions (.jpg, .jpeg, .png, .webp).
              </div>
            </div>
          )}

          {/* Source Summary Card */}
          <div className="file-summary-card">
            <div className="file-info-group">
              <span className="file-icon">{inventory.sourceMethod === 'folder' ? '📁' : '📦'}</span>
              <div>
                <h3 className="file-name">{inventory.sourceName}</h3>
                <div className="file-meta">
                  <span className="badge format-badge">
                    {inventory.sourceMethod === 'folder' ? 'FOLDER' : 'ZIP ARCHIVE'}
                  </span>
                  <span className="meta-separator">&bull;</span>
                  <span className="highlight-metric">
                    <strong>{inventory.supportedFileCount}</strong> supported images
                  </span>
                  <span className="meta-separator">&bull;</span>
                  <span>{formatBytes(inventory.totalSupportedBytes)} total</span>
                  {inventory.unsupportedFileCount > 0 && (
                    <>
                      <span className="meta-separator">&bull;</span>
                      <span className="unsupported-metric">
                        {inventory.unsupportedFileCount} non-image file(s) ignored
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="file-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClearInventory}
              >
                Change images
              </button>
            </div>
          </div>

          {/* Preview of Discovered Images */}
          {inventory.supportedFileCount > 0 && (
            <div className="preview-table-section">
              <div className="preview-table-header">
                <h4 className="section-subtitle">
                  Discovered Images Preview (Showing first {previewItems.length} of {inventory.supportedFileCount})
                </h4>
              </div>

              <div className="table-responsive-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th className="row-num-col">#</th>
                      <th>Relative Path</th>
                      <th>Format</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item, rowIdx) => (
                      <tr key={item.id}>
                        <td className="row-num-cell">{rowIdx + 1}</td>
                        <td title={item.relativePath}>
                          <code>{item.relativePath}</code>
                          {item.hasDuplicatePath && (
                            <span className="badge warning-badge" style={{ marginLeft: '0.5rem' }}>
                              Duplicate path
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge format-badge">{item.extension.toUpperCase()}</span>
                        </td>
                        <td>{formatBytes(item.fileSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Wizard Controls */}
          <div className="wizard-controls">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onPrevious}
            >
              &larr; Back to Column Mapping
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNext}
              disabled={inventory.supportedFileCount === 0}
              title={
                inventory.supportedFileCount === 0
                  ? 'At least one supported image is required to continue'
                  : ''
              }
            >
              Continue to Match Review &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
