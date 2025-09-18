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
import LoadingState from "./LoadingState"
import EmptyState from "./EmptyState"
import { toast } from "sonner"
import { useAdminPermissions } from "../hooks/useAdminPermissions"

// Типы для сущностей
interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  departmentId: string | null;
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

export default function TeamsTab(props: TeamsTabProps) {
  const scope = props.scope ?? 'all'
  const departmentId = 'departmentId' in props ? props.departmentId : null
  const [teams, setTeams] = useState<Team[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [activeDept, setActiveDept] = useState<string | null>(scope === 'department' ? departmentId : null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [removeHeadModalOpen, setRemoveHeadModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const perms = useAdminPermissions()

  // Определяем, должны ли быть видны элементы управления
  const canManageAllTeams = perms.canManageTeams
  const canEditTeams = perms.canEditTeam
  const isTeamScoped = scope === 'department'
  const showManagementControls = canManageAllTeams && !isTeamScoped
  const canViewTeams = canManageAllTeams || canEditTeams

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
        toast.error('Не удалось загрузить команды')
        return
      }
      
      // Получаем отделы
      const { data: deptsData, error: deptsError } = await supabase
        .from("departments")
        .select("department_id, department_name")
      
      if (deptsError) {
        console.error('Ошибка при загрузке отделов:', deptsError)
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
            departmentId: team.department_id || null,
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
      const scopedTeams = scope === 'department'
        ? preparedTeams.filter(t => t.departmentId === departmentId!)
        : preparedTeams
      setTeams(scopedTeams)

      // Устанавливаем данные отделов с учетом скоупа
      const allDepartments = deptsData ? deptsData.map(dep => ({ id: dep.department_id, name: dep.department_name })) : []
      const scopedDepartments = scope === 'department'
        ? allDepartments.filter(d => d.id === departmentId!)
        : allDepartments
      setDepartments(scopedDepartments)
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error)
      toast.error('Произошла ошибка при загрузке данных')
    } finally {
      setIsLoading(false)
    }
  }, [scope, departmentId])

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Мемоизируем фильтрованные команды
  const filtered = useMemo(() => {
    return teams.filter(team => {
      // Фильтрация по отделу: три-состояние
      // activeDept === null: "Все отделы" - показываем все команды
      // activeDept === "": "Без отдела" - показываем команды без отдела
      // activeDept === deptId: показываем команды конкретного отдела
      const matchesDept =
        activeDept === null ||
        (activeDept === "" && (!team.departmentId || team.departmentId === "")) ||
        team.departmentId === activeDept
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
    // Добавляем опцию "Не назначен" для команд без отдела
    const departmentOptions = [
      { value: "none", label: "Не назначен" },
      ...departments.map(dep => ({ value: dep.id, label: dep.name }))
    ]

    return [
      {
        name: "department_id",
        label: "Отдел",
        type: "select" as const,
        options: departmentOptions,
        required: false // Отдел не обязателен для команды
      }
    ]
  }, [departments])

  // Скоуп-версия extraFields (перенесено из JSX, чтобы не нарушать порядок хуков)
  const scopedExtraFields = useMemo(() => {
    // Для пользователей с edit.team всегда ограничиваем отдел их собственным
    if (canEditTeams && !canManageAllTeams && departmentId) {
      const theOnly = departments
        .filter(d => d.id === departmentId)
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
        .filter(d => d.id === departmentId)
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
  }, [extraFields, scope, departmentId, departments, canEditTeams, canManageAllTeams])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedTeam) return undefined

    return {
      team_id: selectedTeam.id,
      team_name: selectedTeam.name,
      department_id: selectedTeam.departmentId || "none" // "none" для "Не назначен"
    }
  }, [selectedTeam])

  // Мемоизируем данные команды для TeamHeadModal
  const teamHeadData = useMemo(() => {
    if (!selectedTeam) return undefined

    return {
      id: selectedTeam.id,
      name: selectedTeam.name,
      departmentId: selectedTeam.departmentId || "",
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
    // Проверяем права на редактирование
    if (canEditTeams && !canManageAllTeams && departmentId && team.departmentId !== departmentId) {
      // Пользователь с edit.team пытается редактировать команду из другого отдела
      return
    }

    setModalMode("edit")
    setSelectedTeam(team)
    setModalOpen(true)
  }, [canEditTeams, canManageAllTeams, departmentId])

  const handleDeleteTeamClick = useCallback((team: Team) => {
    // Проверяем права на удаление
    if (canEditTeams && !canManageAllTeams && departmentId && team.departmentId !== departmentId) {
      // Пользователь с edit.team пытается удалить команду из другого отдела
      return
    }

    setSelectedTeam(team)
    setDeleteModalOpen(true)
  }, [canEditTeams, canManageAllTeams, departmentId])

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open)
  }, [])

  const handleDeleteModalOpenChange = useCallback((open: boolean) => {
    setDeleteModalOpen(open)
  }, [])

  // Обработчики для управления руководителями
  const handleAssignHead = useCallback((team: Team) => {
    // Проверяем права на управление руководителем
    if (canEditTeams && !canManageAllTeams && departmentId && team.departmentId !== departmentId) {
      // Пользователь с edit.team пытается управлять руководителем команды из другого отдела
      return
    }

    setSelectedTeam(team)
    setHeadModalOpen(true)
  }, [canEditTeams, canManageAllTeams, departmentId])

  const handleRemoveHeadClick = useCallback((team: Team) => {
    // Проверяем права на управление руководителем
    if (canEditTeams && !canManageAllTeams && departmentId && team.departmentId !== departmentId) {
      // Пользователь с edit.team пытается управлять руководителем команды из другого отдела
      return
    }

    setSelectedTeam(team)
    setRemoveHeadModalOpen(true)
  }, [canEditTeams, canManageAllTeams, departmentId])

  // Если данные загружаются, показываем индикатор загрузки
  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-xl font-semibold">Управление командами</CardTitle>
              <div className="flex justify-end gap-2">
                <Input
                  placeholder="Поиск команд..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Button size="default" onClick={handleCreateTeam}>Создать команду</Button>
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
              {canViewTeams && (
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
              <Button
                size="sm"
                variant={activeDept === "none" ? "default" : "outline"}
                onClick={() => setActiveDept("none")}
                className="h-7 text-xs rounded font-normal"
              >
                Без отдела
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
                      {team.departmentId ? team.departmentName : "Не назначен"}
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
                          {canViewTeams && (
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
                          {canViewTeams && (
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
                        {canViewTeams && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTeam(team)}
                            >
                              Изменить
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTeamClick(team)}
                            >
                              Удалить
                            </Button>
                          </>
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
                      buttonText={canViewTeams ? "Создать первую команду" : undefined}
                      onButtonClick={canViewTeams ? handleCreateTeam : undefined}
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
    </div>
  )
} 