"use client"

import { useEffect, useState } from "react"
import AdminPanel from "./AdminPanel"
import { useUserStore } from "@/stores/useUserStore"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const permissions = useUserStore((state) => state.permissions)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = () => {
      try {
        const canViewAdminPanel = permissions?.includes("can_view_user_admin_panel") ?? false
        setIsAuthorized(canViewAdminPanel)
      } catch (error) {
        console.error("Error checking access:", error)
        setIsAuthorized(false)
      } finally {
        setIsChecking(false)
      }
    }

    // Wait for permissions to be loaded before checking access
    if (permissions !== null) {
      checkAccess()
    }
  }, [permissions])

  useEffect(() => {
    if (!isChecking && !isAuthorized) {
      router.push("/dashboard")
    }
  }, [isChecking, isAuthorized, router])

  if (isChecking) {
    return <div>Loading...</div> // Or a proper loading component
  }

  if (!isAuthorized) {
    return null
  }

  return <AdminPanel />
} 