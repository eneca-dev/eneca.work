"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useUserStore } from "@/stores/useUserStore"
import { useRouter } from "next/navigation"

interface AdminAccessCheckProps {
  children: React.ReactNode
  redirectOnFailure?: boolean
}

export function AdminAccessCheck({ 
  children, 
  redirectOnFailure = false 
}: AdminAccessCheckProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const permissions = useUserStore((state) => state.permissions)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = () => {
      try {
        // If permissions haven't been loaded yet, wait
        if (!permissions || permissions.length === 0) {
          // Check if user is authenticated to determine if we should wait for permissions
          if (isAuthenticated) {
            // User is authenticated but permissions not loaded yet, keep loading
            return
          }
        }
        
        // Check for user_admin_panel_can_view permission with safe access
        const canViewAdminPanel = permissions?.includes("user_admin_panel_can_view") ?? false
        
        setHasAccess(canViewAdminPanel)
        
        // If no access and need to redirect, return to user list
        if (!canViewAdminPanel && redirectOnFailure) {
          router.push("/dashboard/users")
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error("Error checking admin panel access:", error)
        setHasAccess(false)
        if (redirectOnFailure) {
          router.push("/dashboard/users")
        }
        setIsLoading(false)
      }
    }

    // Wait for permissions to be loaded before checking access
    if (permissions !== null) {
      checkAccess()
    }
  }, [permissions, isAuthenticated, redirectOnFailure, router])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3">Checking access...</span>
        </CardContent>
      </Card>
    )
  }

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You don't have permission to access the admin panel. Please contact your system administrator for access.
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
} 