import { BadgeCheck, Box, Building2, Tag, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { type WingetPackage } from '../types/domain'
import { PackageIcon } from './PackageIcon'

interface PackageDetailsDialogProps {
  packageInfo: WingetPackage | null
  selected: boolean
  onToggle: (packageInfo: WingetPackage) => void
  onClose: () => void
}

export function PackageDetailsDialog({
  packageInfo,
  selected,
  onToggle,
  onClose,
}: PackageDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (packageInfo && !dialog.open) dialog.showModal()
    if (!packageInfo && dialog.open) dialog.close()
  }, [packageInfo])

  return (
    <dialog
      className="modal package-dialog"
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-labelledby="package-dialog-title"
    >
      {packageInfo && (
        <div className="modal__surface">
          <button
            className="icon-button modal__close"
            type="button"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={18} />
          </button>
          <div className="package-dialog__hero">
            <PackageIcon packageInfo={packageInfo} size="large" />
            <div>
              <span className="eyebrow">{packageInfo.category}</span>
              <h2 id="package-dialog-title">{packageInfo.name}</h2>
              <p>{packageInfo.publisher}</p>
            </div>
          </div>
          <p className="package-dialog__description">{packageInfo.description}</p>
          <dl className="package-metadata">
            <div>
              <dt>
                <Box size={14} /> Package ID
              </dt>
              <dd>
                <code>{packageInfo.id}</code>
              </dd>
            </div>
            <div>
              <dt>
                <Building2 size={14} /> Publisher
              </dt>
              <dd>{packageInfo.publisher}</dd>
            </div>
            <div>
              <dt>
                <Tag size={14} /> Catalog version
              </dt>
              <dd>{packageInfo.version}</dd>
            </div>
            <div>
              <dt>
                <BadgeCheck size={14} /> Source
              </dt>
              <dd>WinGet community repository</dd>
            </div>
          </dl>
          <div className="modal__actions">
            <button className="button button--quiet" type="button" onClick={onClose}>
              Close
            </button>
            <button
              className={`button ${selected ? 'button--secondary' : 'button--primary'}`}
              type="button"
              onClick={() => {
                onToggle(packageInfo)
                onClose()
              }}
            >
              {selected ? 'Remove from plan' : 'Add to install plan'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
