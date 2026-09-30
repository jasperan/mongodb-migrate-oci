import { useId } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

// One modal shape for every create/edit form: scrollable body, sticky footer,
// server error surfaced above the fields instead of a toast that disappears.
export function FormModal({
  open,
  onClose,
  onSubmit,
  title,
  description,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  loading = false,
  error,
  size = 'lg',
  children
}) {
  const formId = useId()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} loading={loading}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {description && <p className="-mt-1 mb-4 text-sm text-ink-500">{description}</p>}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-700"
        >
          {error}
        </p>
      )}
      <form
        id={formId}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}
      </form>
    </Modal>
  )
}

// Spans the whole form width — handy for textareas and checkbox rows.
export function FormRow({ children, className }) {
  return <div className={className ? `sm:col-span-2 ${className}` : 'sm:col-span-2'}>{children}</div>
}
