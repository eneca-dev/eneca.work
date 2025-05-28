"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import EntityModal from "./EntityModal"
import DeleteConfirmModal from "./DeleteConfirmModal"
import LoadingState from "./LoadingState"
import EmptyState from "./EmptyState"
import { toast } from "sonner"

// Типы для сущностей
interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  departmentId: string | null;
}

export default function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [activeDept, setActiveDept] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Получаем команды
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("team_id, team_name, department_id")
      
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
      
      // Устанавливаем данные команд
      setTeams(
        teamsData ? 
        teamsData.map(team => ({ 
          id: team.team_id, 
          name: team.team_name, 
          departmentId: team.department_id 
        })) : 
        []
      )
      
      // Устанавливаем данные отделов
      setDepartments(
        deptsData ? 
        deptsData.map(dep => ({ 
          id: dep.department_id, 
          name: dep.department_name 
        })) : 
        []
      )
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error)
      toast.error('Произошла ошибка при загрузке данных')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Мемоизируем фильтрованные команды
  const filtered = useMemo(() => {
    return teams.filter(team => {
      const matchesDept = !activeDept || (team.departmentId && team.departmentId === activeDept)
      const matchesSearch = typeof team.name === "string" && team.name.toLowerCase().includes(search.toLowerCase())
      return matchesDept && matchesSearch
    })
  }, [teams, activeDept, search])

  // Мемоизируем функцию получения имени отдела
  const getDepartmentName = useCallback((id: string) => {
    return departments.find(dep => dep.id === id)?.name || "-"
  }, [departments])

  // Мемоизируем extraFields для EntityModal
  const extraFields = useMemo(() => {
    return [
      {
        name: "department_id",
        label: "Отдел",
        type: "select" as const,
        options: departments.map(dep => ({ value: dep.id, label: dep.name }))
      }
    ]
  }, [departments])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedTeam) return undefined
    
    return {
      team_id: selectedTeam.id,
      team_name: selectedTeam.name,
      department_id: selectedTeam.departmentId
    }
  }, [selectedTeam])

  // Обработчики событий
  const handleCreateTeam = useCallback(() => {
    setModalMode("create")
    setSelectedTeam(null)
    setModalOpen(true)
  }, [])

  const handleEditTeam = useCallback((team: Team) => {
    setModalMode("edit")
    setSelectedTeam(team)
    setModalOpen(true)
  }, [])

  const handleDeleteTeamClick = useCallback((team: Team) => {
    setSelectedTeam(team)
    setDeleteModalOpen(true)
  }, [])

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open)
  }, [])

  const handleDeleteModalOpenChange = useCallback((open: boolean) => {
    setDeleteModalOpen(open)
  }, [])

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
                  <TableHead className="w-48 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LoadingState columnCount={3} />
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
              <Button size="sm" variant={activeDept === null ? "default" : "outline"} onClick={() => setActiveDept(null)} className="h-7 text-xs rounded font-normal">
                Все отделы
              </Button>
              {departments.map((dep) => (
                <Button
                  key={dep.id}
                  size="sm"
                  variant={activeDept === dep.id ? "default" : "outline"}
                  onClick={() => setActiveDept(dep.id)}
                  className="h-7 text-xs rounded font-normal"
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
                <TableHead className="w-48 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map(team => (
                  <TableRow key={team.id}>
                    <TableCell className="text-base font-medium">{team.name}</TableCell>
                    <TableCell className="text-base">{team.departmentId ? getDepartmentName(team.departmentId) : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEditTeam(team)}>
                          Изменить
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeleteTeamClick(team)}>
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3}>
                    <EmptyState 
                      message={
                        search || activeDept
                          ? "Команды по вашему запросу не найдены" 
                          : "Команды не созданы"
                      }
                      buttonText="Создать первую команду"
                      onButtonClick={handleCreateTeam}
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
        extraFields={extraFields}
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
    </div>
  )
} 