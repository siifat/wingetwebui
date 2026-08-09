import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export interface ToastMessage {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

interface ToastRegionProps {
  toast: ToastMessage | null
  onClose: () => void
}

export function ToastRegion({ toast, onClose }: ToastRegionProps) {
  const Icon =
    toast?.tone === 'success' ? CheckCircle2 : toast?.tone === 'error' ? AlertCircle : Info
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div
          className="toast"
          data-tone={toast.tone}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <Icon size={17} />
          <span>{toast.message}</span>
          <button
            className="icon-button icon-button--small"
            type="button"
            onClick={onClose}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
