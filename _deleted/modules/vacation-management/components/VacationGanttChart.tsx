"use client"

import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, startOfDay, addMonths, subMonths, getYear, getMonth, setMonth, setYear, isWeekend } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoreVertical, Plus, Edit, Trash2, Check, X, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Employee, VacationEvent } from '../types'

// Константа для ширины ячейки дня (соответствует классу w-8 = 32px)
export const DAY_CELL_WIDTH = 32

// Интерфейс для отпуска с предварительно обработанными датами
interface ProcessedVacationEvent extends VacationEvent {
  parsedStartDate: Date
  parsedEndDate: Date
}

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
  // Добавляем состояние для отслеживания hover отпуска
  const [hoveredVacationId, setHoveredVacationId] = useState<string | null>(null)
  
  // Ref для контекстного меню
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  // Состояние для сохранения позиции скролла
  const [scrollPosition, setScrollPosition] = useState({ horizontal: 0, vertical: 0 })
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false)
  
  // Ref для отслеживания последней сохраненной позиции
  const lastSavedPositionRef = useRef({ horizontal: 0, vertical: 0 })
  
  // Состояние для диалога подтверждения удаления
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    vacation: VacationEvent
    employee: Employee
  } | null>(null)

  // Состояния для селектора месяца/года
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()))
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()))
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Генерируем диапазон дат для отображения (текущий месяц + 2 следующих) с предварительной нормализацией
  const dateRange = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(addMonths(currentDate, 2))
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // Предварительно нормализуем все даты в диапазоне для оптимизации
  const normalizedDateRange = useMemo(() => {
    return dateRange.map(date => startOfDay(date))
  }, [dateRange])

  // Получаем информацию о годах для отображения
  const yearInfo = useMemo(() => {
    const startYear = getYear(startOfMonth(currentDate))
    const endYear = getYear(endOfMonth(addMonths(currentDate, 2)))
    
    if (startYear === endYear) {
      return startYear.toString()
    } else {
      return `${startYear}/${endYear}`
    }
  }, [currentDate])

  // Получаем названия месяцев для отображения
  const monthsInfo = useMemo(() => {
    return [0, 1, 2].map(offset => {
      const monthDate = addMonths(currentDate, offset)
      return format(monthDate, 'LLLL', { locale: ru })
    })
  }, [currentDate])

  // Группируем отпуска по сотрудникам с предварительной обработкой дат
  const vacationsByEmployee = useMemo(() => {
    const grouped: Record<string, ProcessedVacationEvent[]> = {}
    vacations.forEach(vacation => {
      if (!grouped[vacation.calendar_event_created_by]) {
        grouped[vacation.calendar_event_created_by] = []
      }
      
      // Предварительно парсим и кешируем даты
      const parsedStartDate = startOfDay(parseISO(vacation.calendar_event_date_start))
      const parsedEndDate = vacation.calendar_event_date_end 
        ? startOfDay(parseISO(vacation.calendar_event_date_end))
        : parsedStartDate
      
      const processedVacation: ProcessedVacationEvent = {
        ...vacation,
        parsedStartDate,
        parsedEndDate
      }
      
      grouped[vacation.calendar_event_created_by].push(processedVacation)
    })
    return grouped
  }, [vacations])

  // Оптимизированная структура для быстрого поиска отпусков по датам
  const vacationsByEmployeeAndDate = useMemo(() => {
    const result: Record<string, Map<string, ProcessedVacationEvent>> = {}
    
    Object.entries(vacationsByEmployee).forEach(([employeeId, employeeVacations]) => {
      const dateMap = new Map<string, ProcessedVacationEvent>()
      
      employeeVacations.forEach(vacation => {
        // Заполняем Map для всех дат в диапазоне отпуска
        let currentDate = new Date(vacation.parsedStartDate)
        while (currentDate <= vacation.parsedEndDate) {
          const dateKey = currentDate.toISOString().split('T')[0]
          dateMap.set(dateKey, vacation)
          currentDate = addDays(currentDate, 1)
        }
      })
      
      result[employeeId] = dateMap
    })
    
    return result
  }, [vacationsByEmployee])

  // Интерфейс для объединенного блока отпуска
  interface VacationBlock {
    vacation: ProcessedVacationEvent
    startIndex: number
    width: number
    isHovered: boolean
  }

  // Функция для создания объединенных блоков отпусков для сотрудника
  const getVacationBlocksForEmployee = useMemo(() => {
    return (employeeId: string): VacationBlock[] => {
      const employeeDateMap = vacationsByEmployeeAndDate[employeeId]
      if (!employeeDateMap) return []

      const blocks: VacationBlock[] = []
      let currentBlock: VacationBlock | null = null

      normalizedDateRange.forEach((date, index) => {
        const dateKey = date.toISOString().split('T')[0]
        const vacation = employeeDateMap.get(dateKey)

        if (vacation) {
          if (currentBlock && currentBlock.vacation.calendar_event_id === vacation.calendar_event_id) {
            // Расширяем текущий блок
            currentBlock.width++
          } else {
            // Завершаем предыдущий блок и начинаем новый
            if (currentBlock) {
              blocks.push(currentBlock)
            }
            currentBlock = {
              vacation,
              startIndex: index,
              width: 1,
              isHovered: hoveredVacationId === vacation.calendar_event_id
            }
          }
        } else {
          // Завершаем текущий блок если он есть
          if (currentBlock) {
            blocks.push(currentBlock)
            currentBlock = null
          }
        }
      })

      // Добавляем последний блок если он есть
      if (currentBlock) {
        blocks.push(currentBlock)
      }

      return blocks
    }
  }, [vacationsByEmployeeAndDate, normalizedDateRange, hoveredVacationId])

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



  // Навигация по месяцам
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = subMonths(prev, 1)
      // Синхронизируем селекторы
      setSelectedMonth(getMonth(newDate))
      setSelectedYear(getYear(newDate))
      return newDate
    })
  }

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = addMonths(prev, 1)
      // Синхронизируем селекторы
      setSelectedMonth(getMonth(newDate))
      setSelectedYear(getYear(newDate))
      return newDate
    })
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    setCurrentDate(now)
    // Синхронизируем селекторы с текущей датой
    setSelectedMonth(getMonth(now))
    setSelectedYear(getYear(now))
  }

  // Переход к выбранному месяцу/году
  const goToSelectedMonth = () => {
    const newDate = setYear(setMonth(new Date(), selectedMonth), selectedYear)
    setCurrentDate(newDate)
    setIsPopoverOpen(false) // Закрываем попап после перехода
  }

  // Генерируем годы для селектора (текущий год ± 5 лет)
  const availableYears = useMemo(() => {
    const currentYear = getYear(new Date())
    const years = []
    for (let i = currentYear - 5; i <= currentYear + 10; i++) {
      years.push(i)
    }
    return years
  }, [])

  // Названия месяцев для селектора
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]

  // Синхронизация вертикального скролла между левой и правой частями
  const handleVerticalScroll = (source: 'left' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    
    // Мгновенно закрываем контекстное меню при прокрутке
    setContextMenu(null)
    
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
    const containerRect = scrollContainerRef.current?.getBoundingClientRect()
    
    if (!containerRect) return
    
    let x: number, y: number
    
    if (colorElement) {
      const rect = colorElement.getBoundingClientRect()
      x = rect.left + rect.width // Позиционируем по центру цветной полоски
      y = rect.top - containerRect.top + rect.height + 4 // Относительно контейнера + 4px
    } else {
      // Fallback на старый способ
      const rect = event.currentTarget.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top - containerRect.top + rect.height + 1
    }
    
    // Устанавливаем начальную позицию контекстного меню
    setContextMenu({
      vacation,
      x,
      y
    })
  }

  // Динамическая корректировка позиции контекстного меню после рендера
  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current && scrollContainerRef.current) {
      const menuRect = contextMenuRef.current.getBoundingClientRect()
      const containerRect = scrollContainerRef.current.getBoundingClientRect()
      
      const menuHeight = menuRect.height || (contextMenu.vacation.calendar_event_type === 'Отпуск запрошен' ? 140 : 100) // Fallback
      const containerHeight = containerRect.height
      
      // Проверяем, помещается ли контекстное меню в контейнер
      let adjustedY = contextMenu.y
      
      // Если меню не помещается снизу, позиционируем его сверху
      if (contextMenu.y + menuHeight > containerHeight) {
        // Вычисляем новую позицию сверху от элемента
        const colorElement = document.querySelector('[data-vacation-cell]:hover [data-vacation-color]') as HTMLElement
        if (colorElement) {
          const rect = colorElement.getBoundingClientRect()
          adjustedY = rect.top - containerRect.top - menuHeight - 4
        } else {
          adjustedY = contextMenu.y - menuHeight - 8
        }
        
        // Убеждаемся, что меню не выходит за верхнюю границу
        adjustedY = Math.max(4, adjustedY)
      }
      
      // Обновляем позицию только если она изменилась
      if (adjustedY !== contextMenu.y) {
        setContextMenu(prev => prev ? { ...prev, y: adjustedY } : null)
      }
    }
  }, [contextMenu?.vacation.calendar_event_id, contextMenu?.x, contextMenu?.y]) // Зависимости для корректного обновления

  // Закрытие контекстного меню
  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Обработчики действий из контекстного меню
  const handleApproveFromMenu = () => {
    if (contextMenu) {
      saveScrollPosition()
      onApproveVacation(contextMenu.vacation.calendar_event_id)
      closeContextMenu()
    }
  }

  const handleRejectFromMenu = () => {
    if (contextMenu) {
      saveScrollPosition()
      onRejectVacation(contextMenu.vacation.calendar_event_id)
      closeContextMenu()
    }
  }

  const handleEditFromMenu = () => {
    if (contextMenu) {
      saveScrollPosition()
      onEditVacation(contextMenu.vacation)
      closeContextMenu()
    }
  }

  const handleDeleteFromMenu = () => {
    if (contextMenu) {
      // Находим сотрудника для отпуска
      const employee = employees.find(emp => emp.user_id === contextMenu.vacation.calendar_event_created_by)
      if (employee) {
        setDeleteConfirmation({
          vacation: contextMenu.vacation,
          employee
        })
      }
      closeContextMenu()
    }
  }

  const confirmDelete = () => {
    if (deleteConfirmation) {
      saveScrollPosition()
      onDeleteVacation(deleteConfirmation.vacation.calendar_event_id)
      setDeleteConfirmation(null)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmation(null)
  }

  // Автоматическая прокрутка к текущему месяцу при загрузке
  useEffect(() => {
    if (scrollContainerRef.current && dateRange.length > 0) {
      const today = new Date()
      const todayIndex = dateRange.findIndex(date => isSameDay(date, today))
      
      if (todayIndex !== -1) {
        // Прокручиваем так, чтобы текущий день был примерно в центре видимой области
        const containerWidth = scrollContainerRef.current.clientWidth
        const scrollPosition = Math.max(0, (todayIndex * DAY_CELL_WIDTH) - (containerWidth / 2))
        
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

  // Восстановление позиции скролла при изменении данных отпусков
  useEffect(() => {
    if (shouldRestoreScroll) {
      // Используем requestAnimationFrame для более надежного восстановления позиции
      const frameId = requestAnimationFrame(() => {
        restoreScrollPosition()
      })
      
      return () => cancelAnimationFrame(frameId)
    }
  }, [vacations, shouldRestoreScroll])

  // Дополнительный эффект для восстановления позиции при любых изменениях в данных
  useEffect(() => {
    if (shouldRestoreScroll) {
      // Дополнительная проверка через небольшую задержку
      const timeoutId = setTimeout(() => {
        if (shouldRestoreScroll) {
          restoreScrollPosition()
        }
      }, 50)
      
      return () => clearTimeout(timeoutId)
    }
  }, [vacationsByEmployee, shouldRestoreScroll])

  // Обработчики hover для отпусков
  const handleVacationMouseEnter = (vacationId: string) => {
    setHoveredVacationId(vacationId)
  }

  const handleVacationMouseLeave = () => {
    setHoveredVacationId(null)
  }

  // Функции для сохранения и восстановления позиции скролла
  const saveScrollPosition = () => {
    if (scrollContainerRef.current && leftScrollRef.current) {
      const newPosition = {
        horizontal: scrollContainerRef.current.scrollLeft,
        vertical: leftScrollRef.current.scrollTop
      }
      
      // Сохраняем в state и ref
      setScrollPosition(newPosition)
      lastSavedPositionRef.current = newPosition
      setShouldRestoreScroll(true)
    }
  }

  const restoreScrollPosition = () => {
    if (shouldRestoreScroll && scrollContainerRef.current && leftScrollRef.current && rightScrollRef.current) {
      const targetPosition = lastSavedPositionRef.current
      
      // Восстанавливаем горизонтальную позицию
      scrollContainerRef.current.scrollLeft = targetPosition.horizontal
      
      // Восстанавливаем вертикальную позицию для обеих панелей
      leftScrollRef.current.scrollTop = targetPosition.vertical
      rightScrollRef.current.scrollTop = targetPosition.vertical
      
      // Дополнительная проверка и повторное восстановление при необходимости
      const verifyAndRestore = () => {
        if (scrollContainerRef.current && leftScrollRef.current && rightScrollRef.current) {
          if (Math.abs(scrollContainerRef.current.scrollLeft - targetPosition.horizontal) > 1) {
            scrollContainerRef.current.scrollLeft = targetPosition.horizontal
          }
          if (Math.abs(leftScrollRef.current.scrollTop - targetPosition.vertical) > 1) {
            leftScrollRef.current.scrollTop = targetPosition.vertical
            rightScrollRef.current.scrollTop = targetPosition.vertical
          }
        }
      }
      
      // Проверяем несколько раз для надежности
      setTimeout(verifyAndRestore, 10)
      setTimeout(verifyAndRestore, 50)
      setTimeout(verifyAndRestore, 100)
      
      setShouldRestoreScroll(false)
    }
  }

  return (
    <div className="w-full overflow-hidden relative" onClick={closeContextMenu}>
      <TooltipProvider>
        {/* Панель навигации */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            {/* Левая часть: кнопка "Сегодня" и быстрый переход */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentMonth}
                className="h-8 px-3 flex items-center space-x-2"
              >
                <Calendar className="h-3 w-3" />
                <span className="text-xs">Сегодня</span>
              </Button>

              {/* Кнопка быстрого перехода к месяцу */}
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 flex items-center space-x-2"
                  >
                    <Search className="h-3 w-3" />
                    <span className="text-xs">Перейти к месяцу</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="start">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Быстрый переход
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                          Месяц
                        </label>
                        <Select
                          value={selectedMonth.toString()}
                          onValueChange={(value) => setSelectedMonth(parseInt(value))}
                        >
                          <SelectTrigger className="w-full h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((monthName, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {monthName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                          Год
                        </label>
                        <Select
                          value={selectedYear.toString()}
                          onValueChange={(value) => setSelectedYear(parseInt(value))}
                        >
                          <SelectTrigger className="w-full h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableYears.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={goToSelectedMonth}
                        className="w-full h-8 text-xs"
                        size="sm"
                      >
                        Перейти
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Правая часть: навигация по месяцам */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center min-w-[200px]">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {yearInfo}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {monthsInfo.join(' • ')}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Фиксированная левая колонка с сотрудниками */}
          <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600" onClick={closeContextMenu}>
            {/* Заголовок сотрудников */}
            <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <h3 className="font-semibold text-sm text-gray-600 dark:text-gray-200">
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
                <div key={employee.user_id} className="h-12 flex items-center p-3 border-b border-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600">
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
                        <div className="text-xs text-gray-500 dark:text-gray-300 truncate">
                          {employee.position_name}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        saveScrollPosition()
                        onCreateVacation(employee.user_id)
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Прокручиваемая область с датами и отпусками */}
          <div className="flex-1 overflow-hidden" onClick={closeContextMenu}>
            <div 
              ref={scrollContainerRef} 
              className="overflow-x-auto"
              onScroll={() => setContextMenu(null)}
            >
              <div className="min-w-max">
                {/* Заголовки дат */}
                <div className="h-16 flex items-center border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 relative">
                  {/* Фон для выходных дней под сеткой */}
                  {dateRange.map((date, index) => {
                    const isWeekendDay = isWeekend(date)
                    return isWeekendDay ? (
                      <div 
                        key={`weekend-bg-${index}`}
                        className="absolute top-0 bottom-0 bg-red-50 dark:bg-red-800/30 pointer-events-none"
                        style={{ 
                          transform: `translateX(${index * DAY_CELL_WIDTH}px)`,
                          width: `${DAY_CELL_WIDTH}px`,
                          willChange: 'transform'
                        }}
                      />
                    ) : null
                  })}
                  
                  {/* Ячейки с текстом поверх фона */}
                  {dateRange.map((date, index) => {
                    const isWeekendDay = isWeekend(date)
                    return (
                      <div 
                        key={index}
                        className="w-8 flex-shrink-0 p-1 text-center border-r border-gray-200 dark:border-gray-600 relative z-10"
                      >
                        <div className={`text-xs ${
                          isWeekendDay 
                            ? 'text-red-600 dark:text-red-400 font-medium' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {format(date, 'dd', { locale: ru })}
                        </div>
                        <div className={`text-xs ${
                          isWeekendDay 
                            ? 'text-red-500 dark:text-red-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {format(date, 'MMM', { locale: ru })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Строки отпусков сотрудников */}
                <div 
                  ref={rightScrollRef}
                  className="max-h-96 overflow-y-auto"
                  onScroll={handleVerticalScroll('right')}
                >
                  {employees.map((employee) => {
                    const vacationBlocks = getVacationBlocksForEmployee(employee.user_id)
                    
                    return (
                      <div key={employee.user_id} className="h-12 flex border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600/30 relative">
                        {/* Фон для выходных дней под сеткой */}
                        {dateRange.map((date, dateIndex) => {
                          const isWeekendDay = isWeekend(date)
                          const isToday = isSameDay(date, new Date())
                          return isWeekendDay && !isToday ? (
                            <div 
                              key={`weekend-bg-${dateIndex}`}
                              className="absolute top-0 bottom-0 bg-red-50 dark:bg-red-800/20 pointer-events-none"
                              style={{ 
                                transform: `translateX(${dateIndex * DAY_CELL_WIDTH}px)`,
                                width: `${DAY_CELL_WIDTH}px`,
                                willChange: 'transform'
                              }}
                            />
                          ) : null
                        })}
                        
                        {/* Фон для текущего дня */}
                        {dateRange.map((date, dateIndex) => {
                          const isToday = isSameDay(date, new Date())
                          return isToday ? (
                            <div 
                              key={`today-bg-${dateIndex}`}
                              className="absolute top-0 bottom-0 bg-blue-50 dark:bg-blue-800/30 pointer-events-none"
                              style={{ 
                                transform: `translateX(${dateIndex * DAY_CELL_WIDTH}px)`,
                                width: `${DAY_CELL_WIDTH}px`,
                                willChange: 'transform'
                              }}
                            />
                          ) : null
                        })}
                        
                        {/* Базовая сетка дат поверх фона */}
                        {dateRange.map((date, dateIndex) => {
                          return (
                            <div
                              key={dateIndex}
                              className="w-8 h-12 flex-shrink-0 border-r border-gray-200 dark:border-gray-600 relative z-10"
                            />
                          )
                        })}
                        
                        {/* Блоки отпусков поверх сетки */}
                        {vacationBlocks.map((block, blockIndex) => (
                          <div
                            key={blockIndex}
                            className="absolute top-0 h-12 flex items-center z-20"
                            style={{
                              left: `${block.startIndex * DAY_CELL_WIDTH}px`,
                              width: `${block.width * DAY_CELL_WIDTH}px`
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  data-vacation-cell
                                  className="w-full h-full relative cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleVacationClick(block.vacation, e)
                                  }}
                                  onMouseEnter={() => handleVacationMouseEnter(block.vacation.calendar_event_id)}
                                  onMouseLeave={handleVacationMouseLeave}
                                >
                                  <div 
                                    data-vacation-color
                                    className={`
                                      w-full h-full ${getVacationTypeColor(block.vacation.calendar_event_type)}
                                      transition-all duration-150 rounded-sm mx-0.5
                                      ${hoveredVacationId === block.vacation.calendar_event_id 
                                        ? 'ring-2 ring-blue-400 ring-inset scale-105 opacity-100 shadow-sm' 
                                        : 'opacity-80'
                                      }
                                    `}
                                  >
                                    {/* Индикатор для запрошенных отпусков */}
                                    {block.vacation.calendar_event_type === 'Отпуск запрошен' && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <div className="font-medium">{getVacationTypeText(block.vacation.calendar_event_type)}</div>
                                  <div>
                                    {format(parseISO(block.vacation.calendar_event_date_start), 'dd.MM.yyyy')}
                                    {block.vacation.calendar_event_date_end && 
                                      ` - ${format(parseISO(block.vacation.calendar_event_date_end), 'dd.MM.yyyy')}`
                                    }
                                  </div>
                                  {block.vacation.calendar_event_comment && (
                                    <div className="mt-1 text-gray-400">{block.vacation.calendar_event_comment}</div>
                                  )}
                                  <div className="mt-1 text-blue-400 font-medium">Кликните на отпуск для действий</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Легенда */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t" onClick={closeContextMenu}>
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
            ref={contextMenuRef}
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

            {/* Кнопка удаления - всегда доступна */}
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 text-red-600 dark:text-red-400"
              onClick={handleDeleteFromMenu}
            >
              <Trash2 className="h-4 w-4" />
              <span>Удалить</span>
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

        {/* Диалог подтверждения удаления */}
        <Dialog open={!!deleteConfirmation} onOpenChange={(open) => {
          if (!open) {
            cancelDelete()
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Подтверждение удаления</DialogTitle>
              <DialogDescription>
                {deleteConfirmation && (
                  <>
                  <br />
                    Удалить отпуск с{' '}
                    <strong>
                      {format(parseISO(deleteConfirmation.vacation.calendar_event_date_start), 'dd.MM.yyyy')}
                    </strong>
                    {deleteConfirmation.vacation.calendar_event_date_end && (
                      <>
                        {' '}по{' '}
                        <strong>
                          {format(parseISO(deleteConfirmation.vacation.calendar_event_date_end), 'dd.MM.yyyy')}
                        </strong>
                      </>
                    )}
                    {' '}у{' '}
                    <strong>
                      {deleteConfirmation.employee.first_name} {deleteConfirmation.employee.last_name}
                    </strong>
                    ?
                    <br />
                    <br />
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Это действие нельзя отменить.
                    </span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDelete}>Отмена</Button>
              <Button 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Удалить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </div>
  )
} 