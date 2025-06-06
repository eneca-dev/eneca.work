"use client"

import { useEffect } from "react"
import { TimelineView } from "./components/timeline-view"
import { useUserStore } from "@/stores/useUserStore"

export default function PlanningPage() {
  // Initialize permissions for testing
  const setRoleAndPermissions = useUserStore((state) => state.setRoleAndPermissions)
  const permissions = useUserStore((state) => state.permissions)

  useEffect(() => {
    // Only set permissions if they don't already exist
    if (!permissions.includes("project.view")) {
      setRoleAndPermissions("user", ["project.view", "project.manage"])
    }
  }, [permissions, setRoleAndPermissions])

  return <TimelineView />
}
