import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from '../ui/Button'
import { dialogPortal, useDialog } from '../ui/useDialog'
import { plural } from '../../lib/format'

/** Bottom sheet that holds the filters below the lg breakpoint. */
export function FilterSheet({ open, onClose, onReset, resultCount, children }) {
  const { titleId, panelProps } = useDialog({ open, onClose })

  // The overlay is lg:hidden; without this the dialog would stay mounted invisibly
  // and keep the scroll lock and focus trap after the window grows past lg.
  useEffect(() => {
    if (!open) return undefined
    const wide = window.matchMedia('(min-width: 1024px)')
    const closeWhenWide = (event) => {
      if (event.matches) onClose()
    }
    wide.addEventListener('change', closeWhenWide)
    return () => wide.removeEventListener('change', closeWhenWide)
  }, [open, onClose])

  if (!open) return null

  return dialogPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} aria-hidden />
      <div
        {...panelProps}
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-xl outline-none"
      >
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 id={titleId} className="font-display text-base">
            Filters
          </h2>
          <IconButton label="Close filters" data-dialog-close onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        <footer className="flex items-center gap-3 border-t border-ink-100 px-5 py-3">
          <Button variant="outline" onClick={onReset} className="flex-1">
            Clear all
          </Button>
          <Button onClick={onClose} className="flex-[2]">
            Show {plural(resultCount, 'product')}
          </Button>
        </footer>
      </div>
    </div>
  )
}
