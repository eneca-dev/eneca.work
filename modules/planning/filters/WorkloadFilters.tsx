import React from 'react'
import { FilterSelect } from './FilterSelect'

interface WorkloadFiltersProps {
  filters: {
    department?: string
    team?: string
    employee?: string
    dateRange?: [Date, Date]
  }
  onFiltersChange: (filters: any) => void
}

export function WorkloadFilters({ filters, onFiltersChange }: WorkloadFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-background border-b">
      <FilterSelect
        filterId="department"
        value={filters.department || ''}
        onChange={(value) => updateFilter('department', value)}
        config={{
          apiEndpoint: '/api/departments',
          transform: (data) => data.map((item: any) => ({
            label: item.name,
            value: item.id
          }))
        }}
      />
      
      <FilterSelect
        filterId="team"
        value={filters.team || ''}
        onChange={(value) => updateFilter('team', value)}
        config={{
          apiEndpoint: '/api/teams',
          dependencies: filters.department ? ['department'] : undefined,
          transform: (data) => data.map((item: any) => ({
            label: item.name,
            value: item.id
          }))
        }}
      />
      
      <FilterSelect
        filterId="employee"
        value={filters.employee || ''}
        onChange={(value) => updateFilter('employee', value)}
        config={{
          apiEndpoint: '/api/employees',
          dependencies: filters.team ? ['team'] : undefined,
          transform: (data) => data.map((item: any) => ({
            label: `${item.first_name} ${item.last_name}`,
            value: item.id
          }))
        }}
      />
    </div>
  )
}