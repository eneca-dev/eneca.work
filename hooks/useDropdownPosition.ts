import { useCallback, useEffect, useRef, useState } from 'react'

export interface DropdownPosition {
  left: number
  top: number
  width: number
  openUp: boolean
}

function arePositionsEqual(a: DropdownPosition | null, b: DropdownPosition | null) {
  if (a === b) return true
  if (!a || !b) return false
  return a.left === b.left && a.top === b.top && a.width === b.width && a.openUp === b.openUp
}

export function useDropdownPosition(threshold: number = 160) {
  const [position, setPosition] = useState<DropdownPosition | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const viewportSpaceBelow = window.innerHeight - rect.bottom
    const openUp = viewportSpaceBelow < threshold && rect.top > viewportSpaceBelow
    const next: DropdownPosition = {
      left: rect.left,
      top: openUp ? rect.top : rect.bottom,
      width: rect.width,
      openUp,
    }
    setPosition((prev) => (arePositionsEqual(prev, next) ? prev : next))
  }, [threshold])

  return { position, ref, updatePosition }
}

export function useDropdownPositionEffect(show: boolean, updateFn: () => void) {
  useEffect(() => {
    if (!show) return
    updateFn()
    const handlers = [
      ['scroll', updateFn, true] as const,
      ['resize', updateFn, false] as const,
    ]
    handlers.forEach(([event, fn, capture]) => window.addEventListener(event, fn as EventListener, capture))
    return () => handlers.forEach(([event, fn, capture]) => window.removeEventListener(event, fn as EventListener, capture))
  }, [show, updateFn])
}


