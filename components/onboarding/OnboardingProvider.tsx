"use client"

import { useEffect } from "react"
import { useOnboardingStore } from "@/stores/useOnboardingStore"
import { OnboardingModal } from "./OnboardingModal"

/**
 * Монтируется в dashboard layout.
 * При первом входе в v2 автоматически открывает обучающую модалку.
 */
export function OnboardingProvider() {
  const { hasSeenV2Tutorial, open } = useOnboardingStore()

  useEffect(() => {
    if (!hasSeenV2Tutorial) {
      // Небольшая задержка, чтобы layout успел отрисоваться
      const timer = setTimeout(open, 800)
      return () => clearTimeout(timer)
    }
  }, [hasSeenV2Tutorial, open])

  return <OnboardingModal />
}
