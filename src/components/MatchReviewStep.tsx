import { useMemo, useState, type ChangeEvent } from 'react'
import type { ParsedSpreadsheet, ColumnMapping } from '../types/spreadsheet'
import type { ImageInventory } from '../types/image'
import { executeDeterministicMatching } from '../core/matching'
import {
  buildReviewRows,
  filterReviewRows,
  formatMatchMethod,
  formatMatchStatus,
  getReviewStatusCounts,
  type ReviewFilter,
} from '../core/review'
import { generateReportCsv, downloadReportCsv } from '../core/report'

export interface MatchReviewStepProps {
  readonly spreadsheet: ParsedSpreadsheet | null
  readonly mapping: ColumnMapping
  readonly inventory: ImageInventory | null
  readonly onPrevious: () => void
  readonly onGoToColumnMapping?: () => void
  readonly onNext: () => void
}

export function MatchReviewStep({
  spreadsheet,
  mapping,
  inventory,
  onPrevious,
  onGoToColumnMapping,
  onNext,
}: MatchReviewStepProps) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Run deterministic matching engine whenever spreadsheet, mapping, or inventory changes
  const matchResult = useMemo(() => {
    if (!spreadsheet || !inventory) return null
    return executeDeterministicMatching(
      spreadsheet.currentSheet.rows,
      mapping,
      inventory,
    )
  }, [spreadsheet, mapping, inventory])

  // Build unified review rows
  const allRows = useMemo(() => {
    if (!matchResult) return []
    return buildReviewRows(matchResult)
  }, [matchResult])

  // Derive status counts directly from ReviewRows so filter numbers exactly match table rows
  const statusCounts = useMemo(() => {
    return getReviewStatusCounts(allRows)
  }, [allRows])

  // Filter rows based on active category/status filter and search query
  const filteredRows = useMemo(() => {
    return filterReviewRows(allRows, filter, searchQuery)
  }, [allRows, filter, searchQuery])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    if (pageSize >= filteredRows.length) return filteredRows
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  const handleFilterChange = (newFilter: ReviewFilter) => {
    setFilter(newFilter)
    setCurrentPage(1)
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const val = event.target.value === 'all' ? 100000 : Number(event.target.value)
    setPageSize(val)
    setCurrentPage(1)
  }

  const handleDownloadReport = () => {
    if (!matchResult) return
    const csv = generateReportCsv(matchResult)
    downloadReportCsv(csv, 'picbatch-report.csv')
  }

  // Safe fallback if reached without valid prior state
  if (!spreadsheet || !inventory || !matchResult) {
    return (
      <div className="match-review-step">
        <div className="alert-banner alert-warning" role="alert">
          <div className="alert-content">
            <strong>Missing required state:</strong> Both a loaded spreadsheet and selected images are required to perform match review.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onGoToColumnMapping && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onGoToColumnMapping}>
                Go to Column Mapping
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onPrevious}>
              Go to Images
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { summary } = matchResult

  return (
    <div className="match-review-step">
      {/* Summary Cards Section */}
      <section className="review-summary-container" aria-label="Matching Summary Counters">
        <div className="review-overview-grid">
          <div className="stat-card">
            <span className="stat-value">{summary.totalProducts}</span>
            <span className="stat-label">Total Products</span>
            <span className="stat-sub">{summary.validProducts} valid, {summary.invalidProducts} invalid</span>
          </div>

          <div className="stat-card">
            <span className="stat-value">{summary.totalImages}</span>
            <span className="stat-label">Discovered Files</span>
            <span className="stat-sub">{summary.supportedImages} supported, {summary.unsupportedFiles} ignored</span>
          </div>

          <div className={`stat-card ${statusCounts.matched > 0 ? 'stat-card-matched' : ''}`}>
            <span className={`stat-value ${statusCounts.matched > 0 ? 'stat-value-success' : ''}`}>
              {statusCounts.matched}
            </span>
            <span className="stat-label">Safely Matched Images</span>
            <span className="stat-sub">Ready for output processing</span>
          </div>

          <div className={`stat-card ${statusCounts.totalProblems > 0 ? 'stat-card-problems' : 'stat-card-clean'}`}>
            <span className={`stat-value ${statusCounts.totalProblems > 0 ? 'stat-value-warning' : 'stat-value-success'}`}>
              {statusCounts.totalProblems}
            </span>
            <span className="stat-label">Total Problems</span>
            <span className="stat-sub">
              {statusCounts.totalProblems > 0
                ? 'Will be excluded from processing'
                : 'Zero problems detected'}
            </span>
          </div>
        </div>

        {/* Breakdown chips */}
        <div className="review-breakdown-card">
          <span className="review-breakdown-title">Detailed Status Breakdown:</span>
          <div className="breakdown-chips-list" role="toolbar" aria-label="Status filter chips">
            <button
              type="button"
              className={`breakdown-chip ${filter === 'matched' ? 'active' : ''}`}
              onClick={() => handleFilterChange('matched')}
            >
              <span>Matched:</span>
              <span className="breakdown-chip-count">{statusCounts.matched}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.unmatched_image > 0 ? 'has-issues' : ''} ${filter === 'unmatched_image' ? 'active' : ''}`}
              onClick={() => handleFilterChange('unmatched_image')}
            >
              <span>Unmatched images:</span>
              <span className="breakdown-chip-count">{statusCounts.unmatched_image}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.unmatched_product > 0 ? 'has-issues' : ''} ${filter === 'unmatched_product' ? 'active' : ''}`}
              onClick={() => handleFilterChange('unmatched_product')}
            >
              <span>Unmatched products:</span>
              <span className="breakdown-chip-count">{statusCounts.unmatched_product}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.ambiguous_match > 0 ? 'has-issues' : ''} ${filter === 'ambiguous_match' ? 'active' : ''}`}
              onClick={() => handleFilterChange('ambiguous_match')}
            >
              <span>Ambiguous matches:</span>
              <span className="breakdown-chip-count">{statusCounts.ambiguous_match}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.duplicate_product_key > 0 ? 'has-issues' : ''} ${filter === 'duplicate_product_key' ? 'active' : ''}`}
              onClick={() => handleFilterChange('duplicate_product_key')}
            >
              <span>Duplicate-key cases:</span>
              <span className="breakdown-chip-count">{statusCounts.duplicate_product_key}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.invalid_product_key > 0 ? 'has-issues' : ''} ${filter === 'invalid_product_key' ? 'active' : ''}`}
              onClick={() => handleFilterChange('invalid_product_key')}
            >
              <span>Invalid product keys:</span>
              <span className="breakdown-chip-count">{statusCounts.invalid_product_key}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.unsupported_file > 0 ? 'has-issues' : ''} ${filter === 'unsupported_file' ? 'active' : ''}`}
              onClick={() => handleFilterChange('unsupported_file')}
            >
              <span>Unsupported files:</span>
              <span className="breakdown-chip-count">{statusCounts.unsupported_file}</span>
            </button>

            <button
              type="button"
              className={`breakdown-chip ${statusCounts.output_collision > 0 ? 'has-issues' : ''} ${filter === 'output_collision' ? 'active' : ''}`}
              onClick={() => handleFilterChange('output_collision')}
            >
              <span>Output collisions:</span>
              <span className="breakdown-chip-count">{statusCounts.output_collision}</span>
            </button>
          </div>
        </div>

        {/* Operational Problem Alert / Notice */}
        {statusCounts.totalProblems > 0 && (
          <div className="alert-banner alert-warning" role="status">
            <div>
              <strong>{statusCounts.totalProblems} unresolved problem(s) detected:</strong> Only safely matched images ({statusCounts.matched}) will be processed. Unmatched items and ambiguous matches will be safely excluded from output file generation.
            </div>
          </div>
        )}

        {statusCounts.matched === 0 && (
          <div className="alert-banner alert-warning" role="status">
            <div>
              <strong>No safe matches:</strong> None of the selected images could be safely matched to product identifiers. You may return to Column Mapping or review the diagnostic reasons below.
            </div>
          </div>
        )}

        {statusCounts.totalProblems === 0 && statusCounts.matched > 0 && (
          <div className="alert-banner alert-success" role="status">
            <div>
              <strong>Clean match:</strong> All {statusCounts.matched} image(s) matched products safely with zero ambiguous or conflicting cases.
            </div>
          </div>
        )}
      </section>

      {/* Filter and Search Bar */}
      <section className="review-toolbar" aria-label="Review Filters">
        <div className="filter-tabs-group" role="tablist" aria-label="Quick Filters">
          <button
            type="button"
            className={`filter-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All ({statusCounts.total})
          </button>
          <button
            type="button"
            className={`filter-tab-btn tab-problems ${statusCounts.totalProblems > 0 ? 'has-problems' : ''} ${filter === 'problems' ? 'active' : ''}`}
            onClick={() => handleFilterChange('problems')}
          >
            Problems ({statusCounts.totalProblems})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${filter === 'matched' ? 'active' : ''}`}
            onClick={() => handleFilterChange('matched')}
          >
            Matched ({statusCounts.matched})
          </button>
        </div>

        <div className="toolbar-controls">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadReport}
            title="Download full match and output report as CSV"
          >
            Download report CSV
          </button>

          <select
            className="select-input"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value as ReviewFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses ({statusCounts.total})</option>
            <option value="problems">Problems only ({statusCounts.totalProblems})</option>
            <option value="matched">Matched ({statusCounts.matched})</option>
            <option value="unmatched_image">Unmatched images ({statusCounts.unmatched_image})</option>
            <option value="unmatched_product">Unmatched products ({statusCounts.unmatched_product})</option>
            <option value="ambiguous_match">Ambiguous matches ({statusCounts.ambiguous_match})</option>
            <option value="duplicate_product_key">Duplicate-key cases ({statusCounts.duplicate_product_key})</option>
            <option value="invalid_product_key">Invalid product keys ({statusCounts.invalid_product_key})</option>
            <option value="unsupported_file">Unsupported files ({statusCounts.unsupported_file})</option>
            <option value="output_collision">Output collisions ({statusCounts.output_collision})</option>
          </select>

          <input
            type="search"
            className="search-input"
            placeholder="Search path, SKU, reason..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search review rows"
          />
        </div>
      </section>

      {/* Review Table */}
      <section className="review-table-section" aria-label="Match Review Results Table">
        <div className="table-responsive-container">
          <table className="preview-table">
            <thead>
              <tr>
                <th className="row-num-col">#</th>
                <th>Source Path / File</th>
                <th>Product Identifier</th>
                <th>Proposed Filename</th>
                <th>Match Method</th>
                <th>Status</th>
                <th>Diagnostic Reason</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-rows-cell">
                    <p style={{ marginBottom: '0.5rem' }}>
                      No rows match the current filter ({filter})
                      {searchQuery ? ` and search query "${searchQuery}"` : ''}.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setFilter('all')
                        setSearchQuery('')
                        setCurrentPage(1)
                      }}
                    >
                      Reset Filter & Search
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1
                  return (
                    <tr key={row.id}>
                      <td className="row-num-cell">{itemNumber}</td>
                      <td title={row.sourcePath !== '—' ? row.sourcePath : undefined}>
                        {row.rowType === 'image' ? (
                          <code>{row.sourcePath}</code>
                        ) : (
                          <span className="empty-cell-placeholder">—</span>
                        )}
                      </td>
                      <td>
                        {row.productIdentifier !== '—' && row.productIdentifier !== '(Blank)' ? (
                          <strong>{row.productIdentifier}</strong>
                        ) : (
                          <span className="empty-cell-placeholder">{row.productIdentifier}</span>
                        )}
                        {row.sequenceNumber !== null && (
                          <span className="seq-badge" title={`Image sequence ${row.sequenceNumber}`}>
                            #{row.sequenceNumber}
                          </span>
                        )}
                      </td>
                      <td>
                        {row.proposedFilename !== '—' ? (
                          <code>{row.proposedFilename}</code>
                        ) : (
                          <span className="empty-cell-placeholder">—</span>
                        )}
                      </td>
                      <td>{formatMatchMethod(row.matchMethod)}</td>
                      <td>
                        <span className={`status-badge status-${row.status}`}>
                          {formatMatchStatus(row.status)}
                        </span>
                      </td>
                      <td className="diagnostic-reason">{row.reason}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {filteredRows.length > 0 && (
          <div className="table-pagination-bar">
            <div>
              Showing{' '}
              <strong>
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredRows.length)}
              </strong>{' '}
              of <strong>{filteredRows.length}</strong> items
              {filteredRows.length !== allRows.length && (
                <span> (filtered from {allRows.length} total)</span>
              )}
            </div>

            <div className="pagination-controls">
              <label htmlFor="review-page-size" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Rows:
              </label>
              <select
                id="review-page-size"
                className="select-input"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                value={pageSize >= 100000 ? 'all' : pageSize}
                onChange={handlePageSizeChange}
                aria-label="Items per page"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                &larr; Prev
              </button>

              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Navigation Wizard Controls */}
      <div className="wizard-controls">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onPrevious}>
            &larr; Back to Images
          </button>
          {onGoToColumnMapping && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onGoToColumnMapping}>
              Return to Column Mapping
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          title={statusCounts.matched === 0 ? 'No matched images to process, but you can inspect subsequent steps' : ''}
        >
          Continue to Processing &rarr;
        </button>
      </div>
    </div>
  )
}
