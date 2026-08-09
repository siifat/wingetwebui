import { Check, Info, Plus } from 'lucide-react'
import { type WingetPackage } from '../types/domain'
import { PackageIcon } from './PackageIcon'

export interface SelectionModifiers {
  shiftKey: boolean
  ctrlKey: boolean
}

interface PackageCardProps {
  packageInfo: WingetPackage
  selected: boolean
  view: 'grid' | 'list'
  onSelect: (packageInfo: WingetPackage, modifiers: SelectionModifiers) => void
  onDetails: (packageInfo: WingetPackage) => void
}

export function PackageCard({
  packageInfo,
  selected,
  view,
  onSelect,
  onDetails,
}: PackageCardProps) {
  const handleSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    onSelect(packageInfo, {
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey || event.metaKey,
    })
  }

  if (view === 'list') {
    return (
      <article className="package-row" data-selected={selected}>
        <button
          className="package-row__select"
          type="button"
          onClick={handleSelect}
          aria-pressed={selected}
          aria-label={`${selected ? 'Remove' : 'Add'} ${packageInfo.name}`}
        >
          <span className="selection-checkbox" aria-hidden="true">
            {selected && <Check size={13} />}
          </span>
          <PackageIcon packageInfo={packageInfo} size="small" />
          <span className="package-row__name">
            <strong>{packageInfo.name}</strong>
            <small>{packageInfo.publisher}</small>
          </span>
          <code className="package-row__id">{packageInfo.id}</code>
          <span className="package-row__version">{packageInfo.version}</span>
        </button>
        <button
          className="icon-button package-details-button"
          type="button"
          onClick={() => onDetails(packageInfo)}
          aria-label={`View details for ${packageInfo.name}`}
          title="Package details"
        >
          <Info size={16} />
        </button>
      </article>
    )
  }

  return (
    <article className="package-card" data-selected={selected}>
      <button
        className="package-card__select"
        type="button"
        onClick={handleSelect}
        aria-pressed={selected}
        aria-label={`${selected ? 'Remove' : 'Add'} ${packageInfo.name}`}
      >
        <span className="selection-checkbox package-card__checkbox" aria-hidden="true">
          {selected ? <Check size={13} /> : <Plus size={13} />}
        </span>
        <PackageIcon packageInfo={packageInfo} size="large" />
        <span className="package-card__copy">
          <strong>{packageInfo.name}</strong>
          <span>{packageInfo.publisher}</span>
          <small>{packageInfo.description}</small>
        </span>
        <span className="package-card__footer">
          <code>{packageInfo.id}</code>
          <span className="package-card__state">{selected ? 'Added' : 'Add app'}</span>
        </span>
      </button>
      <button
        className="icon-button package-details-button"
        type="button"
        onClick={() => onDetails(packageInfo)}
        aria-label={`View details for ${packageInfo.name}`}
        title="Package details"
      >
        <Info size={15} />
      </button>
    </article>
  )
}
