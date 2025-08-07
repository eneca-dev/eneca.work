"use client"

import { useMemo, useState, useEffect, useRef } from 'react'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MoreVertical, Plus, Edit, Trash2, Check, X } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Employee, VacationEvent } from '../types'

interface VacationGanttChartProps {
  employees: Employee[]
  vacations: VacationEvent[]
  onCreateVacation: (employeeId: string) => void
  onEditVacation: (vacation: VacationEvent) => void
  onDeleteVacation: (vacationId: string) => void
  onApproveVacation: (vacationId: string) => void
  onRejectVacation: (vacationId: string) => void
}

export function VacationGanttChart({
  employees,
  vacations,
  onCreateVacation,
  onEditVacation,
  onDeleteVacation,
  onApproveVacation,
  onRejectVacation
}: VacationGanttChartProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    vacation: VacationEvent
    x: number
    y: number
  } | null>(null)

  // Генерируем диапазон дат для отображения (текущий месяц ± 2 месяца)
  const dateRange = useMemo(() => {
    const start = startOfMonth(addDays(currentDate, -60))
    const end = endOfMonth(addDays(currentDate, 60))
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // Группируем отпуска по сотрудникам
  const vacationsByEmployee = useMemo(() => {
    const grouped: Record<string, VacationEvent[]> = {}
    vacations.forEach(vacation => {
      if (!grouped[vacation.calendar_event_created_by]) {
        grouped[vacation.calendar_event_created_by] = []
      }
      grouped[vacation.calendar_event_created_by].push(vacation)
    })
    return grouped
  }, [vacations])

  // Получить цвет для типа отпуска
  const getVacationTypeColor = (type: string) => {
    switch (type) {
      case 'Отпуск запрошен': return 'bg-yellow-500'
      case 'Отпуск одобрен': return 'bg-green-500'
      case 'Отпуск отклонен': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Получить текст для типа отпуска
  const getVacationTypeText = (type: string) => {
    switch (type) {
      case 'Отпуск запрошен': return 'Запрошен'
      case 'Отпуск одобрен': return 'Одобрен'
      case 'Отпуск отклонен': return 'Отклонен'
      default: return type
    }
  }

  // Проверить, попадает ли отпуск на определенную дату
  const isVacationOnDate = (vacation: VacationEvent, date: Date) => {
    const startDate = startOfDay(parseISO(vacation.calendar_event_date_start))
    const endDate = vacation.calendar_event_date_end 
      ? startOfDay(parseISO(vacation.calendar_event_date_end))
      : startDate
    
    const normalizedDate = startOfDay(date)

    return normalizedDate >= startDate && normalizedDate <= endDate
  }

  // Найти отпуск на определенную дату для сотрудника
  const getVacationForDate = (employeeId: string, date: Date) => {
    const employeeVacations = vacationsByEmployee[employeeId] || []
    return employeeVacations.find(vacation => isVacationOnDate(vacation, date))
  }

  // Синхронизация вертикального скролла между левой и правой частями
  const handleVerticalScroll = (source: 'left' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    
    if (source === 'left' && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = scrollTop
    } else if (source === 'right' && leftScrollRef.current) {
      leftScrollRef.current.scrollTop = scrollTop
    }
  }

  // Обработка клика на отпуск
  const handleVacationClick = (vacation: VacationEvent, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    // Находим цветной элемент отпуска внутри клика
    const colorElement = event.currentTarget.querySelector('[data-vacation-color]') as HTMLElement
    if (colorElement) {
      const rect = colorElement.getBoundingClientRect()
      // Получаем координаты относительно главного контейнера
      const containerRect = scrollContainerRef.current?.getBoundingClientRect()
      
      setContextMenu({
        vacation,
        x: rect.left + rect.width, // Позиционируем по центру цветной полоски
        y: rect.top - (containerRect?.top || 0) + rect.height + 4 // Относительно контейнера + 1px
      })
    } else {
      // Fallback на старый способ
      const rect = event.currentTarget.getBoundingClientRect()
      const containerRect = scrollContainerRef.current?.getBoundingClientRect()
      
      setContextMenu({
        vacation,
        x: rect.left + rect.width / 2,
        y: rect.top - (containerRect?.top || 0) + rect.height + 1
      })
    }
  }

  // Закрытие контекстного меню
  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Обработчики действий из контекстного меню
  const handleApproveFromMenu = () => {
    if (contextMenu) {
      onApproveVacation(contextMenu.vacation.calendar_event_id)
      closeContextMenu()
    }
  }

  const handleRejectFromMenu = () => {
    if (contextMenu) {
      onRejectVacation(contextMenu.vacation.calendar_event_id)
      closeContextMenu()
    }
  }

  const handleEditFromMenu = () => {
    if (contextMenu) {
      onEditVacation(contextMenu.vacation)
      closeContextMenu()
    }
  }

  // Автоматическая прокрутка к текущему месяцу при загрузке
  useEffect(() => {
    if (scrollContainerRef.current && dateRange.length > 0) {
      const today = new Date()
      const todayIndex = dateRange.findIndex(date => isSameDay(date, today))
      
      if (todayIndex !== -1) {
        // Прокручиваем так, чтобы текущий день был примерно в центре видимой области
        const cellWidth = 32 // w-8 = 32px
        const containerWidth = scrollContainerRef.current.clientWidth
        const scrollPosition = Math.max(0, (todayIndex * cellWidth) - (containerWidth / 2))
        
        scrollContainerRef.current.scrollLeft = scrollPosition
      }
    }
  }, [dateRange, employees.length]) // Добавляем employees.length чтобы прокрутка сработала после загрузки данных

  // Закрытие контекстного меню при нажатии Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu()
      }
    }

    if (contextMenu) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  return (
    <div className="w-full overflow-hidden relative" onClick={closeContextMenu}>
      <TooltipProvider>
        <div className="flex">
          {/* Фиксированная левая колонка с сотрудниками */}
          <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">
            {/* Заголовок сотрудников */}
            <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <h3 className="font-semibold text-sm text-gray-600 dark:text-gray-300">
                Сотрудники ({employees.length})
              </h3>
            </div>
            
            {/* Список сотрудников */}
            <div 
              ref={leftScrollRef}
              className="max-h-96 overflow-y-auto"
              onScroll={handleVerticalScroll('left')}
            >
              {employees.map((employee) => (
                <div key={employee.user_id} className="h-12 flex items-center p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                  <div className="flex items-center space-x-3 w-full">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={employee.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {employee.first_name[0]}{employee.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {employee.first_name} {employee.last_name}
                      </div>
                      {employee.position_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {employee.position_name}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => onCreateVacation(employee.user_id)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Прокручиваемая область с датами и отпусками */}
          <div className="flex-1 overflow-hidden">
            <div ref={scrollContainerRef} className="overflow-x-auto">
              <div className="min-w-max">
                {/* Заголовки дат */}
                <div className="h-16 flex items-center border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                  {dateRange.map((date, index) => (
                    <div 
                      key={index}
                      className="w-8 flex-shrink-0 p-1 text-center border-r border-gray-200 dark:border-gray-600"
                    >
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {format(date, 'dd', { locale: ru })}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {format(date, 'MMM', { locale: ru })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Строки отпусков сотрудников */}
                <div 
                  ref={rightScrollRef}
                  className="max-h-96 overflow-y-auto"
                  onScroll={handleVerticalScroll('right')}
                >
                  {employees.map((employee) => (
                    <div key={employee.user_id} className="h-12 flex border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {/* Диаграмма отпусков */}
                      {dateRange.map((date, dateIndex) => {
                        const vacation = getVacationForDate(employee.user_id, date)
                        const isToday = isSameDay(date, new Date())
                        
                        return (
                          <div
                            key={dateIndex}
                            className={`
                              w-8 h-12 flex-shrink-0 border-r border-gray-200 dark:border-gray-600 relative
                              ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                            `}
                          >
                            {vacation && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    data-vacation-cell
                                    className={`
                                      w-full h-full relative cursor-pointer
                                      hover:ring-2 hover:ring-blue-400
                                    `}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleVacationClick(vacation, e)
                                    }}
                                  >
                                    <div 
                                      data-vacation-color
                                      className={`
                                        w-full h-full ${getVacationTypeColor(vacation.calendar_event_type)}
                                        opacity-80 hover:opacity-100 transition-all
                                      `}
                                    >
                                      {/* Индикатор для запрошенных отпусков */}
                                      {vacation.calendar_event_type === 'Отпуск запрошен' && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div className="font-medium">{getVacationTypeText(vacation.calendar_event_type)}</div>
                                    <div>
                                      {format(parseISO(vacation.calendar_event_date_start), 'dd.MM.yyyy')}
                                      {vacation.calendar_event_date_end && 
                                        ` - ${format(parseISO(vacation.calendar_event_date_end), 'dd.MM.yyyy')}`
                                      }
                                    </div>
                                    {vacation.calendar_event_comment && (
                                      <div className="mt-1 text-gray-400">{vacation.calendar_event_comment}</div>
                                    )}
                                    <div className="mt-1 text-blue-400 font-medium">Кликните на ячейку для действий</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Легенда */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Запрошен</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Одобрен</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Отклонен</span>
            </div>
          </div>
        </div>

        {/* Контекстное меню для отпусков */}
        {contextMenu && (
          <div 
            data-context-menu
            className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-[160px] transform -translate-x-1/2"
            style={{
              left: contextMenu.x,
              top: contextMenu.y
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Кнопка редактирования - всегда доступна */}
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-gray-700 dark:text-gray-300"
              onClick={handleEditFromMenu}
            >
              <Edit className="h-4 w-4" />
              <span>Редактировать</span>
            </button>

            {/* Разделитель */}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>

            {/* Кнопки одобрения/отклонения в зависимости от статуса */}
            {contextMenu.vacation.calendar_event_type === 'Отпуск запрошен' && (
              <>
                {/* Кнопка одобрения для запрошенного отпуска */}
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center space-x-2 text-green-600 dark:text-green-400"
                  onClick={handleApproveFromMenu}
                >
                  <Check className="h-4 w-4" />
                  <span>Одобрить отпуск</span>
                </button>

                {/* Кнопка отклонения для запрошенного отпуска */}
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 text-red-600 dark:text-red-400"
                  onClick={handleRejectFromMenu}
                >
                  <X className="h-4 w-4" />
                  <span>Отклонить отпуск</span>
                </button>
              </>
            )}

            {contextMenu.vacation.calendar_event_type === 'Отпуск одобрен' && (
              /* Кнопка отклонения для одобренного отпуска */
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 text-red-600 dark:text-red-400"
                onClick={handleRejectFromMenu}
              >
                <X className="h-4 w-4" />
                <span>Отклонить отпуск</span>
              </button>
            )}

            {contextMenu.vacation.calendar_event_type === 'Отпуск отклонен' && (
              /* Кнопка одобрения для отклоненного отпуска */
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center space-x-2 text-green-600 dark:text-green-400"
                onClick={handleApproveFromMenu}
              >
                <Check className="h-4 w-4" />
                <span>Одобрить отпуск</span>
              </button>
            )}
          </div>
        )}
      </TooltipProvider>
    </div>
  )
} 