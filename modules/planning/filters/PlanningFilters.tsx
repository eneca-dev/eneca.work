import React from 'react'
import { FilterSelect } from './FilterSelect'
import { usePlanningFilters } from './usePlanningFilters'

export function PlanningFilters() {
  const {
    filters,
    updateFilter,
    clearFilters,
    filterConfigs
  } = usePlanningFilters()

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-background border-b">
      {Object.entries(filterConfigs).map(([key, config]) => (
        <FilterSelect
          key={key}
          filterId={key}
          value={filters[key as keyof typeof filters]}
          onChange={(value) => updateFilter(key as keyof typeof filters, value)}
          config={config}
        />
      ))}
      
      <button
        onClick={clearFilters}
        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Очистить фильтры
      </button>
    </div>
  )
}