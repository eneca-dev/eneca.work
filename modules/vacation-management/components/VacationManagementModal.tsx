"use client"

import { useState, useEffect } from 'react'
import { Modal } from '@/components/modals'
import { ModalButton } from '@/components/modals/base/ModalButton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { VacationGanttChart } from './VacationGanttChart'
import { VacationFormModal } from './VacationFormModal'
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
        <Modal.Header 
          title="Управление отпусками" 
          subtitle="Просмотр и управление отпусками сотрудников по отделам"
          onClose={onClose}
        />

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
    </>
  )
} 