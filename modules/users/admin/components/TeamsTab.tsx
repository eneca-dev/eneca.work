"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Edit2 } from "lucide-react"
import EntityModal from "./EntityModal"
import DeleteConfirmModal from "./DeleteConfirmModal"
import TeamHeadModal from "./TeamHeadModal"
import RemoveHeadConfirmModal from "./RemoveHeadConfirmModal"
import AssignToTeamModal from "./AssignToTeamModal"
import LoadingState from "./LoadingState"
import EmptyState from "./EmptyState"
import { toast } from "sonner"
import { useAdminPermissions } from "../hooks/useAdminPermissions"
import { useUserStore } from "@/stores/useUserStore"
import * as Sentry from "@sentry/nextjs"

// Типы для сущностей
interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string | null;
  team_lead_id: string | null;
  headFirstName: string | null;
  headLastName: string | null;
  headFullName: string | null;
  headEmail: string | null;
  headAvatarUrl: string | null;
}

// Пропсы для ограничения видимости данных
type TeamsTabProps =
  | { scope?: 'all' }
  | { scope: 'department'; departmentId: string }
  | { scope: 'subdivision'; subdivisionId: string }

export default function TeamsTab(props: TeamsTabProps) {
  const scope = props.scope ?? 'all'
  const departmentId = 'departmentId' in props ? props.departmentId : null
  const subdivisionId = 'subdivisionId' in props ? props.subdivisionId : null
  const [teams, setTeams] = useState<Team[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [activeDept, setActiveDept] = useState<string | null>(scope === 'department' ? departmentId : null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [removeHeadModalOpen, setRemoveHeadModalOpen] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const perms = useAdminPermissions()
  const currentUserId = useUserStore(state => state.id)

  // Определяем, должны ли быть видны элементы управления
  const canManageAllTeams = perms.canManageTeams
  const canEditSubdivision = perms.canEditSubdivision
  const canEditDepartment = perms.canEditDepartment
  const canEditTeams = perms.canEditTeam
  const canDeleteTeam = perms.canDeleteTeam
  const canManageTeamLead = perms.canManageTeamLead
  const isTeamScoped = scope === 'department'
  const showManagementControls = (canManageAllTeams && !isTeamScoped) || (canEditSubdivision && scope === 'subdivision')
  // Создавать команды могут: admin (manage.teams), subdivision_head (edit.subdivision) и department_head (edit.department)
  const canCreateTeam = canManageAllTeams || canEditSubdivision || canEditDepartment
  // Редактировать команды могут: admin, subdivision_head, department_head и team_lead (edit.team)
  const canModifyTeams = canManageAllTeams || canEditSubdivision || canEditDepartment || canEditTeams
  // Удалять команды могут: только те, у кого есть разрешение delete.team (admin и department_head)
  const canDelete = canDeleteTeam
  // Управлять руководителями команд могут: только те, у кого есть разрешение manage.team_lead (admin и department_head)
  const canManageHead = canManageTeamLead

  // Проверяет, может ли текущий пользователь управлять данной командой
  const canManageTeam = useCallback((team: Team) => {
    // Admin может управлять всеми командами
    if (canManageAllTeams || canEditSubdivision || canEditDepartment) {
      return true
    }

    // Team_lead может управлять только своей командой
    if (canEditTeams && currentUserId && team.team_lead_id === currentUserId) {
      return true
    }

    return false
  }, [canManageAllTeams, canEditSubdivision, canEditDepartment, canEditTeams, currentUserId])

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Получаем команды с руководителями из view_teams_with_leads
      const { data: teamsData, error: teamsError } = await supabase
        .from("view_teams_with_leads")
        .select(`
          team_id,
          team_name,
          department_id,
          department_name,
          team_lead_id,
          team_lead_first_name,
          team_lead_last_name,
          team_lead_full_name,
          team_lead_email,
          team_lead_avatar_url
        `)
        .order("team_name")
      
      if (teamsError) {
        console.error('Ошибка при загрузке команд:', teamsError)
        Sentry.captureException(teamsError, { tags: { module: 'users', component: 'TeamsTab', action: 'load_teams', error_type: 'db_error' } })
        toast.error('Не удалось загрузить команды')
        return
      }
      
      // Получаем отделы
      const { data: deptsData, error: deptsError } = await supabase
        .from("departments")
        .select("department_id, department_name, subdivision_id")
      
      if (deptsError) {
        console.error('Ошибка при загрузке отделов:', deptsError)
        Sentry.captureException(deptsError, { tags: { module: 'users', component: 'TeamsTab', action: 'load_departments', error_type: 'db_error' } })
        toast.error('Не удалось загрузить отделы')
        return
      }
      
      // Дедупликация команд по team_id
      const uniqueTeamsMap = new Map()
      teamsData?.forEach(team => {
        if (!uniqueTeamsMap.has(team.team_id)) {
          uniqueTeamsMap.set(team.team_id, {
            id: team.team_id,
            name: team.team_name,
            departmentId: team.department_id,
            departmentName: team.department_name || null,
            team_lead_id: team.team_lead_id,
            headFirstName: team.team_lead_first_name,
            headLastName: team.team_lead_last_name,
            headFullName: team.team_lead_full_name,
            headEmail: team.team_lead_email,
            headAvatarUrl: team.team_lead_avatar_url
          })
        }
      })
      
      // Устанавливаем данные команд с учетом скоупа
      const preparedTeams = Array.from(uniqueTeamsMap.values())
      let scopedTeams = preparedTeams
      if (scope === 'department') {
        scopedTeams = preparedTeams.filter(t => t.departmentId === departmentId!)
      } else if (scope === 'subdivision') {
        // Для subdivision нужно фильтровать по отделам, которые принадлежат подразделению
        // Сначала получаем список отделов подразделения
        const subdivisionDeptIds = deptsData
          ?.filter((d: any) => d.subdivision_id === subdivisionId)
          .map((d: any) => d.department_id) || []
        scopedTeams = preparedTeams.filter(t => t.departmentId && subdivisionDeptIds.includes(t.departmentId))
      }
      setTeams(scopedTeams)

      // Устанавливаем данные отделов с учетом скоупа
      const allDepartments = deptsData ? deptsData.map(dep => ({ id: dep.department_id, name: dep.department_name })) : []
      let scopedDepartments = allDepartments
      if (scope === 'department') {
        scopedDepartments = allDepartments.filter(d => d.id === departmentId!)
      } else if (scope === 'subdivision') {
        scopedDepartments = deptsData
          ?.filter((d: any) => d.subdivision_id === subdivisionId)
          .map((d: any) => ({ id: d.department_id, name: d.department_name })) || []
      }
      setDepartments(scopedDepartments)
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error)
      Sentry.captureException(error, { tags: { module: 'users', component: 'TeamsTab', action: 'fetch_data', error_type: 'unexpected' } })
      toast.error('Произошла ошибка при загрузке данных')
    } finally {
      setIsLoading(false)
    }
  }, [scope, departmentId, subdivisionId])

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Мемоизируем фильтрованные команды
  const filtered = useMemo(() => {
    return teams.filter(team => {
      // Фильтрация по отделу
      // activeDept === null: "Все отделы" - показываем все команды
      // activeDept === deptId: показываем команды конкретного отдела
      const matchesDept = activeDept === null || team.departmentId === activeDept
      const matchesSearch = typeof team.name === "string" && team.name.toLowerCase().includes(search.toLowerCase())
      return matchesDept && matchesSearch
    })
  }, [teams, activeDept, search, scope, departmentId])

  // Мемоизируем функцию получения имени отдела
  const getDepartmentName = useCallback((id: string) => {
    return departments.find(dep => dep.id === id)?.name || "-"
  }, [departments])

  // Мемоизируем extraFields для EntityModal
  const extraFields = useMemo(() => {
    // Фильтруем департаменты, исключая "Не назначен"
    const departmentOptions = departments
      .filter(dep => dep.name !== "Не назначен")
      .map(dep => ({ value: dep.id, label: dep.name }))

    return [
      {
        name: "department_id",
        label: "Отдел",
        type: "select" as const,
        options: departmentOptions,
        required: true // Отдел обязателен для команды
      }
    ]
  }, [departments])

  // Скоуп-версия extraFields (перенесено из JSX, чтобы не нарушать порядок хуков)
  const scopedExtraFields = useMemo(() => {
    // Для team_lead (edit.team без edit.department) ограничиваем отдел их собственным
    if (canEditTeams && !canManageAllTeams && !canEditDepartment && departmentId) {
      const theOnly = departments
        .filter(d => d.id === departmentId && d.name !== "Не назначен")
        .map(d => ({ value: d.id, label: d.name }))
      return [
        {
          name: "department_id",
          label: "Отдел",
          type: "select" as const,
          options: theOnly,
          required: true
        }
      ]
    }
    // Для пользователей с manage.teams или без ограничений - обычная логика
    if (scope === 'department') {
      const theOnly = departments
        .filter(d => d.id === departmentId && d.name !== "Не назначен")
        .map(d => ({ value: d.id, label: d.name }))
      return [
        {
          name: "department_id",
          label: "Отдел",
          type: "select" as const,
          options: theOnly,
          required: true
        }
      ]
    }
    return extraFields
  }, [extraFields, scope, departmentId, departments, canEditTeams, canManageAllTeams, canEditDepartment])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedTeam) return undefined

    return {
      team_id: selectedTeam.id,
      team_name: selectedTeam.name,
      department_id: selectedTeam.departmentId
    }
  }, [selectedTeam, departments])

  // Мемоизируем данные команды для TeamHeadModal
  const teamHeadData = useMemo(() => {
    if (!selectedTeam) return undefined

    return {
      id: selectedTeam.id,
      name: selectedTeam.name,
      departmentId: selectedTeam.departmentId,
      departmentName: selectedTeam.departmentName || "",
      team_lead_id: selectedTeam.team_lead_id,
      headFirstName: selectedTeam.headFirstName,
      headLastName: selectedTeam.headLastName,
      headFullName: selectedTeam.headFullName,
      headEmail: selectedTeam.headEmail,
      headAvatarUrl: selectedTeam.headAvatarUrl
    }
  }, [selectedTeam])

  // Обработчики событий
  const handleCreateTeam = useCallback(() => {
    setModalMode("create")
    setSelectedTeam(null)
    setModalOpen(true)
  }, [])

  const handleEditTeam = useCallback((team: Team) => {
    // Проверяем права на управление этой командой
    if (!canManageTeam(team)) {
      return
    }

    setModalMode("edit")
    setSelectedTeam(team)
    setModalOpen(true)
  }, [canManageTeam])

  const handleDeleteTeamClick = useCallback((team: Team) => {
    // Проверяем наличие разрешения на удаление команд
    if (!canDeleteTeam) {
      return
    }

    // Подсчитываем количество команд в отделе
    const teamsInDepartment = teams.filter(t => t.departmentId === team.departmentId).length

    // Если это последняя команда в отделе, показываем предупреждение
    if (teamsInDepartment === 1) {
      toast.error(
        `Невозможно удалить команду "${team.name}". Это последняя команда в отделе "${team.departmentName}". Удалите весь отдел, если необходимо.`,
        { duration: 5000 }
      )
      return
    }

    setSelectedTeam(team)
    setDeleteModalOpen(true)
  }, [canDeleteTeam, teams])

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open)
  }, [])

  const handleDeleteModalOpenChange = useCallback((open: boolean) => {
    setDeleteModalOpen(open)
  }, [])

  // Обработчики для управления руководителями
  const handleAssignHead = useCallback((team: Team) => {
    // Проверяем наличие разрешения на управление руководителями команд
    if (!canManageTeamLead) {
      return
    }

    setSelectedTeam(team)
    setHeadModalOpen(true)
  }, [canManageTeamLead])

  const handleRemoveHeadClick = useCallback((team: Team) => {
    // Проверяем наличие разрешения на управление руководителями команд
    if (!canManageTeamLead) {
      return
    }

    setSelectedTeam(team)
    setRemoveHeadModalOpen(true)
  }, [canManageTeamLead])

  const handleAssignToTeam = useCallback((team: Team) => {
    // Проверяем права на управление этой командой
    if (!canManageTeam(team)) {
      return
    }

    setSelectedTeam(team)
    setAssignModalOpen(true)
  }, [canManageTeam])

  // Если данные загружаются, показываем индикатор загрузки
  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-xl font-semibold">Управление командами</CardTitle>
              <div className="flex justify-end gap-2">
                {showManagementControls && (
                  <Input
                    placeholder="Поиск команд..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                )}
                {canCreateTeam && (
                  <Button size="default" onClick={handleCreateTeam}>Создать команду</Button>
                )}
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs rounded font-normal">
                  Все отделы
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Название команды</TableHead>
                  <TableHead className="text-base">Отдел</TableHead>
                  <TableHead className="text-base">Руководитель</TableHead>
                  <TableHead className="w-64 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LoadingState columnCount={4} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-xl font-semibold">Управление командами</CardTitle>
            <div className="flex justify-end gap-2">
              {showManagementControls && (
                <Input
                  placeholder="Поиск команд..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs"
                />
              )}
              {canCreateTeam && (
                <Button size="default" onClick={handleCreateTeam}>Создать команду</Button>
              )}
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={activeDept === null ? "default" : "outline"}
                onClick={() => setActiveDept(null)}
                className="h-7 text-xs rounded font-normal"
              >
                Все отделы
              </Button>
              {departments.map((dep) => (
                <Button
                  key={dep.id}
                  size="sm"
                  variant={(scope === 'department' ? (departmentId! === dep.id) : (activeDept === dep.id)) ? "default" : "outline"}
                  onClick={() => {
                    if (scope !== 'department') {
                      setActiveDept(dep.id);
                    }
                  }}
                  className="h-7 text-xs rounded font-normal"
                  disabled={scope === 'department'}
                >
                  {dep.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base">Название команды</TableHead>
                <TableHead className="text-base">Отдел</TableHead>
                <TableHead className="text-base">Руководитель</TableHead>
                <TableHead className="w-64 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map(team => (
                  <TableRow key={team.id}>
                    <TableCell className="text-base font-medium">{team.name}</TableCell>
                    <TableCell className="text-base">
                      {team.departmentName}
                    </TableCell>
                    <TableCell className="text-base">
                      {team.team_lead_id ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={team.headAvatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {team.headFirstName?.[0]}{team.headLastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{team.headFullName}</div>
                            <div className="text-sm text-muted-foreground">{team.headEmail}</div>
                          </div>
                          {canManageHead && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <div className="flex flex-col">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAssignHead(team)}
                                    className="justify-start rounded-b-none border-b-0"
                                  >
                                    Сменить
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveHeadClick(team)}
                                    className="justify-start rounded-t-none"
                                  >
                                    Убрать
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Не назначен</span>
                          {canManageHead && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <div className="flex flex-col">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAssignHead(team)}
                                    className="justify-start"
                                  >
                                    Назначить
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canManageTeam(team) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignToTeam(team)}
                          >
                            Назначить в команду
                          </Button>
                        )}
                        {canManageTeam(team) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTeam(team)}
                          >
                            Изменить
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTeamClick(team)}
                          >
                            Удалить
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      message={
                        search || activeDept
                          ? "Команды по вашему запросу не найдены"
                          : "Команды не созданы"
                      }
                      buttonText={canCreateTeam ? "Создать первую команду" : undefined}
                      onButtonClick={canCreateTeam ? handleCreateTeam : undefined}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntityModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        title={modalMode === "create" ? "Создать команду" : "Редактировать команду"}
        mode={modalMode}
        table="teams"
        idField="team_id"
        nameField="team_name"
        entity={entityData}
        extraFields={scopedExtraFields}
        existingNames={teams.map(t => t.name)}
        entityType="team"
        onSuccess={fetchData}
      />

      {selectedTeam && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={handleDeleteModalOpenChange}
          title="Удаление команды"
          entityName={selectedTeam.name}
          table="teams"
          idField="team_id"
          entityId={selectedTeam.id}
          onSuccess={fetchData}
        />
      )}

      {/* Модальное окно для назначения руководителя команды */}
      {selectedTeam && teamHeadData && (
        <TeamHeadModal
          open={headModalOpen}
          onOpenChange={setHeadModalOpen}
          team={teamHeadData}
          onSuccess={fetchData}
        />
      )}

      {/* Модальное окно для подтверждения удаления руководителя команды */}
      {selectedTeam && (
        <RemoveHeadConfirmModal
          open={removeHeadModalOpen}
          onOpenChange={setRemoveHeadModalOpen}
          type="team"
          entityName={selectedTeam.name}
          entityId={selectedTeam.id}
          onSuccess={fetchData}
        />
      )}

      {/* Модальное окно для назначения сотрудников в команду */}
      {selectedTeam && (
        <AssignToTeamModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          team={{
            id: selectedTeam.id,
            name: selectedTeam.name,
            departmentId: selectedTeam.departmentId!,
            departmentName: selectedTeam.departmentName || "",
            team_lead_id: selectedTeam.team_lead_id
          }}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
} 