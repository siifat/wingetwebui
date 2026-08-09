import { CheckSquare2, Grid2X2, List, Search, X } from 'lucide-react'
import { type PackageCategory, type ViewMode } from '../types/domain'

interface SearchToolbarProps {
  query: string
  activeCategory: PackageCategory | 'All'
  resultCount: number
  viewMode: ViewMode
  allVisibleSelected: boolean
  hasVisiblePackages: boolean
  onQueryChange: (query: string) => void
  onViewModeChange: (view: ViewMode) => void
  onToggleVisible: () => void
}

export function SearchToolbar({
  query,
  activeCategory,
  resultCount,
  viewMode,
  allVisibleSelected,
  hasVisiblePackages,
  onQueryChange,
  onViewModeChange,
  onToggleVisible,
}: SearchToolbarProps) {
  return (
    <div className="search-toolbar">
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search applications and categories</span>
        <input
          id="package-search"
          aria-label="Search applications and categories"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search apps, publishers, or package IDs…"
          type="search"
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button
            type="button"
            className="icon-button icon-button--small"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
        <kbd className="search-shortcut">/</kbd>
      </label>

      <div className="browser-toolbar">
        <p className="results-summary" aria-live="polite">
          <strong>{resultCount}</strong> {resultCount === 1 ? 'application' : 'applications'}
          {activeCategory !== 'All' && <span> in {activeCategory}</span>}
        </p>
        <div className="browser-actions">
          <button
            className="button button--quiet button--compact select-visible-button"
            type="button"
            disabled={!hasVisiblePackages}
            onClick={onToggleVisible}
          >
            <CheckSquare2 size={15} />
            {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
          </button>
          <div className="view-toggle" role="group" aria-label="Package view">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              aria-label="Card view"
              aria-pressed={viewMode === 'grid'}
              data-active={viewMode === 'grid'}
              title="Card view"
            >
              <Grid2X2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              data-active={viewMode === 'list'}
              title="List view"
            >
              <List size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
