"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Modal, ModalButton } from '@/components/modals'
import { UserCheck } from 'lucide-react'
import * as Sentry from "@sentry/nextjs"

interface User {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  avatar_url: string | null
  department_name: string | null
  position_name: string | null
}

interface Subdivision {
  subdivision_id: string
  subdivision_name: string
  subdivision_head_id: string | null
  head_name: string | null
  head_email: string | null
  head_avatar_url: string | null
}

interface SubdivisionHeadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subdivision: Subdivision
  onSuccess: () => void
}

export default function SubdivisionHeadModal({
  open,
  onOpenChange,
  subdivision,
  onSuccess
}: SubdivisionHeadModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [search, setSearch] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Загрузка всех пользователей (руководитель подразделения может быть из любого отдела)
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("view_users")
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          avatar_url,
          department_name,
          position_name
        `)
        .order("first_name")

      if (error) {
        console.error("Ошибка при загрузке пользователей:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'SubdivisionHeadModal', action: 'load_users', error_type: 'db_error' },
          extra: { subdivision: subdivision.subdivision_name }
        })
        toast.error("Не удалось загрузить пользователей")
        return
      }

      setUsers(data || [])
    } catch (error) {
      console.error("Ошибка при загрузке пользователей:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'SubdivisionHeadModal', action: 'fetch_users', error_type: 'unexpected' },
        extra: { subdivision: subdivision.subdivision_name }
      })
      toast.error("Произошла ошибка при загрузке данных")
    } finally {
      setIsLoading(false)
    }
  }, [subdivision.subdivision_name])

  // Фильтрация пользователей по поиску
  useEffect(() => {
    if (!search.trim()) {
      setFilteredUsers(users)
      return
    }

    const filtered = users.filter(user => {
      const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase()
      const email = user.email.toLowerCase()
      const searchLower = search.toLowerCase()

      return fullName.includes(searchLower) ||
             email.includes(searchLower) ||
             (user.department_name && user.department_name.toLowerCase().includes(searchLower)) ||
             (user.position_name && user.position_name.toLowerCase().includes(searchLower))
    })

    setFilteredUsers(filtered)
  }, [users, search])

  // Загрузка данных при открытии модального окна
  useEffect(() => {
    if (open) {
      fetchUsers()
      setSearch("")
      setSelectedUser(null)
    }
  }, [open, fetchUsers])

  const handleSave = useCallback(async () => {
    if (!selectedUser) return

    try {
      setIsSaving(true)
      const supabase = createClient()

      // Назначаем нового руководителя подразделения
      const { error } = await supabase
        .from("subdivisions")
        .update({ subdivision_head_id: selectedUser.user_id })
        .eq("subdivision_id", subdivision.subdivision_id)

      if (error) {
        console.error("Ошибка при назначении руководителя:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'SubdivisionHeadModal', action: 'assign_subdivision_head', error_type: 'db_error' },
          extra: { subdivision_id: subdivision.subdivision_id, user_id: selectedUser.user_id }
        })
        toast.error("Не удалось назначить руководителя")
        return
      }

      toast.success(`${selectedUser.first_name} ${selectedUser.last_name} назначен руководителем подразделения "${subdivision.subdivision_name}"`)
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Ошибка при назначении руководителя:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'SubdivisionHeadModal', action: 'assign_subdivision_head_unexpected', error_type: 'unexpected' },
        extra: { subdivision_id: subdivision.subdivision_id, user_id: selectedUser?.user_id }
      })
      toast.error("Произошла ошибка")
    } finally {
      setIsSaving(false)
    }
  }, [selectedUser, subdivision, onSuccess, onOpenChange])

  const getUserFullName = (user: User) => {
    return `${user.first_name || ""} ${user.last_name || ""}`.trim()
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} size="xl">
      <Modal.Header
        title={`${subdivision.subdivision_head_id ? "Сменить" : "Назначить"} руководителя подразделения`}
        subtitle={
          <>
            Подразделение: <strong>{subdivision.subdivision_name}</strong>
            {subdivision.subdivision_head_id && (
              <>
                <br />
                Текущий руководитель: <strong>{subdivision.head_name}</strong>
              </>
            )}
          </>
        }
        onClose={() => onOpenChange(false)}
      />

      <Modal.Body className="flex flex-col gap-4 max-h-[60vh]">
        <Input
          placeholder="Поиск по имени, email, отделу или должности..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex-1 overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Загрузка пользователей...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {search ? "Пользователи не найдены" : "Нет доступных пользователей"}
            </div>
          ) : (
            <div className="p-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={`flex items-center gap-3 p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                    selectedUser?.user_id === user.user_id ? "bg-muted border-2 border-primary" : ""
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{getUserFullName(user)}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    {(user.position_name || user.department_name) && (
                      <div className="text-xs text-muted-foreground">
                        {user.position_name && user.department_name
                          ? `${user.position_name} • ${user.department_name}`
                          : user.position_name || user.department_name
                        }
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <ModalButton
          variant="cancel"
          onClick={() => onOpenChange(false)}
        >
          Отмена
        </ModalButton>
        <ModalButton
          variant="success"
          onClick={handleSave}
          disabled={!selectedUser}
          loading={isSaving}
          icon={<UserCheck />}
        >
          {isSaving ? 'Назначение...' : 'Назначить'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
}
