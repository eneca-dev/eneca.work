"use client"

import { useCallback, useMemo, useRef, useState } from "react"

// Универсальный хук hover-состояния с поддержкой порталов/абсолютно позиционированных элементов
// Использует pointer-события и геометрию элемента, чтобы не снимать hover,
// если указатель фактически остаётся внутри его прямоугольника.
export function useHoverWithPortalSupport<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const onPointerEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const onPointerLeave = useCallback((e: React.PointerEvent) => {
    const element = ref.current
    if (!element) {
      setIsHovered(false)
      return
    }
    const rect = element.getBoundingClientRect()
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom
    if (!inside) setIsHovered(false)
  }, [])

  const handlers = useMemo(() => ({ onPointerEnter, onPointerLeave }), [onPointerEnter, onPointerLeave])

  return { ref, isHovered, handlers }
}


