"use client"
import { useCallback, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { Card, CardTitle, CardContent } from "@/components/ui/card"
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
import { useAdminPermissions } from "../hooks/useAdminPermissions"
import { useAdminSubdivisions, useAdminDepartments, type AdminDepartment } from "../hooks/useAdminData"
import * as Sentry from "@sentry/nextjs"

type Department = AdminDepartment

// Пропсы для ограничения видимости данных
type DepartmentsTabProps =
  | { scope?: 'all' }
  | { scope: 'department'; departmentId: string }
  | { scope: 'subdivision'; subdivisionId: string }

function DepartmentsTab(props: DepartmentsTabProps) {
  const scope = props.scope ?? 'all'
  const departmentId = 'departmentId' in props ? props.departmentId : null
  const subdivisionId = 'subdivisionId' in props ? props.subdivisionId : null
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [removeHeadModalOpen, setRemoveHeadModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)

  const perms = useAdminPermissions()
  const { subdivisions: rawSubdivisions } = useAdminSubdivisions()
  const { departments: allDepartments, isLoading, refetch: refetchDepartments } = useAdminDepartments()

  // Список подразделений для dropdown-а (id + name)
  const subdivisions = useMemo(
    () => rawSubdivisions.map(s => ({ id: s.subdivision_id, name: s.subdivision_name })),
    [rawSubdivisions]
  )

  // Применяем scope-фильтрацию поверх кешированных данных
  const departments = useMemo(() => {
    if (scope === 'department') {
      return departmentId ? allDepartments.filter(d => d.department_id === departmentId) : []
    }
    if (scope === 'subdivision') {
      return subdivisionId ? allDepartments.filter(d => d.subdivision_id === subdivisionId) : []
    }
    return allDepartments
  }, [allDepartments, scope, departmentId, subdivisionId])

  // Определяем, должны ли быть видны элементы управления
  // subdivision_head может управлять отделами своего подразделения
  const showManagementControls = (perms.canManageDepartments && scope !== 'department') || (perms.canEditSubdivision && scope === 'subdivision')

  // Принудительное обновление данных
  const forceRefresh = useCallback(async () => {
    Sentry.addBreadcrumb({
      category: 'ui.action',
      level: 'info',
      message: 'DepartmentsTab: forceRefresh clicked'
    })
    try {
      await refetchDepartments()
      toast.success("Данные обновлены")
    } catch (error) {
      Sentry.captureException(error, { tags: { module: 'users', component: 'DepartmentsTab', action: 'force_refresh', error_type: 'unexpected' } })
      toast.error("Не удалось обновить данные")
    }
  }, [refetchDepartments])

  // Фильтрация отделов по поиску (дедупликация уже в хуке)
  const filteredDepartments = useMemo(() => {
    return departments.filter(dept =>
      dept.department_name.toLowerCase().includes(search.toLowerCase()) ||
      (dept.head_full_name && dept.head_full_name.toLowerCase().includes(search.toLowerCase()))
    )
  }, [departments, search])

  // Обработчики для управления отделами
  const handleCreateDepartment = useCallback(() => {
    Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'DepartmentsTab: open create department' })
    setModalMode("create")
    setSelectedDepartment(null)
    setModalOpen(true)
  }, [])

  const handleEditDepartment = useCallback((department: Department) => {
    Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'DepartmentsTab: open edit department', data: { department_id: department.department_id } })
    setModalMode("edit")
    setSelectedDepartment(department)
    setModalOpen(true)
  }, [])

  const handleDeleteDepartment = useCallback((department: Department) => {
    Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'DepartmentsTab: open delete department confirm', data: { department_id: department.department_id } })

    // Подсчитываем количество отделов в подразделении
    const deptsInSubdivision = departments.filter(d => d.subdivision_id === department.subdivision_id).length

    // Если это последний отдел в подразделении, показываем предупреждение
    if (deptsInSubdivision === 1 && department.subdivision_id) {
      const subdivisionName = subdivisions.find(s => s.id === department.subdivision_id)?.name || 'подразделении'
      toast.error(
        `Невозможно удалить отдел "${department.department_name}". Это последний отдел в подразделении "${subdivisionName}". Удалите всё подразделение, если необходимо.`,
        { duration: 5000 }
      )
      return
    }

    setSelectedDepartment(department)
    setDeleteModalOpen(true)
  }, [departments, subdivisions])

  // Обработчики для управления руководителями
  const handleAssignHead = useCallback((department: Department) => {
    Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'DepartmentsTab: open assign head', data: { department_id: department.department_id } })
    setSelectedDepartment(department)
    setHeadModalOpen(true)
  }, [])

  const handleRemoveHeadClick = useCallback((department: Department) => {
    Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'DepartmentsTab: open remove head confirm', data: { department_id: department.department_id } })
    setSelectedDepartment(department)
    setRemoveHeadModalOpen(true)
  }, [])

  // Данные для EntityModal
  const entityData = useMemo<Record<string, string | number | null> | undefined>(() => {
    if (!selectedDepartment) {
      // При создании нового отдела в режиме subdivision добавляем subdivision_id
      if (modalMode === "create" && scope === 'subdivision' && subdivisionId) {
        return {
          subdivision_id: subdivisionId
        } as Record<string, string | number | null>
      }
      return undefined
    }

    return {
      department_id: selectedDepartment.department_id,
      department_name: selectedDepartment.department_name,
      subdivision_id: selectedDepartment.subdivision_id || "none" // "none" если нет подразделения
    } as Record<string, string | number | null>
  }, [selectedDepartment, modalMode, scope, subdivisionId])

  // Дополнительные поля для формы создания/редактирования отдела
  const extraFields = useMemo(() => {
    // Только для админа (scope='all') показываем выбор подразделения
    if (scope !== 'all') return []

    return [
      {
        name: 'subdivision_id',
        label: 'Подразделение',
        type: 'select' as const,
        required: true,
        options: subdivisions
          .filter(s => s.name !== "Не назначен")
          .map(s => ({ value: s.id, label: s.name }))
      }
    ]
  }, [scope, subdivisions])

  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-xl font-semibold">Управление отделами</CardTitle>
                          <div className="flex justify-end gap-2">
              {showManagementControls && (
                <Input
                  placeholder="Поиск отделов..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    Sentry.addBreadcrumb({ category: 'ui.input', level: 'info', message: 'DepartmentsTab: search change', data: { value_length: e.target.value.length } })
                  }}
                  className="max-w-xs"
                />
              )}
              <Button
                variant="outline"
                size="default"
                onClick={forceRefresh}
                disabled={isLoading}
                className="transition-all duration-200 hover:scale-105"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    Обновление...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-sm">🔄</div>
                    Обновить
                  </div>
                )}
              </Button>
              {showManagementControls && (
                <Button
                  size="default"
                  onClick={handleCreateDepartment}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  Создать отдел
                </Button>
              )}
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
                  <TableHead className="text-base">Подразделение</TableHead>
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
            <CardTitle className="text-xl font-semibold">Управление отделами</CardTitle>
            <div className="flex justify-end gap-2">
              {showManagementControls && (
                <Input
                  placeholder="Поиск отделов..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    Sentry.addBreadcrumb({ category: 'ui.input', level: 'info', message: 'DepartmentsTab: search change', data: { value_length: e.target.value.length } })
                  }}
                  className="max-w-xs"
                />
              )}
              <Button
                variant="outline"
                size="default"
                onClick={forceRefresh}
                disabled={isLoading}
                className="transition-all duration-200 hover:scale-105"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    Обновление...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-sm">🔄</div>
                    Обновить
                  </div>
                )}
              </Button>
              {showManagementControls && (
                <Button
                  size="default"
                  onClick={handleCreateDepartment}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  Создать отдел
                </Button>
              )}
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
                <TableHead className="text-base">Подразделение</TableHead>
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
                      {department.subdivision_name || <span className="text-muted-foreground">Не указано</span>}
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
                          {showManagementControls && (
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
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Не назначен</span>
                          {showManagementControls && (
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
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {showManagementControls && (
                          <>
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
                        search
                          ? "Отделы по вашему запросу не найдены"
                          : "Отделы не созданы"
                      }
                      buttonText={showManagementControls ? "Создать первый отдел" : undefined}
                      onButtonClick={showManagementControls ? handleCreateDepartment : undefined}
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
        extraFields={extraFields}
        existingNames={departments.map(d => d.department_name)}
        entityType="department"
        onSuccess={async () => {
          await refetchDepartments()

          // Показываем уведомление об успешном создании/редактировании
          if (modalMode === "create") {
            toast.success("Отдел успешно создан и данные обновлены")
          } else {
            toast.success("Отдел успешно отредактирован и данные обновлены")
          }
        }}
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
          onConfirm={async () => {
            const response = await Sentry.startSpan({ name: 'Admin/DeleteDepartment', op: 'http', attributes: { department_id: selectedDepartment.department_id } }, async () => fetch(`/api/admin/delete-department?departmentId=${selectedDepartment.department_id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            }))

            let result: any = null
            try { result = await response.json() } catch {}
            if (!response.ok) {
              throw new Error(result?.error || 'Не удалось удалить отдел')
            }
          }}
          onSuccess={async () => {
            await refetchDepartments()

            // Показываем уведомление об успешном удалении
            toast.success("Отдел успешно удален и данные обновлены")
          }}
        />
      )}

      {/* Модальное окно для назначения руководителя */}
      {selectedDepartment && (
        <DepartmentHeadModal
          open={headModalOpen}
          onOpenChange={setHeadModalOpen}
          department={selectedDepartment}
          onSuccess={async () => {
            await refetchDepartments()

            // Показываем уведомление об успешном назначении руководителя
            toast.success("Руководитель отдела успешно назначен и данные обновлены")
          }}
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
          onSuccess={async () => {
            await refetchDepartments()

            // Показываем уведомление об успешном удалении руководителя
            toast.success("Руководитель отдела успешно удален и данные обновлены")
          }}
        />
      )}
    </div>
  )
}

export default Sentry.withProfiler(DepartmentsTab, { name: 'DepartmentsTab' })