"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUserStore } from "@/stores/useUserStore"

export function ProfileDebug() {
  const [refreshCounter, setRefreshCounter] = useState(0)
  const userState = useUserStore()
  const { role, permissions } = userState
  
  useEffect(() => {
    console.log("ProfileDebug компонент смонтирован с состоянием:", userState)
  }, [userState, refreshCounter])
  
  const handleRefresh = () => {
    // Обновляем счетчик для повторного запуска useEffect
    setRefreshCounter(prev => prev + 1)
    console.log("Текущее состояние профиля:", userState.profile)
  }
  
  return (
    <Card className="w-full bg-white dark:bg-gray-800 shadow-md">
      <CardHeader className="bg-primary/5">
        <CardTitle className="text-xl font-bold">Отладка профиля пользователя</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Проверка состояния профиля:</h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="font-medium text-gray-500 dark:text-gray-400">
                    Профиль равен null: {userState.profile === null ? "Да" : "Нет"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 dark:text-gray-400">
                    Профиль равен undefined: {userState.profile === undefined ? "Да" : "Нет"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 dark:text-gray-400">
                    typeof Profile: {typeof userState.profile}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 dark:text-gray-400">
                    Object.keys(profile).length: {userState.profile ? Object.keys(userState.profile).length : "N/A"}
                  </p>
                </div>
              </div>
              
              <div className="pt-2 border-t dark:border-gray-700">
                <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">Содержимое профиля:</p>
                <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                  {JSON.stringify(userState.profile, null, 2)}
                </pre>
              </div>
              
              <Button onClick={handleRefresh} className="mt-4">
                Обновить информацию
              </Button>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Роль и разрешения пользователя</h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Роль:</span> {role || "—"}
              </div>
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Разрешения:</span>
                {permissions && permissions.length > 0 ? (
                  <ul className="list-disc list-inside ml-4">
                    {permissions.map((perm) => (
                      <li key={perm}>{perm}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="ml-2">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 