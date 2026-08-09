import { Database, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { CategorySidebar } from './components/CategorySidebar'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ImportDialog, type PendingImport } from './components/ImportDialog'
import { OptionsPanel } from './components/OptionsPanel'
import { OutputPanel } from './components/OutputPanel'
import { PackageBrowser } from './components/PackageBrowser'
import { type SelectionModifiers } from './components/PackageCard'
import { PackageDetailsDialog } from './components/PackageDetailsDialog'
import { SearchToolbar } from './components/SearchToolbar'
import { SelectionPanel } from './components/SelectionPanel'
import { ToastRegion, type ToastMessage } from './components/ToastRegion'
import { loadPackageCatalog, type PackageCatalogResult } from './data'
import { useTheme } from './hooks/useTheme'
import { deserializeConfiguration, serializeConfiguration } from './lib/configuration'
import { generateArtifacts } from './lib/generators'
import { filterPackages } from './lib/search'
import {
  areAllPackagesSelected,
  createSelectionState,
  movePackageInSelection,
  removePackageFromSelection,
  reorderSelectionById,
  resolveSelectedPackages,
  toggleCategorySelection,
  updateSelectionFromInteraction,
} from './lib/selection'
import {
  CATEGORIES,
  DEFAULT_WINGET_OPTIONS,
  type PackageCategory,
  type SelectionState,
  type ViewMode,
  type WingetOptions,
  type WingetPackage,
} from './types'

interface CatalogState {
  loading: boolean
  result: PackageCatalogResult | null
}

const EMPTY_PACKAGES: WingetPackage[] = []
const INITIAL_RESULT_LIMIT = 120
const RESULT_PAGE_SIZE = 120

function downloadFile(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function App() {
  const { preference: theme, setPreference: setTheme } = useTheme()
  const [catalog, setCatalog] = useState<CatalogState>({ loading: true, result: null })
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<PackageCategory | 'All'>('All')
  const [resultLimit, setResultLimit] = useState(INITIAL_RESULT_LIMIT)
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    window.localStorage.getItem('winget-web-ui-view') === 'list' ? 'list' : 'grid',
  )
  const [selection, setSelection] = useState<SelectionState>(() => createSelectionState())
  const [options, setOptions] = useState<WingetOptions>({ ...DEFAULT_WINGET_OPTIONS })
  const [detailsPackage, setDetailsPackage] = useState<WingetPackage | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<number | null>(null)

  const packages = catalog.result?.packages ?? EMPTY_PACKAGES

  const reloadCatalog = useCallback(async () => {
    setCatalog((current) => ({ ...current, loading: true }))
    const result = await loadPackageCatalog()
    setCatalog({ loading: false, result })
  }, [])

  useEffect(() => {
    let active = true
    void loadPackageCatalog().then((result) => {
      if (active) setCatalog({ loading: false, result })
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('winget-web-ui-view', viewMode)
  }, [viewMode])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !isEditing) {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('#package-search')?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    },
    [],
  )

  const showFeedback = useCallback((message: string, tone: ToastMessage['tone'] = 'info') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    const nextToast = { id: Date.now(), message, tone }
    setToast(nextToast)
    toastTimerRef.current = window.setTimeout(() => setToast(null), tone === 'error' ? 5000 : 2800)
  }, [])

  const deferredQuery = useDeferredValue(query)
  const filteredPackages = useMemo(
    () => filterPackages(packages, { query: deferredQuery, category: activeCategory }),
    [activeCategory, deferredQuery, packages],
  )
  const visiblePackages = useMemo(
    () => filteredPackages.slice(0, resultLimit),
    [filteredPackages, resultLimit],
  )
  const selectedPackages = useMemo(
    () => resolveSelectedPackages(selection.selectedIds, packages),
    [packages, selection.selectedIds],
  )
  const selectedIds = useMemo(() => new Set(selection.selectedIds), [selection.selectedIds])
  const visibleIds = useMemo(() => visiblePackages.map((item) => item.id), [visiblePackages])
  const allVisibleSelected = areAllPackagesSelected(selection.selectedIds, visibleIds)
  const artifacts = useMemo(
    () => generateArtifacts(selectedPackages, options),
    [options, selectedPackages],
  )

  const packageCounts = useMemo(() => {
    const counts = new Map<PackageCategory, number>(CATEGORIES.map((category) => [category, 0]))
    packages.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1))
    return counts
  }, [packages])

  const selectedCounts = useMemo(() => {
    const counts = new Map<PackageCategory, number>()
    selectedPackages.forEach((item) =>
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1),
    )
    return counts
  }, [selectedPackages])

  const handleSelect = (packageInfo: WingetPackage, modifiers: SelectionModifiers) => {
    setSelection((current) =>
      updateSelectionFromInteraction(current, packageInfo.id, visibleIds, modifiers),
    )
  }

  const handleToggleVisible = () => {
    setSelection((current) => ({
      selectedIds: toggleCategorySelection(current.selectedIds, visibleIds),
      anchorId: visibleIds.at(-1) ?? current.anchorId,
    }))
  }

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery)
    setResultLimit(INITIAL_RESULT_LIMIT)
  }

  const handleCategoryChange = (category: PackageCategory | 'All') => {
    setActiveCategory(category)
    setResultLimit(INITIAL_RESULT_LIMIT)
  }

  const handleReset = () => {
    setSelection(createSelectionState())
    setOptions({ ...DEFAULT_WINGET_OPTIONS })
    setConfirmReset(false)
    showFeedback('Configuration reset', 'success')
  }

  const handleExport = () => {
    if (selectedPackages.length === 0) return
    const contents = serializeConfiguration(selectedPackages, options)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(contents, `winget-setup-${date}.json`, 'application/json')
    showFeedback('Configuration exported', 'success')
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 1_000_000) {
      showFeedback('That configuration is too large. Choose a JSON file under 1 MB.', 'error')
      return
    }

    let contents: string
    try {
      contents = await file.text()
    } catch {
      showFeedback('The selected file could not be read.', 'error')
      return
    }

    const parsed = deserializeConfiguration(contents)
    if (!parsed.success) {
      const detail = parsed.error.issues?.[0]
      showFeedback(detail ? `${parsed.error.message} ${detail}` : parsed.error.message, 'error')
      return
    }

    const packageById = new Map(packages.map((item) => [item.id, item]))
    const importedPackages = parsed.value.packages.flatMap(({ id }) => {
      const packageInfo = packageById.get(id)
      return packageInfo ? [packageInfo] : []
    })
    const unavailablePackageIds = parsed.value.packages
      .map(({ id }) => id)
      .filter((id) => !packageById.has(id))

    setPendingImport({
      packages: importedPackages,
      options: parsed.value.wingetOptions,
      unavailablePackageIds,
      fileName: file.name,
    })
  }

  const handleApplyImport = (value: PendingImport) => {
    setSelection(createSelectionState(value.packages.map((item) => item.id)))
    setOptions(value.options)
    showFeedback(
      value.unavailablePackageIds.length > 0
        ? `Configuration imported; ${value.unavailablePackageIds.length} unavailable package${value.unavailablePackageIds.length === 1 ? '' : 's'} skipped.`
        : 'Configuration imported',
      value.unavailablePackageIds.length > 0 ? 'info' : 'success',
    )
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to application workspace
      </a>
      <AppHeader
        selectedCount={selectedPackages.length}
        theme={theme}
        onThemeChange={setTheme}
        onImport={() => importInputRef.current?.click()}
        onExport={handleExport}
        onReset={() => setConfirmReset(true)}
      />

      <main id="main" className="app-main">
        <div className="workspace">
          <section className="discovery-panel" id="discover" aria-labelledby="discover-title">
            <div className="discovery-intro">
              <div>
                <span className="eyebrow">
                  <span>01</span> Discover applications
                </span>
                <h1 id="discover-title">Build your Windows setup.</h1>
                <p>
                  Find the apps you trust, choose an install order, then copy one ready-to-run
                  command.
                </p>
              </div>
              <div className="catalog-status" data-source={catalog.result?.source ?? 'loading'}>
                <span>
                  <Database size={14} />
                </span>
                <div>
                  <strong>
                    {catalog.loading
                      ? 'Loading catalog'
                      : catalog.result?.source === 'official'
                        ? 'Official WinGet catalog'
                        : catalog.result?.source === 'remote'
                          ? 'Custom live catalog'
                          : 'Curated catalog'}
                  </strong>
                  <small>
                    {catalog.loading
                      ? 'Connecting…'
                      : catalog.result?.source === 'official'
                        ? `${packages.length.toLocaleString()} official packages`
                        : catalog.result?.source === 'remote'
                          ? `${packages.length.toLocaleString()} package entries`
                          : `${packages.length} verified WinGet IDs`}
                  </small>
                </div>
              </div>
            </div>

            {catalog.result?.notice && (
              <div className="catalog-notice" role={catalog.result.error ? 'alert' : 'status'}>
                <Sparkles size={15} />
                <span>{catalog.result.notice}</span>
                {catalog.result.error && (
                  <button
                    className="button button--compact"
                    type="button"
                    onClick={() => void reloadCatalog()}
                  >
                    <RefreshCw size={13} /> Retry
                  </button>
                )}
              </div>
            )}

            <SearchToolbar
              query={query}
              activeCategory={activeCategory}
              resultCount={filteredPackages.length}
              viewMode={viewMode}
              allVisibleSelected={allVisibleSelected}
              hasVisiblePackages={visiblePackages.length > 0}
              onQueryChange={handleQueryChange}
              onViewModeChange={setViewMode}
              onToggleVisible={handleToggleVisible}
            />

            <div className="discovery-browser">
              <CategorySidebar
                activeCategory={activeCategory}
                packageCounts={packageCounts}
                selectedCounts={selectedCounts}
                totalCount={packages.length}
                onChange={handleCategoryChange}
              />
              <div className="package-browser" id="package-results">
                <PackageBrowser
                  packages={visiblePackages}
                  totalCount={filteredPackages.length}
                  selectedIds={selectedIds}
                  viewMode={viewMode}
                  loading={catalog.loading}
                  error={catalog.result?.error?.message}
                  query={query}
                  onSelect={handleSelect}
                  onDetails={setDetailsPackage}
                  onRetry={() => void reloadCatalog()}
                  onClearSearch={() => handleQueryChange('')}
                  onLoadMore={() => setResultLimit((current) => current + RESULT_PAGE_SIZE)}
                />
              </div>
            </div>
          </section>

          <aside className="plan-panel" aria-label="Installation plan and generated output">
            <SelectionPanel
              packages={selectedPackages}
              onRemove={(id) =>
                setSelection((current) => ({
                  ...current,
                  selectedIds: removePackageFromSelection(current.selectedIds, id),
                }))
              }
              onClear={() => setConfirmReset(true)}
              onReorder={(activeId, overId) =>
                setSelection((current) => ({
                  ...current,
                  selectedIds: reorderSelectionById(current.selectedIds, activeId, overId),
                }))
              }
              onMove={(index, direction) => {
                const packageInfo = selectedPackages[index]
                if (!packageInfo) return
                setSelection((current) => ({
                  ...current,
                  selectedIds: movePackageInSelection(
                    current.selectedIds,
                    packageInfo.id,
                    direction === -1 ? 'up' : 'down',
                  ),
                }))
              }}
              onBrowse={() => document.querySelector<HTMLInputElement>('#package-search')?.focus()}
            />
            <OptionsPanel value={options} onChange={setOptions} />
            <OutputPanel
              artifacts={artifacts}
              selectedCount={selectedPackages.length}
              onFeedback={showFeedback}
            />
          </aside>
        </div>

        <footer className="app-footer">
          <span>
            <ShieldCheck size={14} /> Commands are generated locally in your browser.
          </span>
          <span>Package versions are resolved by WinGet at install time.</span>
        </footer>
      </main>

      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        tabIndex={-1}
        onChange={(event) => void handleImportFile(event)}
        aria-label="Import configuration file"
      />
      <PackageDetailsDialog
        packageInfo={detailsPackage}
        selected={detailsPackage ? selectedIds.has(detailsPackage.id) : false}
        onToggle={(packageInfo) => handleSelect(packageInfo, { shiftKey: false, ctrlKey: false })}
        onClose={() => setDetailsPackage(null)}
      />
      <ImportDialog
        value={pendingImport}
        replacingExisting={selectedPackages.length > 0}
        onApply={handleApplyImport}
        onClose={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset your install plan?"
        description="This clears every selected application and restores the default WinGet options. Export first if you want to keep a copy."
        confirmLabel="Reset configuration"
        tone="danger"
        onConfirm={handleReset}
        onClose={() => setConfirmReset(false)}
      />
      <ToastRegion toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
