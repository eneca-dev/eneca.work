"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardTitle, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Edit2 } from "lucide-react"
import EntityModal from "./EntityModal"
import DeleteConfirmModal from "./DeleteConfirmModal"
import LoadingState from "./LoadingState"
import EmptyState from "./EmptyState"
import SubdivisionHeadModal from "./SubdivisionHeadModal"
import RemoveHeadConfirmModal from "./RemoveHeadConfirmModal"
import { toast } from "sonner"
import { useAdminPermissions } from "../hooks/useAdminPermissions"
import * as Sentry from "@sentry/nextjs"

// Утилитарная функция для обновления данных с задержкой
const refreshWithDelay = async (fetchFn: () => Promise<void>, initialDelay: number = 300) => {
  await new Promise(resolve => setTimeout(resolve, initialDelay))
  await fetchFn()
}

interface Subdivision {
  subdivision_id: string
  subdivision_name: string
  subdivision_head_id: string | null
  head_name: string | null
  head_email: string | null
  head_avatar_url: string | null
  departments_count: number
  employees_count: number
}

function SubdivisionsTab() {
  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [removeHeadModalOpen, setRemoveHeadModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedSubdivision, setSelectedSubdivision] = useState<Subdivision | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const perms = useAdminPermissions()

  // Только admin может управлять подразделениями (создавать, удалять, изменять, назначать руководителей)
  // subdivision_head может только просматривать
  const showManagementControls = perms.isAdmin

  // Загрузка подразделений из представления
  const fetchSubdivisions = useCallback(async () => {
    return await Sentry.startSpan({
      name: 'Users/SubdivisionsTab fetchSubdivisions',
      op: 'ui.load'
    }, async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
          .from("view_subdivisions_with_heads")
          .select("*")
          .order("subdivision_name")
          .abortSignal(AbortSignal.timeout(10000))

        if (error) {
          console.error("Ошибка при загрузке подразделений:", error)
          Sentry.captureException(error, {
            tags: { module: 'users', component: 'SubdivisionsTab', action: 'load_subdivisions', error_type: 'db_error' }
          })
          toast.error("Не удалось загрузить подразделения")
          return
        }

        console.log("📊 Данные из view_subdivisions_with_heads:", data)

        setSubdivisions(data || [])
      } catch (error) {
        console.error("Ошибка при загрузке подразделений:", error)
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'SubdivisionsTab', action: 'fetch_subdivisions', error_type: 'unexpected' }
        })
        toast.error("Произошла ошибка при загрузке данных")
      } finally {
        setIsLoading(false)
      }
    })
  }, [])

  // Принудительное обновление данных
  const forceRefresh = useCallback(async () => {
    Sentry.addBreadcrumb({
      category: 'ui.action',
      level: 'info',
      message: 'SubdivisionsTab: forceRefresh clicked'
    })
    console.log("🔄 Принудительное обновление данных...")
    setIsLoading(true)
    try {
      await Sentry.startSpan({ name: 'Users/SubdivisionsTab forceRefresh', op: 'ui.action' }, async () => {
        await fetchSubdivisions()
      })
      toast.success("Данные обновлены")
    } catch (error) {
      console.error("Ошибка при обновлении данных:", error)
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'SubdivisionsTab', action: 'force_refresh', error_type: 'unexpected' }
      })
      toast.error("Не удалось обновить данные")
    } finally {
      setIsLoading(false)
    }
  }, [fetchSubdivisions])

  useEffect(() => {
    fetchSubdivisions()
  }, [fetchSubdivisions])

  // Фильтрация подразделений по поиску
  const filteredSubdivisions = useMemo(() => {
    return subdivisions.filter(sub =>
      sub.subdivision_name.toLowerCase().includes(search.toLowerCase()) ||
      (sub.head_name && sub.head_name.toLowerCase().includes(search.toLowerCase()))
    )
  }, [subdivisions, search])

  // Обработчики для управления подразделениями
  const handleCreateSubdivision = useCallback(() => {
    Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'SubdivisionsTab: open create subdivision' })
    setModalMode("create")
    setSelectedSubdivision(null)
    setModalOpen(true)
  }, [])

  const handleEditSubdivision = useCallback((subdivision: Subdivision) => {
    Sentry.addBreadcrumb({
      category: 'ui.open',
      level: 'info',
      message: 'SubdivisionsTab: open edit subdivision',
      data: { subdivision_id: subdivision.subdivision_id }
    })
    setModalMode("edit")
    setSelectedSubdivision(subdivision)
    setModalOpen(true)
  }, [])

  const handleDeleteSubdivision = useCallback((subdivision: Subdivision) => {
    Sentry.addBreadcrumb({
      category: 'ui.open',
      level: 'info',
      message: 'SubdivisionsTab: open delete subdivision confirm',
      data: { subdivision_id: subdivision.subdivision_id }
    })
    setSelectedSubdivision(subdivision)
    setDeleteModalOpen(true)
  }, [])

  // Обработчики для управления руководителями
  const handleAssignHead = useCallback((subdivision: Subdivision) => {
    Sentry.addBreadcrumb({
      category: 'ui.open',
      level: 'info',
      message: 'SubdivisionsTab: open assign head',
      data: { subdivision_id: subdivision.subdivision_id }
    })
    setSelectedSubdivision(subdivision)
    setHeadModalOpen(true)
  }, [])

  const handleRemoveHeadClick = useCallback((subdivision: Subdivision) => {
    Sentry.addBreadcrumb({
      category: 'ui.open',
      level: 'info',
      message: 'SubdivisionsTab: open remove head confirm',
      data: { subdivision_id: subdivision.subdivision_id }
    })
    setSelectedSubdivision(subdivision)
    setRemoveHeadModalOpen(true)
  }, [])

  // Данные для EntityModal
  const entityData = useMemo(() => {
    if (!selectedSubdivision) return undefined

    return {
      subdivision_id: selectedSubdivision.subdivision_id,
      subdivision_name: selectedSubdivision.subdivision_name
    }
  }, [selectedSubdivision])

  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-xl font-semibold">Управление подразделениями</CardTitle>
              <div className="flex justify-end gap-2">
                {showManagementControls && (
                  <Input
                    placeholder="Поиск подразделений..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
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
                    onClick={handleCreateSubdivision}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  >
                    Создать подразделение
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
                  <TableHead className="text-base">Название подразделения</TableHead>
                  <TableHead className="text-base">Руководитель</TableHead>
                  <TableHead className="text-base">Отделов</TableHead>
                  <TableHead className="text-base">Сотрудников</TableHead>
                  <TableHead className="w-64 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LoadingState columnCount={5} />
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
            <CardTitle className="text-xl font-semibold">Управление подразделениями</CardTitle>
            <div className="flex justify-end gap-2">
              {showManagementControls && (
                <Input
                  placeholder="Поиск подразделений..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    Sentry.addBreadcrumb({
                      category: 'ui.input',
                      level: 'info',
                      message: 'SubdivisionsTab: search change',
                      data: { value_length: e.target.value.length }
                    })
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
                  onClick={handleCreateSubdivision}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  Создать подразделение
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
                <TableHead className="text-base">Название подразделения</TableHead>
                <TableHead className="text-base">Руководитель</TableHead>
                <TableHead className="text-base">Отделов</TableHead>
                <TableHead className="text-base">Сотрудников</TableHead>
                <TableHead className="w-64 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubdivisions.length > 0 ? (
                filteredSubdivisions.map((subdivision, index) => (
                  <TableRow key={`subdivision-${subdivision.subdivision_id}-${index}`}>
                    <TableCell className="text-base font-medium">
                      {subdivision.subdivision_name}
                    </TableCell>
                    <TableCell className="text-base">
                      {subdivision.subdivision_head_id ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={subdivision.head_avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {subdivision.head_name?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{subdivision.head_name}</div>
                            <div className="text-sm text-muted-foreground">{subdivision.head_email}</div>
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
                                    onClick={() => handleAssignHead(subdivision)}
                                    className="justify-start rounded-b-none border-b-0"
                                  >
                                    Сменить
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveHeadClick(subdivision)}
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
                                    onClick={() => handleAssignHead(subdivision)}
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
                    <TableCell className="text-base">
                      {subdivision.departments_count}
                    </TableCell>
                    <TableCell className="text-base">
                      {subdivision.employees_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {showManagementControls && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditSubdivision(subdivision)}
                            >
                              Изменить
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteSubdivision(subdivision)}
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
                  <TableCell colSpan={5}>
                    <EmptyState
                      message={
                        search
                          ? "Подразделения по вашему запросу не найдены"
                          : "Подразделения не созданы"
                      }
                      buttonText={showManagementControls ? "Создать первое подразделение" : undefined}
                      onButtonClick={showManagementControls ? handleCreateSubdivision : undefined}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Модальное окно для создания/редактирования подразделения */}
      <EntityModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={modalMode === "create" ? "Создать подразделение" : "Редактировать подразделение"}
        mode={modalMode}
        table="subdivisions"
        idField="subdivision_id"
        nameField="subdivision_name"
        entity={entityData}
        existingNames={subdivisions.map(s => s.subdivision_name)}
        entityType="subdivision"
        onSuccess={async () => {
          await refreshWithDelay(fetchSubdivisions, 500)

          if (modalMode === "create") {
            toast.success("Подразделение успешно создано и данные обновлены")
          } else {
            toast.success("Подразделение успешно отредактировано и данные обновлены")
          }
        }}
      />

      {/* Модальное окно для удаления подразделения */}
      {selectedSubdivision && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          title="Удаление подразделения"
          entityName={selectedSubdivision.subdivision_name}
          table="subdivisions"
          idField="subdivision_id"
          entityId={selectedSubdivision.subdivision_id}
          onConfirm={async () => {
            const response = await Sentry.startSpan({
              name: 'Admin/DeleteSubdivision',
              op: 'http',
              attributes: { subdivision_id: selectedSubdivision.subdivision_id }
            }, async () => fetch(`/api/admin/delete-subdivision?subdivisionId=${selectedSubdivision.subdivision_id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            }))

            let result: any = null
            try { result = await response.json() } catch {}
            if (!response.ok) {
              throw new Error(result?.error || 'Не удалось удалить подразделение')
            }
          }}
          onSuccess={async () => {
            await refreshWithDelay(fetchSubdivisions, 300)
            toast.success("Подразделение успешно удалено и данные обновлены")
          }}
        />
      )}

      {/* Модальное окно для назначения руководителя */}
      {selectedSubdivision && (
        <SubdivisionHeadModal
          open={headModalOpen}
          onOpenChange={setHeadModalOpen}
          subdivision={selectedSubdivision}
          onSuccess={async () => {
            await refreshWithDelay(fetchSubdivisions, 300)
            toast.success("Руководитель подразделения успешно назначен и данные обновлены")
          }}
        />
      )}

      {/* Модальное окно для подтверждения удаления руководителя подразделения */}
      {selectedSubdivision && (
        <RemoveHeadConfirmModal
          open={removeHeadModalOpen}
          onOpenChange={setRemoveHeadModalOpen}
          type="subdivision"
          entityName={selectedSubdivision.subdivision_name}
          entityId={selectedSubdivision.subdivision_id}
          onSuccess={async () => {
            await refreshWithDelay(fetchSubdivisions, 300)
            toast.success("Руководитель подразделения успешно удален и данные обновлены")
          }}
        />
      )}
    </div>
  )
}

export default Sentry.withProfiler(SubdivisionsTab, { name: 'SubdivisionsTab' })
