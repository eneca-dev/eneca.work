"use client"

import React, { useState, useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { Avatar } from "./Avatar"
import { updateSectionResponsible } from "@/lib/supabase-client"
import { useProjectsStore } from "../store"
import { useUiStore } from "@/stores/useUiStore"
import { Modal, ModalButton } from '@/components/modals'
import { Save } from 'lucide-react'

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
      return Sentry.startSpan(
        {
          op: "projects.load_employees",
          name: "Load Employees for Assignment",
        },
        async (span) => {
          setIsLoadingEmployees(true)
          try {
            span.setAttribute("section.id", section.id)
            span.setAttribute("section.name", section.name)
            
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
                departments!profiles_department_membership_fkey(department_name),
                teams!profiles_team_membership_fkey(team_name),
                positions!profiles_position_id_fkey(position_name)
              `)
              .not('first_name', 'is', null)
              .neq('first_name', '')
              .order("first_name")

            if (error) {
              span.setAttribute("load.success", false)
              span.setAttribute("load.error", error.message)
              Sentry.captureException(error, {
                tags: { 
                  module: 'projects', 
                  action: 'load_employees',
                  error_type: 'db_error'
                },
                extra: { 
                  component: 'AssignResponsibleModal',
                  section_id: section.id,
                  section_name: section.name,
                  timestamp: new Date().toISOString()
                }
              })
              console.error("Ошибка загрузки сотрудников:", error)
              setNotification(`Ошибка загрузки сотрудников: ${error.message}`)
              return
            }

            const employeesList = data?.map((emp: any) => ({
              user_id: emp.user_id,
              full_name: `${emp.first_name} ${emp.last_name}`.trim(),
              email: emp.email,
              avatar_url: emp.avatar_url,
              position_name: emp.positions?.position_name || null,
              team_name: (emp as any).teams?.team_name || (emp as any).profiles_team_membership_fkey?.team_name || null,
              department_name: (emp as any).departments?.department_name || (emp as any).profiles_department_membership_fkey?.department_name || null,
            })) || []

            span.setAttribute("load.success", true)
            span.setAttribute("employees.count", employeesList.length)
            setEmployees(employeesList)
            
            Sentry.addBreadcrumb({
              message: 'Employees loaded for assignment',
              category: 'projects',
              level: 'info',
              data: { 
                section_id: section.id,
                employees_count: employeesList.length 
              }
            })
          } catch (error) {
            span.setAttribute("load.success", false)
            span.recordException(error as Error)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'load_employees',
                error_type: 'unexpected_error'
              },
              extra: { 
                component: 'AssignResponsibleModal',
                section_id: section.id,
                section_name: section.name,
                timestamp: new Date().toISOString()
              }
            })
            console.error("Ошибка при загрузке сотрудников:", error)
            setNotification(`Ошибка при загрузке сотрудников: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
          } finally {
            setIsLoadingEmployees(false)
          }
        }
      )
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

    return Sentry.startSpan(
      {
        op: "projects.assign_responsible",
        name: "Assign Section Responsible",
      },
      async (span) => {
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

          span.setAttribute("section.id", sectionId)
          span.setAttribute("section.name", section.name)
          span.setAttribute("employee.id", selectedEmployee!.user_id)
          span.setAttribute("employee.name", selectedEmployee!.full_name)

          console.log("Используемый sectionId:", sectionId)
          console.log("Попытка обновления ответственного:", {
            sectionId: sectionId,
            responsibleId: selectedEmployee!.user_id,
            responsibleName: selectedEmployee!.full_name,
          })

          // ЭТО ОСНОВНОЙ КОД СОХРАНЕНИЯ В БД:
          const result = await updateSectionResponsible(sectionId, selectedEmployee!.user_id)

          if (!result.success) {
            span.setAttribute("assign.success", false)
            span.setAttribute("assign.error", result.error || "Неизвестная ошибка")
            throw new Error(result.error || "Неизвестная ошибка при обновлении")
          }

          console.log("Обновление прошло успешно:", result.data)

          // Обновляем раздел в сторе (локальное состояние)
          updateSectionInStore(sectionId, {
            responsibleName: selectedEmployee!.full_name,
            responsibleAvatarUrl: selectedEmployee!.avatar_url || undefined,
          })

          span.setAttribute("assign.success", true)
          
          Sentry.addBreadcrumb({
            message: 'Section responsible assigned successfully',
            category: 'projects',
            level: 'info',
            data: { 
              section_id: sectionId,
              section_name: section.name,
              employee_id: selectedEmployee!.user_id,
              employee_name: selectedEmployee!.full_name
            }
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
          span.setAttribute("assign.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: { 
              module: 'projects', 
              action: 'assign_responsible',
              error_type: 'assignment_failed'
            },
            extra: { 
              component: 'AssignResponsibleModal',
              section_id: section.id,
              section_name: section.name,
              employee_id: selectedEmployee?.user_id,
              employee_name: selectedEmployee?.full_name,
              timestamp: new Date().toISOString()
            }
          })
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
    )
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
    <Modal isOpen={true} onClose={() => setShowAssignModal(false)} size="md">
      <Modal.Header 
        title="Назначение ответственного"
        onClose={() => setShowAssignModal(false)}
      />
      
      <Modal.Body>

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

      </Modal.Body>
      
      <Modal.Footer>
        <ModalButton
          variant="cancel"
          onClick={() => setShowAssignModal(false)}
          disabled={isSaving}
        >
          Отмена
        </ModalButton>
        <ModalButton
          variant="success"
          onClick={handleSave}
          disabled={!selectedEmployee}
          loading={isSaving}
          icon={<Save />}
        >
          {isSaving ? 'Назначение...' : 'Назначить'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 