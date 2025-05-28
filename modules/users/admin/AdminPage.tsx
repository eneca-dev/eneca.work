"use client"

import { useEffect, useState } from "react"
import AdminPanel from "@/modules/users/admin/AdminPanel"
import { useUserStore } from "@/stores/useUserStore"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAdminPermissions } from "./hooks/useAdminPermissions"

export default function AdminPage() {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const permissions = useUserStore((state) => state.permissions)
  const { canViewAdminPanel } = useAdminPermissions()
  const router = useRouter()

  useEffect(() => {
    // Wait for permissions to be loaded before checking access
    if (permissions !== null) {
      setIsAuthorized(canViewAdminPanel)
      setIsChecking(false)
    }
  }, [permissions, canViewAdminPanel])

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
