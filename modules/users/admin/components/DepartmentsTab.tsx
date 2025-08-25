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
import LoadingState from "./LoadingState"
import EmptyState from "./EmptyState"
import DepartmentHeadModal from "./DepartmentHeadModal"
import RemoveHeadConfirmModal from "./RemoveHeadConfirmModal"
import { toast } from "sonner"

interface Department {
  department_id: string
  department_name: string
  department_head_id: string | null
  head_first_name: string | null
  head_last_name: string | null
  head_full_name: string | null
  head_email: string | null
  head_avatar_url: string | null
}

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [removeHeadModalOpen, setRemoveHeadModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Загрузка отделов из представления
  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from("view_departments_with_heads")
        .select("*")
        .order("department_name")
      
      if (error) {
        console.error("Ошибка при загрузке отделов:", error)
        toast.error("Не удалось загрузить отделы")
        return
      }
      
      console.log("📊 Данные из view_departments_with_heads:", data)
      console.log("📊 Количество записей:", data?.length)
      
      // Дедупликация данных на уровне состояния
      const uniqueData = (data || []).reduce((acc: Department[], dept: Department) => {
        if (!acc.find((d: Department) => d.department_id === dept.department_id)) {
          acc.push(dept)
        }
        return acc
      }, [] as Department[])
      
      console.log("📊 Уникальные отделы:", uniqueData)
      setDepartments(uniqueData)
    } catch (error) {
      console.error("Ошибка при загрузке отделов:", error)
      toast.error("Произошла ошибка при загрузке данных")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  // Фильтрация отделов по поиску с дедупликацией
  const filteredDepartments = useMemo(() => {
    // Сначала дедуплицируем данные по department_id
    const uniqueDepartments = departments.reduce((acc: Department[], dept: Department) => {
      if (!acc.find((d: Department) => d.department_id === dept.department_id)) {
        acc.push(dept)
      }
      return acc
    }, [] as Department[])
    
    // Затем фильтруем по поиску
    return uniqueDepartments.filter(dept =>
      dept.department_name.toLowerCase().includes(search.toLowerCase()) ||
      (dept.head_full_name && dept.head_full_name.toLowerCase().includes(search.toLowerCase()))
    )
  }, [departments, search])

  // Обработчики для управления отделами
  const handleCreateDepartment = useCallback(() => {
    setModalMode("create")
    setSelectedDepartment(null)
    setModalOpen(true)
  }, [])

  const handleEditDepartment = useCallback((department: Department) => {
    setModalMode("edit")
    setSelectedDepartment(department)
    setModalOpen(true)
  }, [])

  const handleDeleteDepartment = useCallback((department: Department) => {
    setSelectedDepartment(department)
    setDeleteModalOpen(true)
  }, [])

  // Обработчики для управления руководителями
  const handleAssignHead = useCallback((department: Department) => {
    setSelectedDepartment(department)
    setHeadModalOpen(true)
  }, [])

  const handleRemoveHeadClick = useCallback((department: Department) => {
    setSelectedDepartment(department)
    setRemoveHeadModalOpen(true)
  }, [])

  // Данные для EntityModal
  const entityData = useMemo(() => {
    if (!selectedDepartment) return undefined
    
    return {
      department_id: selectedDepartment.department_id,
      department_name: selectedDepartment.department_name
    }
  }, [selectedDepartment])

  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-xl font-semibold">Управление отделами</CardTitle>
              <div className="flex justify-end gap-2">
                <Input
                  placeholder="Поиск отделов..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Button size="default" onClick={handleCreateDepartment}>Создать отдел</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Название отдела</TableHead>
                  <TableHead className="text-base">Руководитель</TableHead>
                  <TableHead className="w-64 text-right">Действия</TableHead>
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
            <CardTitle className="text-xl font-semibold">Управление отделами</CardTitle>
            <div className="flex justify-end gap-2">
              <Input
                placeholder="Поиск отделов..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button size="default" onClick={handleCreateDepartment}>Создать отдел</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base">Название отдела</TableHead>
                <TableHead className="text-base">Руководитель</TableHead>
                <TableHead className="w-64 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDepartments.length > 0 ? (
                filteredDepartments.map((department, index) => (
                  <TableRow key={`dept-${department.department_id}-${index}`}>
                    <TableCell className="text-base font-medium">
                      {department.department_name}
                    </TableCell>
                    <TableCell className="text-base">
                      {department.department_head_id ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={department.head_avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {department.head_first_name?.[0]}{department.head_last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{department.head_full_name}</div>
                            <div className="text-sm text-muted-foreground">{department.head_email}</div>
                          </div>
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
                                  onClick={() => handleAssignHead(department)}
                                  className="justify-start rounded-b-none border-b-0"
                                >
                                  Сменить
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleRemoveHeadClick(department)}
                                  className="justify-start rounded-t-none"
                                >
                                  Убрать
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Не назначен</span>
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
                                  onClick={() => handleAssignHead(department)}
                                  className="justify-start"
                                >
                                  Назначить
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditDepartment(department)}
                        >
                          Изменить
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteDepartment(department)}
                        >
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
                        search 
                          ? "Отделы по вашему запросу не найдены" 
                          : "Отделы не созданы"
                      }
                      buttonText="Создать первый отдел"
                      onButtonClick={handleCreateDepartment}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Модальное окно для создания/редактирования отдела */}
      <EntityModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={modalMode === "create" ? "Создать отдел" : "Редактировать отдел"}
        mode={modalMode}
        table="departments"
        idField="department_id"
        nameField="department_name"
        entity={entityData}
        existingNames={departments.map(d => d.department_name)}
        entityType="department"
        onSuccess={fetchDepartments}
      />

      {/* Модальное окно для удаления отдела */}
      {selectedDepartment && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          title="Удаление отдела"
          entityName={selectedDepartment.department_name}
          table="departments"
          idField="department_id"
          entityId={selectedDepartment.department_id}
          onSuccess={fetchDepartments}
        />
      )}

      {/* Модальное окно для назначения руководителя */}
      {selectedDepartment && (
        <DepartmentHeadModal
          open={headModalOpen}
          onOpenChange={setHeadModalOpen}
          department={selectedDepartment}
          onSuccess={fetchDepartments}
        />
      )}

      {/* Модальное окно для подтверждения удаления руководителя отдела */}
      {selectedDepartment && (
        <RemoveHeadConfirmModal
          open={removeHeadModalOpen}
          onOpenChange={setRemoveHeadModalOpen}
          type="department"
          entityName={selectedDepartment.department_name}
          entityId={selectedDepartment.department_id}
          onSuccess={fetchDepartments}
        />
      )}
    </div>
  )
} 