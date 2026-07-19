import { useCallback, useRef, type KeyboardEvent } from 'react'

/**
 * Keyboard support for a custom radiogroup rendered as buttons.
 *
 * ARIA radiogroups expect a single tab stop (roving tabindex) and arrow-key
 * navigation that moves focus AND selection between options. Spread the props
 * returned by the getter onto each `role="radio"` button:
 *
 *   const radioProps = useRovingRadioGroup(options.length, selectedIndex, select)
 *   <button role="radio" aria-checked={i === selectedIndex} {...radioProps(i)} … />
 *
 * ArrowRight/ArrowDown move to the next option, ArrowLeft/ArrowUp to the
 * previous, wrapping around — matching native radio behaviour.
 */
export function useRovingRadioGroup(
  count: number,
  selectedIndex: number,
  select: (index: number) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // With nothing selected the first option holds the tab stop so the group
  // stays reachable by keyboard.
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      let next: number
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (index + 1) % count
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (index - 1 + count) % count
          break
        default:
          return
      }
      event.preventDefault()
      select(next)
      refs.current[next]?.focus()
    },
    [count, select],
  )

  return (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el
    },
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, index),
  })
}
