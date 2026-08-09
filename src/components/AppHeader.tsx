import { Download, RotateCcw, Upload } from 'lucide-react'
import { type ThemePreference } from '../types/domain'
import { ThemeControl } from './ThemeControl'

interface AppHeaderProps {
  selectedCount: number
  theme: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
  onImport: () => void
  onExport: () => void
  onReset: () => void
}

export function AppHeader({
  selectedCount,
  theme,
  onThemeChange,
  onImport,
  onExport,
  onReset,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <a className="brand" href="#main" aria-label="WingetWebUI home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="brand-copy">
            <strong>WingetWebUI</strong>
            <small>Windows setup, simplified</small>
          </span>
        </a>

        <nav className="header-actions" aria-label="Configuration and appearance">
          <button className="button button--quiet header-action" type="button" onClick={onImport}>
            <Upload size={15} />
            <span>Import</span>
          </button>
          <button
            className="button button--quiet header-action"
            type="button"
            onClick={onExport}
            disabled={selectedCount === 0}
          >
            <Download size={15} />
            <span>Export</span>
          </button>
          <button
            className="button button--quiet header-action header-action--reset"
            type="button"
            onClick={onReset}
            disabled={selectedCount === 0}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
          <span className="header-divider" aria-hidden="true" />
          <ThemeControl value={theme} onChange={onThemeChange} />
        </nav>
      </div>
    </header>
  )
}
