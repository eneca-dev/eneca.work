/**
 * Resource Graph - Main Component
 *
 * Главный компонент модуля графика ресурсов с timeline
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { Settings2, Filter, Database, FilterX } from 'lucide-react'
import { useResourceGraphData } from '../hooks'
import { useDisplaySettingsStore, useFiltersStore } from '../stores'
import { ResourceGraphFilters } from '../filters'
import { ResourceGraphTimeline } from './timeline'
import { cn } from '@/lib/utils'

/**
 * Проверяет, установлен ли хотя бы один фильтр
 */
function hasAnyFilter(filters: Record<string, unknown>): boolean {
  return Object.values(filters).some(
    (value) => value !== undefined && value !== null && value !== ''
  )
}

export function ResourceGraph() {
  const [showFilters, setShowFilters] = useState(true)
  const [loadAll, setLoadAll] = useState(false)

  // Filters and settings
  const { filters, clearFilters } = useFiltersStore()
  const { settings } = useDisplaySettingsStore()

  // Проверяем наличие фильтров
  const filtersApplied = useMemo(() => hasAnyFilter(filters), [filters])

  // Определяем, нужно ли загружать данные
  const shouldFetchData = filtersApplied || loadAll

  // Data fetching - только если есть фильтры или режим "загрузить всё"
  const { data, isLoading, error } = useResourceGraphData(filters, {
    enabled: shouldFetchData,
  })

  // Сброс режима "загрузить всё" при установке фильтров
  const handleLoadAll = useCallback(() => {
    setLoadAll(true)
  }, [])

  // Сброс всех фильтров и режима "загрузить всё"
  const handleClearAll = useCallback(() => {
    clearFilters()
    setLoadAll(false)
  }, [clearFilters])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="border-b p-4 flex items-center justify-between bg-card">
        <div>
          <h1 className="text-2xl font-bold">График ресурсов</h1>
          <p className="text-sm text-muted-foreground">
            Масштаб: {settings.scale} | Проектов: {data?.length || 0}
            {loadAll && !filtersApplied && ' (все данные)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Кнопка сброса (показывается если есть фильтры или loadAll) */}
          {(filtersApplied || loadAll) && (
            <button
              onClick={handleClearAll}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                'bg-destructive/10 text-destructive border border-destructive/30',
                'hover:bg-destructive/20 transition-colors duration-200'
              )}
            >
              <FilterX size={16} />
              Сбросить
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
              'border transition-colors duration-200',
              showFilters
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted'
            )}
          >
            <Filter size={16} />
            Фильтры
          </button>
          <button
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
              'bg-background text-foreground border border-input hover:bg-muted',
              'transition-colors duration-200'
            )}
          >
            <Settings2 size={16} />
            Настройки
          </button>
        </div>
      </header>

      {/* Filters */}
      {showFilters && <ResourceGraphFilters />}

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {/* Prompt to set filters or load all */}
        {!shouldFetchData && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md">
              <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold mb-2">
                Выберите данные для отображения
              </h2>
              <p className="text-muted-foreground mb-6">
                Используйте фильтры выше, чтобы выбрать проект, раздел или
                сотрудника. Или загрузите все данные сразу.
              </p>
              <button
                onClick={handleLoadAll}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors duration-200'
                )}
              >
                <Database size={16} />
                Загрузить всё
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {shouldFetchData && error && !isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-destructive mb-2">Ошибка загрузки данных</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {shouldFetchData && !error && (
          <ResourceGraphTimeline
            projects={data || []}
            isLoading={isLoading}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
