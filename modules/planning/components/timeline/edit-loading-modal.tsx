"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import type { Loading } from "../../types"
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

interface EditLoadingModalProps {
  loading: Loading
  setEditingLoading: (loading: Loading | null) => void
  theme: string
}

export function EditLoadingModal({ loading, setEditingLoading, theme }: EditLoadingModalProps) {
  // Состояние для отслеживания процесса сохранения и удаления
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // Состояние для отслеживания ошибок валидации
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Состояние для подтверждения удаления
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Получаем функции из сторов
  const setNotification = useUiStore((state) => state.setNotification)
  const clearNotification = useUiStore((state) => state.clearNotification)
  const updateLoadingInStore = usePlanningStore((state) => state.updateLoading)
  const deleteLoadingInStore = usePlanningStore((state) => state.deleteLoading)

  // Локальное состояние для формы
  const [formData, setFormData] = useState({
    startDate: loading.startDate.toISOString().split("T")[0],
    endDate: loading.endDate.toISOString().split("T")[0],
    rate: loading.rate,
    projectId: loading.projectId || "",
    sectionId: loading.sectionId || "",
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
    
    // Создаем AbortController для отмены запроса
    const abortController = new AbortController()
    
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("project_id, project_name")
        .eq("project_status", "active")
        .order("project_name")
        .abortSignal(abortController.signal)

      if (error) {
        console.error("Ошибка при загрузке проектов:", error)
        return
      }

      // Проверяем, не был ли запрос отменен
      if (!abortController.signal.aborted) {
        setProjects(data || [])
      }
    } catch (error) {
      // Игнорируем ошибки отмены запроса
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error("Ошибка при загрузке проектов:", error)
      }
    } finally {
      // Проверяем, не был ли запрос отменен перед обновлением состояния
      if (!abortController.signal.aborted) {
        setIsLoadingProjects(false)
      }
    }
    
    // Возвращаем функцию очистки для отмены запроса
    return () => {
      abortController.abort()
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
    const cleanup = fetchProjects()

    // Если у загрузки есть projectId, загружаем разделы для этого проекта
    if (loading.projectId) {
      fetchSections(loading.projectId)
    }

    // Возвращаем функцию очистки
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.())
    }
  }, [loading.projectId])

  // Устанавливаем название проекта в поле поиска после загрузки проектов
  useEffect(() => {
    if (loading.projectId && projects.length > 0) {
      const currentProject = projects.find((p) => p.project_id === loading.projectId)
      if (currentProject) {
        setProjectSearchTerm(currentProject.project_name)
      }
    }
  }, [loading.projectId, projects])

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

    // Проверка ставки с явной проверкой на конечное число
    if (!Number.isFinite(formData.rate)) {
      newErrors.rate = "Ставка должна быть числом"
    } else if (formData.rate <= 0) {
      newErrors.rate = "Ставка должна быть больше 0"
    } else if (formData.rate > 2) {
      newErrors.rate = "Ставка не может быть больше 2"
    }

    // Проверка: если выбран проект, то должен быть выбран и раздел
    if (formData.projectId && !formData.sectionId) {
      newErrors.sectionId = "При выборе проекта необходимо выбрать раздел"
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
      // Подготавливаем данные для обновления - только измененные поля
      const updatedLoading: Partial<Loading> = {
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        rate: formData.rate,
      }

      // Добавляем проект и раздел только если они были изменены
      if (formData.projectId && formData.projectId !== loading.projectId) {
        const selectedProject = projects.find((p) => p.project_id === formData.projectId)
        updatedLoading.projectId = formData.projectId
        updatedLoading.projectName = selectedProject?.project_name
      }

      if (formData.sectionId && formData.sectionId !== loading.sectionId) {
        const selectedSection = sections.find((s) => s.section_id === formData.sectionId)
        updatedLoading.sectionId = formData.sectionId
        updatedLoading.sectionName = selectedSection?.section_name
      }

      // Вызываем функцию обновления из стора
      const result = await updateLoadingInStore(loading.id, updatedLoading)

      if (!result.success) {
        throw new Error(result.error || "Ошибка при обновлении загрузки")
      }

      // Показываем уведомление об успехе
      const currentProject = updatedLoading.projectName || loading.projectName || "Неизвестный проект"
      setNotification(`Загрузка для проекта "${currentProject}" успешно обновлена`)

      // Автоматически скрываем уведомление через 3 секунды
      setTimeout(() => {
        clearNotification()
      }, 3000)

      // Закрываем модальное окно
      setEditingLoading(null)

      console.log("Загрузка успешно обновлена:", loading.id, updatedLoading)
    } catch (error) {
      console.error("Ошибка при сохранении загрузки:", error)

      // Показываем уведомление об ошибке
      setNotification(
        `Ошибка при обновлении загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
      )

      // Автоматически скрываем уведомление через 5 секунд
      setTimeout(() => {
        clearNotification()
      }, 5000)
    } finally {
      // Сбрасываем состояние загрузки
      setIsSaving(false)
    }
  }

  // Обработчик удаления
  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      // Вызываем функцию удаления из стора
      const result = await deleteLoadingInStore(loading.id)

      if (!result.success) {
        throw new Error(result.error || "Ошибка при удалении загрузки")
      }

      // Показываем уведомление об успехе
      setNotification("Загрузка успешно удалена")

      // Автоматически скрываем уведомление через 3 секунды
      setTimeout(() => {
        clearNotification()
      }, 3000)

      // Закрываем модальное окно
      setEditingLoading(null)

      console.log("Загрузка успешно удалена:", loading.id)
    } catch (error) {
      console.error("Ошибка при удалении загрузки:", error)

      // Показываем уведомление об ошибке
      setNotification(`Ошибка при удалении загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)

      // Автоматически скрываем уведомление через 5 секунд
      setTimeout(() => {
        clearNotification()
      }, 5000)
    } finally {
      // Сбрасываем состояние удаления и скрываем подтверждение
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleProjectSelect = (project: Project) => {
    setFormData((prev) => ({ 
      ...prev, 
      projectId: project.project_id,
      sectionId: "" // Сбрасываем sectionId при выборе нового проекта
    }))
    setProjectSearchTerm(project.project_name)
    fetchSections(project.project_id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={cn("rounded-lg p-6 w-96 max-w-[90vw]", theme === "dark" ? "bg-slate-800" : "bg-white")}>
        <h3 className={cn("text-lg font-semibold mb-4", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
          Редактирование загрузки
        </h3>

        {showDeleteConfirm ? (
          <div className="space-y-4">
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ? "bg-amber-900 border-amber-700" : "bg-amber-50 border-amber-200",
              )}
            >
              <div className="flex items-start space-x-3">
                <div
                  className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-amber-400" : "text-amber-600")}
                >
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-amber-200" : "text-amber-800")}>
                    Внимание! Удаление загрузки
                  </h4>
                  <div className={cn("mt-2 text-sm", theme === "dark" ? "text-amber-300" : "text-amber-700")}>
                    <p className="mb-2">
                      <strong>Устаревшие загрузки следует архивировать, а не удалять.</strong>
                    </p>
                    <p className="mb-2">
                      Удаление предназначено только для <strong>неправильно созданных</strong> загрузок.
                    </p>
                    <p>Вы уверены, что эта загрузка была создана по ошибке и её нужно полностью удалить?</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className={cn(
                  "px-4 py-2 text-sm rounded border",
                  theme === "dark"
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50",
                  isDeleting ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[120px]",
                  theme === "dark"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-red-500 text-white hover:bg-red-600",
                  isDeleting ? "opacity-70 cursor-not-allowed" : "",
                )}
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Удаление...
                  </>
                ) : (
                  "Да, удалить"
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="project-search-container relative">
                <label
                  className={cn(
                    "block text-sm font-medium mb-1",
                    theme === "dark" ? "text-slate-300" : "text-slate-700",
                  )}
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
                    onBlur={() => setTimeout(() => setShowProjectDropdown(false), 100)}
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
                        "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded border",
                        theme === "dark"
                          ? "bg-slate-800 border-slate-600"
                          : "bg-white border-slate-300",
                      )}
                    >
                      {filteredProjects.map((project) => (
                        <div
                          key={project.project_id}
                          onClick={() => handleProjectSelect(project)}
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
                  className={cn(
                    "block text-sm font-medium mb-1",
                    theme === "dark" ? "text-slate-300" : "text-slate-700",
                  )}
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
                    className={cn(
                      "block text-sm font-medium mb-1",
                      theme === "dark" ? "text-slate-300" : "text-slate-700",
                    )}
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
                    className={cn(
                      "block text-sm font-medium mb-1",
                      theme === "dark" ? "text-slate-300" : "text-slate-700",
                    )}
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
                  className={cn(
                    "block text-sm font-medium mb-1",
                    theme === "dark" ? "text-slate-300" : "text-slate-700",
                  )}
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

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className={cn(
                  "px-4 py-2 text-sm rounded border",
                  theme === "dark"
                    ? "border-red-600 text-red-400 hover:bg-red-900 hover:bg-opacity-20"
                    : "border-red-300 text-red-600 hover:bg-red-50",
                  isSaving ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                Удалить
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingLoading(null)}
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
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Сохранение...
                    </>
                  ) : (
                    "Сохранить"
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
