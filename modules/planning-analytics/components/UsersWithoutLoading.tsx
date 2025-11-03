"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"

interface UserWithoutLoading {
  first_name: string
  last_name: string
  category_name?: string
}

interface DepartmentWithUsers {
  department_name: string
  users: UserWithoutLoading[]
}

interface UsersWithoutLoadingProps {
  data: DepartmentWithUsers[]
  isLoading: boolean
}

export function UsersWithoutLoading({ data, isLoading }: UsersWithoutLoadingProps) {
  if (isLoading) {
    return (
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded animate-pulse w-64" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded animate-pulse w-32" />
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-6 bg-gray-200 dark:bg-slate-800 rounded animate-pulse w-24" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Подсчитываем общее количество пользователей без загрузки
  const totalUsersWithoutLoading = data.reduce((sum, dept) => sum + dept.users.length, 0)

  // Если нет пользователей без загрузки
  if (totalUsersWithoutLoading === 0) {
    return (
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground dark:text-white">
            <Users className="h-5 w-5" />
            Пользователи без загрузки на сегодня
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <span className="text-sm">✅ Все пользователи имеют загрузку</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground dark:text-white">
          <Users className="h-5 w-5" />
          Пользователи без загрузки на сегодня
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({totalUsersWithoutLoading})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((department) => (
            <div key={department.department_name} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {department.department_name}
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  ({department.users.length})
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {department.users.map((user, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs px-2.5 py-0.5 flex items-center gap-1.5"
                  >
                    <span>{user.last_name} {user.first_name}</span>
                    {user.category_name && (
                      <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                        ({user.category_name})
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
