import { create } from 'zustand'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { combineNotionContent } from './utils'
import type { Notion, NotionInput, NotionUpdate, NotionsFilter, NotionsState, NotionsMutations } from './types'

type NotionsStore = NotionsState & NotionsMutations

export const useNotionsStore = create<NotionsStore>((set, get) => ({
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
      let query = supabase
        .from('notions')
        .select('*')
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

      // Сортируем заметки: невыполненные сначала, потом выполненные
      const sortedData = (data || []).sort((a, b) => {
        if (a.notion_done !== b.notion_done) {
          return a.notion_done ? 1 : -1
        }
        return new Date(b.notion_created_at).getTime() - new Date(a.notion_created_at).getTime()
      })

      set({ notions: sortedData, isLoading: false })
    } catch (error) {
      console.error('Error fetching notions:', error)
      set({ error: 'Ошибка при загрузке заметок', isLoading: false })
      toast.error('Ошибка при загрузке заметок')
    }
  },

  createNotion: async (input: NotionInput) => {
    try {
      const supabase = createClient()
      
      // Получаем текущего пользователя
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        throw new Error('Пользователь не авторизован')
      }
      
      const { data, error } = await supabase
        .from('notions')
        .insert([{
          notion_content: input.notion_content,
          notion_done: false,
          notion_created_by: user.id
        }])
        .select()

      if (error) throw error

      // Добавляем новую заметку в начало списка
      const currentNotions = get().notions
      set({ notions: [data[0], ...currentNotions] })
      
      toast.success('Заметка создана')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error :
                          (error as any)?.message || 'Ошибка при создании заметки'
      
      console.error('Error creating notion:', errorMessage)
      toast.error(errorMessage)
      throw error
    }
  },

  updateNotion: async (id: string, update: NotionUpdate) => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('notions')
        .update({
          ...update,
          notion_updated_at: new Date().toISOString()
        })
        .eq('notion_id', id)
        .select()

      if (error) throw error

      // Обновляем заметку в локальном состоянии
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        notion.notion_id === id ? { ...notion, ...data[0] } : notion
      )
      set({ notions: updatedNotions })
      
      toast.success('Заметка обновлена')
    } catch (error) {
      console.error('Error updating notion:', error)
      toast.error('Ошибка при обновлении заметки')
    }
  },

  deleteNotion: async (id: string) => {
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('notions')
        .delete()
        .eq('notion_id', id)

      if (error) throw error

      // Удаляем заметку из локального состояния
      const currentNotions = get().notions
      const filteredNotions = currentNotions.filter(notion => notion.notion_id !== id)
      set({ notions: filteredNotions })
      
      toast.success('Заметка удалена')
    } catch (error) {
      console.error('Error deleting notion:', error)
      toast.error('Ошибка при удалении заметки')
    }
  },

  deleteNotions: async (ids: string[]) => {
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('notions')
        .delete()
        .in('notion_id', ids)

      if (error) throw error

      // Удаляем заметки из локального состояния
      const currentNotions = get().notions
      const filteredNotions = currentNotions.filter(notion => !ids.includes(notion.notion_id))
      set({ notions: filteredNotions, selectedNotions: [] })
      
      toast.success(`Удалено заметок: ${ids.length}`)
    } catch (error) {
      console.error('Error deleting notions:', error)
      toast.error('Ошибка при удалении заметок')
    }
  },

  toggleNotionDone: async (id: string) => {
    const notion = get().notions.find(n => n.notion_id === id)
    if (!notion) return

    await get().updateNotion(id, { notion_done: !notion.notion_done })
    
    // Пересортируем список после изменения статуса
    const currentNotions = get().notions
    const sortedNotions = [...currentNotions].sort((a, b) => {
      if (a.notion_done !== b.notion_done) {
        return a.notion_done ? 1 : -1
      }
      return new Date(b.notion_created_at).getTime() - new Date(a.notion_created_at).getTime()
    })
    
    set({ notions: sortedNotions })
  },

  setSelectedNotions: (ids: string[]) => {
    set({ selectedNotions: ids })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    // Автоматически применяем поиск с debounce
    const fetchNotions = get().fetchNotions
    setTimeout(() => {
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
      
      const { error } = await supabase
        .from('notions')
        .update({ 
          notion_done: true,
          notion_updated_at: new Date().toISOString()
        })
        .in('notion_id', ids)

      if (error) throw error

      // Обновляем заметки в локальном состоянии и пересортируем
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        ids.includes(notion.notion_id) 
          ? { ...notion, notion_done: true, notion_updated_at: new Date().toISOString() }
          : notion
      )
      
      // Сортируем обновленный список
      const sortedNotions = updatedNotions.sort((a, b) => {
        if (a.notion_done !== b.notion_done) {
          return a.notion_done ? 1 : -1
        }
        return new Date(b.notion_created_at).getTime() - new Date(a.notion_created_at).getTime()
      })
      
      set({ notions: sortedNotions, selectedNotions: [] })
      
      toast.success(`Отмечено как выполненное: ${ids.length} заметок`)
    } catch (error) {
      console.error('Error marking notions as done:', error)
      toast.error('Ошибка при отметке заметок как выполненных')
    }
  },

  markNotionsAsUndone: async (ids: string[]) => {
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('notions')
        .update({ 
          notion_done: false,
          notion_updated_at: new Date().toISOString()
        })
        .in('notion_id', ids)

      if (error) throw error

      // Обновляем заметки в локальном состоянии и пересортируем
      const currentNotions = get().notions
      const updatedNotions = currentNotions.map(notion =>
        ids.includes(notion.notion_id) 
          ? { ...notion, notion_done: false, notion_updated_at: new Date().toISOString() }
          : notion
      )
      
      // Сортируем обновленный список
      const sortedNotions = updatedNotions.sort((a, b) => {
        if (a.notion_done !== b.notion_done) {
          return a.notion_done ? 1 : -1
        }
        return new Date(b.notion_created_at).getTime() - new Date(a.notion_created_at).getTime()
      })
      
      set({ notions: sortedNotions, selectedNotions: [] })
      
      toast.success(`Отмечено как невыполненное: ${ids.length} заметок`)
    } catch (error) {
      console.error('Error marking notions as undone:', error)
      toast.error('Ошибка при отметке заметок как невыполненных')
    }
  }
})) 