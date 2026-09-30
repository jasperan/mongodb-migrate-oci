import { useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { IconButton } from './Button'

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/45" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'card-surface relative z-10 w-full overflow-hidden',
          { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size]
        )}
      >
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h3 className="font-display text-lg">{title}</h3>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-ink-200 bg-ink-50 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  )
}
