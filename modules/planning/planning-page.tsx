"use client"

import { useEffect } from "react"
import { TimelineView } from "./components/timeline-view"
import { useUserStore } from "@/stores/useUserStore"

export default function PlanningPage() {
  // Initialize permissions for testing
  // УДАЛЕНО: Legacy permissions и setRoleAndPermissions

  // УДАЛЕНО: Legacy инициализация permissions

  return <TimelineView />
}
