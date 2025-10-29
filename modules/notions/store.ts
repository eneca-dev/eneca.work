import { create } from 'zustand'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { combineNotionContent } from '@/modules/notions/utils'
import type { Notion, NotionInput, NotionUpdate, NotionsFilter, NotionsState, NotionsMutations } from '@/modules/notions/types'
import * as Sentry from "@sentry/nextjs"

type NotionsStore = NotionsState & NotionsMutations

// Helper function to sort notions: undone first (by updated_at), then done (by updated_at)
const sortNotions = (notions: Notion[]): Notion[] => {
  return [...notions].sort((a, b) => {
    if (a.notion_done !== b.notion_done) {
      return a.notion_done ? 1 : -1
    }
    // Сортируем по последнему изменению (updated_at), затем по created_at если updated_at одинаковы
    const aTime = new Date(a.notion_updated_at || a.notion_created_at).getTime()
    const bTime = new Date(b.notion_updated_at || b.notion_created_at).getTime()
    return bTime - aTime
  })
}

export const useNotionsStore = create<NotionsStore>((set, get) => {
  let searchTimeoutId: NodeJS.Timeout | null = null

  return {
  // State
  notions: [],
  selectedNotions: [],
  searchQuery: '',
  isLoading: false,
  error: null,

  // Actions
  fetchNotions: async (filter?: NotionsFilter) => {
    set({ isLoading: true, error: null })

    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      let query = supabase
        .from('notions')
        .select('*')
        .eq('notion_created_by', user.id) // 🔒 ФИЛЬТРУЕМ ПО ТЕКУЩЕМУ ПОЛЬЗОВАТЕЛЮ
        .order('notion_created_at', { ascending: false })

      // Применяем фильтры
      if (filter?.search) {
        query = query.ilike('notion_content', `%${filter.search}%`)
      }
      
      if (filter?.done !== undefined) {
        query = query.eq('notion_done', filter.done)
      }

      const { data, error } = await query

      if (error) throw error

      // Сортируем заметки: невыполненные сначала, потом выполненные, внутри групп по последнему изменению
      const sortedData = sortNotions(data || [])

      set({ notions: sortedData, isLoading: false })
    } catch (error) {
      console.error('Error fetching notions:', error)
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'fetch', error_type: 'db_error' } })
      set({ error: 'Ошибка при загрузке заметок', isLoading: false })
      toast.error('Ошибка при загрузке заметок')
    }
  },

  createNotion: async (input: NotionInput) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .insert([{
          notion_content: input.notion_content,
          notion_done: false,
          notion_created_by: user.id
        }])
        .select()

      if (error) throw error

      // Добавляем новую заметку и пересортируем список
      const currentNotions = get().notions
      const updatedNotions = [data[0], ...currentNotions]
      const sortedNotions = sortNotions(updatedNotions)
      set({ notions: sortedNotions })
      
      toast.success('Заметка создана')
      return data[0]
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error :
                          (error as any)?.message || 'Ошибка при создании заметки'
      
      console.error('Error creating notion:', errorMessage)
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'create', error_type: 'db_error' } })
      toast.error(errorMessage)
      throw error
    }
  },

  createNotionSilent: async (input: NotionInput) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .insert([{
          notion_content: input.notion_content,
          notion_done: false,
          notion_created_by: user.id
        }])
        .select()

      if (error) throw error

      // Добавляем новую заметку и пересортируем список
      const currentNotions = get().notions
      const updatedNotions = [data[0], ...currentNotions]
      const sortedNotions = sortNotions(updatedNotions)
      set({ notions: sortedNotions })
      
      return data[0]
    } catch (error) {
      console.error('Error creating notion silently:', error)
      throw error
    }
  },

  updateNotion: async (id: string, update: NotionUpdate) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .update({
          ...update,
          notion_updated_at: new Date().toISOString()
        })
        .eq('notion_id', id)
        .eq('notion_created_by', user.id) // 🔒 ПРОВЕРЯЕМ ПРИНАДЛЕЖНОСТЬ
        .select()

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error('Заметка не найдена или у вас нет прав на её изменение')
      }

      // Обновляем заметку в локальном состоянии БЕЗ пересортировки
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        notion.notion_id === id ? { ...notion, ...data[0] } : notion
      )
      set({ notions: updatedNotions })
      
      toast.success('Заметка обновлена')
    } catch (error) {
      console.error('Error updating notion:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обновлении заметки'
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'update', error_type: 'db_error' } })
      toast.error(errorMessage)
    }
  },

  updateNotionSilent: async (id: string, update: NotionUpdate) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .update({
          ...update,
          notion_updated_at: new Date().toISOString()
        })
        .eq('notion_id', id)
        .eq('notion_created_by', user.id) // 🔒 ПРОВЕРЯЕМ ПРИНАДЛЕЖНОСТЬ
        .select()

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error('Заметка не найдена или у вас нет прав на её изменение')
      }

      // Обновляем заметку в локальном состоянии БЕЗ пересортировки
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        notion.notion_id === id ? { ...notion, ...data[0] } : notion
      )
      set({ notions: updatedNotions })
      
      return data[0]
    } catch (error) {
      console.error('Error updating notion silently:', error)
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'update_silent', error_type: 'db_error' } })
      throw error
    }
  },

  deleteNotion: async (id: string) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .delete()
        .eq('notion_id', id)
        .eq('notion_created_by', user.id) // 🔒 ПРОВЕРЯЕМ ПРИНАДЛЕЖНОСТЬ
        .select('notion_id')

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error('Заметка не найдена или у вас нет прав на её удаление')
      }

      // Удаляем заметку из локального состояния
      const currentNotions = get().notions
      const filteredNotions = currentNotions.filter(notion => notion.notion_id !== id)
      set({ notions: filteredNotions })
      
      toast.success('Заметка удалена')
    } catch (error) {
      console.error('Error deleting notion:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при удалении заметки'
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'delete', error_type: 'db_error' } })
      toast.error(errorMessage)
    }
  },

  deleteNotions: async (ids: string[]) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .delete()
        .in('notion_id', ids)
        .eq('notion_created_by', user.id) // 🔒 ПРОВЕРЯЕМ ПРИНАДЛЕЖНОСТЬ
        .select('notion_id')

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error('Заметки не найдены или у вас нет прав на их удаление')
      }

      // Удаляем заметки из локального состояния
      const currentNotions = get().notions
      const filteredNotions = currentNotions.filter(notion => !ids.includes(notion.notion_id))
      set({ notions: filteredNotions, selectedNotions: [] })
      
      toast.success(`Удалено заметок: ${data.length}`)
    } catch (error) {
      console.error('Error deleting notions:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при удалении заметок'
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'delete_many', error_type: 'db_error' } })
      toast.error(errorMessage)
    }
  },

  toggleNotionDone: async (id: string) => {
    const notion = get().notions.find(n => n.notion_id === id)
    if (!notion) return

    await get().updateNotion(id, { notion_done: !notion.notion_done })
    
    // Пересортируем список после изменения статуса
    const currentNotions = get().notions
    const sortedNotions = sortNotions(currentNotions)
    
    set({ notions: sortedNotions })
  },

  setSelectedNotions: (ids: string[]) => {
    set({ selectedNotions: ids })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    
    // Очищаем предыдущий таймаут
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId)
    }
    
    // Устанавливаем новый таймаут с debounce
    const fetchNotions = get().fetchNotions
    searchTimeoutId = setTimeout(() => {
      if (get().searchQuery === query) {
        fetchNotions({ search: query || undefined })
      }
    }, 300)
  },

  selectAllNotions: () => {
    const allIds = get().notions.map(notion => notion.notion_id)
    set({ selectedNotions: allIds })
  },

  clearSelectedNotions: () => {
    set({ selectedNotions: [] })
  },

  markNotionsAsDone: async (ids: string[]) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .update({ 
          notion_done: true,
          notion_updated_at: new Date().toISOString()
        })
        .in('notion_id', ids)
        .eq('notion_created_by', user.id) // 🔒 ПРОВЕРЯЕМ ПРИНАДЛЕЖНОСТЬ
        .select('notion_id')

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error('Заметки не найдены или у вас нет прав на их изменение')
      }

      // Обновляем заметки в локальном состоянии и пересортируем
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        ids.includes(notion.notion_id) 
          ? { ...notion, notion_done: true, notion_updated_at: new Date().toISOString() }
          : notion
      )
      
      // Сортируем обновленный список
      const sortedNotions = sortNotions(updatedNotions)
      
      set({ notions: sortedNotions, selectedNotions: [] })
      
      toast.success(`Отмечено как выполненное: ${data.length} заметок`)
    } catch (error) {
      console.error('Error marking notions as done:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при отметке заметок как выполненных'
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'mark_done', error_type: 'db_error' } })
      toast.error(errorMessage)
    }
  },

  markNotionsAsUndone: async (ids: string[]) => {
    try {
      const supabase = createClient()

      // Проверяем сессию (более надежно чем getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        throw new Error('Пользователь не авторизован')
      }

      const user = session.user
      
      const { data, error } = await supabase
        .from('notions')
        .update({ 
          notion_done: false,
          notion_updated_at: new Date().toISOString()
        })
        .in('notion_id', ids)
        .eq('notion_created_by', user.id) // 🔒 ПРОВЕРЯЕМ ПРИНАДЛЕЖНОСТЬ
        .select('notion_id')

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error('Заметки не найдены или у вас нет прав на их изменение')
      }

      // Обновляем заметки в локальном состоянии и пересортируем
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        ids.includes(notion.notion_id) 
          ? { ...notion, notion_done: false, notion_updated_at: new Date().toISOString() }
          : notion
      )
      
      // Сортируем обновленный список
      const sortedNotions = sortNotions(updatedNotions)
      
      set({ notions: sortedNotions, selectedNotions: [] })
      
      toast.success(`Отмечено как невыполненное: ${data.length} заметок`)
    } catch (error) {
      console.error('Error marking notions as undone:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при отметке заметок как невыполненных'
      Sentry.captureException(error, { tags: { module: 'notions', store: 'useNotionsStore', action: 'mark_undone', error_type: 'db_error' } })
      toast.error(errorMessage)
    }
  }
  }
})