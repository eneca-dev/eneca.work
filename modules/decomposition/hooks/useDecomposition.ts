"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useDecompositionStore } from "../store"
import { useUserStore } from "@/stores/useUserStore"
import { supabase } from "../utils"
import type { SectionHierarchy } from "../types"

export const useDecomposition = () => {
  // Получаем данные пользователя из userStore
  const userStore = useUserStore()
  const { id, name, profile, isAuthenticated } = userStore

  const [departmentName, setDepartmentName] = useState<string>("")
  const [storeLoaded, setStoreLoaded] = useState(false)

  // Состояния для диалогов шаблонов
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false)

  // Добавьте эти состояния после существующих useState
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [stages, setStages] = useState<{ id: string; name: string }[]>([])
  const [objects, setObjects] = useState<{ id: string; name: string }[]>([])
  const [filteredSections, setFilteredSections] = useState<SectionHierarchy[]>([])

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)

  const {
    activeTab,
    setActiveTab,
    sections,
    selectedSectionId,
    decompositionItems,
    templates,
    isLoading,
    error,
    fetchSections,
    selectSection,
    addDecompositionItem,
    updateDecompositionItem,
    removeDecompositionItem,
    setDecompositionItems,
    saveDecomposition,
    fetchTemplates,
    saveAsTemplate,
    loadFromTemplate,
    deleteTemplate,
  } = useDecompositionStore()

  // Проверяем, загружен ли store
  useEffect(() => {
    // Даем время на загрузку данных из localStorage
    const timer = setTimeout(() => {
      setStoreLoaded(true)
      console.log("UserStore loaded:", userStore)
    }, 300)

    return () => clearTimeout(timer)
  }, [userStore])

  // Загружаем разделы при изменении ID пользователя
  useEffect(() => {
    if (id && storeLoaded && isAuthenticated) {
      console.log("Fetching sections for authenticated user ID:", id)
      // Сбрасываем выбранные значения при смене пользователя
      setSelectedProjectId(null)
      setSelectedStageId(null)
      setSelectedObjectId(null)
      selectSection(null)
      // Загружаем разделы для аутентифицированного пользователя
      fetchSections(id)
    } else if (storeLoaded && !isAuthenticated) {
      console.log("User not authenticated, cannot fetch sections")
      // Очищаем данные если пользователь не аутентифицирован
      selectSection(null)
    }
  }, [id, fetchSections, storeLoaded, selectSection, isAuthenticated])

  // Загружаем название отдела по departmentId
  useEffect(() => {
    const fetchDepartmentName = async () => {
      if (profile?.departmentId) {
        try {
          console.log("Fetching department for ID:", profile.departmentId)
          const { data, error } = await supabase
            .from("departments")
            .select("department_name")
            .eq("department_id", profile.departmentId)
            .single()

          if (error) {
            console.error("Error fetching department:", error)
            return
          }

          if (data) {
            console.log("Department data:", data)
            setDepartmentName(data.department_name)
          }
        } catch (error) {
          console.error("Error:", error)
        }
      } else {
        // Если departmentId не определен, оставляем пустое значение
        setDepartmentName("")
      }
    }

    if (storeLoaded) {
      fetchDepartmentName()
    }
  }, [profile?.departmentId, storeLoaded])

  // Загружаем шаблоны для отдела пользователя
  useEffect(() => {
    if (storeLoaded && profile?.departmentId) {
      // Передаем departmentId пользователя для загрузки только шаблонов его отдела
      fetchTemplates(profile.departmentId)
    }
  }, [fetchTemplates, storeLoaded, profile?.departmentId])

  // Добавьте этот эффект для обработки данных разделов
  useEffect(() => {
    if (sections.length > 0) {
      console.log("Processing sections data:", sections.length, "sections found")

      // Извлекаем уникальные проекты
      const uniqueProjects = Array.from(
        new Map(
          sections.map((section) => [section.project_id, { id: section.project_id, name: section.project_name }]),
        ).values(),
      )
      console.log("Unique projects:", uniqueProjects.length)
      setProjects(uniqueProjects)

      // Фильтруем разделы на основе выбранных значений
      let filtered = [...sections]

      if (selectedProjectId) {
        filtered = filtered.filter((section) => section.project_id === selectedProjectId)

        // Извлекаем уникальные стадии для выбранного проекта
        const uniqueStages = Array.from(
          new Map(
            filtered.map((section) => [section.stage_id, { id: section.stage_id, name: section.stage_name }]),
          ).values(),
        )
        console.log("Unique stages for selected project:", uniqueStages.length)
        setStages(uniqueStages)
      } else {
        setStages([])
        setSelectedStageId(null)
      }

      if (selectedStageId) {
        filtered = filtered.filter((section) => section.stage_id === selectedStageId)

        // Извлекаем уникальные объекты для выбранной стадии
        const uniqueObjects = Array.from(
          new Map(
            filtered.map((section) => [section.object_id, { id: section.object_id, name: section.object_name }]),
          ).values(),
        )
        console.log("Unique objects for selected stage:", uniqueObjects.length)
        setObjects(uniqueObjects)
      } else {
        setObjects([])
        setSelectedObjectId(null)
      }

      if (selectedObjectId) {
        filtered = filtered.filter((section) => section.object_id === selectedObjectId)
      }

      console.log("Filtered sections:", filtered.length)
      setFilteredSections(filtered)
    } else {
      console.log("No sections data available")
    }
  }, [sections, selectedProjectId, selectedStageId, selectedObjectId])

  // Добавьте эти функции для обработки выбора
  const handleProjectSelect = (projectId: string) => {
    console.log("Project selected:", projectId)
    setSelectedProjectId(projectId)
    setSelectedStageId(null)
    setSelectedObjectId(null)
    selectSection(null)
  }

  const handleStageSelect = (stageId: string) => {
    console.log("Stage selected:", stageId)
    setSelectedStageId(stageId)
    setSelectedObjectId(null)
    selectSection(null)
  }

  const handleObjectSelect = (objectId: string) => {
    console.log("Object selected:", objectId)
    setSelectedObjectId(objectId)
    selectSection(null)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Проверяем расширение файла
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      alert('Поддерживаются только файлы Excel (.xlsx, .xls)')
      return
    }

    console.log('XLSX file upload not implemented yet')
    // TODO: Реализовать загрузку XLSX файлов
  }

  const handleSave = async () => {
    if (id && selectedSectionId) {
      await saveDecomposition(id, selectedSectionId)
    }
  }

  // Функции для работы с шаблонами
  const handleSaveAsTemplate = async (templateName: string) => {
    if (!id) {
      throw new Error("Пользователь не авторизован")
    }

    if (!profile?.departmentId) {
      throw new Error("Отдел пользователя не определен")
    }

    await saveAsTemplate(templateName, id, profile.departmentId)
  }

  const handleLoadFromTemplate = async (templateId: string) => {
    if (!id) {
      throw new Error("Пользователь не авторизован")
    }

    if (!selectedSectionId) {
      throw new Error("Не выбран раздел для сохранения")
    }

    await loadFromTemplate(templateId, id, selectedSectionId)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplate(templateId)
  }

  const openSaveTemplateDialog = () => {
    setSaveTemplateDialogOpen(true)
  }

  const closeSaveTemplateDialog = () => {
    setSaveTemplateDialogOpen(false)
  }

  const openLoadTemplateDialog = () => {
    setLoadTemplateDialogOpen(true)
  }

  const closeLoadTemplateDialog = () => {
    setLoadTemplateDialogOpen(false)
  }

  // Добавляем эффект для сброса всех выбранных значений при переключении вкладок
  useEffect(() => {
    // Сбрасываем все выбранные значения при переключении вкладок
    setSelectedProjectId(null)
    setSelectedStageId(null)
    setSelectedObjectId(null)
    selectSection(null)
  }, [activeTab, selectSection])

  return {
    // Существующие переменные...
    userId: id,
    userName: name,
    userProfile: profile,
    departmentName,
    isAuthenticated: isAuthenticated || false, // Добавляем fallback значение
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
    storeLoaded,

    // Добавьте эти новые переменные
    projects,
    stages,
    objects,
    filteredSections,
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

    // Остальные существующие переменные...
  }
}
