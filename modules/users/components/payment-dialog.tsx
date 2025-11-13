"use client"

import type React from "react"
import { Modal, ModalButton } from '@/components/modals'
import { Save } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useState, useEffect, useMemo } from "react"
import { updateUser } from "@/services/org-data-service"
import type { User } from "@/types/db"
import { toast } from "@/components/ui/use-toast"
import { DollarSign, Clock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import * as Sentry from "@sentry/nextjs"
import { useUserPermissions } from "../hooks/useUserPermissions"
import { useUserStore } from "@/stores/useUserStore"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onUserUpdated?: () => void
}

function PaymentDialog({ open, onOpenChange, user, onUserUpdated }: PaymentDialogProps) {
  const [formData, setFormData] = useState<Partial<User>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Получаем разрешения и данные текущего пользователя
  const { canEditSalaryAll, canEditSalaryDepartment } = useUserPermissions()
  const currentUserProfile = useUserStore((state) => state.profile)

  // Определяем, может ли текущий пользователь редактировать ставку и загруженность
  const canEditSalaryFields = useMemo(() => {
    // Админ с полными правами может редактировать всех
    if (canEditSalaryAll) return true

    // Руководитель отдела может редактировать только своего отдела
    if (canEditSalaryDepartment) {
      const currentDepartmentId = currentUserProfile?.departmentId
      const targetDepartmentId = user?.departmentId

      // Если не известны ID отделов, запрещаем редактирование
      if (!currentDepartmentId || !targetDepartmentId) return false

      return currentDepartmentId === targetDepartmentId
    }

    return false
  }, [canEditSalaryAll, canEditSalaryDepartment, currentUserProfile, user])

  // Установка данных пользователя при открытии диалога
  useEffect(() => {
    if (user) {
      setFormData({
        employmentRate: user.employmentRate,
        salary: user.salary,
        isHourly: user.isHourly,
      })
    } else {
      setFormData({})
    }
  }, [user, open])

  const handleChange = (field: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Проверяем права перед сохранением
    if (!canEditSalaryFields) {
      toast({
        title: "Ошибка",
        description: "Недостаточно прав для редактирования информации об оплате",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Обновление пользователя
      if (user) {
        Sentry.addBreadcrumb({ category: 'ui.submit', level: 'info', message: 'PaymentDialog: submit', data: { user_id: user.id } })
        await Sentry.startSpan({ name: 'Users/PaymentDialog updateUser', op: 'db.write', attributes: { user_id: user.id } }, async () => updateUser(user.id, formData))
        toast({
          title: "Успешно",
          description: "Информация об оплате успешно обновлена",
        })

        // Закрываем диалог и обновляем список пользователей
        onOpenChange(false)
        if (onUserUpdated) {
          onUserUpdated()
        }
      }
    } catch (error) {
      console.error("Ошибка при сохранении информации об оплате:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить информацию об оплате",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Изменим функцию форматирования зарплаты, чтобы использовать 2 знака после запятой для почасовой оплаты
  const formatSalary = (salary: number, isHourly: boolean) => {
    return (
      new Intl.NumberFormat("ru-BY", {
        style: "currency",
        currency: "BYN",
        minimumFractionDigits: isHourly ? 2 : 0,
        maximumFractionDigits: isHourly ? 2 : 0,
      }).format(salary) + (isHourly ? "/час" : "/мес")
    )
  }

  return (
    <TooltipProvider>
      <Modal isOpen={open} onClose={() => onOpenChange(false)} size="lg">
        <form onSubmit={handleSubmit}>
          <Modal.Header
            title="Редактирование оплаты"
            subtitle={
              <>
                {user && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-500">{user.position}</span>
                  </div>
                )}
                {canEditSalaryFields ? (
                  "Измените информацию об оплате и нажмите Сохранить, когда закончите."
                ) : (
                  <span className="text-orange-600">Недостаточно прав для редактирования информации об оплате.</span>
                )}
              </>
            }
          />
          <Modal.Body>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="employmentRate" className="text-right">
                  Занятость
                </Label>
                <Select
                  value={formData.employmentRate !== undefined ? String(formData.employmentRate) : undefined}
                  onValueChange={(value) => handleChange("employmentRate", Number.parseFloat(value))}
                  disabled={!canEditSalaryFields}
                >
                  <SelectTrigger id="employmentRate" className="col-span-3">
                    <SelectValue placeholder="Выберите ставку" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">25% (0.25 ставки)</SelectItem>
                    <SelectItem value="0.5">50% (0.5 ставки)</SelectItem>
                    <SelectItem value="0.75">75% (0.75 ставки)</SelectItem>
                    <SelectItem value="1">100% (1 ставка)</SelectItem>
                    <SelectItem value="1.25">125% (1.25 ставки)</SelectItem>
                    <SelectItem value="1.5">150% (1.5 ставки)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isHourly" className="text-right">
                  Тип оплаты
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Switch
                    id="isHourly"
                    checked={!!formData.isHourly}
                    onCheckedChange={(checked) => handleChange("isHourly", checked)}
                    disabled={!canEditSalaryFields}
                  />
                  <Label htmlFor="isHourly" className="flex items-center">
                    {formData.isHourly ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-blue-600 dark:text-blue-400">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>Почасовая оплата</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Оплата за час работы</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-green-600 dark:text-green-400">
                            <DollarSign className="h-4 w-4 mr-1" />
                            <span>Фиксированный оклад</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Фиксированный месячный оклад</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="salary" className="text-right">
                  {formData.isHourly ? "Ставка в час" : "Оклад"}
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="salary"
                    type="number"
                    value={formData.salary ?? ''}
                    onChange={(e) => handleChange("salary", Number.parseFloat(e.target.value))}
                    className="pl-8"
                    min={0}
                    step={formData.isHourly ? 0.01 : 10}
                    disabled={!canEditSalaryFields}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Br</span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <div className="text-right text-sm text-gray-500">Текущая ставка:</div>
                <div className="col-span-3 text-sm font-medium">
                  {formData.salary === undefined || formData.salary === null ? '—' : formatSalary(formData.salary, !!formData.isHourly)}
                </div>
              </div>

              {formData.isHourly && formData.salary !== undefined && formData.salary !== null && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="text-right text-sm text-gray-500">Примерно в месяц:</div>
                  <div className="col-span-3 text-sm">
                    {formatSalary((formData.salary) * 168 * (formData.employmentRate ?? 1), false)}
                    <span className="text-xs text-gray-500 ml-1">(при 168 часах)</span>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>
          
          <Modal.Footer>
            <ModalButton 
              type="button" 
              variant="cancel"
              onClick={() => onOpenChange(false)} 
              disabled={isLoading}
            >
              Отмена
            </ModalButton>
            <ModalButton
              type="submit"
              variant="success"
              loading={isLoading}
              disabled={!canEditSalaryFields || isLoading}
              icon={<Save />}
            >
              {isLoading ? "Сохранение..." : "Сохранить"}
            </ModalButton>
          </Modal.Footer>
        </form>
      </Modal>
    </TooltipProvider>
  )
}

export default Sentry.withProfiler(PaymentDialog, { name: 'PaymentDialog' })
