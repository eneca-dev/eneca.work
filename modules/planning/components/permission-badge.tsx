"use client"

import { cn } from "@/lib/utils"
import { Shield, ShieldCheck, Crown, Info } from "lucide-react"
import { useState } from "react"

interface PermissionBadgeProps {
  theme: string
  userRole?: "admin" | "manager" | "user" | null
  className?: string
  debugInfo?: {
    reason: string
    permissions?: string[]
    userId?: string
    source?: string
  }
  showDebug?: boolean
}

export function PermissionBadge({ 
  theme, 
  userRole = "user", 
  className, 
  debugInfo,
  showDebug = true 
}: PermissionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const getRoleConfig = () => {
    switch (userRole) {
      case "admin":
        return {
          icon: Crown,
          label: "Администратор",
          bgColor: theme === "dark" ? "bg-amber-900/20" : "bg-amber-50",
          borderColor: theme === "dark" ? "border-amber-700" : "border-amber-200",
          textColor: theme === "dark" ? "text-amber-400" : "text-amber-700",
          iconColor: theme === "dark" ? "text-amber-400" : "text-amber-600"
        }
      case "manager":
        return {
          icon: ShieldCheck,
          label: "Менеджер",
          bgColor: theme === "dark" ? "bg-blue-900/20" : "bg-blue-50",
          borderColor: theme === "dark" ? "border-blue-700" : "border-blue-200",
          textColor: theme === "dark" ? "text-blue-400" : "text-blue-700",
          iconColor: theme === "dark" ? "text-blue-400" : "text-blue-600"
        }
      default:
        return {
          icon: Shield,
          label: "Пользователь",
          bgColor: theme === "dark" ? "bg-slate-800/50" : "bg-slate-50",
          borderColor: theme === "dark" ? "border-slate-600" : "border-slate-300",
          textColor: theme === "dark" ? "text-slate-400" : "text-slate-600",
          iconColor: theme === "dark" ? "text-slate-500" : "text-slate-500"
        }
    }
  }

  const config = getRoleConfig()
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
          config.bgColor,
          config.borderColor,
          config.textColor,
          className
        )}
      >
        <Icon size={12} className={config.iconColor} />
        <span>{config.label}</span>
      </div>

      {/* Отладочная информация */}
      {showDebug && debugInfo && (
        <div className="relative">
          <button
            className={cn(
              "p-1 rounded-full border text-xs hover:bg-opacity-80 transition-colors",
              theme === "dark" 
                ? "bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600" 
                : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200"
            )}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            title="Отладочная информация"
          >
            <Info size={10} />
          </button>

          {/* Tooltip с отладочной информацией */}
          {showTooltip && (
            <div
              className={cn(
                "absolute left-0 top-8 z-50 p-3 rounded-lg border shadow-lg min-w-[280px] text-xs",
                theme === "dark"
                  ? "bg-slate-800 border-slate-600 text-slate-200"
                  : "bg-white border-slate-300 text-slate-700"
              )}
            >
              <div className="space-y-2">
                <div className="font-medium text-teal-500">Отладочная информация:</div>
                
                <div>
                  <span className="font-medium">Роль:</span> {userRole || "не определена"}
                </div>
                
                <div>
                  <span className="font-medium">Причина:</span> {debugInfo.reason}
                </div>

                {debugInfo.userId && (
                  <div>
                    <span className="font-medium">ID пользователя:</span> {debugInfo.userId}
                  </div>
                )}

                {debugInfo.source && (
                  <div>
                    <span className="font-medium">Источник:</span> {debugInfo.source}
                  </div>
                )}

                {debugInfo.permissions && debugInfo.permissions.length > 0 && (
                  <div>
                    <span className="font-medium">Разрешения:</span>
                    <ul className="mt-1 ml-2 space-y-1">
                      {debugInfo.permissions.map((permission, index) => (
                        <li key={index} className="text-xs">• {permission}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 