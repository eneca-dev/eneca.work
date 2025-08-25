"use client"

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'
import type { VacationManagementState, Employee, VacationEvent, Department } from './types'

const supabase = createClient()

interface VacationManagementStore extends VacationManagementState {
  // Токен для отслеживания актуальности запросов
  currentRequestToken: string | null
  
  // Действия
  setSelectedDepartment: (departmentId: string | null) => void
  loadDepartments: () => Promise<void>
  loadEmployees: (departmentId: string) => Promise<void>
  loadVacations: (employeeIds: string[]) => Promise<void>
  createVacation: (userId: string, startDate: string, endDate: string, type: string, comment?: string) => Promise<void>
  updateVacation: (vacationId: string, startDate: string, endDate: string, type: string, comment?: string) => Promise<void>
  deleteVacation: (vacationId: string) => Promise<void>
  approveVacation: (vacationId: string) => Promise<void>
  rejectVacation: (vacationId: string) => Promise<void>
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useVacationManagementStore = create<VacationManagementStore>()(
  devtools(
    (set, get) => ({
      // Начальное состояние
      selectedDepartmentId: null,
      employees: [],
      vacations: [],
      departments: [],
      isLoading: false,
      error: null,
      currentRequestToken: null,

      // Установка выбранного отдела
      setSelectedDepartment: (departmentId) => {
        // Генерируем новый токен для этого запроса
        const requestToken = `dept_${Date.now()}_${Math.random()}`
        
        set({ 
          selectedDepartmentId: departmentId,
          currentRequestToken: requestToken
        })
        
        if (departmentId) {
          get().loadEmployees(departmentId)
        } else {
          set({ employees: [], vacations: [] })
        }
      },

      // Загрузка списка отделов
      loadDepartments: async () => {
        set({ isLoading: true, error: null })
        
        try {
          const { data, error } = await supabase
            .from('departments')
            .select('department_id, department_name')
            .order('department_name')

          if (error) throw error

          set({ departments: data || [] })
        } catch (error) {
          console.error('Ошибка загрузки отделов:', error)
          set({ error: 'Не удалось загрузить список отделов' })
        } finally {
          set({ isLoading: false })
        }
      },

      // Загрузка сотрудников отдела
      loadEmployees: async (departmentId) => {
        // Сохраняем токен запроса на момент начала загрузки
        const { currentRequestToken: requestToken } = get()
        
        set({ isLoading: true, error: null })
        
        try {
          // Получаем профили сотрудников
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select(`
              user_id,
              first_name,
              last_name,
              email,
              department_id,
              avatar_url,
              position_id
            `)
            .eq('department_id', departmentId)
            .order('last_name')

          if (profilesError) throw profilesError

          // Получаем название отдела
          const { data: departmentData, error: departmentError } = await supabase
            .from('departments')
            .select('department_name')
            .eq('department_id', departmentId)
            .single()

          if (departmentError) throw departmentError

          // Получаем должности
          const positionIds = profilesData?.map(p => p.position_id).filter(Boolean) || []
          let positionsData: any[] = []
          
          if (positionIds.length > 0) {
            const { data: posData, error: posError } = await supabase
              .from('positions')
              .select('position_id, position_name')
              .in('position_id', positionIds)
            
            if (posError) throw posError
            positionsData = posData || []
          }

          // Создаем мапу должностей
          const positionMap = new Map(positionsData.map(p => [p.position_id, p.position_name]))

          const data = profilesData

          // Проверяем, что запрос все еще актуален
          const { currentRequestToken: currentToken } = get()
          if (requestToken !== currentToken) {
            console.log('Отменяем устаревший запрос сотрудников для отдела:', departmentId)
            return
          }

          const employees: Employee[] = data?.map((profile: any) => ({
            user_id: profile.user_id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
            department_id: profile.department_id,
            department_name: departmentData?.department_name || '',
            position_name: profile.position_id ? positionMap.get(profile.position_id) : undefined,
            avatar_url: profile.avatar_url
          })) || []

          // Еще раз проверяем актуальность перед обновлением состояния
          const { currentRequestToken: finalToken } = get()
          if (requestToken !== finalToken) {
            console.log('Отменяем обновление состояния для устаревшего запроса сотрудников')
            return
          }

          set({ employees })
          
          // Загружаем отпуска для всех сотрудников отдела
          if (employees.length > 0) {
            const employeeIds = employees.map(emp => emp.user_id)
            await get().loadVacations(employeeIds)
          }
        } catch (error) {
          // Проверяем актуальность запроса перед установкой ошибки
          const { currentRequestToken: errorToken } = get()
          if (requestToken === errorToken) {
            console.error('Ошибка загрузки сотрудников:', {
              error,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              errorStack: error instanceof Error ? error.stack : undefined,
              departmentId,
              requestToken
            })
            set({ error: 'Не удалось загрузить список сотрудников' })
          }
        } finally {
          // Сбрасываем состояние загрузки только для актуального запроса
          const { currentRequestToken: finalToken } = get()
          if (requestToken === finalToken) {
            set({ isLoading: false })
          }
        }
      },

      // Загрузка отпусков сотрудников
      loadVacations: async (employeeIds) => {
        // Сохраняем токен запроса на момент начала загрузки
        const { currentRequestToken: requestToken } = get()
        
        set({ isLoading: true, error: null })
        
        try {
          // Получаем события календаря
          const { data: eventsData, error: eventsError } = await supabase
            .from('calendar_events')
            .select(`
              calendar_event_id,
              calendar_event_date_start,
              calendar_event_date_end,
              calendar_event_type,
              calendar_event_comment,
              calendar_event_created_by,
              calendar_event_created_at
            `)
            .in('calendar_event_created_by', employeeIds)
            .in('calendar_event_type', ['Отпуск запрошен', 'Отпуск одобрен', 'Отпуск отклонен'])
            .order('calendar_event_date_start')

          if (eventsError) throw eventsError

          // Получаем профили пользователей
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, email')
            .in('user_id', employeeIds)

          if (profilesError) throw profilesError

          // Создаем мапу профилей
          const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || [])

          const data = eventsData

          // Проверяем, что запрос все еще актуален
          const { currentRequestToken: currentToken } = get()
          if (requestToken !== currentToken) {
            console.log('Отменяем устаревший запрос отпусков для сотрудников:', employeeIds.length)
            return
          }

          const vacations: VacationEvent[] = data?.map((event: any) => {
            const profile = profileMap.get(event.calendar_event_created_by)
            return {
              calendar_event_id: event.calendar_event_id,
              calendar_event_date_start: event.calendar_event_date_start,
              calendar_event_date_end: event.calendar_event_date_end,
              calendar_event_type: event.calendar_event_type as any,
              calendar_event_comment: event.calendar_event_comment,
              calendar_event_created_by: event.calendar_event_created_by,
              calendar_event_created_at: event.calendar_event_created_at,
              user_id: profile?.user_id || event.calendar_event_created_by,
              user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Неизвестный пользователь',
              user_email: profile?.email || ''
            }
          }) || []

          // Еще раз проверяем актуальность перед обновлением состояния
          const { currentRequestToken: finalToken } = get()
          if (requestToken !== finalToken) {
            console.log('Отменяем обновление отпусков для устаревшего запроса')
            return
          }

          set({ vacations })
        } catch (error) {
          // Проверяем актуальность запроса перед установкой ошибки
          const { currentRequestToken: errorToken } = get()
          if (requestToken === errorToken) {
            console.error('Ошибка загрузки отпусков:', {
              error,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              errorStack: error instanceof Error ? error.stack : undefined,
              employeeIds,
              requestToken
            })
            set({ error: 'Не удалось загрузить данные об отпусках' })
          }
        } finally {
          // Сбрасываем состояние загрузки только для актуального запроса
          const { currentRequestToken: finalToken } = get()
          if (requestToken === finalToken) {
            set({ isLoading: false })
          }
        }
      },

      // Создание нового отпуска
      createVacation: async (userId, startDate, endDate, type, comment) => {
        set({ isLoading: true, error: null })
        
        try {
          const { error } = await supabase
            .from('calendar_events')
            .insert({
              calendar_event_created_by: userId,
              calendar_event_date_start: startDate,
              calendar_event_date_end: endDate,
              calendar_event_type: type,
              calendar_event_comment: comment,
              calendar_event_is_global: false
            })

          if (error) throw error

          // Перезагружаем отпуска
          const { employees } = get()
          if (employees.length > 0) {
            const employeeIds = employees.map(emp => emp.user_id)
            await get().loadVacations(employeeIds)
          }
        } catch (error) {
          console.error('Ошибка создания отпуска:', error)
          set({ error: 'Не удалось создать отпуск' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      // Обновление отпуска
      updateVacation: async (vacationId, startDate, endDate, type, comment) => {
        set({ isLoading: true, error: null })
        
        try {
          const { error } = await supabase
            .from('calendar_events')
            .update({
              calendar_event_date_start: startDate,
              calendar_event_date_end: endDate,
              calendar_event_type: type,
              calendar_event_comment: comment
            })
            .eq('calendar_event_id', vacationId)

          if (error) throw error

          // Перезагружаем отпуска
          const { employees } = get()
          if (employees.length > 0) {
            const employeeIds = employees.map(emp => emp.user_id)
            await get().loadVacations(employeeIds)
          }
        } catch (error) {
          console.error('Ошибка обновления отпуска:', error)
          set({ error: 'Не удалось обновить отпуск' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      // Удаление отпуска
      deleteVacation: async (vacationId) => {
        set({ isLoading: true, error: null })
        
        try {
          const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('calendar_event_id', vacationId)

          if (error) throw error

          // Обновляем локальное состояние
          const { vacations } = get()
          set({ vacations: vacations.filter(v => v.calendar_event_id !== vacationId) })
        } catch (error) {
          console.error('Ошибка удаления отпуска:', error)
          set({ error: 'Не удалось удалить отпуск' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      // Одобрение отпуска
      approveVacation: async (vacationId) => {
        const { vacations } = get()
        const vacation = vacations.find(v => v.calendar_event_id === vacationId)
        if (vacation) {
          await get().updateVacation(
            vacationId, 
            vacation.calendar_event_date_start.split('T')[0], 
            vacation.calendar_event_date_end?.split('T')[0] || vacation.calendar_event_date_start.split('T')[0], 
            'Отпуск одобрен', 
            vacation.calendar_event_comment || ''
          )
        }
      },

      // Отклонение отпуска
      rejectVacation: async (vacationId) => {
        const { vacations } = get()
        const vacation = vacations.find(v => v.calendar_event_id === vacationId)
        if (vacation) {
          await get().updateVacation(
            vacationId, 
            vacation.calendar_event_date_start.split('T')[0], 
            vacation.calendar_event_date_end?.split('T')[0] || vacation.calendar_event_date_start.split('T')[0], 
            'Отпуск отклонен', 
            vacation.calendar_event_comment || ''
          )
        }
      },

      // Установка ошибки
      setError: (error) => set({ error }),

      // Установка состояния загрузки
      setLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: 'vacation-management-store'
    }
  )
) 