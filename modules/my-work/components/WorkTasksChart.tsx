"use client"

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkLogEntry } from '../types'

interface WorkTasksChartData {
  date: Date
  label: string
  tasksCount: number
  totalHours: number
  workLogs: WorkLogEntry[]
  isWeekend?: boolean
  isToday?: boolean
}

interface WorkTasksChartProps {
  workLogs: WorkLogEntry[]
  daysToShow?: number
  height?: number
}

export const WorkTasksChart: React.FC<WorkTasksChartProps> = ({
  workLogs = [],
  daysToShow = 7,
  height = 200,
}) => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [hoveredBarData, setHoveredBarData] = useState<WorkTasksChartData | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [tooltipSide, setTooltipSide] = useState<'left' | 'right'>('right')
  const containerRef = useRef<HTMLDivElement>(null)

  // Отслеживание изменений размера контейнера
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth
        setContainerWidth(newWidth)
      }
    }

    // Устанавливаем начальную ширину
    updateWidth()

    // Используем ResizeObserver для отслеживания изменений размера контейнера
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        updateWidth()
      })
      
      resizeObserver.observe(containerRef.current)
      
      return () => {
        resizeObserver.disconnect()
      }
    }

    // Fallback для старых браузеров - отслеживаем изменения размера окна
    window.addEventListener('resize', updateWidth)
    
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Утилиты для работы с датами
  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const generateTimeUnits = (daysToShow: number) => {
    const result: { date: Date; label: string; isWeekend?: boolean }[] = []
    const currentDate = new Date()

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(currentDate)
      date.setDate(date.getDate() - i)
      const isWeekendDay = isWeekend(date)
      result.push({
        date,
        label: date.getDate().toString(),
        isWeekend: isWeekendDay,
      })
    }

    return result
  }

  // Функция для склонения русских слов
  const pluralize = (count: number, forms: [string, string, string]) => {
    // Для дробных значений от 0.2 до 0.9 используем множественное число
    if (count > 0 && count < 1 && count >= 0.2) {
      return forms[1]
    }
    
    const n = Math.abs(Math.floor(count)) % 100;
    const n1 = n % 10;
    
    if (n > 10 && n < 20) {
      return forms[2];
    }
    if (n1 > 1 && n1 < 5) {
      return forms[1];
    }
    if (n1 === 1) {
      return forms[0];
    }
    return forms[2];
  }

  // Функция для склонения слова "отчет"
  const pluralizeReports = (count: number) => {
    return pluralize(count, ['отчет', 'отчета', 'отчетов'])
  }

  // Функция для генерации динамических цветов с градиентом: снизу темный, сверху светлый
  const generateDynamicColor = (index: number, total: number) => {
    // Базовый темно-синий цвет (RGB: 30, 64, 175)
    const baseColor = { r: 30, g: 64, b: 175 }
    
    // Инвертируем индекс: последний элемент (сверху) должен быть светлым
    const invertedIndex = total - 1 - index
    
    // Вычисляем прозрачность: снизу темный (alpha=1.0), сверху светлый (alpha=0.3)
    const alpha = Math.max(1.0 - (invertedIndex / Math.max(total - 1, 1)) * 0.7, 0.3)
    
    return `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`
  }

  // Генерация данных для графика
  const chartData: WorkTasksChartData[] = useMemo(() => {
    const timeUnits = generateTimeUnits(daysToShow)
    

    
    return timeUnits.map(unit => {
      const dayWorkLogs = workLogs.filter(log => {
        const logDate = new Date(log.work_log_date)
        return (
          logDate.getDate() === unit.date.getDate() &&
          logDate.getMonth() === unit.date.getMonth() &&
          logDate.getFullYear() === unit.date.getFullYear()
        )
      })
      
      const totalHours = dayWorkLogs.reduce((sum, log) => sum + log.work_log_hours, 0)
      
      return {
        date: unit.date,
        label: unit.label,
        isWeekend: unit.isWeekend,
        isToday: isToday(unit.date),
        tasksCount: dayWorkLogs.length,
        totalHours,
        workLogs: dayWorkLogs
      }
    })
  }, [workLogs, daysToShow])

  // Максимальное количество задач для масштабирования
  const maxTasks = Math.max(...chartData.map(d => d.tasksCount), 1)
  
  // Проверяем есть ли данные
  const hasAnyData = workLogs.length > 0
  
  // Определяем компактность для адаптивности
  const isCompact = height < 140

  // Ширина каждого столбика (используем динамическую ширину контейнера, учитываем px-12 отступы = 96px)
  const barWidth = Math.max(Math.floor((containerWidth - 200) / daysToShow), 8)

  // Функция получения цвета столбика на основе часов
  const getBarColor = (tasksCount: number, totalHours: number) => {
    if (tasksCount === 0) return 'transparent'
    
    // Голубые оттенки в зависимости от количества часов
    if (totalHours === 0) return 'rgb(219, 234, 254)' // blue-100 (очень светлый)
    if (totalHours < 2) return 'rgb(191, 219, 254)' // blue-200 (светлый)
    if (totalHours < 4) return 'rgb(147, 197, 253)' // blue-300 (средний)
    if (totalHours < 8) return 'rgb(96, 165, 250)' // blue-400 (темный)
    return 'rgb(59, 130, 246)' // blue-500 (очень темный)
  }

  // Функция получения высоты столбика
  const getBarHeight = (tasksCount: number) => {
    if (tasksCount === 0) return 0
    return Math.max((tasksCount / maxTasks) * (height - 60), 8)
  }



  return (
    <div className="w-full">
      {/* CSS анимации */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
        <h3 className="text-sm text-primary">
          График отчетов
        </h3>
      </div>

      {/* График */}
      <div ref={containerRef} className="relative bg-muted rounded-lg px-12 py-3 overflow-visible">
        {/* Сообщение для пустого состояния */}
        {!hasAnyData && (
          <div className={`absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex items-center text-foreground animate-in fade-in-0 duration-300 max-w-sm ${
            isCompact ? 'gap-2 px-4 py-3' : 'gap-3 px-6 py-4'
          }`}>
            <BarChart3 className={`text-emerald-400 ${isCompact ? 'w-4 h-4' : 'w-6 h-6'}`} />
            <div className="text-center">
              <div className={`font-medium ${isCompact ? 'text-sm' : 'text-base'}`}>
                У вас нет выполненных задач
              </div>
              {!isCompact && (
                <div className="text-muted-foreground text-sm mt-1">
                  Чтобы отметить выполнение задачи, составьте отчет на вкладке декомпозиции
                </div>
              )}
            </div>
          </div>
        )}
        
        <div 
          className="flex items-end justify-center gap-1"
          style={{ height: `${height}px` }}
        >
          {chartData.map((data, index) => (
            <div key={index} className="relative flex flex-col items-center">
              {/* Столбик */}
              <div
                className={cn(
                  "relative transition-all duration-200 cursor-pointer rounded-t overflow-hidden",
                  data.isWeekend ? "opacity-60" : "",
                  data.isToday ? "ring-2 ring-emerald-400" : "",
                  hoveredBar === index ? "transform scale-105" : ""
                )}
                style={{
                  width: `${barWidth}px`,
                  height: `${Math.max(getBarHeight(data.tasksCount), 8)}px`, // Минимум 8px для видимости
                  backgroundColor: data.tasksCount === 0 ? 'rgb(219, 234, 254)' : getBarColor(data.tasksCount, data.totalHours),
                  opacity: 0.9
                }}
                onMouseEnter={(e) => {
                  // Получаем позицию столбика относительно контейнера
                  const barRect = e.currentTarget.getBoundingClientRect()
                  const containerRect = containerRef.current?.getBoundingClientRect()
                  
                  if (containerRect) {
                    const barCenter = barRect.left + barRect.width / 2 - containerRect.left
                    const containerCenter = containerWidth / 2
                    const y = barRect.top - containerRect.top
                    
                    let x: number
                    let side: 'left' | 'right'
                    
                    if (barCenter < containerCenter) {
                      x = barRect.right - containerRect.left + 10
                      side = 'right'
                    } else {
                      x = barRect.left - containerRect.left - 10
                      side = 'left'
                    }
                    
                    setTooltipPosition({ x, y })
                    setTooltipSide(side)
                  }
                  
                  setHoveredBar(index)
                  setHoveredBarData(data)
                }}
                onMouseLeave={() => {
                  setHoveredBar(null)
                  setHoveredBarData(null)
                }}
              >
                {/* Сегменты для отдельных отчетов - показываются при наведении */}
                {hoveredBar === index && data.workLogs.length > 0 && (
                  <div className="absolute inset-0 flex flex-col justify-end animate-in fade-in-0 duration-300">
                    {data.workLogs.map((log, logIndex) => {
                      const segmentHeight = data.totalHours > 0 
                        ? (log.work_log_hours / data.totalHours) * Math.max(getBarHeight(data.tasksCount), 8)
                        : Math.max(getBarHeight(data.tasksCount), 8) / data.workLogs.length
                      
                      return (
                        <div
                          key={logIndex}
                          className="transition-all duration-300 hover:brightness-110 cursor-pointer"
                          style={{
                            height: `${Math.max(segmentHeight, 2)}px`,
                            backgroundColor: generateDynamicColor(logIndex, data.workLogs.length),
                            transformOrigin: 'bottom',
                            animation: `slideUp 0.3s ease-out ${logIndex * 0.05}s both`
                          }}
                          title={`${log.work_category_name || 'Без категории'} (${log.section_name || 'Неизвестный раздел'}): ${log.work_log_hours} ч`}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Дата под столбиком */}
              <div className={cn(
                "text-xs mt-1 text-center",
                data.isToday ? "font-bold text-emerald-400" : "text-gray-400",
                data.isWeekend ? "text-red-400" : ""
              )}>
                {data.label}
              </div>
              

            </div>
          ))}
        </div>

        {/* Tooltip с детальной информацией */}
        {hoveredBarData && hoveredBarData.tasksCount > 0 && (
          <div 
            className="absolute bg-popover/95 backdrop-blur-sm text-popover-foreground p-3 rounded-lg shadow-lg border border-border text-xs z-20 animate-in fade-in-0 slide-in-from-top-2 duration-200 w-auto max-w-xs pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${Math.max(tooltipPosition.y - 10, 10)}px`,
              transform: tooltipSide === 'left' ? 'translateX(-100%)' : 'translateX(0)'
            }}
          >
            {/* Заголовок с датой и общими показателями */}
            <div className="mb-2 pb-2 border-b border-border">
              <div className="font-semibold text-foreground mb-1">
                {hoveredBarData.date.toLocaleDateString('ru-RU', { 
                  day: '2-digit', 
                  month: '2-digit',
                  weekday: 'short'
                })}
              </div>
                              <div className="flex items-center gap-3 text-xs">
                  <div className="text-emerald-400 font-medium">
                    {hoveredBarData.totalHours} {pluralize(hoveredBarData.totalHours, ['час', 'часа', 'часов'])}
                  </div>
                  <div className="text-gray-400">
                    {hoveredBarData.tasksCount} {pluralizeReports(hoveredBarData.tasksCount)}
                  </div>
                </div>
            </div>
            
            {/* Список задач */}
            <div className="space-y-1">
              {hoveredBarData.workLogs.slice(0, 5).map((log, idx) => (
                <div 
                  key={log.work_log_id} 
                  className="p-2 rounded border bg-muted/50 border-border"
                >
                  <div className="text-foreground text-xs mb-1 line-clamp-2">
                    {log.work_category_name || 'Без категории'}
                  </div>
                  <div className="text-muted-foreground text-xs mb-1">
                    {log.section_name || 'Неизвестный раздел'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {log.work_log_hours} {pluralize(log.work_log_hours, ['час', 'часа', 'часов'])}
                  </div>
                </div>
              ))}
              {hoveredBarData.workLogs.length > 5 && (
                <div className="text-muted-foreground text-xs text-center">
                  ... и еще {hoveredBarData.workLogs.length - 5} {pluralizeReports(hoveredBarData.workLogs.length - 5)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
