import { useEffect } from 'react'

const SITE = 'MERN Store'
export const DEFAULT_TITLE = `${SITE} · Oracle AI Database 26ai`

/**
 * Sets the tab title for the current page ("Shop · MERN Store") and restores
 * the previous one on unmount, so screen-reader users and browser history see
 * where they are. Pass a falsy title while data is loading to keep the default.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${SITE}` : DEFAULT_TITLE
    return () => {
      document.title = previous
    }
  }, [title])
}
