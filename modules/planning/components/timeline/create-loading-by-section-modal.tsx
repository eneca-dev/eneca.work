"use client"

import type React from "react"
import type { JSX } from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import type { Section } from "../../types"
import { useUiStore } from "@/stores/useUiStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { supabase } from "@/lib/supabase-client"
import { Avatar } from "../avatar"

interface Employee {
  user_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  position_name: string | null
  avatar_url: string | null
  team_name: string | null
  department_name: string | null
  employment_rate: number | null
}

interface CreateLoadingBySectionModalProps {
  section: Section
  setShowModal: (show: boolean) => void
  theme: string
}

export function CreateLoadingBySectionModal({ section, setShowModal, theme }: CreateLoadingBySectionModalProps): JSX.Element {
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setNotification = useUiStore((state) => state.setNotification)
  const clearNotification = useUiStore((state) => state.clearNotification)
  const createLoadingInStore = usePlanningStore((state) => state.createLoading)
  const toggleSectionExpanded = usePlanningStore((state) => state.toggleSectionExpanded)

  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    rate: 1,
  })

  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true)
      try {
        const { data, error } = await supabase
          .from("view_users")
          .select(`
            user_id,
            first_name,
            last_name,
            full_name,
            email,
            position_name,
            avatar_url,
            team_name,
            department_name,
            employment_rate
          `)
          .order("full_name")
          .abortSignal(abortController.signal)

        if (error) {
          if (!abortController.signal.aborted) {
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'fetch_employees_for_section_loading',
                modal: 'create_loading_by_section_modal'
              },
              extra: {
                section_id: section.id,
                section_name: section.name,
                error_code: error.code,
                error_details: error.details,
                timestamp: new Date().toISOString()
              }
            })
          }
          return
        }

        setEmployees(data || [])
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError' && !abortController.signal.aborted) {
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'fetch_employees_for_section_loading',
              error_type: 'unexpected_error',
              modal: 'create_loading_by_section_modal'
            },
            extra: {
              section_id: section.id,
              section_name: section.name,
              timestamp: new Date().toISOString()
            }
          })
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingEmployees(false)
        }
      }
    }

    fetchEmployees()
    return () => abortController.abort()
  }, [])

  const filteredEmployees = employees
    .filter((employee) => {
      if (employeeSearchTerm.trim() === "") return true
      return (
        employee.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      )
    })
    .slice(0, 10)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rate" ? Number.parseFloat(value) : value,
    }))

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.startDate) {
      newErrors.startDate = "Дата начала обязательна"
    }

    if (!formData.endDate) {
      newErrors.endDate = "Дата окончания обязательна"
    } else if (formData.startDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = "Дата окончания должна быть позже даты начала"
    }

    if (formData.rate <= 0) {
      newErrors.rate = "Ставка должна быть больше 0"
    } else if (formData.rate > 2) {
      newErrors.rate = "Ставка не может быть больше 2"
    }

    if (!selectedEmployee) {
      newErrors.employee = "Необходимо выбрать сотрудника"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    await Sentry.startSpan(
      {
        op: "ui.action",
        name: "Создание загрузки по разделу",
      },
      async (span) => {
        setIsSaving(true)

        try {
          // Устанавливаем атрибуты span
          span.setAttribute("section.id", section.id)
          span.setAttribute("section.name", section.name)
          span.setAttribute("employee.id", selectedEmployee!.user_id)
          span.setAttribute("employee.name", selectedEmployee!.full_name)
          span.setAttribute("loading.start_date", formData.startDate)
          span.setAttribute("loading.end_date", formData.endDate)
          span.setAttribute("loading.rate", formData.rate)

          const result = await createLoadingInStore({
            responsibleId: selectedEmployee!.user_id,
            sectionId: section.id,
            startDate: new Date(formData.startDate),
            endDate: new Date(formData.endDate),
            rate: formData.rate,
            projectName: section.projectName,
            sectionName: section.name,
            responsibleName: selectedEmployee!.full_name,
            responsibleAvatarUrl: selectedEmployee!.avatar_url,
            responsibleTeamName: selectedEmployee!.team_name,
          })

          if (!result.success) {
            span.setAttribute("operation.success", false)
            span.setAttribute("operation.error", result.error || "Неизвестная ошибка")
            throw new Error(result.error || "Неизвестная ошибка при создании загрузки")
          }

          span.setAttribute("operation.success", true)
          span.setAttribute("loading.id", result.loadingId || "unknown")

          setNotification(`Загрузка для сотрудника ${selectedEmployee!.full_name} в разделе "${section.name}" успешно создана`)

          // Автоматически раскрываем раздел, чтобы показать новую загрузку
          toggleSectionExpanded(section.id)

          successTimeoutRef.current = setTimeout(() => {
            clearNotification()
          }, 3000)

          setShowModal(false)
        } catch (error) {
          span.setAttribute("operation.success", false)
          span.setAttribute("operation.error", error instanceof Error ? error.message : "Неизвестная ошибка")
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'create_section_loading',
              modal: 'create_loading_by_section_modal'
            },
            extra: {
              section_id: section.id,
              section_name: section.name,
              employee_id: selectedEmployee?.user_id,
              employee_name: selectedEmployee?.full_name,
              start_date: formData.startDate,
              end_date: formData.endDate,
              rate: formData.rate,
              timestamp: new Date().toISOString()
            }
          })
          
          setNotification(`Ошибка при создании загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)

          errorTimeoutRef.current = setTimeout(() => {
            clearNotification()
          }, 5000)
        } finally {
          setIsSaving(false)
        }
      }
    )
  }

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee)
    setEmployeeSearchTerm(employee.full_name)
    setShowEmployeeDropdown(false)

    if (errors.employee) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.employee
        return newErrors
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={cn("rounded-lg p-6 w-96 max-w-[90vw]", theme === "dark" ? "bg-slate-800" : "bg-white")}>
        <h3 className={cn("text-lg font-semibold mb-4", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
          Создание загрузки
        </h3>

        <div className={cn("p-4 rounded-lg border mb-4", theme === "dark" ? "bg-teal-900 border-teal-700" : "bg-teal-50 border-teal-200")}>
          <div className="flex items-start space-x-3">
            <div className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-teal-400" : "text-teal-600")}>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-teal-200" : "text-teal-800")}>
                Создание загрузки в разделе
              </h4>
              <div className={cn("mt-2 text-sm", theme === "dark" ? "text-teal-300" : "text-teal-700")}>
                <p className="mb-1"><strong>Раздел:</strong> {section.name}</p>
                <p className="mb-1"><strong>Проект:</strong> {section.projectName || "Не указан"}</p>
                <p><strong>Отдел:</strong> {section.departmentName || "Не указан"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="employee-search-container relative">
            <label className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
              Сотрудник
            </label>
            <div className="relative">
              <input
                type="text"
                value={employeeSearchTerm}
                onChange={(e) => {
                  setEmployeeSearchTerm(e.target.value)
                  setShowEmployeeDropdown(true)
                  if (selectedEmployee && e.target.value !== selectedEmployee.full_name) {
                    setSelectedEmployee(null)
                  }
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                    setTimeout(() => setShowEmployeeDropdown(false), 200)
                  }
                }}
                placeholder="Поиск сотрудника..."
                disabled={isSaving || isLoadingEmployees}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800",
                  errors.employee ? "border-red-500" : "",
                  isSaving || isLoadingEmployees ? "opacity-50 cursor-not-allowed" : "",
                )}
              />

              {showEmployeeDropdown && filteredEmployees.length > 0 && !selectedEmployee && (
                <div
                  className={cn(
                    "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded border",
                    theme === "dark" ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.user_id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleEmployeeSelect(employee)
                      }}
                      className={cn(
                        "px-3 py-2 cursor-pointer text-sm flex items-center space-x-3",
                        theme === "dark" ? "hover:bg-slate-600 text-slate-200" : "hover:bg-slate-50 text-slate-800",
                      )}
                    >
                      <Avatar
                        name={employee.full_name}
                        avatarUrl={employee.avatar_url}
                        theme={theme === "dark" ? "dark" : "light"}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{employee.full_name}</div>
                        <div className={cn("text-xs truncate", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                          {employee.position_name || "Должность не указана"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.employee && <p className="text-xs text-red-500 mt-1">{errors.employee}</p>}
            {isLoadingEmployees && <p className="text-xs text-slate-500 mt-1">Загрузка сотрудников...</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
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
                  theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800",
                  errors.startDate ? "border-red-500" : "",
                  isSaving ? "opacity-50 cursor-not-allowed" : "",
                )}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
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
                  theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800",
                  errors.endDate ? "border-red-500" : "",
                  isSaving ? "opacity-50 cursor-not-allowed" : "",
                )}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
            </div>
          </div>

          <div>
            <label className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
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
                theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800",
                errors.rate ? "border-red-500" : "",
                isSaving ? "opacity-50 cursor-not-allowed" : "",
              )}
            />
            {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            disabled={isSaving}
            className={cn(
              "px-4 py-2 text-sm rounded border",
              theme === "dark" ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50",
              isSaving ? "opacity-50 cursor-not-allowed" : "",
            )}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedEmployee}
            className={cn(
              "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[100px]",
              theme === "dark" ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-teal-500 text-white hover:bg-teal-600",
              isSaving || !selectedEmployee ? "opacity-70 cursor-not-allowed" : "",
            )}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
