"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import EntityModal from "./EntityModal"
import DeleteConfirmModal from "./DeleteConfirmModal"
import EmptyState from "./EmptyState"

// Типы для сущностей
interface Category {
  id: string;
  name: string;
}

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  // Мемоизируем функцию загрузки категорий
  const fetchCategories = useCallback(async () => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from("categories")
        .select("category_id, category_name")
      
      if (error) {
        console.error('Ошибка при загрузке категорий:', error)
        return
      }
      
      setCategories(
        data ? 
        data.map(cat => ({ 
          id: cat.category_id, 
          name: cat.category_name 
        })) : 
        []
      )
    } catch (error) {
      console.error('Ошибка при загрузке категорий:', error)
    }
  }, [])

  // Загружаем категории при монтировании компонента
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Мемоизируем фильтрованные категории
  const filtered = useMemo(() => {
    return categories.filter(cat =>
      typeof cat.name === "string" && cat.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [categories, search])

  // Мемоизируем entity для EntityModal
  const entityData = useMemo(() => {
    if (!selectedCategory) return undefined
    
    return {
      category_id: selectedCategory.id,
      category_name: selectedCategory.name
    }
  }, [selectedCategory])

  // Обработчики событий
  const handleCreateCategory = useCallback(() => {
    setModalMode("create")
    setSelectedCategory(null)
    setModalOpen(true)
  }, [])

  const handleEditCategory = useCallback((category: Category) => {
    setModalMode("edit")
    setSelectedCategory(category)
    setModalOpen(true)
  }, [])

  const handleDeleteCategoryClick = useCallback((category: Category) => {
    setSelectedCategory(category)
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
            <CardTitle className="text-xl font-semibold">Управление категориями</CardTitle>
            <div className="flex justify-end gap-2">
              <Input
                placeholder="Поиск категорий..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button size="default" onClick={handleCreateCategory}>Создать категорию</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base">Название категории</TableHead>
                <TableHead className="w-48 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell className="text-base font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEditCategory(cat)}>
                          Изменить
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeleteCategoryClick(cat)}>
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">
                    Категории не найдены
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
        title={modalMode === "create" ? "Создать категорию" : "Редактировать категорию"}
        mode={modalMode}
        table="categories"
        idField="category_id"
        nameField="category_name"
        entity={entityData}
        onSuccess={fetchCategories}
      />

      {selectedCategory && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onOpenChange={handleDeleteModalOpenChange}
          title="Удаление категории"
          entityName={selectedCategory.name}
          table="categories"
          idField="category_id"
          entityId={selectedCategory.id}
          onSuccess={fetchCategories}
        />
      )}
    </div>
  )
} 