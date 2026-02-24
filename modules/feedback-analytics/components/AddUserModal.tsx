"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, UserPlus, UserMinus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface User {
  user_id: string
  first_name: string
  last_name: string
  email: string
  hasAccess: boolean
}

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddUserModal({ open, onClose, onSuccess }: AddUserModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { toast } = useToast()
  const requestIdRef = useRef(0)
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Загружаем список пользователей с поддержкой отмены запроса
  const loadUsers = useCallback(async (q: string) => {
    const currentId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const url = q && q.length > 0
        ? `/api/feedback-analytics/users?q=${encodeURIComponent(q)}`
        : '/api/feedback-analytics/users'

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (requestIdRef.current !== currentId) return

      if (!response.ok) throw new Error('Ошибка загрузки пользователей')

      const { users: fetchedUsers } = await response.json()

      if (requestIdRef.current !== currentId) return
      setUsers(fetchedUsers)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Error loading users:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список пользователей",
        variant: "destructive",
      })
    } finally {
      // Всегда завершаем загрузку, даже если запрос устарел, чтобы не зависал спиннер
      setIsLoading(false)
    }
  }, [toast])

  // Загружаем список пользователей при открытии модального окна и при изменении debouncedQuery
  useEffect(() => {
    if (open) {
      loadUsers(debouncedQuery)
    }
  }, [open, debouncedQuery, loadUsers])

  // Фильтрация пользователей по поиску
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users

    const query = searchQuery.toLowerCase()
    return users.filter(user => {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
      const email = user.email.toLowerCase()
      return fullName.includes(query) || email.includes(query)
    })
  }, [users, searchQuery])

  // Добавить доступ пользователю
  const handleAddAccess = async (userId: string) => {
    setActionLoading(userId)
    try {
      const response = await fetch('/api/feedback-analytics/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        let errorMessage = 'Ошибка добавления доступа'
        try {
          const { error } = await response.json()
          errorMessage = error || errorMessage
        } catch {
          // Response body is not JSON, use default message
        }
        throw new Error(errorMessage)
      }
      toast({
        title: "Успешно",
        description: "Доступ к аналитике предоставлен",
      })

      // Optimistic update
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, hasAccess: true } : u))
      // Фоновое обновление
      void loadUsers(debouncedQuery)
      onSuccess?.()
    } catch (error) {
      console.error('Error granting access:', error)
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }
  // Удалить доступ пользователю
  const handleRemoveAccess = async (userId: string) => {
    setActionLoading(userId)
    try {
      const response = await fetch(`/api/feedback-analytics/users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        let errorMessage = 'Ошибка удаления доступа'
        try {
          const { error } = await response.json()
          errorMessage = error || errorMessage
        } catch {
          // Response body is not JSON, use default message
        }
        throw new Error(errorMessage)
      }
      toast({
        title: "Успешно",
        description: "Доступ к аналитике отозван",
      })

      // Optimistic update
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, hasAccess: false } : u))
      // Фоновое обновление
      void loadUsers(debouncedQuery)
      onSuccess?.()
    } catch (error) {
      console.error('Error revoking access:', error)
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-labelledby="add-users-title" aria-describedby={undefined} className="sm:max-w-2xl rounded-sm max-h-[80vh] flex flex-col bg-popover border-border">
        {/* Визуально скрытый заголовок для Radix a11y-валидности */}
        <DialogTitle className="sr-only">Управление доступом к аналитике</DialogTitle>
        <DialogHeader>
          <DialogTitle id="add-users-title">Управление доступом к аналитике</DialogTitle>
        </DialogHeader>

        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-sm bg-popover border-border"
          />
        </div>

        {/* Список пользователей */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "Пользователи не найдены" : "Нет пользователей"}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-3 border rounded-sm hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  {user.hasAccess && (
                    <Badge variant="default" className="text-xs">
                      Имеет доступ
                    </Badge>
                  )}
                  {user.hasAccess ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveAccess(user.user_id)}
                      disabled={actionLoading === user.user_id}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAddAccess(user.user_id)}
                      disabled={actionLoading === user.user_id}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
