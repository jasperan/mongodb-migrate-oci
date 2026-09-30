import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
          <AlertTriangle size={18} />
        </span>
        <div className="space-y-2 text-sm text-ink-600">
          {typeof description === 'string' ? <p>{description}</p> : description}
        </div>
      </div>
    </Modal>
  )
}
