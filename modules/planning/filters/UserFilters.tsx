import React from 'react'
import { FilterSelect } from './FilterSelect'

interface UserFiltersProps {
  filters: {
    department?: string
    team?: string
    role?: string
    status?: string
  }
  onFiltersChange: (filters: any) => void
}

export function UserFilters({ filters, onFiltersChange }: UserFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const statusOptions = [
    { label: 'Активные', value: 'active' },
    { label: 'Неактивные', value: 'inactive' },
    { label: 'Все', value: 'all' }
  ]

  const roleOptions = [
    { label: 'Администратор', value: 'admin' },
    { label: 'Менеджер', value: 'manager' },
    { label: 'Сотрудник', value: 'employee' }
  ]

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
      
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Роль</label>
        <select
          value={filters.role || ''}
          onChange={(e) => updateFilter('role', e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm"
        >
          <option value="">Все роли</option>
          {roleOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Статус</label>
        <select
          value={filters.status || 'active'}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}