"use client"

import { useState, useEffect } from "react"
import { TimelineView } from "./components/timeline-view"
import { PlanningGuide } from "./components/PlanningGuide"
import PlanningTopFilters from './components/PlanningTopFilters'

export default function PlanningPage() {
  const [showGuide, setShowGuide] = useState(false)

  // Слушаем событие для показа руководства
  useEffect(() => {
    const handleShowGuide = () => {
      setShowGuide(true)
    }

    window.addEventListener('showPlanningGuide', handleShowGuide)
    return () => window.removeEventListener('showPlanningGuide', handleShowGuide)
  }, [])

  if (showGuide) {
    return <PlanningGuide onClose={() => setShowGuide(false)} />
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PlanningTopFilters />
      <div className="flex-1 overflow-hidden">
        <TimelineView />
      </div>
    </div>
  )
}
