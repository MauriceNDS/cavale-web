import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Measured CSS width of a container, so SVG charts can build their viewBox
 * at a 1:1 scale with screen pixels. A fixed-width viewBox scaled down by
 * CSS renders 10px tick text at ~6px on a phone; measuring keeps text and
 * strokes at their designed size on every device.
 */
export function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth || fallback)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [fallback])

  return { ref, width }
}
