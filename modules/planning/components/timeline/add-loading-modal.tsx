"use client"

import type React from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
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

  // Рефы для хранения ID таймеров
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Получаем функции из сторов
  const setNotification = useUiStore((state) => state.setNotification)
  const clearNotification = useUiStore((state) => state.clearNotification)
  const createLoadingInStore = usePlanningStore((state) => state.createLoading)
  const toggleSectionExpanded = usePlanningStore((state) => state.toggleSectionExpanded)

  // Локальное состояние для формы
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // +7 дней
    rate: 1,
    projectId: "",
    sectionId: "",
    comment: "",
  })

  // Состояния для списков проектов и разделов
  const [projects, setProjects] = useState<Project[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingSections, setIsLoadingSections] = useState(false)
  // Новые состояния для стадий и объектов
  const [stages, setStages] = useState<{ stage_id: string; stage_name: string }[]>([])
  const [objects, setObjects] = useState<{ object_id: string; object_name: string }[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string>("")
  const [selectedObjectId, setSelectedObjectId] = useState<string>("")

  // Состояния для поиска проектов - упрощенные
  const [projectSearchTerm, setProjectSearchTerm] = useState("")
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // Очистка таймеров при размонтировании компонента
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current)
      }
    }
  }, [])

  // Загрузка списка проектов
  const fetchProjects = async () => {
    await Sentry.startSpan(
      {
        op: "db.query",
        name: "Загрузка списка проектов для модала",
      },
      async (span) => {
        setIsLoadingProjects(true)
        try {
          span.setAttribute("table", "projects")
          span.setAttribute("modal_type", "add_loading")
          span.setAttribute("employee_id", employee.id)
          
          const { data, error } = await supabase
            .from("projects")
            .select("project_id, project_name")
            .eq("project_status", "active")
            .order("project_name")

          if (error) {
            span.setAttribute("db.success", false)
            span.setAttribute("db.error", error.message)
            
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'fetch_projects_for_loading',
                modal: 'add_loading_modal'
              },
              extra: {
                employee_id: employee.id,
                employee_name: employee.fullName,
                error_code: error.code,
                error_details: error.details,
                timestamp: new Date().toISOString()
              }
            })
            
            setNotification("Ошибка при загрузке списка проектов. Попробуйте обновить страницу.")
            errorTimeoutRef.current = setTimeout(() => {
              clearNotification()
            }, 5000)
            return
          }

          span.setAttribute("db.success", true)
          span.setAttribute("projects_count", data?.length || 0)
          
          setProjects(data || [])
        } catch (error) {
          span.setAttribute("db.success", false)
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'fetch_projects_for_loading',
              error_type: 'unexpected_error',
              modal: 'add_loading_modal'
            },
            extra: {
              employee_id: employee.id,
              employee_name: employee.fullName,
              timestamp: new Date().toISOString()
            }
          })
          
          setNotification("Ошибка при загрузке списка проектов. Проверьте подключение к интернету.")
          errorTimeoutRef.current = setTimeout(() => {
            clearNotification()
          }, 5000)
        } finally {
          setIsLoadingProjects(false)
        }
      }
    )
  }

  // Загрузка разделов для выбранного проекта
  const fetchSections = async (projectId: string, stageId?: string, objectId?: string) => {
    if (!projectId) {
      setSections([])
      return
    }

    await Sentry.startSpan(
      {
        op: "db.query",
        name: "Загрузка разделов проекта для модала",
      },
      async (span) => {
        setIsLoadingSections(true)
        try {
          span.setAttribute("table", "view_section_hierarchy")
          span.setAttribute("project_id", projectId)
          span.setAttribute("modal_type", "add_loading")
          span.setAttribute("employee_id", employee.id)
          
          let query = supabase
            .from("view_section_hierarchy")
            .select("section_id, section_name, project_id")
            .eq("project_id", projectId)
            .order("section_name")

          if (stageId) {
            query = query.eq("stage_id", stageId)
          }
          if (objectId) {
            query = query.eq("object_id", objectId)
          }

          const { data, error } = await query

          if (error) {
            span.setAttribute("db.success", false)
            span.setAttribute("db.error", error.message)
            
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'fetch_sections_for_loading',
                modal: 'add_loading_modal'
              },
              extra: {
                project_id: projectId,
                employee_id: employee.id,
                employee_name: employee.fullName,
                error_code: error.code,
                error_details: error.details,
                timestamp: new Date().toISOString()
              }
            })
            
            setNotification("Ошибка при загрузке разделов проекта. Попробуйте выбрать проект заново.")
            errorTimeoutRef.current = setTimeout(() => {
              clearNotification()
            }, 5000)
            return
          }

          span.setAttribute("db.success", true)
          span.setAttribute("sections_count", data?.length || 0)
          
          setSections(data || [])
        } catch (error) {
          span.setAttribute("db.success", false)
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'fetch_sections_for_loading',
              error_type: 'unexpected_error',
              modal: 'add_loading_modal'
            },
            extra: {
              project_id: projectId,
              employee_id: employee.id,
              employee_name: employee.fullName,
              timestamp: new Date().toISOString()
            }
          })
          
          setNotification("Ошибка при загрузке разделов проекта. Проверьте подключение к интернету.")
          errorTimeoutRef.current = setTimeout(() => {
            clearNotification()
          }, 5000)
        } finally {
          setIsLoadingSections(false)
        }
      }
    )
  }

  // Загрузка проектов при открытии модального окна
  useEffect(() => {
    fetchProjects()
  }, [])

  // При смене проекта подгружаем список стадий и объектов
  useEffect(() => {
    const loadStageAndObjects = async () => {
      try {
        if (!formData.projectId) {
          setStages([]); setObjects([])
          return
        }
        // Стадии
        const { data: stageRows } = await supabase
          .from("stages")
          .select("stage_id, stage_name")
          .eq("stage_project_id", formData.projectId)
          .order("stage_name")
        setStages(stageRows || [])

        // Объекты проекта
        const { data: objectRows } = await supabase
          .from("view_section_hierarchy")
          .select("object_id, object_name")
          .eq("project_id", formData.projectId)
          .not("object_id", "is", null)
          .not("object_name", "is", null)
        // Уникализируем
        const map = new Map<string, { object_id: string; object_name: string }>()
        ;(objectRows || []).forEach((r: any) => {
          if (r.object_id && r.object_name && !map.has(r.object_id)) {
            map.set(r.object_id, { object_id: r.object_id, object_name: r.object_name })
          }
        })
        setObjects(Array.from(map.values()).sort((a, b) => a.object_name.localeCompare(b.object_name)))
      } catch (e) {
        console.error("Ошибка загрузки стадий/объектов:", e)
      }
    }
    loadStageAndObjects()
  }, [formData.projectId])

  // Если модалка открыта из конкретного раздела (employee может содержать sectionId в расширенных данных)
  // или ранее выбранный sectionId присутствует, автоматически подтягиваем проект по разделу
  useEffect(() => {
    const resolveProjectBySection = async () => {
      const sectionId = formData.sectionId || (employee as any)?.sectionId
      if (!sectionId || formData.projectId) return

      try {
        const { data, error } = await supabase
          .from("view_section_hierarchy")
          .select("project_id, project_name, section_id, section_name")
          .eq("section_id", sectionId)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error("Ошибка при получении проекта по разделу:", error)
          return
        }

        if (data?.project_id) {
          setFormData((prev) => ({
            ...prev,
            projectId: data.project_id,
            sectionId: data.section_id,
          }))

          setProjects((prev) => {
            const exists = prev.some((p) => p.project_id === data.project_id)
            return exists ? prev : [{ project_id: data.project_id, project_name: data.project_name }, ...prev]
          })

          setProjectSearchTerm(data.project_name ?? "")
          fetchSections(data.project_id)
        }
      } catch (e) {
        console.error("Не удалось восстановить проект по разделу:", e)
      }
    }

    resolveProjectBySection()
  }, [formData.sectionId])

  // Простая фильтрация проектов прямо в рендере
  const filteredProjects =
    projectSearchTerm.trim() === ""
      ? projects.slice(0, 10)
      : projects
          .filter((project) => project.project_name.toLowerCase().includes(projectSearchTerm.toLowerCase()))
          .slice(0, 10)

  // Обработчик изменения полей формы
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    // Если изменился проект, обновляем список разделов и сбрасываем выбранный раздел
    if (name === "projectId" && value !== formData.projectId) {
      setSelectedStageId("")
      setSelectedObjectId("")
      fetchSections(value)
      setFormData((prev) => ({
        ...prev,
        projectId: value,
        sectionId: "", // Сбрасываем выбранный раздел
      }))
    } else if (name === "stageId") {
      setSelectedStageId(value)
      fetchSections(formData.projectId, value || undefined, selectedObjectId || undefined)
    } else if (name === "objectId") {
      setSelectedObjectId(value)
      fetchSections(formData.projectId, selectedStageId || undefined, value || undefined)
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

    await Sentry.startSpan(
      {
        op: "ui.action",
        name: "Создание загрузки сотрудника",
      },
      async (span) => {
        // Устанавливаем состояние загрузки
        setIsSaving(true)

        try {
          // Получаем названия проекта и раздела
          const selectedProject = projects.find((p) => p.project_id === formData.projectId)
          const selectedSection = sections.find((s) => s.section_id === formData.sectionId)

          if (!selectedProject || !selectedSection) {
            throw new Error("Не удалось найти выбранный проект или раздел")
          }

          // Устанавливаем атрибуты spans
          span.setAttribute("employee.id", employee.id)
          span.setAttribute("employee.name", employee.fullName || employee.name)
          span.setAttribute("project.id", formData.projectId)
          span.setAttribute("project.name", selectedProject.project_name)
          span.setAttribute("section.id", formData.sectionId)
          span.setAttribute("section.name", selectedSection.section_name)
          span.setAttribute("loading.start_date", formData.startDate)
          span.setAttribute("loading.end_date", formData.endDate)
          span.setAttribute("loading.rate", formData.rate)

          // Создаем загрузку через стор
          const result = await createLoadingInStore({
            responsibleId: employee.id,
            sectionId: formData.sectionId,
            startDate: new Date(formData.startDate),
            endDate: new Date(formData.endDate),
            rate: formData.rate,
            projectName: selectedProject?.project_name,
            sectionName: selectedSection?.section_name,
            responsibleName: employee.fullName || employee.name,
            responsibleAvatarUrl: employee.avatarUrl,
            responsibleTeamName: employee.teamName,
            comment: formData.comment?.trim() || undefined,
          })

          if (!result.success) {
            span.setAttribute("operation.success", false)
            span.setAttribute("operation.error", result.error || "Неизвестная ошибка")
            throw new Error(result.error || "Неизвестная ошибка при создании загрузки")
          }

          span.setAttribute("operation.success", true)
          span.setAttribute("loading.id", result.loadingId || "unknown")

          // Показываем уведомление об успехе
          const projectName = selectedProject?.project_name || "Неизвестный проект"
          setNotification(`Загрузка для сотрудника ${employee.fullName} на проект "${projectName}" успешно создана`)

          // Автоматически раскрываем раздел, чтобы показать новую загрузку
          toggleSectionExpanded(formData.sectionId)

          // Автоматически скрываем уведомление через 3 секунды
          successTimeoutRef.current = setTimeout(() => {
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
          span.setAttribute("operation.success", false)
          span.setAttribute("operation.error", error instanceof Error ? error.message : "Неизвестная ошибка")
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'create_loading',
              modal: 'add_loading_modal'
            },
            extra: {
              employee_id: employee.id,
              employee_name: employee.fullName || employee.name,
              project_id: formData.projectId,
              section_id: formData.sectionId,
              start_date: formData.startDate,
              end_date: formData.endDate,
              rate: formData.rate,
              timestamp: new Date().toISOString()
            }
          })

          // Показываем уведомление об ошибке
          setNotification(`Ошибка при создании загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)

          // Автоматически скрываем уведомление через 5 секунд
          errorTimeoutRef.current = setTimeout(() => {
            clearNotification()
          }, 5000)
        } finally {
          // Сбрасываем состояние загрузки
          setIsSaving(false)
        }
      }
    )
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
                onBlur={() => {
                  dropdownTimeoutRef.current = setTimeout(() => setShowProjectDropdown(false), 200)
                }}
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

          {/* Стадия и объект */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
              >
                Стадия
              </label>
              <select
                name="stageId"
                value={selectedStageId}
                onChange={handleChange}
                disabled={isSaving || !formData.projectId}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800",
                  isSaving || !formData.projectId ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                <option value="">Любая</option>
                {stages.map((s) => (
                  <option key={s.stage_id} value={s.stage_id}>{s.stage_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
              >
                Объект
              </label>
              <select
                name="objectId"
                value={selectedObjectId}
                onChange={handleChange}
                disabled={isSaving || !formData.projectId}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800",
                  isSaving || !formData.projectId ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                <option value="">Любой</option>
                {objects.map((o) => (
                  <option key={o.object_id} value={o.object_id}>{o.object_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Комментарий */}
          <div>
            <label
              className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
            >
              Комментарий (необязательно)
            </label>
            <textarea
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              rows={3}
              placeholder="Например: уточнение по задачам, договорённости и т.п."
              disabled={isSaving}
              className={cn(
                "w-full text-sm rounded border px-3 py-2 resize-y min-h-[72px]",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-400"
                  : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                isSaving ? "opacity-50 cursor-not-allowed" : "",
              )}
            />
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
