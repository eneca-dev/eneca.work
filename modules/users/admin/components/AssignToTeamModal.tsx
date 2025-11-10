"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Modal, ModalButton } from '@/components/modals'
import { UserPlus, Users, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUserStore } from "@/stores/useUserStore"
import * as Sentry from "@sentry/nextjs"

interface User {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  avatar_url: string | null
  department_id: string | null
  department_name: string | null
  position_name: string | null
  team_id: string | null
}

interface Team {
  id: string
  name: string
  departmentId: string
  departmentName: string
  team_lead_id?: string | null
}

interface AssignToTeamModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: Team
  onSuccess: () => void
}

export default function AssignToTeamModal({
  open,
  onOpenChange,
  team,
  onSuccess
}: AssignToTeamModalProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [filteredAvailableUsers, setFilteredAvailableUsers] = useState<User[]>([])
  const [filteredTeamMembers, setFilteredTeamMembers] = useState<User[]>([])
  const [searchAvailable, setSearchAvailable] = useState("")
  const [searchMembers, setSearchMembers] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"assign" | "members">("assign")
  const currentUserId = useUserStore(state => state.id)

  // Загрузка доступных пользователей (без команды, с ролью user, из того же отдела)
  const fetchAvailableUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      // Получаем пользователей из того же отдела, без команды и с ролью user
      const { data, error } = await supabase
        .from("view_users")
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          avatar_url,
          department_id,
          department_name,
          position_name,
          team_id
        `)
        .eq("department_id", team.departmentId)
        .is("team_id", null)
        .order("first_name")

      if (error) {
        console.error("Ошибка при загрузке доступных пользователей:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'AssignToTeamModal', action: 'load_available_users', error_type: 'db_error' },
          extra: { team_id: team.id, department_id: team.departmentId }
        })
        toast.error("Не удалось загрузить доступных пользователей")
        return
      }

      // Фильтруем только пользователей с ролью user
      if (data) {
        const userIds = data.map(u => u.user_id)

        // Получаем роли пользователей
        const { data: userRolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select(`
            user_id,
            roles:role_id (
              name
            )
          `)
          .in("user_id", userIds)

        if (rolesError) {
          console.error("Ошибка при загрузке ролей:", rolesError)
          Sentry.captureException(rolesError, {
            tags: { module: 'users', component: 'AssignToTeamModal', action: 'load_user_roles', error_type: 'db_error' }
          })
          toast.error("Не удалось загрузить роли пользователей")
          return
        }

        // Создаём Map с ролями пользователей
        const userRolesMap = new Map<string, string[]>()
        userRolesData?.forEach((ur: any) => {
          if (!userRolesMap.has(ur.user_id)) {
            userRolesMap.set(ur.user_id, [])
          }
          userRolesMap.get(ur.user_id)?.push(ur.roles.name)
        })

        // Фильтруем только пользователей с ролью user (и не имеющих других ролей кроме user и hierarchy.is_user)
        const usersWithUserRole = data.filter(user => {
          const roles = userRolesMap.get(user.user_id) || []
          // Проверяем, что у пользователя есть роль user и нет admin, team_lead, department_head
          const hasUserRole = roles.some(role => role === 'user' || role === 'hierarchy.is_user')
          const hasOtherRoles = roles.some(role =>
            role === 'admin' ||
            role === 'team_lead' ||
            role === 'department_head' ||
            role === 'hierarchy.is_admin' ||
            role === 'hierarchy.is_team_lead' ||
            role === 'hierarchy.is_department_head'
          )
          return hasUserRole && !hasOtherRoles
        })

        setAvailableUsers(usersWithUserRole)
      }
    } catch (error) {
      console.error("Ошибка при загрузке доступных пользователей:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'AssignToTeamModal', action: 'fetch_available_users', error_type: 'unexpected' },
        extra: { team_id: team.id }
      })
      toast.error("Произошла ошибка при загрузке данных")
    } finally {
      setIsLoading(false)
    }
  }, [team.id, team.departmentId])

  // Загрузка текущих участников команды
  const fetchTeamMembers = useCallback(async () => {
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("view_users")
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          avatar_url,
          department_id,
          department_name,
          position_name,
          team_id
        `)
        .eq("team_id", team.id)
        .order("first_name")

      if (error) {
        console.error("Ошибка при загрузке участников команды:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'AssignToTeamModal', action: 'load_team_members', error_type: 'db_error' },
          extra: { team_id: team.id }
        })
        toast.error("Не удалось загрузить участников команды")
        return
      }

      setTeamMembers(data || [])
    } catch (error) {
      console.error("Ошибка при загрузке участников команды:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'AssignToTeamModal', action: 'fetch_team_members', error_type: 'unexpected' },
        extra: { team_id: team.id }
      })
      toast.error("Произошла ошибка при загрузке данных")
    }
  }, [team.id])

  // Фильтрация доступных пользователей по поиску
  useEffect(() => {
    if (!searchAvailable.trim()) {
      setFilteredAvailableUsers(availableUsers)
      return
    }

    const filtered = availableUsers.filter(user => {
      const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase()
      const email = user.email.toLowerCase()
      const searchLower = searchAvailable.toLowerCase()

      return fullName.includes(searchLower) ||
             email.includes(searchLower) ||
             (user.position_name && user.position_name.toLowerCase().includes(searchLower))
    })

    setFilteredAvailableUsers(filtered)
  }, [availableUsers, searchAvailable])

  // Фильтрация участников команды по поиску
  useEffect(() => {
    if (!searchMembers.trim()) {
      setFilteredTeamMembers(teamMembers)
      return
    }

    const filtered = teamMembers.filter(user => {
      const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase()
      const email = user.email.toLowerCase()
      const searchLower = searchMembers.toLowerCase()

      return fullName.includes(searchLower) ||
             email.includes(searchLower) ||
             (user.position_name && user.position_name.toLowerCase().includes(searchLower))
    })

    setFilteredTeamMembers(filtered)
  }, [teamMembers, searchMembers])

  // Загрузка данных при открытии модального окна
  useEffect(() => {
    if (open) {
      fetchAvailableUsers()
      fetchTeamMembers()
      setSearchAvailable("")
      setSearchMembers("")
      setSelectedUser(null)
      setActiveTab("assign")
    }
  }, [open, fetchAvailableUsers, fetchTeamMembers])

  const handleAssign = useCallback(async () => {
    if (!selectedUser) return

    try {
      setIsSaving(true)
      const supabase = createClient()

      // Проверяем, что пользователь не назначен в другую команду и в правильном отделе
      if (selectedUser.team_id !== null) {
        toast.error("Сотрудник уже назначен в другую команду")
        return
      }

      if (selectedUser.department_id !== team.departmentId) {
        toast.error("Сотрудник должен быть в отделе команды")
        return
      }

      // Назначаем пользователя в команду
      const { error } = await supabase
        .from("profiles")
        .update({ team_id: team.id })
        .eq("user_id", selectedUser.user_id)

      if (error) {
        console.error("Ошибка при назначении в команду:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'AssignToTeamModal', action: 'assign_to_team', error_type: 'db_error' },
          extra: { team_id: team.id, user_id: selectedUser.user_id }
        })
        toast.error("Не удалось назначить сотрудника в команду")
        return
      }

      toast.success(`${selectedUser.first_name} ${selectedUser.last_name} назначен(а) в команду "${team.name}"`)

      // Обновляем списки
      await fetchAvailableUsers()
      await fetchTeamMembers()
      setSelectedUser(null)
      onSuccess()
    } catch (error) {
      console.error("Ошибка при назначении в команду:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'AssignToTeamModal', action: 'assign_to_team_unexpected', error_type: 'unexpected' },
        extra: { team_id: team.id, user_id: selectedUser?.user_id }
      })
      toast.error("Произошла ошибка")
    } finally {
      setIsSaving(false)
    }
  }, [selectedUser, team, fetchAvailableUsers, fetchTeamMembers, onSuccess])

  const handleRemoveFromTeam = useCallback(async (user: User) => {
    try {
      const supabase = createClient()

      // Убираем пользователя из команды
      const { error } = await supabase
        .from("profiles")
        .update({ team_id: null })
        .eq("user_id", user.user_id)

      if (error) {
        console.error("Ошибка при удалении из команды:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'AssignToTeamModal', action: 'remove_from_team', error_type: 'db_error' },
          extra: { team_id: team.id, user_id: user.user_id }
        })
        toast.error("Не удалось удалить сотрудника из команды")
        return
      }

      toast.success(`${user.first_name} ${user.last_name} удалён(а) из команды "${team.name}"`)

      // Обновляем списки
      await fetchAvailableUsers()
      await fetchTeamMembers()
      onSuccess()
    } catch (error) {
      console.error("Ошибка при удалении из команды:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'AssignToTeamModal', action: 'remove_from_team_unexpected', error_type: 'unexpected' },
        extra: { team_id: team.id, user_id: user.user_id }
      })
      toast.error("Произошла ошибка")
    }
  }, [team, fetchAvailableUsers, fetchTeamMembers, onSuccess])

  const getUserFullName = (user: User) => {
    return `${user.first_name || ""} ${user.last_name || ""}`.trim()
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} size="xl">
      <Modal.Header
        title="Управление составом команды"
        subtitle={
          <>
            Отдел: <strong>{team.departmentName}</strong>
            <br />
            Команда: <strong>{team.name}</strong>
          </>
        }
      />

      <Modal.Body className="flex flex-col gap-4 flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "assign" | "members")} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assign">
              <UserPlus className="h-4 w-4 mr-2" />
              Назначить в команду
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-2" />
              Участники команды ({teamMembers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assign" className="flex-1 flex flex-col gap-4 mt-4">
            <Input
              placeholder="Поиск по имени, email или должности..."
              value={searchAvailable}
              onChange={(e) => setSearchAvailable(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto border rounded-md">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Загрузка пользователей...
                </div>
              ) : filteredAvailableUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchAvailable
                    ? "Пользователи не найдены"
                    : "Нет доступных сотрудников для назначения.\nСотрудники должны быть в отделе команды, иметь роль \"user\" и не состоять в другой команде."
                  }
                </div>
              ) : (
                <div className="p-2">
                  {filteredAvailableUsers.map((user) => (
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
                        {user.position_name && (
                          <div className="text-xs text-muted-foreground">
                            {user.position_name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <ModalButton
                variant="cancel"
                onClick={() => onOpenChange(false)}
              >
                Закрыть
              </ModalButton>
              <ModalButton
                variant="success"
                onClick={handleAssign}
                disabled={!selectedUser}
                loading={isSaving}
                icon={<UserPlus />}
              >
                {isSaving ? 'Назначение...' : 'Назначить'}
              </ModalButton>
            </div>
          </TabsContent>

          <TabsContent value="members" className="flex-1 flex flex-col gap-4 mt-4">
            <Input
              placeholder="Поиск по имени, email или должности..."
              value={searchMembers}
              onChange={(e) => setSearchMembers(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto border rounded-md">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Загрузка участников...
                </div>
              ) : filteredTeamMembers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchMembers ? "Участники не найдены" : "В команде пока нет участников"}
                </div>
              ) : (
                <div className="p-2">
                  {filteredTeamMembers.map((user) => {
                    // Проверяем, является ли пользователь тимлидом команды или текущим пользователем
                    const isTeamLead = team.team_lead_id === user.user_id
                    const isCurrentUser = currentUserId === user.user_id
                    const canRemove = !isTeamLead && !isCurrentUser

                    return (
                      <div
                        key={user.user_id}
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">
                            {getUserFullName(user)}
                            {isTeamLead && (
                              <span className="ml-2 text-xs text-muted-foreground">(Руководитель)</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          {user.position_name && (
                            <div className="text-xs text-muted-foreground">
                              {user.position_name}
                            </div>
                          )}
                        </div>
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromTeam(user)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <ModalButton
                variant="cancel"
                onClick={() => onOpenChange(false)}
              >
                Закрыть
              </ModalButton>
            </div>
          </TabsContent>
        </Tabs>
      </Modal.Body>
    </Modal>
  )
}
