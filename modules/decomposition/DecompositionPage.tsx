"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DecompositionForm } from "./components/DecompositionForm"
import { DecompositionList } from "./components/DecompositionList"
import { DecompositionTemplates } from "./components/DecompositionTemplates"
import { useDecomposition } from "./hooks/useDecomposition"
import type { TabType } from "./types"
import { useUserStore } from "@/stores/useUserStore"
import { UserStoreInitializer } from "./components/UserStoreInitializer"
import { Card, CardContent } from "@/components/ui/card"
// Импортируем компонент UserSelector
import { UserSelector } from "./components/UserSelector"
import { exportToXLSX } from "./utils"
import { supabase } from "./utils"
import type { SectionHierarchy } from "./types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HelpCircle } from "lucide-react"

type DecompositionStage = {
  decomposition_stage_id: string
  decomposition_stage_name: string
  decomposition_stage_start?: string | null
  decomposition_stage_finish?: string | null
}

const DecompositionPage = () => {
  const router = useRouter()
  // Получаем данные напрямую из userStore для отладки
  const userStoreDirectly = useUserStore()
  const [isLoaded, setIsLoaded] = useState(false)

  // Состояния для просмотра всех разделов
  const [allSections, setAllSections] = useState<SectionHierarchy[]>([])
  const [isLoadingAllSections, setIsLoadingAllSections] = useState(false)
  const [viewMode, setViewMode] = useState<"user" | "all">("user")
  const [viewSectionId, setViewSectionId] = useState<string | null>(null)
  const [viewItems, setViewItems] = useState<any[]>([])

  // Состояния для фильтрации всех разделов
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([])
  const [allStages, setAllStages] = useState<{ id: string; name: string }[]>([])
  const [allObjects, setAllObjects] = useState<{ id: string; name: string }[]>([])
  const [filteredAllSections, setFilteredAllSections] = useState<SectionHierarchy[]>([])
  const [selectedAllProjectId, setSelectedAllProjectId] = useState<string | null>(null)
  const [selectedAllStageId, setSelectedAllStageId] = useState<string | null>(null)
  const [selectedAllObjectId, setSelectedAllObjectId] = useState<string | null>(null)

  const [instructionOpen, setInstructionOpen] = useState(false)

  const {
    userName,
    userProfile,
    departmentName,
    isAuthenticated,
    activeTab,
    setActiveTab,
    sections,
    selectedSectionId,
    selectSection,
    decompositionItems,
    isLoading,
    error,
    addDecompositionItem,
    updateDecompositionItem,
    removeDecompositionItem,
    setDecompositionItems,
    handleFileUpload,
    handleSave,
    filteredSections,
    projects,
    stages,
    objects,
    selectedProjectId,
    selectedStageId,
    selectedObjectId,
    handleProjectSelect,
    handleStageSelect,
    handleObjectSelect,
    // Переменные для работы с шаблонами
    templates,
    saveTemplateDialogOpen,
    loadTemplateDialogOpen,
    openSaveTemplateDialog,
    closeSaveTemplateDialog,
    openLoadTemplateDialog,
    closeLoadTemplateDialog,
    handleSaveAsTemplate,
    handleLoadFromTemplate,
    handleDeleteTemplate,

    // Новые: работа с этапами
    decompositionStages: managementStages,
    stageItems,
    fetchStages,
    fetchStageItems,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    assignItemToStage,
  } = useDecomposition()

  // Проверяем аутентификацию
  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      console.log("User not authenticated, redirecting to login")
      router.push("/auth/login")
    }
  }, [isAuthenticated, router, isLoaded])

  // Добавляем эффект для проверки загрузки данных
  useEffect(() => {
    // Даем время на загрузку данных из localStorage
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // Загружаем все разделы
  useEffect(() => {
    const fetchAllSections = async () => {
      if (!isLoaded || viewMode !== "all") return

      setIsLoadingAllSections(true)
      try {
        // Получаем только разделы, где есть ответственный
        const { data, error } = await supabase
          .from("view_section_hierarchy")
          .select("*")
          .not("section_responsible_id", "is", null)

        if (error) {
          console.error("Error fetching all sections:", error)
          return
        }

        console.log(`Loaded ${data?.length || 0} sections with responsible users`)
        setAllSections(data || [])
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setIsLoadingAllSections(false)
      }
    }

    fetchAllSections()
  }, [isLoaded, viewMode])

  // Подгружаем этапы и элементы при выборе раздела в режиме "Этапы"
  useEffect(() => {
    if (activeTab === "stages" && selectedSectionId) {
      fetchStages(selectedSectionId)
      fetchStageItems(selectedSectionId)
    }
  }, [activeTab, selectedSectionId, fetchStages, fetchStageItems])

  // Обрабатываем данные всех разделов
  useEffect(() => {
    if (allSections.length > 0) {
      // Извлекаем уникальные проекты
      const uniqueProjects = Array.from(
        new Map(
          allSections.map((section) => [section.project_id, { id: section.project_id, name: section.project_name }]),
        ).values(),
      )
      setAllProjects(uniqueProjects)

      // Фильтруем разделы на основе выбранных значений
      let filtered = [...allSections]

      if (selectedAllProjectId) {
        filtered = filtered.filter((section) => section.project_id === selectedAllProjectId)

        // Извлекаем уникальные стадии для выбранного проекта
        const uniqueStages = Array.from(
          new Map(
            filtered.map((section) => [section.stage_id, { id: section.stage_id, name: section.stage_name }]),
          ).values(),
        )
        setAllStages(uniqueStages)
      } else {
        setAllStages([])
        setSelectedAllStageId(null)
      }

      if (selectedAllStageId) {
        filtered = filtered.filter((section) => section.stage_id === selectedAllStageId)

        // Извлекаем уникальные объекты для выбранной стадии
        const uniqueObjects = Array.from(
          new Map(
            filtered.map((section) => [section.object_id, { id: section.object_id, name: section.object_name }]),
          ).values(),
        )
        setAllObjects(uniqueObjects)
      } else {
        setAllObjects([])
        setSelectedAllObjectId(null)
      }

      if (selectedAllObjectId) {
        filtered = filtered.filter((section) => section.object_id === selectedAllObjectId)
      }

      setFilteredAllSections(filtered)
    }
  }, [allSections, selectedAllProjectId, selectedAllStageId, selectedAllObjectId])

  // Функция для загрузки декомпозиции выбранного раздела
  const loadViewDecomposition = async (sectionId: string) => {
    if (!sectionId) return

    setIsLoadingAllSections(true)
    try {
      // Загружаем строки декомпозиции для выбранного раздела из decomposition_items
      const { data, error } = await supabase
        .from("decomposition_items")
        .select(`
          decomposition_item_description,
          decomposition_item_planned_hours,
          decomposition_item_work_category_id,
          work_categories:decomposition_item_work_category_id(work_category_name)
        `)
        .eq("decomposition_item_section_id", sectionId)
        .order("decomposition_item_order", { ascending: true })

      if (error) {
        console.error("Error loading decomposition items:", error)
        setViewItems([])
        return
      }

      const mapped = (data || []).map((row: any) => ({
        work_type: row?.work_categories?.work_category_name || "",
        work_content: row?.decomposition_item_description || "",
        complexity_level: "",
        labor_costs: Number(row?.decomposition_item_planned_hours) || 0,
        duration_days: 0,
        execution_period: 0,
      }))

      console.log(`Loaded ${mapped.length} decomposition items for section ${sectionId}`)
      setViewItems(mapped)
    } catch (error) {
      console.error("Error:", error)
      setViewItems([])
    } finally {
      setIsLoadingAllSections(false)
    }
  }

  // Функции для обработки выбора в режиме просмотра всех разделов
  const handleAllProjectSelect = (projectId: string) => {
    setSelectedAllProjectId(projectId)
    setSelectedAllStageId(null)
    setSelectedAllObjectId(null)
    setViewSectionId(null)
  }

  const handleAllStageSelect = (stageId: string) => {
    setSelectedAllStageId(stageId)
    setSelectedAllObjectId(null)
    setViewSectionId(null)
  }

  const handleAllObjectSelect = (objectId: string) => {
    setSelectedAllObjectId(objectId)
    setViewSectionId(null)
  }

  const handleAllSectionSelect = (sectionId: string) => {
    setViewSectionId(sectionId)
    loadViewDecomposition(sectionId)
  }

  // Если данные еще загружаются, показываем индикатор загрузки
  if (!isLoaded) {
    return (
      <div className="container mx-auto py-6 text-center">
        <div className="animate-pulse">Загрузка данных пользователя...</div>
      </div>
    )
  }

  // Проверяем аутентификацию перед рендерингом
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-6 text-center">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-lg">Необходима авторизация для доступа к модулю декомпозиции</p>
          <p className="text-sm text-muted-foreground">Вы будете перенаправлены на страницу входа...</p>
        </div>
      </div>
    )
  }

  // Функция для скачивания данных в формате XLSX
  const handleXLSXDownload = async () => {
    if (decompositionItems.length === 0) {
      alert("Нет данных для экспорта")
      return
    }

    try {
      // Получаем Blob с данными XLSX
      const blob = await exportToXLSX(decompositionItems)

      // Создаем ссылку для скачивания
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      // Формируем имя файла с датой и временем
      const now = new Date()
      const fileName = `decomposition_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
        .getDate()
        .toString()
        .padStart(
          2,
          "0",
        )}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}.xlsx`

      link.setAttribute("href", url)
      link.setAttribute("download", fileName)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
link.click()
document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting to XLSX:", error)
      alert("Ошибка при экспорте данных")
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
      {/* Компонент для инициализации userStore */}
      <UserStoreInitializer />

      {/* В компоненте DecompositionPage, обновим блок с заголовком и кнопками: */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Модуль декомпозиции</h1>
        <div className="flex items-center gap-4">
          <UserSelector />
        </div>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full">
              <TabsList className="bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="view" className="rounded-md px-6 py-1.5 text-sm font-medium">
                  Просмотр
                </TabsTrigger>
                <TabsTrigger value="create" className="rounded-md px-6 py-1.5 text-sm font-medium">
                  Создание
                </TabsTrigger>
                <TabsTrigger value="templates" className="rounded-md px-6 py-1.5 text-sm font-medium">
                  Шаблоны
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Dialog open={instructionOpen} onOpenChange={setInstructionOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Инструкция
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Инструкция по использованию системы декомпозиции</DialogTitle>
                  <DialogDescription>Руководство по работе с модулем декомпозиции проектных работ</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-6 text-sm">
                    <section>
                      <h3 className="text-lg font-semibold mb-3">Общее описание</h3>
                      <p className="mb-2">
                        Модуль декомпозиции предназначен для детального планирования и структурирования проектных работ.
                        Система позволяет разбивать крупные задачи на более мелкие компоненты с указанием трудозатрат и
                        уровня сложности.
                      </p>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">Жизненный цикл декомпозиции</h3>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">1. Создание декомпозиции</h4>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Выберите раздел проекта из иерархии: Проект → Стадия → Объект → Раздел</li>
                            <li>Добавьте элементы декомпозиции вручную или загрузите из XLSX файла</li>
                            <li>
                              Укажите для каждого элемента: группу работ, наименование задачи, уровень сложности и часы
                            </li>
                            <li>Сохраните декомпозицию</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium">2. Работа с шаблонами</h4>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Сохраните готовую декомпозицию как шаблон для повторного использования</li>
                            <li>Загрузите существующий шаблон в новый раздел</li>
                            <li>Управляйте шаблонами: просматривайте, фильтруйте и удаляйте</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium">3. Просмотр и анализ</h4>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Просматривайте свои декомпозиции или все декомпозиции в системе</li>
                            <li>Фильтруйте по проектам, стадиям и объектам</li>
                            <li>Экспортируйте данные в XLSX формат</li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">Вкладки системы</h3>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">📋 Просмотр</h4>
                          <p>
                            Просмотр существующих декомпозиций. Переключение между "Мои разделы" и "Все разделы" для
                            просмотра собственных или всех декомпозиций в системе.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-medium">✏️ Создание</h4>
                          <p>
                            Создание и редактирование декомпозиций. Добавление элементов вручную, загрузка из файлов,
                            сохранение в базе данных.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-medium">📚 Шаблоны</h4>
                          <p>
                            Управление шаблонами декомпозиций. Просмотр, фильтрация по отделам, поиск и удаление
                            шаблонов.
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">Работа с файлами</h3>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">📤 Импорт XLSX</h4>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Поддерживаются файлы с расширением .xlsx и .xls</li>
                            <li>При наличии нескольких листов система предложит выбрать нужный</li>
                            <li>Обязательные столбцы: "Группа работ", "Наименование задачи"</li>
                            <li>Дополнительные столбцы: "Уровень сложности", "Часов"</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium">📥 Экспорт XLSX</h4>
                          <p>
                            Выгрузка текущей декомпозиции в формате Excel с сохранением всех данных и форматирования.
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">Структура данных</h3>
                      <div className="space-y-2">
                        <div>
                          <strong>Группа работ:</strong> Категория или тип выполняемых работ
                        </div>
                        <div>
                          <strong>Наименование задачи:</strong> Детальное описание конкретной задачи
                        </div>
                        <div>
                          <strong>Уровень сложности:</strong> Оценка сложности выполнения (опционально)
                        </div>
                        <div>
                          <strong>Часов:</strong> Планируемые трудозатраты в часах
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">Права доступа</h3>
                      <div className="space-y-2">
                        <p>
                          <strong>Создание:</strong> Пользователи могут создавать декомпозиции только для разделов, где
                          они назначены ответственными
                        </p>
                        <p>
                          <strong>Просмотр:</strong> Доступ к просмотру всех декомпозиций в системе
                        </p>
                        <p>
                          <strong>Шаблоны:</strong> Шаблоны доступны всем пользователям отдела для использования
                        </p>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">Советы по использованию</h3>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Используйте понятные и стандартизированные названия для групп работ</li>
                        <li>Детализируйте задачи до уровня, удобного для планирования и контроля</li>
                        <li>Создавайте шаблоны для типовых видов работ</li>
                        <li>Регулярно обновляйте трудозатраты на основе фактических данных</li>
                        <li>Используйте фильтры для быстрого поиска нужных разделов</li>
                      </ul>
                    </section>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border rounded-lg shadow-sm">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="view" className="mt-0">
                {/* Добавляем переключатель режимов просмотра */}
                <div className="flex justify-end mb-4">
                  <div className="flex space-x-2">
                    <Button
                      variant={viewMode === "user" ? "default" : "outline"}
                      onClick={() => setViewMode("user")}
                      size="sm"
                    >
                      Мои разделы
                    </Button>
                    <Button
                      variant={viewMode === "all" ? "default" : "outline"}
                      onClick={() => setViewMode("all")}
                      size="sm"
                    >
                      Все разделы
                    </Button>
                  </div>
                </div>

                {viewMode === "user" ? (
                  <DecompositionList
                    sections={sections}
                    filteredSections={filteredSections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={selectSection}
                    projects={projects}
                    stages={stages}
                    objects={objects}
                    selectedProjectId={selectedProjectId}
                    selectedStageId={selectedStageId}
                    selectedObjectId={selectedObjectId}
                    handleProjectSelect={handleProjectSelect}
                    handleStageSelect={handleStageSelect}
                    handleObjectSelect={handleObjectSelect}
                    items={decompositionItems}
                    isLoading={isLoading}
                    department={departmentName}
                    userName={userName || ""}
                    userAvatar={userProfile?.avatar_url || undefined}
                  />
                ) : (
                  <DecompositionList
                    sections={allSections}
                    filteredSections={filteredAllSections}
                    selectedSectionId={viewSectionId}
                    onSelectSection={handleAllSectionSelect}
                    projects={allProjects}
                    stages={allStages}
                    objects={allObjects}
                    selectedProjectId={selectedAllProjectId}
                    selectedStageId={selectedAllStageId}
                    selectedObjectId={selectedAllObjectId}
                    handleProjectSelect={handleAllProjectSelect}
                    handleStageSelect={handleAllStageSelect}
                    handleObjectSelect={handleAllObjectSelect}
                    items={viewItems}
                    isLoading={isLoadingAllSections}
                    department={departmentName}
                    userName={userName || ""}
                    userAvatar={userProfile?.avatar_url || undefined}
                  />
                )}
              </TabsContent>

              <TabsContent value="create" className="mt-0">
                <DecompositionForm
                  sections={sections}
                  filteredSections={filteredSections}
                  selectedSectionId={selectedSectionId}
                  onSelectSection={selectSection}
                  projects={projects}
                  stages={stages}
                  objects={objects}
                  selectedProjectId={selectedProjectId}
                  selectedStageId={selectedStageId}
                  selectedObjectId={selectedObjectId}
                  handleProjectSelect={handleProjectSelect}
                  handleStageSelect={handleStageSelect}
                  handleObjectSelect={handleObjectSelect}
                  items={decompositionItems}
                  onAddItem={addDecompositionItem}
                  onUpdateItem={updateDecompositionItem}
                  onRemoveItem={removeDecompositionItem}
                  onSetItems={setDecompositionItems}
                  onSave={handleSave}
                  onFileDownload={handleXLSXDownload}
                  isLoading={isLoading}
                  department={departmentName}
                  userName={userName || ""}
                  userAvatar={userProfile?.avatar_url || undefined}
                  // Новые пропсы для работы с шаблонами
                  templates={templates}
                  saveTemplateDialogOpen={saveTemplateDialogOpen}
                  loadTemplateDialogOpen={loadTemplateDialogOpen}
                  openSaveTemplateDialog={openSaveTemplateDialog}
                  closeSaveTemplateDialog={closeSaveTemplateDialog}
                  openLoadTemplateDialog={openLoadTemplateDialog}
                  closeLoadTemplateDialog={closeLoadTemplateDialog}
                  handleSaveAsTemplate={handleSaveAsTemplate}
                  handleLoadFromTemplate={handleLoadFromTemplate}
                />
              </TabsContent>

              <TabsContent value="stages" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Этапы раздела</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedSectionId) {
                          createStage(selectedSectionId, { name: "Новый этап" })
                        }
                      }}
                      disabled={!selectedSectionId}
                    >
                      Добавить этап
                    </Button>
                  </div>

                  {/* Простое дерево: этап → его строки */}
                  <div className="border rounded-md">
                    <div className="divide-y">
                      {managementStages.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">Этапы отсутствуют</div>
                      ) : (
                        managementStages.map((stage: DecompositionStage) => (
                          <div key={stage.decomposition_stage_id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">
                                  {stage.decomposition_stage_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {stage.decomposition_stage_start || "—"} → {stage.decomposition_stage_finish || "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateStage(stage.decomposition_stage_id, {
                                      decomposition_stage_name: `${stage.decomposition_stage_name} *`,
                                    })
                                  }
                                >
                                  Переименовать
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteStage(stage.decomposition_stage_id)}
                                >
                                  Удалить
                                </Button>
                              </div>
                            </div>

                            {/* Декомпозиции этапа */}
                            <div className="mt-3 border rounded-md overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px]">
                                  <thead className="bg-muted">
                                    <tr>
                                      <th className="px-2 sm:px-4 py-2 text-left font-medium">#</th>
                                      <th className="px-4 py-2 text-left font-medium">Группа работ</th>
                                      <th className="px-4 py-2 text-left font-medium">Наименование задачи</th>
                                      <th className="px-4 py-2 text-left font-medium">Часов</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stageItems
                                      .filter((it) => it.decomposition_item_stage_id === stage.decomposition_stage_id)
                                      .map((it, idx) => (
                                        <tr key={`${stage.decomposition_stage_id}-${it.id}-${idx}`} className="border-t">
                                          <td className="px-2 sm:px-4 py-2">{idx + 1}</td>
                                          <td className="px-4 py-2">{it.work_type}</td>
                                          <td className="px-4 py-2">{it.work_content}</td>
                                          <td className="px-4 py-2">{it.labor_costs}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="templates" className="mt-0">
                <DecompositionTemplates
                  templates={templates}
                  isLoading={isLoading}
                  onDeleteTemplate={handleDeleteTemplate}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DecompositionPage
