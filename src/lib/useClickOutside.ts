import { useEffect, useRef } from 'react'

/**
 * Dismiss-on-outside-interaction for dropdowns and popovers: calls
 * `onDismiss` on a pointerdown outside the returned ref, or on Escape.
 * Listeners only exist while `active` is true, so an idle menu costs nothing.
 */
export function useClickOutside<T extends HTMLElement>(onDismiss: () => void, active: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, onDismiss])

  return ref
}
