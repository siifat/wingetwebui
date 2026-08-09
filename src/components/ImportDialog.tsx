import { AlertCircle, CheckCircle2, FileJson2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { type WingetOptions, type WingetPackage } from '../types/domain'

export interface PendingImport {
  packages: WingetPackage[]
  options: WingetOptions
  unavailablePackageIds: string[]
  fileName: string
}

interface ImportDialogProps {
  value: PendingImport | null
  replacingExisting: boolean
  onApply: (value: PendingImport) => void
  onClose: () => void
}

export function ImportDialog({ value, replacingExisting, onApply, onClose }: ImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (value && !dialog.open) dialog.showModal()
    if (!value && dialog.open) dialog.close()
  }, [value])

  return (
    <dialog
      className="modal import-dialog"
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="import-dialog-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      {value && (
        <div className="modal__surface">
          <button
            className="icon-button modal__close"
            type="button"
            onClick={onClose}
            aria-label="Close import preview"
          >
            <X size={18} />
          </button>
          <span className="modal-icon modal-icon--default">
            <FileJson2 size={22} />
          </span>
          <span className="eyebrow">Configuration preview</span>
          <h2 id="import-dialog-title">Import {value.fileName}?</h2>
          <p>
            We found {value.packages.length} available{' '}
            {value.packages.length === 1 ? 'application' : 'applications'}. Review the result before
            replacing your current plan.
          </p>

          <div className="import-summary">
            <div>
              <CheckCircle2 size={17} />
              <span>
                <strong>{value.packages.length}</strong> ready to import
              </span>
            </div>
            {value.unavailablePackageIds.length > 0 && (
              <div className="import-summary__warning">
                <AlertCircle size={17} />
                <span>
                  <strong>{value.unavailablePackageIds.length}</strong> unavailable in this catalog
                </span>
              </div>
            )}
          </div>

          {value.unavailablePackageIds.length > 0 && (
            <div className="unavailable-packages">
              <strong>Unavailable packages</strong>
              <ul>
                {value.unavailablePackageIds.map((id) => (
                  <li key={id}>
                    <code>{id}</code>
                  </li>
                ))}
              </ul>
              <p>These entries will be skipped. Your original file will not be modified.</p>
            </div>
          )}

          {replacingExisting && (
            <p className="replace-warning">
              <AlertCircle size={15} /> Importing replaces your current install plan.
            </p>
          )}

          <div className="modal__actions">
            <button className="button button--quiet" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={value.packages.length === 0}
              onClick={() => {
                onApply(value)
                onClose()
              }}
            >
              Import configuration
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
