import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'
import type { SectionStatus, SectionStatusFormData } from './types'

interface SectionStatusesStore {
  statuses: SectionStatus[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null

  loadStatuses: () => Promise<void>
  createStatus: (statusData: SectionStatusFormData) => Promise<SectionStatus | null>
  updateStatus: (id: string, statusData: SectionStatusFormData) => Promise<SectionStatus | null>
  deleteStatus: (id: string) => Promise<boolean>
  reset: () => void
}

export const useSectionStatusesStore = create<SectionStatusesStore>()(
  devtools(
    persist(
      (set, get) => ({
        statuses: [],
        isLoading: false,
        isLoaded: false,
        error: null,

        loadStatuses: async () => {
          // Если уже загружено и есть данные, не перезагружать
          const state = get()
          if (state.isLoaded && state.statuses.length > 0) {
            console.log('✅ Статусы уже загружены из кеша:', state.statuses.length)
            return
          }

          set({ isLoading: true, error: null })

          try {
            const supabase = createClient()
            const { data, error } = await supabase
              .from('section_statuses')
              .select('*')
              .order('name')

            if (error) {
              console.warn('❌ Ошибка загрузки статусов:', error)
              set({ error: error.message, isLoading: false })
              return
            }

            console.log('✅ Загружено статусов из БД:', data?.length || 0)
            set({
              statuses: data || [],
              isLoading: false,
              isLoaded: true,
              error: null
            })
          } catch (err) {
            console.warn('❌ Ошибка загрузки статусов:', err)
            const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки статусов'
            set({ error: errorMessage, isLoading: false })
          }
        },

        createStatus: async (statusData: SectionStatusFormData): Promise<SectionStatus | null> => {
          set({ isLoading: true, error: null })

          try {
            const supabase = createClient()
            const { data, error } = await supabase
              .from('section_statuses')
              .insert({
                name: statusData.name,
                color: statusData.color,
                description: statusData.description || null
              })
              .select()
              .single()

            if (error) throw error

            // Добавляем новый статус в локальный store
            set(state => ({
              statuses: [...state.statuses, data],
              isLoading: false
            }))

            console.log('✅ Статус создан:', data.name)
            return data
          } catch (err) {
            console.warn('❌ Ошибка создания статуса:', err)
            const errorMessage = err instanceof Error ? err.message : 'Ошибка создания статуса'
            set({ error: errorMessage, isLoading: false })
            return null
          }
        },

        updateStatus: async (id: string, statusData: SectionStatusFormData): Promise<SectionStatus | null> => {
          set({ isLoading: true, error: null })

          try {
            const supabase = createClient()
            const { data, error } = await supabase
              .from('section_statuses')
              .update({
                name: statusData.name,
                color: statusData.color,
                description: statusData.description || null
              })
              .eq('id', id)
              .select()
              .single()

            if (error) throw error

            // Обновляем статус в локальном store
            set(state => ({
              statuses: state.statuses.map(s =>
                s.id === id ? data : s
              ),
              isLoading: false
            }))

            console.log('✅ Статус обновлен:', data.name)

            // Диспатчим событие для обновления UI (для ProjectsTree)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('statusUpdated', {
                detail: {
                  statusId: data.id,
                  statusName: data.name,
                  statusColor: data.color
                }
              }))
            }

            return data
          } catch (err) {
            console.warn('❌ Ошибка обновления статуса:', err)
            const errorMessage = err instanceof Error ? err.message : 'Ошибка обновления статуса'
            set({ error: errorMessage, isLoading: false })
            return null
          }
        },

        deleteStatus: async (id: string): Promise<boolean> => {
          set({ isLoading: true, error: null })

          try {
            const supabase = createClient()

            // Сначала обновляем все разделы, которые используют этот статус
            const { error: updateError } = await supabase
              .from('sections')
              .update({ section_status_id: null })
              .eq('section_status_id', id)

            if (updateError) {
              console.warn('❌ Ошибка обновления разделов:', updateError)
              throw new Error('Не удалось обновить разделы, использующие статус')
            }

            console.log(`🔄 Обновлены разделы: статус ${id} заменен на "Без статуса"`)

            // Затем удаляем сам статус
            const { error } = await supabase
              .from('section_statuses')
              .delete()
              .eq('id', id)

            if (error) throw error

            // Удаляем статус из локального store
            set(state => ({
              statuses: state.statuses.filter(s => s.id !== id),
              isLoading: false
            }))

            console.log('✅ Статус удален')

            // Диспатчим событие для обновления UI (для ProjectsTree)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('statusDeleted', {
                detail: { statusId: id }
              }))
            }

            return true
          } catch (err) {
            console.warn('❌ Ошибка удаления статуса:', err)
            const errorMessage = err instanceof Error ? err.message : 'Ошибка удаления статуса'
            set({ error: errorMessage, isLoading: false })
            return false
          }
        },

        reset: () => {
          set({
            statuses: [],
            isLoading: false,
            isLoaded: false,
            error: null
          })
        }
      }),
      {
        name: 'section-statuses-store',
        // Сохраняем только statuses и isLoaded
        partialize: (state) => ({
          statuses: state.statuses,
          isLoaded: state.isLoaded
        })
      }
    )
  )
)
