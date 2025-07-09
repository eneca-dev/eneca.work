"use client"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import type { Section } from "../../types"
import { useUiStore } from "@/stores/useUiStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { supabase, updateSectionResponsible } from "@/lib/supabase-client"
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

interface AssignResponsibleModalProps {
  section: Section
  setShowAssignModal: (show: boolean) => void
  theme: string
}

export function AssignResponsibleModal({ section, setShowAssignModal, theme }: AssignResponsibleModalProps) {
  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState(false)
  // Состояние для отслеживания ошибок валидации
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Получаем функции из сторов
  const setNotification = useUiStore((state) => state.setNotification)
  const clearNotification = useUiStore((state) => state.clearNotification)
  const updateSectionInStore = usePlanningStore((state) => state.updateSection)

  // Состояния для списка сотрудников
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)

  // Состояния для поиска сотрудников
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  // Загрузка списка сотрудников
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
            console.error("Ошибка при загрузке сотрудников:", error.message || error)
          }
          return
        }

        setEmployees(data || [])
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError' && !abortController.signal.aborted) {
          console.error("Ошибка при загрузке сотрудников:", error.message || error)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingEmployees(false)
        }
      }
    }

    fetchEmployees()

    return () => {
      abortController.abort()
    }
  }, [])

  // Простая фильтрация сотрудников прямо в рендере
  const filteredEmployees = employees
    .filter((employee) => {
      if (employeeSearchTerm.trim() === "") {
        return true // Показываем всех сотрудников если поиск пустой
      }
      return (
        employee.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      )
    })
    .slice(0, 10) // Ограничиваем до 10 результатов

  // Временная отладочная информация
  console.log("Состояние компонента:", {
    employeesCount: employees.length,
    filteredCount: filteredEmployees.length,
    searchTerm: employeeSearchTerm,
    showDropdown: showEmployeeDropdown,
    selectedEmployee: selectedEmployee?.full_name,
    isLoading: isLoadingEmployees,
  })

  // Функция валидации формы
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Проверка выбора сотрудника
    if (!selectedEmployee) {
      newErrors.employee = "Необходимо выбрать ответственного"
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
      // Используем правильный ID раздела согласно схеме БД
      const sectionId = section.id

      if (!sectionId) {
        console.error("Структура объекта section:", section)
        console.error("Доступные ключи:", Object.keys(section))
        throw new Error(`Отсутствует id в объекте раздела. Доступные поля: ${Object.keys(section).join(", ")}`)
      }

      console.log("Используемый sectionId:", sectionId)
      console.log("Попытка обновления ответственного:", {
        sectionId: sectionId,
        responsibleId: selectedEmployee!.user_id,
        responsibleName: selectedEmployee!.full_name,
      })

      // ЭТО ОСНОВНОЙ КОД СОХРАНЕНИЯ В БД:
      const result = await updateSectionResponsible(sectionId, selectedEmployee!.user_id)

      if (!result.success) {
        throw new Error(result.error || "Неизвестная ошибка при обновлении")
      }

      console.log("Обновление прошло успешно:", result.data)

      // Обновляем раздел в сторе (локальное состояние)
      updateSectionInStore(sectionId, {
        responsibleName: selectedEmployee!.full_name,
        responsibleAvatarUrl: selectedEmployee!.avatar_url || undefined,
      })

      // Показываем уведомление об успехе
      setNotification(`Ответственный для раздела "${section.name}" успешно назначен: ${selectedEmployee!.full_name}`)

      // Автоматически скрываем уведомление через 3 секунды
      setTimeout(() => {
        clearNotification()
      }, 3000)

      // Закрываем модальное окно
      setShowAssignModal(false)

      console.log("Ответственный успешно назначен:", {
        sectionId: sectionId,
        sectionName: section.name,
        responsibleId: selectedEmployee!.user_id,
        responsibleName: selectedEmployee!.full_name,
      })
    } catch (error) {
      console.error("Ошибка при назначении ответственного:", error)

      // Показываем уведомление об ошибке
      setNotification(
        `Ошибка при назначении ответственного: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
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

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee)
    setEmployeeSearchTerm(employee.full_name)
    setShowEmployeeDropdown(false)

    // Очищаем ошибку при выборе
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
          {section.responsibleName ? "Изменение ответственного" : "Назначение ответственного"}
        </h3>

        <div
          className={cn(
            "p-4 rounded-lg border mb-4",
            theme === "dark" ? "bg-blue-900 border-blue-700" : "bg-blue-50 border-blue-200",
          )}
        >
          <div className="flex items-start space-x-3">
            <div className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-blue-400" : "text-blue-600")}>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-blue-200" : "text-blue-800")}>
                {section.responsibleName ? "Изменение ответственного за раздел" : "Назначение ответственного за раздел"}
              </h4>
              <div className={cn("mt-2 text-sm", theme === "dark" ? "text-blue-300" : "text-blue-700")}>
                <p className="mb-1">
                  <strong>Раздел:</strong> {section.name}
                </p>
                <p className="mb-1">
                  <strong>Проект:</strong> {section.projectName || "Не указан"}
                </p>
                <p>
                  <strong>Текущий ответственный:</strong> {section.responsibleName || "Не назначен"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="employee-search-container relative">
            <label
              className={cn("block text-sm font-medium mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}
            >
              {section.responsibleName ? "Новый ответственный" : "Выберите ответственного"}
            </label>
            <div className="relative">
              <input
                type="text"
                value={employeeSearchTerm}
                onChange={(e) => {
                  setEmployeeSearchTerm(e.target.value)
                  setShowEmployeeDropdown(true)
                  // Не сбрасываем selectedEmployee при вводе, только при изменении значения
                  if (selectedEmployee && e.target.value !== selectedEmployee.full_name) {
                    setSelectedEmployee(null)
                  }
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                onBlur={(e) => {
                  // Проверяем, что фокус не переходит на элемент внутри dropdown
                  if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                    setTimeout(() => setShowEmployeeDropdown(false), 200)
                  }
                }}
                placeholder="Поиск сотрудника..."
                disabled={isSaving || isLoadingEmployees}
                className={cn(
                  "w-full text-sm rounded border px-3 py-2",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800",
                  errors.employee ? "border-red-500" : "",
                  isSaving || isLoadingEmployees ? "opacity-50 cursor-not-allowed" : "",
                )}
              />

              {showEmployeeDropdown && filteredEmployees.length > 0 && !selectedEmployee && (
                <div
                  className={cn(
                    "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded border",
                    theme === "dark"
                      ? "bg-slate-800 border-slate-600"
                      : "bg-white border-slate-300",
                  )}
                  onMouseDown={(e) => e.preventDefault()} // Предотвращаем потерю фокуса при клике
                >
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.user_id}
                      onMouseDown={(e) => {
                        e.preventDefault() // Предотвращаем потерю фокуса
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
                        {employee.team_name && (
                          <div
                            className={cn("text-xs truncate", theme === "dark" ? "text-slate-400" : "text-slate-500")}
                          >
                            {employee.team_name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.employee && <p className="text-xs text-red-500 mt-1">{errors.employee}</p>}
            {isLoadingEmployees && <p className="text-xs text-slate-500 mt-1">Загрузка сотрудников...</p>}
          </div>

          {selectedEmployee && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                theme === "dark" ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-200",
              )}
            >
              <div className="flex items-center space-x-3">
                <Avatar
                  name={selectedEmployee.full_name}
                  avatarUrl={selectedEmployee.avatar_url}
                  theme={theme === "dark" ? "dark" : "light"}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                    {selectedEmployee.full_name}
                  </div>
                  <div className={cn("text-sm", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                    {selectedEmployee.position_name || "Должность не указана"}
                  </div>
                  {selectedEmployee.team_name && (
                    <div className={cn("text-sm", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                      {selectedEmployee.team_name}
                    </div>
                  )}
                  <div className={cn("text-xs", theme === "dark" ? "text-slate-500" : "text-slate-500")}>
                    {selectedEmployee.email}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowAssignModal(false)}
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
            disabled={isSaving || !selectedEmployee}
            className={cn(
              "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[100px]",
              theme === "dark"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-blue-500 text-white hover:bg-blue-600",
              isSaving || !selectedEmployee ? "opacity-70 cursor-not-allowed" : "",
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
                Назначение...
              </>
            ) : (
              "Назначить"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
