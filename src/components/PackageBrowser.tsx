import { DatabaseZap, RefreshCw, SearchX } from 'lucide-react'
import { type ViewMode, type WingetPackage } from '../types/domain'
import { PackageCard, type SelectionModifiers } from './PackageCard'

interface PackageBrowserProps {
  packages: WingetPackage[]
  totalCount: number
  selectedIds: Set<string>
  viewMode: ViewMode
  loading: boolean
  error?: string
  query: string
  onSelect: (packageInfo: WingetPackage, modifiers: SelectionModifiers) => void
  onDetails: (packageInfo: WingetPackage) => void
  onRetry: () => void
  onClearSearch: () => void
  onLoadMore: () => void
}

export function PackageBrowser({
  packages,
  totalCount,
  selectedIds,
  viewMode,
  loading,
  error,
  query,
  onSelect,
  onDetails,
  onRetry,
  onClearSearch,
  onLoadMore,
}: PackageBrowserProps) {
  if (loading) {
    return (
      <div
        className={`package-collection package-collection--${viewMode}`}
        aria-label="Loading applications"
      >
        {Array.from({ length: viewMode === 'grid' ? 8 : 6 }, (_, index) => (
          <div
            className={`package-skeleton package-skeleton--${viewMode}`}
            key={index}
            aria-hidden="true"
          >
            <span />
            <i />
            <i />
            <i />
          </div>
        ))}
        <span className="sr-only">Loading applications…</span>
      </div>
    )
  }

  if (error && packages.length === 0) {
    return (
      <div className="browser-state browser-state--error" role="alert">
        <span className="browser-state__icon">
          <DatabaseZap size={25} />
        </span>
        <h3>Unable to load applications</h3>
        <p>{error}</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className="browser-state">
        <span className="browser-state__icon">
          <SearchX size={25} />
        </span>
        <h3>No applications found</h3>
        <p>Try a different name, publisher, package ID, or category.</p>
        {query && (
          <button className="button button--secondary" type="button" onClick={onClearSearch}>
            Clear search
          </button>
        )}
      </div>
    )
  }

  const remainingCount = Math.max(0, totalCount - packages.length)

  return (
    <>
      <div className={`package-collection package-collection--${viewMode}`}>
        {packages.map((packageInfo) => (
          <PackageCard
            key={packageInfo.id}
            packageInfo={packageInfo}
            selected={selectedIds.has(packageInfo.id)}
            view={viewMode}
            onSelect={onSelect}
            onDetails={onDetails}
          />
        ))}
      </div>
      {remainingCount > 0 && (
        <div className="package-pagination">
          <p>
            Showing <strong>{packages.length.toLocaleString()}</strong> of{' '}
            <strong>{totalCount.toLocaleString()}</strong> applications
          </p>
          <button className="button button--secondary" type="button" onClick={onLoadMore}>
            Load more <span>({Math.min(RESULT_PAGE_SIZE, remainingCount).toLocaleString()})</span>
          </button>
        </div>
      )}
    </>
  )
}

const RESULT_PAGE_SIZE = 120
