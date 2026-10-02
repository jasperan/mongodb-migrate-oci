import { useEffect, useRef } from 'react'

/**
 * Calls `onDismiss` on Escape or on a pointer press outside every element in
 * `refs`. Used by popovers and menus; `onDismiss` may change identity freely.
 */
export function useDismiss(refs, open, onDismiss) {
  const latest = useRef({ refs, onDismiss })
  useEffect(() => {
    latest.current = { refs, onDismiss }
  })

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      const inside = latest.current.refs.some((ref) => ref.current?.contains(event.target))
      if (!inside) latest.current.onDismiss(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') latest.current.onDismiss(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])
}
