"use client"
import { useEffect, useMemo, useState } from "react"
import { ShieldAlert, RefreshCw, X, Bug } from "lucide-react"
import { useUserPermissionsSync } from "@/modules/permissions"
import { usePermissionsStore } from "@/modules/permissions/store/usePermissionsStore"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"



// Глобальный дебаг-виджет разрешений: плавающая иконка + закрепляемая панель
export default function GlobalPermissionsDebug() {
  // Состояние открытости панели должно переживать навигацию
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("global-permissions-debug-open")
      return saved === "1"
    } catch {
      return false
    }
  })

  const { isLoading, error, hasPermissions, reloadPermissions } = useUserPermissionsSync()
  const { permissions, lastUpdated } = usePermissionsStore()
  
  // Вычисляем текущую роль из permissions стора (тот же приоритет, что в debug/page.tsx)
  const computeRole = (perms: string[]) => {
    const set = new Set(perms)
    if (set.has('hierarchy.is_admin')) return 'admin'
    if (set.has('hierarchy.is_department_head')) return 'department_head'
    if (set.has('hierarchy.is_team_lead')) return 'team_lead'
    if (set.has('hierarchy.is_user')) return 'user'
    return 'none'
  }
  const role = useMemo(() => computeRole(permissions), [permissions])

  useEffect(() => {
    try {
      localStorage.setItem("global-permissions-debug-open", open ? "1" : "0")
    } catch {}
  }, [open])

  const status = useMemo(() => {
    if (isLoading) return { text: "Загрузка...", color: "text-blue-600" }
    if (error) return { text: "Ошибка", color: "text-red-600" }
    if (hasPermissions) return { text: "OK", color: "text-green-600" }
    return { text: "Нет данных", color: "text-yellow-600" }
  }, [isLoading, error, hasPermissions])

  return (
    <div className="pointer-events-none">
      {/* Плавающая кнопка в правом нижнем углу */}
      <button
        aria-label="Permissions Debug"
        title="Permissions Debug"
        onClick={() => setOpen(!open)}
        className="pointer-events-auto fixed z-[1000] bottom-4 right-4 h-10 w-10 rounded-full shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:shadow-lg transition"
      >
        <Bug className="h-5 w-5 text-gray-700 dark:text-gray-200" />
      </button>

      {/* Закрепляемая панель справа, не закрывается при навигации */}
      {open && (
        <div className="pointer-events-auto fixed z-[1000] bottom-20 right-4 w-[360px] max-h-[70vh]">
          <Card className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <span className={`text-sm font-medium ${status.color}`}>Permissions Debug — {status.text}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={reloadPermissions} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-xs mb-3 p-2 rounded border border-red-200 bg-red-50 text-red-700">
                {String(error)}
              </div>
            )}

            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
            <div className="flex items-center justify-between">
                <span>Роль</span>
                <span className="font-mono">{role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Всего разрешений</span>
                <span className="font-mono">{permissions.length}</span>  
              </div>
              <div className="flex items-center justify-between">
                <span>Обновлено</span>
                <span className="font-mono">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 max-h-[40vh] overflow-auto text-xs">
              {permissions.length > 0 ? (
                <ul className="space-y-1">
                  {permissions.map((perm, idx) => (
                    <li key={idx} className="font-mono text-gray-700 dark:text-gray-200 break-all">
                      {perm}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-400">Нет разрешений</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}


