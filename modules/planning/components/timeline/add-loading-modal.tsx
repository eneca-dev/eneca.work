"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import type { Employee } from "../../types"
import { useUiStore } from "@/stores/useUiStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { supabase } from "@/lib/supabase-client"

interface Project {
  project_id: string
  project_name: string
}

interface Section {
  section_id: string
  section_name: string
  project_id: string
}

interface AddLoadingModalProps {
  employee: Employee
  setShowAddModal: (show: boolean) => void
  theme: string
}

export function AddLoadingModal({ employee, setShowAddModal, theme }: AddLoadingModalProps) {
  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState(false)
  // Состояние для отслеживания ошибок валидации
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Получаем функции из сторов
  const setNotification = useUiStore((state) => state.setNotification)
  const clearNotification = useUiStore((state) => state.clearNotification)
  const createLoadingInStore = usePlanningStore((state) => state.createLoading)

  // Локальное состояние для формы
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // +7 дней
    rate: 1,
    projectId: "",
    sectionId: "",
  })

  // Состояния для списков проектов и разделов
  const [projects, setProjects] = useState<Project[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingSections, setIsLoadingSections] = useState(false)

  // Состояния для поиска проектов - упрощенные
  const [projectSearchTerm, setProjectSearchTerm] = useState("")
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // Загрузка списка проектов
  const fetchProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("project_id, project_name")
        .eq("project_status", "active")
        .order("project_name")

      if (error) {
        console.error("Ошибка при загрузке проектов:", error)
        return
      }

      setProjects(data || [])
    } catch (error) {
      console.error("Ошибка при загрузке проектов:", error)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  // Загрузка разделов для выбранного проекта
  const fetchSections = async (projectId: string) => {
    if (!projectId) {
      setSections([])
      return
    }

    setIsLoadingSections(true)
    try {
      const { data, error } = await supabase
        .from("view_section_hierarchy")
        .select("section_id, section_name, project_id")
        .eq("project_id", projectId)
        .order("section_name")

      if (error) {
        console.error("Ошибка при загрузке разделов:", error)
        return
      }

      setSections(data || [])
    } catch (error) {
      console.error("Ошибка при загрузке разделов:", error)
    } finally {
      setIsLoadingSections(false)
    }
  }

  // Загрузка проектов при открытии модального окна
  useEffect(() => {
    fetchProjects()
  }, [])

  // Простая фильтрация проектов прямо в рендере
  const filteredProjects =
    projectSearchTerm.trim() === ""
      ? projects.slice(0, 10)
      : projects
          .filter((project) => project.project_name.toLowerCase().includes(projectSearchTerm.toLowerCase()))
          .slice(0, 10)

  // Обработчик изменения полей формы
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    // Если изменился проект, обновляем список разделов и сбрасываем выбранный раздел
    if (name === "projectId" && value !== formData.projectId) {
      fetchSections(value)
      setFormData((prev) => ({
        ...prev,
        projectId: value,
        sectionId: "", // Сбрасываем выбранный раздел
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: name === "rate" ? Number.parseFloat(value) : value,
      }))
    }

    // Очищаем ошибку для этого поля при изменении
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Функция валидации формы
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Проверка даты начала
    if (!formData.startDate) {
      newErrors.startDate = "Дата начала обязательна"
    }

    // Проверка даты окончания
    if (!formData.endDate) {
      newErrors.endDate = "Дата окончания обязательна"
    } else if (formData.startDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = "Дата окончания должна быть позже даты начала"
    }

    // Проверка ставки
    if (formData.rate <= 0) {
      newErrors.rate = "Ставка должна быть больше 0"
    } else if (formData.rate > 2) {
      newErrors.rate = "Ставка не может быть больше 2"
    }

    // Проверка проекта
    if (!formData.projectId) {
      newErrors.projectId = "Необходимо выбрать проект"
    }

    // Проверка раздела
    if (!formData.sectionId) {
      newErrors.sectionId = "Необходимо выбрать раздел"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Обработчик сохранения
  const handleSave = async () => {
    // Валидация формы
    if (!validateForm()) {
      return
    }

    // Устанавливаем состояние загрузки
    setIsSaving(true)

    try {
      // Получаем названия проекта и раздела
      const selectedProject = projects.find((p) => p.project_id === formData.projectId)
      const selectedSection = sections.find((s) => s.section_id === formData.sectionId)

      // Подготавливаем данные для создания загрузки
      const loadingData = {
        responsibleId: employee.id,
        sectionId: formData.sectionId,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        rate: formData.rate,
        projectName: selectedProject?.project_name,
        sectionName: selectedSection?.section_name,
      }

      // Вызываем функцию создания из стора
      const result = await createLoadingInStore(loadingData)

      if (!result.success) {
        throw new Error(result.error || "Ошибка при создании загрузки")
      }

      // Показываем уведомление об успехе
      const projectName = selectedProject?.project_name || "Неизвестный проект"
      setNotification(`Загрузка для сотрудника ${employee.fullName} на проект "${projectName}" успешно создана`)

      // Автоматически скрываем уведомление через 3 секунды
      setTimeout(() => {
        clearNotification()
      }, 3000)

      // Закрываем модальное окно
      setShowAddModal(false)

      console.log("Загрузка успешно создана:", result.loadingId, {
        employee: employee.fullName,
        project: selectedProject?.project_name,
        section: selectedSection?.section_name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        rate: formData.rate,
      })
    } catch (error) {
      console.error("Ошибка при создании загрузки:", error)

      // Показываем уведомление об ошибке
      setNotification(`Ошибка при создании загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)

      // Автоматически скрываем уведомление через 5 секунд
      setTimeout(() => {
        clearNotification()
      }, 5000)
    } finally {
      // Сбрасываем состояние загрузки
      setIsSaving(false)
    }
  }

  const handleProjectSelect = (project: Project) => {
    setFormData((prev) => ({ ...prev, projectId: project.project_id }))
    setProjectSearchTerm(project.project_name)
    setShowProjectDropdown(false)
    fetchSections(project.project_id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={cn("rounded-lg p-6 w-96 max-w-[90vw]", theme === "dark" ? "bg-slate-800" : "bg-white")}>
        <h3 className={cn("text-lg font-semibold mb-4", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
          Добавление загрузки
        </h3>

        <div
          className={cn(
            "p-4 rounded-lg border mb-4",
            theme === "dark" ? "bg-teal-900 border-teal-700" : "bg-teal-50 border-teal-200",
          )}
        >
          <div className="flex items-start space-x-3">
            <div className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-teal-400" : "text-teal-600")}>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-teal-200" : "text-teal-800")}>
                Создание новой загрузки
              </h4>
              <div className={cn("mt-2 text-sm", theme === "dark" ? "text-teal-300" : "text-teal-700")}>
                <p className="mb-1">
                  <strong>Сотрудник:</strong> {employee.fullName}
                </p>
                <p className="mb-1">
                  <strong>Должность:</strong> {employee.position || "Не указана"}
                </p>
                <p>
                  <strong>Команда:</strong> {employee.teamName || "Не указана"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="project-search-container relative">
            <label
              className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
            >
              Проект
            </label>
            <div className="relative">
              <input
                type="text"
                value={projectSearchTerm}
                onChange={(e) => {
                  setProjectSearchTerm(e.target.value)
                  setShowProjectDropdown(true)
                }}
                onFocus={() => setShowProjectDropdown(true)}
                onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                placeholder="Поиск проекта..."
                disabled={isSaving || isLoadingProjects}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800",
                  errors.projectId ? "border-red-500" : "",
                  isSaving || isLoadingProjects ? "opacity-50 cursor-not-allowed" : "",
                )}
              />

              {showProjectDropdown && filteredProjects.length > 0 && (
                <div
                  className={cn(
                    "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded border shadow-lg",
                    theme === "dark" ? "bg-slate-700 border-slate-600" : "bg-white border-slate-300",
                  )}
                >
                  {filteredProjects.map((project) => (
                    <div
                      key={project.project_id}
                      onMouseDown={() => handleProjectSelect(project)}
                      className={cn(
                        "px-3 py-2 cursor-pointer text-sm",
                        theme === "dark" ? "hover:bg-slate-600 text-slate-200" : "hover:bg-slate-50 text-slate-800",
                      )}
                    >
                      {project.project_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.projectId && <p className="text-xs text-red-500 mt-1">{errors.projectId}</p>}
            {isLoadingProjects && <p className="text-xs text-slate-500 mt-1">Загрузка проектов...</p>}
          </div>

          <div>
            <label
              className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
            >
              Раздел
            </label>
            <select
              name="sectionId"
              value={formData.sectionId}
              onChange={handleChange}
              disabled={isSaving || isLoadingSections || !formData.projectId}
              className={cn(
                "w-full text-sm rounded border px-3 py-2",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200"
                  : "bg-white border-slate-300 text-slate-800",
                errors.sectionId ? "border-red-500" : "",
                isSaving || isLoadingSections || !formData.projectId ? "opacity-50 cursor-not-allowed" : "",
              )}
            >
              <option value="">Выберите раздел</option>
              {sections.map((section) => (
                <option key={section.section_id} value={section.section_id}>
                  {section.section_name}
                </option>
              ))}
            </select>
            {errors.sectionId && <p className="text-xs text-red-500 mt-1">{errors.sectionId}</p>}
            {isLoadingSections && <p className="text-xs text-slate-500 mt-1">Загрузка разделов...</p>}
            {!formData.projectId && <p className="text-xs text-slate-500 mt-1">Сначала выберите проект</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
              >
                Дата начала
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                disabled={isSaving}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800",
                  errors.startDate ? "border-red-500" : "",
                  isSaving ? "opacity-50 cursor-not-allowed" : "",
                )}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
            </div>

            <div>
              <label
                className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
              >
                Дата окончания
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                disabled={isSaving}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800",
                  errors.endDate ? "border-red-500" : "",
                  isSaving ? "opacity-50 cursor-not-allowed" : "",
                )}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
            </div>
          </div>

          <div>
            <label
              className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
            >
              Ставка
            </label>
            <input
              type="number"
              name="rate"
              step="0.1"
              min="0.1"
              max="2"
              value={formData.rate}
              onChange={handleChange}
              disabled={isSaving}
              className={cn(
                "w-full text-sm rounded border px-3 py-2",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200"
                  : "bg-white border-slate-300 text-slate-800",
                errors.rate ? "border-red-500" : "",
                isSaving ? "opacity-50 cursor-not-allowed" : "",
              )}
            />
            {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowAddModal(false)}
            disabled={isSaving}
            className={cn(
              "px-4 py-2 text-sm rounded border",
              theme === "dark"
                ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50",
              isSaving ? "opacity-50 cursor-not-allowed" : "",
            )}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[100px]",
              theme === "dark"
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "bg-teal-500 text-white hover:bg-teal-600",
              isSaving ? "opacity-70 cursor-not-allowed" : "",
            )}
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Создание...
              </>
            ) : (
              "Создать"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
