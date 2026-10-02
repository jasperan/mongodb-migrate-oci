import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from './Button'
import { dialogPortal, useDialog } from './useDialog'

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { titleId, panelProps } = useDialog({ open, onClose })

  if (!open) return null

  return dialogPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/45" onClick={onClose} aria-hidden />
      {/* Header and footer stay put; only the body scrolls on short viewports. */}
      <div
        {...panelProps}
        className={cn(
          'card-surface relative z-10 flex max-h-full w-full flex-col overflow-hidden outline-none',
          SIZES[size]
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-ink-200 px-5 py-4">
          <h3 id={titleId} className="font-display text-lg">
            {title}
          </h3>
          <IconButton label="Close" data-dialog-close onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-ink-200 bg-ink-50 px-5 py-4">{footer}</footer>
        )}
      </div>
    </div>
  )
}
