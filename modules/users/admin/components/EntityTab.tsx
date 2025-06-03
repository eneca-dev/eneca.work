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
import { toast } from "sonner"

interface EntityTabConfig {
  entityName: string
  entityNamePlural: string
  tableName: string
  idField: string
  nameField: string
  searchPlaceholder: string
  createButtonText: string
  createModalTitle: string
  editModalTitle: string
  deleteModalTitle: string
  emptyStateMessage: string
  notFoundMessage: string
  createFirstButtonText: string
}

interface Entity {
  id: string;
  name: string;
}

interface EntityTabProps {
  config: EntityTabConfig
}

export default function EntityTab({ config }: EntityTabProps) {
  const [entities, setEntities] = useState<Entity[]>([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Мемоизируем функцию загрузки сущностей
  const fetchEntities = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from(config.tableName)
        .select(`${config.idField}, ${config.nameField}`)
      
      if (error) {
        console.error(`Ошибка при загрузке ${config.entityNamePlural}:`, error)
        toast.error(`Не удалось загрузить ${config.entityNamePlural}`)
        return
      }
      
      setEntities(
        data ? 
        data.map((item: any) => ({ 
          id: item[config.idField], 
          name: item[config.nameField] 
        })) : 
        []
      )
    } catch (error) {
      console.error(`Ошибка при загрузке ${config.entityNamePlural}:`, error)
      toast.error("Произошла ошибка при загрузке данных")
    } finally {
      setIsLoading(false)
    }
  }, [config])

  // Загружаем сущности при монтировании компонента
  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  // Мемоизируем фильтрованные сущности
  const filtered = useMemo(() => {
    return entities.filter(entity =>
      typeof entity.name === "string" && entity.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [entities, search])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedEntity) return undefined
    
    return {
      [config.idField]: selectedEntity.id,
      [config.nameField]: selectedEntity.name
    }
  }, [selectedEntity, config])

  // Обработчики событий
  const handleCreateEntity = useCallback(() => {
    setModalMode("create")
    setSelectedEntity(null)
    setModalOpen(true)
  }, [])

  const handleEditEntity = useCallback((entity: Entity) => {
    setModalMode("edit")
    setSelectedEntity(entity)
    setModalOpen(true)
  }, [])

  const handleDeleteEntityClick = useCallback((entity: Entity) => {
    setSelectedEntity(entity)
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
              <CardTitle className="text-xl font-semibold">Управление {config.entityNamePlural}</CardTitle>
              <div className="flex justify-end gap-2">
                <Input
                  placeholder={config.searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Button size="default" onClick={handleCreateEntity}>{config.createButtonText}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Название {config.entityName}</TableHead>
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
            <CardTitle className="text-xl font-semibold">Управление {config.entityNamePlural}</CardTitle>
            <div className="flex justify-end gap-2">
              <Input
                placeholder={config.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button size="default" onClick={handleCreateEntity}>{config.createButtonText}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base">Название {config.entityName}</TableHead>
                <TableHead className="w-48 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map(entity => (
                  <TableRow key={entity.id}>
                    <TableCell className="text-base font-medium">{entity.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEditEntity(entity)}>
                          Изменить
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeleteEntityClick(entity)}>
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
                          ? config.notFoundMessage 
                          : config.emptyStateMessage
                      }
                      buttonText={config.createFirstButtonText}
                      onButtonClick={handleCreateEntity}
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
        title={modalMode === "create" ? config.createModalTitle : config.editModalTitle}
        mode={modalMode}
        table={config.tableName}
        idField={config.idField}
        nameField={config.nameField}
        entity={entityData}
        onSuccess={fetchEntities}
      />

      {selectedEntity && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={handleDeleteModalOpenChange}
          title={config.deleteModalTitle}
          entityName={selectedEntity.name}
          table={config.tableName}
          idField={config.idField}
          entityId={selectedEntity.id}
          onSuccess={fetchEntities}
        />
      )}
    </div>
  )
} 