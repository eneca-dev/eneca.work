"use client"

import { useState, useEffect } from 'react'
import { Modal } from '@/components/modals'
import { ModalButton } from '@/components/modals/base/ModalButton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Loader2, AlertCircle, HelpCircle, X, Check, ChevronsUpDown } from 'lucide-react'
import { VacationGanttChart } from './VacationGanttChart'
import { VacationFormModal } from './VacationFormModal'
import { VacationInstructionsModal } from './VacationInstructionsModal'
import { useVacationManagementStore } from '../store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { VacationEvent, Employee, VacationFormData } from '../types'

interface VacationManagementModalProps {
  isOpen: boolean
  onClose: () => void
}

export function VacationManagementModal({
  isOpen,
  onClose
}: VacationManagementModalProps) {
  const {
    selectedDepartmentId,
    employees,
    vacations,
    departments,
    isLoading,
    error,
    setSelectedDepartment,
    loadDepartments,
    createVacation,
    updateVacation,
    deleteVacation,
    approveVacation,
    rejectVacation,
    setError
  } = useVacationManagementStore()

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedVacation, setSelectedVacation] = useState<VacationEvent | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [departmentSelectOpen, setDepartmentSelectOpen] = useState(false)

  // Загружаем отделы при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadDepartments()
    }
  }, [isOpen, loadDepartments])

  // Очищаем состояние при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSelectedDepartment(null)
      setSelectedEmployee(null)
      setSelectedVacation(null)
      setFormModalOpen(false)
      setInstructionsModalOpen(false)
      setError(null)
      setDepartmentSelectOpen(false)
    }
  }, [isOpen, setSelectedDepartment, setError])

  // Получение названия выбранного отдела
  const getSelectedDepartmentName = () => {
    if (!selectedDepartmentId) return ''
    const department = departments.find(d => d.department_id === selectedDepartmentId)
    return department?.department_name || ''
  }

  const handleCreateVacation = (employeeId: string) => {
    const employee = employees.find(emp => emp.user_id === employeeId)
    if (employee) {
      setSelectedEmployee(employee)
      setSelectedVacation(null)
      setFormMode('create')
      setFormModalOpen(true)
    } else {
      console.error('Сотрудник не найден для создания отпуска:', {
        employeeId,
        availableEmployees: employees.map(emp => emp.user_id)
      })
      toast.error('Не удалось найти сотрудника для создания отпуска')
    }
  }

  const handleEditVacation = (vacation: VacationEvent) => {
    const employee = employees.find(emp => emp.user_id === vacation.calendar_event_created_by)
    if (employee) {
      setSelectedEmployee(employee)
      setSelectedVacation(vacation)
      setFormMode('edit')
      setFormModalOpen(true)
    } else {
      console.error('Сотрудник не найден для отпуска:', {
        vacationId: vacation.calendar_event_id,
        createdBy: vacation.calendar_event_created_by,
        availableEmployees: employees.map(emp => emp.user_id)
      })
      toast.error('Не удалось найти сотрудника для редактирования отпуска')
    }
  }

  const handleDeleteVacation = async (vacationId: string) => {
    try {
      await deleteVacation(vacationId)
      toast.success('Отпуск успешно удален')
    } catch (error) {
      toast.error('Не удалось удалить отпуск')
    }
  }

  const handleApproveVacation = async (vacationId: string) => {
    try {
      await approveVacation(vacationId)
      toast.success('Отпуск одобрен')
    } catch (error) {
      toast.error('Не удалось одобрить отпуск')
    }
  }

  const handleRejectVacation = async (vacationId: string) => {
    try {
      await rejectVacation(vacationId)
      toast.success('Отпуск отклонен')
    } catch (error) {
      toast.error('Не удалось отклонить отпуск')
    }
  }

  const handleFormSubmit = async (data: VacationFormData) => {
    // Предотвращаем множественные отправки
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      if (formMode === 'create') {
        // Для создания требуется выбранный сотрудник
        if (!selectedEmployee) {
          toast.error('Не выбран сотрудник')
          setIsSubmitting(false)
          return
        }
        
        await createVacation(
          selectedEmployee.user_id,
          data.startDate,
          data.endDate,
          data.type,
          data.comment
        )
        toast.success('Отпуск успешно создан')
      } else if (selectedVacation) {
        await updateVacation(
          selectedVacation.calendar_event_id,
          data.startDate,
          data.endDate,
          data.type,
          data.comment
        )
        toast.success('Отпуск успешно обновлен')
      }
      setFormModalOpen(false)
    } catch (error) {
      toast.error(formMode === 'create' ? 'Не удалось создать отпуск' : 'Не удалось обновить отпуск')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="full">
        {/* Кастомный заголовок с кнопкой инструкции */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
                Управление отпусками
              </h2>
              <div className="mt-2 text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                Просмотр и управление отпусками сотрудников по отделам
              </div>
            </div>
            
            <div className="ml-4 flex items-center space-x-2">
              {/* Кнопка инструкции */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInstructionsModalOpen(true)}
                className="flex items-center gap-2 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-500 dark:hover:border-slate-400"
              >
                <HelpCircle className="h-4 w-4" />
                Инструкция
              </Button>
              
              {/* Кнопка закрытия */}
              <button
                onClick={onClose}
                className="
                  p-2 
                  text-gray-400 hover:text-gray-600 
                  dark:text-slate-500 dark:hover:text-slate-300
                  hover:bg-gray-100 dark:hover:bg-slate-700
                  rounded-lg transition-colors duration-200
                  flex-shrink-0
                "
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <Modal.Body className="space-y-6">
          {/* Выбор отдела с поиском */}
          <div className="space-y-2">

            <Popover open={departmentSelectOpen} onOpenChange={setDepartmentSelectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={departmentSelectOpen}
                  className="w-64 justify-between dark:bg-slate-700 dark:border-slate-500 dark:hover:bg-slate-600"
                >
                  {selectedDepartmentId
                    ? getSelectedDepartmentName()
                    : "Выберите отдел"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 dark:bg-slate-700 dark:border-slate-500">
                <Command className="dark:bg-slate-700">
                  <CommandInput 
                    placeholder="Поиск отдела..." 
                    className="dark:bg-slate-700 dark:text-slate-200"
                  />
                  <CommandList>
                    <CommandEmpty>Отделы не найдены.</CommandEmpty>
                    <CommandGroup>
                      {departments.map((department) => (
                        <CommandItem
                          key={department.department_id}
                          value={department.department_name}
                          onSelect={() => {
                            setSelectedDepartment(department.department_id)
                            setDepartmentSelectOpen(false)
                          }}
                          className="dark:hover:bg-slate-600 dark:text-slate-200"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedDepartmentId === department.department_id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {department.department_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Отображение ошибок */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Индикатор загрузки */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Загрузка данных...</span>
            </div>
          )}

          {/* Диаграмма Ганта */}
          {selectedDepartmentId && !isLoading && employees.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <VacationGanttChart
                employees={employees}
                vacations={vacations}
                onCreateVacation={handleCreateVacation}
                onEditVacation={handleEditVacation}
                onDeleteVacation={handleDeleteVacation}
                onApproveVacation={handleApproveVacation}
                onRejectVacation={handleRejectVacation}
              />
            </div>
          )}

          {/* Сообщение о пустом отделе */}
          {selectedDepartmentId && !isLoading && employees.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              В выбранном отделе нет сотрудников
            </div>
          )}

          {/* Сообщение о необходимости выбора отдела */}
          {!selectedDepartmentId && !isLoading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Выберите отдел для просмотра отпусков сотрудников
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <ModalButton variant="cancel" onClick={onClose}>
            Закрыть
          </ModalButton>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно формы отпуска */}
      <VacationFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        employee={selectedEmployee || undefined}
        vacation={selectedVacation || undefined}
        mode={formMode}
        isSubmitting={isSubmitting}
      />

      {/* Модальное окно с инструкцией */}
      <VacationInstructionsModal
        isOpen={instructionsModalOpen}
        onClose={() => setInstructionsModalOpen(false)}
      />
    </>
  )
} 