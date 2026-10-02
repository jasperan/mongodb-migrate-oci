import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Open dialogs, topmost last: only the topmost one reacts to Escape and Tab.
const stack = []
let lockCount = 0
let restoreScroll = null

const lockScroll = () => {
  if (lockCount === 0) {
    const { body, documentElement } = document
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
    const scrollbar = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    restoreScroll = () => Object.assign(body.style, previous)
  }
  lockCount += 1
}

const unlockScroll = () => {
  lockCount -= 1
  if (lockCount === 0) restoreScroll?.()
}

const tabbables = (root) =>
  Array.from(root.querySelectorAll(TABBABLE)).filter((element) => element.getClientRects().length > 0)

/** Renders a dialog outside the app tree so no ancestor can clip or transform it. */
export const dialogPortal = (node) => createPortal(node, document.body)

/**
 * Behaviour shared by every modal surface (Modal, cart drawer): Escape closes,
 * Tab stays inside the panel, the page behind does not scroll, focus moves in
 * on open (an element marked `data-autofocus`, else the first control that is
 * not the close button) and returns to the opener on close.
 *
 * Spread `panelProps` on the panel element and give the title `id={titleId}`.
 */
export function useDialog({ open, onClose }) {
  const panelRef = useRef(null)
  const titleId = useId()
  // Consumers pass inline callbacks; keeping the latest in a ref stops the
  // effect below from re-running (and stealing focus) on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined
    const panel = panelRef.current
    const opener = document.activeElement
    const token = Symbol('dialog')
    stack.push(token)
    lockScroll()

    const controls = tabbables(panel)
    const target =
      panel.querySelector('[data-autofocus]') ||
      controls.find((element) => !element.hasAttribute('data-dialog-close')) ||
      controls[0] ||
      panel
    target.focus({ preventScroll: true })

    const onKeyDown = (event) => {
      if (stack[stack.length - 1] !== token) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = tabbables(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      stack.splice(stack.indexOf(token), 1)
      unlockScroll()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  return {
    titleId,
    panelProps: { ref: panelRef, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabIndex: -1 }
  }
}
