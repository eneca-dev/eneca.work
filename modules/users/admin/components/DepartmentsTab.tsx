"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import EntityModal from "./EntityModal"
import DeleteConfirmModal from "./DeleteConfirmModal"
import LoadingState from "./LoadingState"
import EmptyState from "./EmptyState"

// Типы для сущностей
interface Department {
  id: string;
  name: string;
}

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Мемоизируем функцию загрузки отделов
  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from("departments")
        .select("department_id, department_name")
      
      if (error) {
        console.error('Ошибка при загрузке отделов:', error)
        return
      }
      
      setDepartments(
        data ? 
        data.map(dep => ({ 
          id: dep.department_id, 
          name: dep.department_name 
        })) : 
        []
      )
    } catch (error) {
      console.error('Ошибка при загрузке отделов:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Загружаем отделы при монтировании компонента
  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  // Мемоизируем фильтрованные отделы
  const filtered = useMemo(() => {
    return departments.filter(dep =>
      typeof dep.name === "string" && dep.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [departments, search])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedDepartment) return undefined
    
    return {
      department_id: selectedDepartment.id,
      department_name: selectedDepartment.name
    }
  }, [selectedDepartment])

  // Обработчики событий
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

  const handleDeleteDepartmentClick = useCallback((department: Department) => {
    setSelectedDepartment(department)
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
                  <TableHead className="w-48 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LoadingState columnCount={2} />
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
                <TableHead className="w-48 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map(dep => (
                  <TableRow key={dep.id}>
                    <TableCell className="text-base font-medium">{dep.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEditDepartment(dep)}>
                          Изменить
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeleteDepartmentClick(dep)}>
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2}>
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

      <EntityModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        title={modalMode === "create" ? "Создать отдел" : "Редактировать отдел"}
        mode={modalMode}
        table="departments"
        idField="department_id"
        nameField="department_name"
        entity={entityData}
        onSuccess={fetchDepartments}
      />

      {selectedDepartment && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={handleDeleteModalOpenChange}
          title="Удаление отдела"
          entityName={selectedDepartment.name}
          table="departments"
          idField="department_id"
          entityId={selectedDepartment.id}
          onSuccess={fetchDepartments}
        />
      )}
    </div>
  )
} 