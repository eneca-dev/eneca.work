"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DecompositionItem, DecompositionTemplate, SectionHierarchy } from "../types"
import { Trash2, Download, Upload, Save, BookmarkPlus, BookmarkCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SaveTemplateDialog } from "./SaveTemplateDialog"
import { LoadTemplateDialog } from "./LoadTemplateDialog"
import { parseXLSX } from "../utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DecompositionFormProps {
  sections: SectionHierarchy[]
  filteredSections: SectionHierarchy[]
  selectedSectionId: string | null
  onSelectSection: (sectionId: string) => void
  projects: { id: string; name: string }[]
  stages: { id: string; name: string }[]
  objects: { id: string; name: string }[]
  selectedProjectId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
  handleProjectSelect: (projectId: string) => void
  handleStageSelect: (stageId: string) => void
  handleObjectSelect: (objectId: string) => void
  items: DecompositionItem[]
  onAddItem: () => void
  onUpdateItem: (index: number, field: keyof DecompositionItem, value: string | number) => void
  onRemoveItem: (index: number) => void
  onSetItems: (items: DecompositionItem[]) => void
  onSave: () => void
  onFileDownload: () => void // Новый проп для скачивания XLSX
  isLoading: boolean
  department: string
  userName: string
  userAvatar?: string
  // Новые пропсы для работы с шаблонами
  templates: DecompositionTemplate[]
  saveTemplateDialogOpen: boolean
  loadTemplateDialogOpen: boolean
  openSaveTemplateDialog: () => void
  closeSaveTemplateDialog: () => void
  openLoadTemplateDialog: () => void
  closeLoadTemplateDialog: () => void
  handleSaveAsTemplate: (templateName: string) => Promise<void>
  handleLoadFromTemplate: (templateId: string) => Promise<void>
}

export const DecompositionForm: React.FC<DecompositionFormProps> = ({
  sections,
  filteredSections,
  selectedSectionId,
  onSelectSection,
  projects,
  stages,
  objects,
  selectedProjectId,
  selectedStageId,
  selectedObjectId,
  handleProjectSelect,
  handleStageSelect,
  handleObjectSelect,
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSetItems,
  onSave,
  onFileDownload, // Добавьте этот проп
  isLoading,
  department,
  userName,
  userAvatar,
  // Новые пропсы для работы с шаблонами
  templates,
  saveTemplateDialogOpen,
  loadTemplateDialogOpen,
  openSaveTemplateDialog,
  closeSaveTemplateDialog,
  openLoadTemplateDialog,
  closeLoadTemplateDialog,
  handleSaveAsTemplate,
  handleLoadFromTemplate,
}) => {
  const [fileInputKey, setFileInputKey] = useState<number>(0)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [showDebug, setShowDebug] = useState<boolean>(false) // State to control debug visibility
  const [newItemValue, setNewItemValue] = useState<string>("") // Состояние для хранения значения новой строки
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sheetSelectionOpen, setSheetSelectionOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const selectedSection = sections.find((s) => s.section_id === selectedSectionId)

  const handleFileUploadClick = () => {
    // Reset file input to allow selecting the same file again
    setFileInputKey((prev) => prev + 1)
    setSheetNames([])
    setSelectedSheet(undefined)
  }

  // Обработчик для загрузки XLSX файла
  const handleFileUploadXLSX = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Парсим XLSX файл только для получения списка листов
      const { sheetNames: names } = await parseXLSX(file)

      setSheetNames(names)
      setPendingFile(file)

      if (names.length === 1) {
        // Если только один лист, загружаем его сразу
        await loadDataFromSheet(file, names[0])
      } else {
        // Если несколько листов, показываем модальное окно
        setSheetSelectionOpen(true)
      }

      // Сбрасываем input для возможности повторной загрузки того же файла
      event.target.value = ""
    } catch (error) {
      console.error("Error parsing XLSX:", error)
      alert("Ошибка при чтении файла: " + (error as Error).message)
    }
  }

  const loadDataFromSheet = async (file: File, sheetName: string) => {
    try {
      const { newItems } = await parseXLSX(file, sheetName)

      // Преобразуем данные из файла в формат DecompositionItem
      const formattedItems: DecompositionItem[] = newItems.map((item) => ({
        work_type: item.work_type || "",
        work_content: item.work_content || "",
        complexity_level: item.complexity_level || "",
        labor_costs: item.labor_costs || 0,
        duration_days: 0, // Значение по умолчанию
        execution_period: 0, // Значение по умолчанию
      }))

      // Заменяем все элементы одной операцией
      onSetItems(formattedItems)

      console.log(`Загружено ${formattedItems.length} записей из листа "${sheetName}"`)
    } catch (error) {
      console.error("Error parsing XLSX:", error)
      alert("Ошибка при чтении файла: " + (error as Error).message)
    }
  }

  // Обработчик для добавления новой строки
  const handleAddNewItem = () => {
    if (newItemValue.trim()) {
      onAddItem()
      onUpdateItem(items.length, "work_type", newItemValue.trim())
      setNewItemValue("") // Очищаем поле ввода после добавления
    }
  }

  // Keyboard shortcut to toggle debug info (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault()
        setShowDebug((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Отладочная информация
  useEffect(() => {
    setDebugInfo(
      JSON.stringify(
        {
          sectionsCount: sections.length,
          projectsCount: projects.length,
          stagesCount: stages.length,
          objectsCount: objects.length,
          filteredSectionsCount: filteredSections.length,
          templatesCount: templates.length,
        },
        null,
        2,
      ),
    )
  }, [sections, projects, stages, objects, filteredSections, templates])

  return (
    <div className="space-y-6">
      {/* Отладочная информация - скрыта по умолчанию, можно показать с помощью Ctrl+Shift+D */}
      {showDebug && (
        <div className="p-4 border rounded-md mb-4 bg-yellow-50">
          <h3 className="text-lg font-medium mb-2">Отладочная информация</h3>
          <p>Количество секций: {sections.length}</p>
          <p>Количество проектов: {projects.length}</p>
          <p>Количество стадий: {stages.length}</p>
          <p>Количество объектов: {objects.length}</p>
          <p>Количество отфильтрованных секций: {filteredSections.length}</p>
          <p>Количество шаблонов: {templates.length}</p>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">{debugInfo}</pre>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Раздел (Проект/стадия/объект/раздел)</label>
          <Select
            value={selectedSectionId || ""}
            onValueChange={(value) => {
              // Проверяем, что значение не пустое
              if (value) {
                onSelectSection(value)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите раздел" />
            </SelectTrigger>
            <SelectContent>
              {filteredSections.map((section) => (
                <SelectItem key={section.section_id} value={section.section_id}>
                  {`${section.project_name} / ${section.stage_name} / ${section.object_name} / ${section.section_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Декомпозиция работ</h3>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={onFileDownload} size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Скачать данные в XLSX</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button variant="outline" onClick={handleFileUploadClick} size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUploadXLSX}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    ref={fileInputRef}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Загрузить XLSX (заменит текущие данные)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Кнопка "Сохранить как шаблон" */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={openSaveTemplateDialog}
                  disabled={isLoading || items.length === 0}
                  size="icon"
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Сохранить как шаблон</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Кнопка "Загрузить из шаблона" */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={openLoadTemplateDialog}
                  disabled={isLoading || templates.length === 0}
                  size="icon"
                >
                  <BookmarkCheck className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Загрузить из шаблона</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={onSave} disabled={isLoading || !selectedSectionId} size="icon">
                  <Save className="h-4 w-4" />
                  {isLoading && <span className="ml-2">...</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Сохранить</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="border rounded-md overflow-auto max-h-[calc(100vh-300px)] lg:max-h-[calc(100vh-250px)]">
        <table className="w-full table-fixed min-w-[800px]">
          <colgroup>
            <col className="w-12 lg:w-16" />
            <col className="w-[18%] lg:w-[22%]" />
            <col className="w-[45%] lg:w-[48%]" />
            <col className="w-[12%] lg:w-[10%]" />
            <col className="w-[10%] lg:w-[8%]" />
            <col className="w-[8%] lg:w-[6%]" />
          </colgroup>
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Группа работ</th>
              <th className="px-4 py-2 text-left font-medium">Наименование задачи</th>
              <th className="px-4 py-2 text-left font-medium">Уровень сложности</th>
              <th className="px-4 py-2 text-left font-medium">Часов</th>
              <th className="px-4 py-2 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t hover:bg-[hsl(var(--table-row-hover))]">
                <td className="px-2 sm:px-4 py-2 text-sm sticky left-0 bg-[hsl(var(--table-number-bg))] text-left text-[hsl(var(--table-number-text))]">
                  {index + 1}
                </td>
                <td className="px-4 py-2 text-left">
                  <Input
                    value={item.work_type}
                    onChange={(e) => onUpdateItem(index, "work_type", e.target.value)}
                    className="border-0 focus:ring-0 p-0 h-8 bg-transparent w-full text-left"
                  />
                </td>
                <td className="px-4 py-2 text-left">
                  <Input
                    value={item.work_content}
                    onChange={(e) => onUpdateItem(index, "work_content", e.target.value)}
                    className="border-0 focus:ring-0 p-0 h-8 bg-transparent w-full text-left"
                  />
                </td>
                <td className="px-4 py-2 text-left">
                  <Input
                    type="text"
                    value={item.complexity_level || ""}
                    onChange={(e) => onUpdateItem(index, "complexity_level", e.target.value)}
                    className="border-0 focus:ring-0 p-0 h-8 bg-transparent w-full text-left"
                  />
                </td>
                <td className="px-4 py-2 text-left">
                  <Input
                    type="number"
                    value={item.labor_costs}
                    onChange={(e) => onUpdateItem(index, "labor_costs", Number.parseFloat(e.target.value) || 0)}
                    className="border-0 focus:ring-0 p-0 h-8 bg-transparent w-full text-left"
                  />
                </td>
                <td className="px-4 py-2 text-left">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveItem(index)}
                          className="h-8 w-8 p-0 mx-auto"
                        >
                          <Trash2 className="h-5 w-5 text-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Удалить</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
              </tr>
            ))}
            {/* Добавляем пустую строку в конце для возможности добавления новых данных */}
            <tr className="border-t hover:bg-[hsl(var(--table-row-hover))]">
              <td className="px-2 sm:px-4 py-2 text-sm sticky left-0 bg-[hsl(var(--table-number-bg))] text-left text-[hsl(var(--table-number-text))]">
                {items.length + 1}
              </td>
              <td className="px-4 py-2 text-left">
                <Input
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  onBlur={handleAddNewItem}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddNewItem()
                    }
                  }}
                  placeholder="Добавить..."
                  className="border-0 focus:ring-0 p-0 h-8 bg-transparent w-full text-left"
                />
              </td>
              <td className="px-4 py-2 text-left"></td>
              <td className="px-4 py-2 text-left"></td>
              <td className="px-4 py-2 text-left"></td>
              <td className="px-4 py-2 text-left"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Диалоги для работы с шаблонами */}
      <SaveTemplateDialog
        isOpen={saveTemplateDialogOpen}
        onClose={closeSaveTemplateDialog}
        onSave={handleSaveAsTemplate}
        isLoading={isLoading}
      />

      <LoadTemplateDialog
        isOpen={loadTemplateDialogOpen}
        onClose={closeLoadTemplateDialog}
        onLoad={handleLoadFromTemplate}
        templates={templates}
        isLoading={isLoading}
        selectedSectionId={selectedSectionId}
      />

      {/* Модальное окно для выбора листа */}
      <Dialog open={sheetSelectionOpen} onOpenChange={setSheetSelectionOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Выберите лист для загрузки</DialogTitle>
            <DialogDescription>
              В файле найдено несколько листов. Выберите лист, данные из которого нужно загрузить.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {sheetNames.map((name) => (
              <Button
                key={name}
                variant="outline"
                className="justify-start"
                onClick={async () => {
                  if (pendingFile) {
                    await loadDataFromSheet(pendingFile, name)
                    setSheetSelectionOpen(false)
                    setPendingFile(null)
                    setSheetNames([])
                  }
                }}
              >
                {name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSheetSelectionOpen(false)
                setPendingFile(null)
                setSheetNames([])
              }}
            >
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
