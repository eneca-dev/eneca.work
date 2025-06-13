"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "./Avatar"
import { updateSectionResponsible } from "@/lib/supabase-client"
import { useProjectsStore } from "../store"
import { useUiStore } from "@/stores/useUiStore"

interface Employee {
  user_id: string
  full_name: string
  email: string
  avatar_url?: string | null
  position_name?: string | null
  team_name?: string | null
  department_name?: string | null
}

interface SectionNode {
  id: string
  name: string
  type: string
  projectName?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
}

interface AssignResponsibleModalProps {
  section: SectionNode
  setShowAssignModal: (show: boolean) => void
  theme: string
}

export function AssignResponsibleModal({ section, setShowAssignModal, theme }: AssignResponsibleModalProps) {
  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState(false)
  // Состояние для отслеживания ошибок валидации
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Получаем функции из сторов
  const { updateSectionResponsible: updateSectionInStore } = useProjectsStore()
  const { setNotification, clearNotification } = useUiStore()

  // Состояния для списка сотрудников
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)

  // Состояния для поиска сотрудников
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  // Загружаем список сотрудников при открытии модального окна
  useEffect(() => {
    const loadEmployees = async () => {
      setIsLoadingEmployees(true)
      try {
        const { createClient } = await import("@/utils/supabase/client")
        const supabase = createClient()

        const { data, error } = await supabase
          .from("profiles")
          .select(`
            user_id,
            first_name,
            last_name,
            email,
            avatar_url,
            position_name,
            team_name,
            department_name
          `)
          .eq("is_active", true)
          .order("first_name")

        if (error) {
          console.error("Ошибка загрузки сотрудников:", error)
          return
        }

        const employeesList = data?.map((emp: any) => ({
          user_id: emp.user_id,
          full_name: `${emp.first_name} ${emp.last_name}`,
          email: emp.email,
          avatar_url: emp.avatar_url,
          position_name: emp.position_name,
          team_name: emp.team_name,
          department_name: emp.department_name,
        })) || []

        setEmployees(employeesList)
      } catch (error) {
        console.error("Ошибка при загрузке сотрудников:", error)
      } finally {
        setIsLoadingEmployees(false)
      }
    }

    loadEmployees()
  }, [])

  // Фильтруем сотрудников по поисковому запросу
  const filteredEmployees = employees.filter((employee) =>
    employee.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  )

  // Валидация формы
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!selectedEmployee) {
      newErrors.employee = "Выберите сотрудника"
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
          Назначение ответственного
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
                Назначение ответственного за раздел
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

        {/* Поиск сотрудника */}
        <div className="mb-4">
          <label className={cn("block text-sm font-medium mb-2", theme === "dark" ? "text-slate-200" : "text-slate-700")}>
            Выберите ответственного
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
              onBlur={() => {
                // Задержка для обработки клика по элементу списка
                setTimeout(() => setShowEmployeeDropdown(false), 200)
              }}
              placeholder="Начните вводить имя или email..."
              className={cn(
                "w-full px-3 py-2 border rounded text-sm",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400"
                  : "bg-white border-slate-300 text-slate-800 placeholder-slate-500",
                errors.employee ? "border-red-500" : "",
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
                      <div className="font-medium">{employee.full_name}</div>
                      <div className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                        {employee.email}
                      </div>
                      {employee.position_name && (
                        <div className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                          {employee.position_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.employee && (
            <p className="text-red-500 text-xs mt-1">{errors.employee}</p>
          )}
        </div>

        {/* Выбранный сотрудник */}
        {selectedEmployee && (
          <div
            className={cn(
              "p-3 rounded-lg border mb-4",
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