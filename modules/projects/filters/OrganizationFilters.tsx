import React from 'react'
import { Building2, Users, User, Lock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterOption } from './types'
import { FilterSelect } from './FilterSelect'

interface OrganizationFiltersProps {
  // Данные
  departments: FilterOption[]
  teams: FilterOption[]
  employees: FilterOption[]
  
  // Выбранные значения
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedEmployeeId: string | null
  
  // Состояние
  isLoading: boolean
  
  // Методы
  setFilter: (type: string, value: string | null) => void
  isFilterLocked: (type: string) => boolean
  
  // Настройки
  theme?: 'light' | 'dark'
}

export function OrganizationFilters({
  departments,
  teams,
  employees,
  selectedDepartmentId,
  selectedTeamId,
  selectedEmployeeId,
  isLoading,
  setFilter,
  isFilterLocked,
  theme = 'light'
}: OrganizationFiltersProps) {
  
  // Фильтрованные команды и сотрудники
  const filteredTeams = selectedDepartmentId 
    ? teams.filter(team => team.departmentId === selectedDepartmentId)
    : []
    
  const filteredEmployees = selectedTeamId
    ? employees.filter(emp => emp.teamId === selectedTeamId)
    : []

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-300",
      theme === 'dark' 
        ? "bg-slate-800/50 border-slate-700/50 shadow-xl" 
        : "bg-white border-slate-200 shadow-lg"
    )}>
      {/* Заголовок */}
      <div className={cn(
        "px-6 py-4 border-b flex items-center gap-3",
        theme === 'dark' 
          ? "border-slate-700/50 bg-slate-800/80" 
          : "border-slate-200 bg-slate-50/50"
      )}>
        <div className={cn(
          "p-2 rounded-lg",
          theme === 'dark' 
            ? "bg-teal-500/20 text-teal-400" 
            : "bg-teal-50 text-teal-600"
        )}>
          <Building2 size={20} />
        </div>
        <div>
          <h3 className={cn(
            "font-semibold text-base",
            theme === 'dark' ? "text-slate-100" : "text-slate-900"
          )}>
            Организация
          </h3>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? "text-slate-400" : "text-slate-500"
          )}>
            Фильтрация по отделам, командам и сотрудникам
          </p>
        </div>
      </div>

      {/* Контент */}
      <div className="p-6 space-y-6">
        {/* Отдел */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            )}>
              Отдел
            </span>
            {isFilterLocked('department') && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Lock size={10} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Заблокировано
                </span>
              </div>
            )}
          </div>
          
          <FilterSelect
            id="department"
            label=""
            value={selectedDepartmentId}
            onChange={(value) => setFilter('department', value)}
            disabled={isLoading}
            locked={isFilterLocked('department')}
            options={departments}
            placeholder="Выберите отдел"
            theme={theme}
            loading={isLoading}
          />
        </div>

        {/* Стрелка */}
        {selectedDepartmentId && (
          <div className="flex justify-center">
            <ChevronRight size={16} className={cn(
              "text-slate-400",
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            )} />
          </div>
        )}

        {/* Команда */}
        <div className={cn(
          "space-y-3 transition-all duration-300",
          selectedDepartmentId ? 'opacity-100' : 'opacity-50'
        )}>
          <div className="flex items-center gap-2">
            <Users size={16} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            )}>
              Команда
            </span>
            {isFilterLocked('team') && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Lock size={10} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Заблокировано
                </span>
              </div>
            )}
          </div>
          
          <FilterSelect
            id="team"
            label=""
            value={selectedTeamId}
            onChange={(value) => setFilter('team', value)}
            disabled={isLoading || !selectedDepartmentId}
            locked={isFilterLocked('team')}
            options={filteredTeams}
            placeholder={!selectedDepartmentId ? "Сначала выберите отдел" : "Выберите команду"}
            theme={theme}
            loading={isLoading}
          />
          
          {selectedDepartmentId && filteredTeams.length === 0 && !isLoading && (
            <p className={cn(
              "text-xs text-center py-2",
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            )}>
              В выбранном отделе нет команд
            </p>
          )}
        </div>

        {/* Стрелка */}
        {selectedTeamId && (
          <div className="flex justify-center">
            <ChevronRight size={16} className={cn(
              "text-slate-400",
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            )} />
          </div>
        )}

        {/* Сотрудник */}
        <div className={cn(
          "space-y-3 transition-all duration-300",
          selectedTeamId ? 'opacity-100' : 'opacity-50'
        )}>
          <div className="flex items-center gap-2">
            <User size={16} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            )}>
              Сотрудник
            </span>
            {isFilterLocked('employee') && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Lock size={10} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Заблокировано
                </span>
              </div>
            )}
          </div>
          
          <FilterSelect
            id="employee"
            label=""
            value={selectedEmployeeId}
            onChange={(value) => setFilter('employee', value)}
            disabled={isLoading || !selectedTeamId}
            locked={isFilterLocked('employee')}
            options={filteredEmployees}
            placeholder={!selectedTeamId ? "Сначала выберите команду" : "Выберите сотрудника"}
            theme={theme}
            loading={isLoading}
          />
          
          {selectedTeamId && filteredEmployees.length === 0 && !isLoading && (
            <p className={cn(
              "text-xs text-center py-2",
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            )}>
              В выбранной команде нет сотрудников
            </p>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className={cn(
        "px-6 py-3 border-t text-xs",
        theme === 'dark' 
          ? "border-slate-700/50 bg-slate-800/30 text-slate-400" 
          : "border-slate-200 bg-slate-50/30 text-slate-500"
      )}>
        <div className="flex justify-between items-center">
          <span>
            {departments.length} отдел{departments.length === 1 ? '' : departments.length < 5 ? 'а' : 'ов'}
          </span>
          {selectedDepartmentId && (
            <span>
              {filteredTeams.length} команд{filteredTeams.length === 1 ? 'а' : filteredTeams.length < 5 ? 'ы' : ''}
            </span>
          )}
          {selectedTeamId && (
            <span>
              {filteredEmployees.length} сотрудник{filteredEmployees.length === 1 ? '' : filteredEmployees.length < 5 ? 'а' : 'ов'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
