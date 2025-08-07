"use client"

import { useState, useEffect } from 'react'
import { Modal } from '@/components/modals'
import { ModalButton } from '@/components/modals/base/ModalButton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, HelpCircle, X } from 'lucide-react'
import { VacationGanttChart } from './VacationGanttChart'
import { VacationFormModal } from './VacationFormModal'
import { VacationInstructionsModal } from './VacationInstructionsModal'
import { useVacationManagementStore } from '../store'
import { toast } from 'sonner'
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
    }
  }, [isOpen, setSelectedDepartment, setError])

  const handleCreateVacation = (employeeId: string) => {
    const employee = employees.find(emp => emp.user_id === employeeId)
    if (employee) {
      setSelectedEmployee(employee)
      setSelectedVacation(null)
      setFormMode('create')
      setFormModalOpen(true)
    }
  }

  const handleEditVacation = (vacation: VacationEvent) => {
    const employee = employees.find(emp => emp.user_id === vacation.calendar_event_created_by)
    if (employee) {
      setSelectedEmployee(employee)
      setSelectedVacation(vacation)
      setFormMode('edit')
      setFormModalOpen(true)
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
    if (!selectedEmployee) return

    try {
      if (formMode === 'create') {
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
                className="flex items-center gap-2"
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
          {/* Выбор отдела */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Выберите отдел
            </label>
            <Select 
              value={selectedDepartmentId || undefined}
              onValueChange={setSelectedDepartment}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Выберите отдел..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.department_id} value={department.department_id}>
                    {department.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      />

      {/* Модальное окно с инструкцией */}
      <VacationInstructionsModal
        isOpen={instructionsModalOpen}
        onClose={() => setInstructionsModalOpen(false)}
      />
    </>
  )
} 