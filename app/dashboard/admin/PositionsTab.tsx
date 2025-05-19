"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import EntityModal from "./components/EntityModal"
import DeleteConfirmModal from "./components/DeleteConfirmModal"

// Типы для сущностей
interface Position {
  id: string;
  name: string;
}

export default function PositionsTab() {
  const [positions, setPositions] = useState<Position[]>([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)

  // Мемоизируем функцию загрузки должностей
  const fetchPositions = useCallback(async () => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from("positions")
        .select("position_id, position_name")
      
      if (error) {
        console.error('Ошибка при загрузке должностей:', error)
        return
      }
      
      setPositions(
        data ? 
        data.map(pos => ({ 
          id: pos.position_id, 
          name: pos.position_name 
        })) : 
        []
      )
    } catch (error) {
      console.error('Ошибка при загрузке должностей:', error)
    }
  }, [])

  // Загружаем должности при монтировании компонента
  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  // Мемоизируем фильтрованные должности
  const filtered = useMemo(() => {
    return positions.filter(pos =>
      typeof pos.name === "string" && pos.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [positions, search])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedPosition) return undefined
    
    return {
      position_id: selectedPosition.id,
      position_name: selectedPosition.name
    }
  }, [selectedPosition])

  // Обработчики событий
  const handleCreatePosition = useCallback(() => {
    setModalMode("create")
    setSelectedPosition(null)
    setModalOpen(true)
  }, [])

  const handleEditPosition = useCallback((position: Position) => {
    setModalMode("edit")
    setSelectedPosition(position)
    setModalOpen(true)
  }, [])

  const handleDeletePositionClick = useCallback((position: Position) => {
    setSelectedPosition(position)
    setDeleteModalOpen(true)
  }, [])

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open)
  }, [])

  const handleDeleteModalOpenChange = useCallback((open: boolean) => {
    setDeleteModalOpen(open)
  }, [])

  return (
    <div className="mb-6 space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-xl font-semibold">Управление должностями</CardTitle>
            <div className="flex justify-end gap-2">
              <Input
                placeholder="Поиск должностей..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button size="default" onClick={handleCreatePosition}>Создать должность</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base">Название должности</TableHead>
                <TableHead className="w-48 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map(pos => (
                  <TableRow key={pos.id}>
                    <TableCell className="text-base font-medium">{pos.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEditPosition(pos)}>
                          Изменить
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeletePositionClick(pos)}>
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">
                    Должности не найдены
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
        title={modalMode === "create" ? "Создать должность" : "Редактировать должность"}
        mode={modalMode}
        table="positions"
        idField="position_id"
        nameField="position_name"
        entity={entityData}
        onSuccess={fetchPositions}
      />

      {selectedPosition && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={handleDeleteModalOpenChange}
          title="Удаление должности"
          entityName={selectedPosition.name}
          table="positions"
          idField="position_id"
          entityId={selectedPosition.id}
          onSuccess={fetchPositions}
        />
      )}
    </div>
  )
} 