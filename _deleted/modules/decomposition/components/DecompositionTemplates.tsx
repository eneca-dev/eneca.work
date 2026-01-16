"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { DecompositionTemplate } from "../types"
import { Trash2, Eye, Search, Filter } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface DecompositionTemplatesProps {
  templates: DecompositionTemplate[]
  isLoading: boolean
  onDeleteTemplate: (templateId: string) => Promise<void>
  // onApplyTemplate: (templateId: string) => Promise<void>
  // departmentName: string
}

export const DecompositionTemplates: React.FC<DecompositionTemplatesProps> = ({
  templates,
  isLoading,
  onDeleteTemplate,
  // onApplyTemplate,
  // departmentName,
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewTemplate, setViewTemplate] = useState<DecompositionTemplate | null>(null)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])

  // Получаем список уникальных отделов из шаблонов
  const departments = useMemo(() => {
    const uniqueDepartments = new Map<string, string>()

    templates.forEach((template) => {
      if (template.decomposition_department_id && template.department_name) {
        uniqueDepartments.set(template.decomposition_department_id, template.department_name)
      }
    })

    return Array.from(uniqueDepartments.entries()).map(([id, name]) => ({
      id,
      name,
    }))
  }, [templates])

  // Фильтрация шаблонов по поисковому запросу и выбранным отделам
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Фильтр по поисковому запросу
      const matchesSearch =
        template.decomposition_template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.creator_name && template.creator_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (template.department_name && template.department_name.toLowerCase().includes(searchQuery.toLowerCase()))

      // Фильтр по выбранным отделам
      const matchesDepartment =
        selectedDepartments.length === 0 || selectedDepartments.includes(template.decomposition_department_id)

      return matchesSearch && matchesDepartment
    })
  }, [templates, searchQuery, selectedDepartments])

  // Обработчики для диалогов
  const openViewDialog = (template: DecompositionTemplate) => {
    setViewTemplate(template)
  }

  const closeViewDialog = () => {
    setViewTemplate(null)
  }

  const openDeleteDialog = (templateId: string) => {
    setDeleteTemplateId(templateId)
  }

  const closeDeleteDialog = () => {
    setDeleteTemplateId(null)
  }

  const handleDeleteTemplate = async () => {
    if (deleteTemplateId) {
      await onDeleteTemplate(deleteTemplateId)
      closeDeleteDialog()
    }
  }

  // Обработчик для выбора/отмены выбора отдела
  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments((prev) => {
      if (prev.includes(departmentId)) {
        return prev.filter((id) => id !== departmentId)
      } else {
        return [...prev, departmentId]
      }
    })
  }

  // Безопасное форматирование даты
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Дата неизвестна"

    try {
      return format(new Date(dateString), "d MMMM yyyy", { locale: ru })
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Дата неизвестна"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h3 className="text-lg font-medium">Шаблоны декомпозиций</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Фильтр по отделам */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Отделы</span>
                {selectedDepartments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedDepartments.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Фильтр по отделам</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {departments.map((dept) => (
                <DropdownMenuCheckboxItem
                  key={dept.id}
                  checked={selectedDepartments.includes(dept.id)}
                  onCheckedChange={() => toggleDepartment(dept.id)}
                >
                  {dept.name}
                </DropdownMenuCheckboxItem>
              ))}
              {departments.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">Нет доступных отделов</div>
              )}
              {selectedDepartments.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setSelectedDepartments([])}
                  >
                    Сбросить фильтры
                  </Button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Поиск */}
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск шаблонов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Загрузка шаблонов...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery || selectedDepartments.length > 0 ? "Шаблоны не найдены" : "Нет доступных шаблонов"}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 sm:px-4 py-2 text-left font-medium">Название шаблона</th>
                  <th className="px-2 sm:px-4 py-2 text-left font-medium">Отдел</th>
                  <th className="px-2 sm:px-4 py-2 text-left font-medium">Автор</th>
                  <th className="px-2 sm:px-4 py-2 text-left font-medium">Дата создания</th>
                  <th className="px-2 sm:px-4 py-2 text-left font-medium">Элементов</th>
                  <th className="px-2 sm:px-4 py-2 text-center font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => (
                  <tr
                    key={template.decomposition_template_id}
                    className="border-t hover:bg-[hsl(var(--table-row-hover))]"
                  >
                    <td className="px-2 sm:px-4 py-2 font-medium">
                      {template.decomposition_template_name}
                    </td>
                    <td className="px-2 sm:px-4 py-2">{template.department_name || "Неизвестно"}</td>
                    <td className="px-2 sm:px-4 py-2">{template.creator_name || "Неизвестно"}</td>
                    <td className="px-2 sm:px-4 py-2">{formatDate(template.decomposition_template_created_at)}</td>
                    <td className="px-2 sm:px-4 py-2">
                      {template.decomposition_template_content?.length ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2">
                      <div className="flex justify-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openViewDialog(template)}
                                className="h-8 w-8"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Просмотреть</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(template.decomposition_template_id)}
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Удалить</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Диалог просмотра шаблона */}
      <Dialog open={!!viewTemplate} onOpenChange={(open) => !open && closeViewDialog()}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{viewTemplate?.decomposition_template_name}</DialogTitle>
            <DialogDescription>
              Отдел: {viewTemplate?.department_name || "Неизвестно"} • Автор:{" "}
              {viewTemplate?.creator_name || "Неизвестно"} • Создан:{" "}
              {viewTemplate?.decomposition_template_created_at
                ? formatDate(viewTemplate.decomposition_template_created_at)
                : "Дата неизвестна"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded-md border">
            <div className="p-4">
              <table className="w-full">
                <thead className="bg-muted sticky top-0 z-10 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium w-10">#</th>
                    <th className="px-4 py-2 text-left font-medium">Группа работ</th>
                    <th className="px-4 py-2 text-left font-medium">Наименование задачи</th>
                    <th className="px-4 py-2 text-left font-medium">Уровень сложности</th>
                    <th className="px-4 py-2 text-left font-medium">Часов</th>
                  </tr>
                </thead>
                <tbody>
                  {viewTemplate?.decomposition_template_content.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">{item.work_type}</td>
                      <td className="px-4 py-2">{item.work_content}</td>
                      <td className="px-4 py-2">{item.complexity_level?.toString() || "-"}</td>
                      <td className="px-4 py-2">{item.labor_costs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={closeViewDialog}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление шаблона</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот шаблон? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-red-500 hover:bg-red-600">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
