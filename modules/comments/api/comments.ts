import { createClient } from '@/utils/supabase/client'
import type { SectionComment, MentionUser } from '../types'

/**
 * Загружает комментарии для указанного раздела
 */
export async function fetchSectionComments(sectionId: string): Promise<SectionComment[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('section_comments')
    .select(`
      *,
      author:profiles!section_comments_author_id_fkey(
        user_id,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('section_id', sectionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Ошибка загрузки комментариев:', error)
    throw error
  }

  // Трансформируем данные в нужный формат
  return data?.map((comment: any) => ({
    ...comment,
    author_name: `${comment.author.first_name} ${comment.author.last_name}`.trim(),
    author_avatar_url: comment.author.avatar_url
  })) || []
}

/**
 * Создает новый комментарий к разделу
 */
export async function createSectionComment(
  sectionId: string, 
  content: string, 
  mentions: string[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Пользователь не авторизован')
  }

  // Валидация длины контента
  const plainText = content.replace(/<[^>]*>/g, '')
  if (plainText.length > 3000) {
    throw new Error('Превышен лимит символов (3000)')
  }

  const { error } = await supabase
    .from('section_comments')
    .insert({
      section_id: sectionId,
      author_id: user.id,
      content,
      mentions
    })

  if (error) {
    console.error('Ошибка создания комментария:', error)
    throw error
  }
}

/**
 * Ищет пользователей для упоминаний по запросу
 */
export async function searchUsersForMentions(
  query: string, 
  sectionId: string
): Promise<MentionUser[]> {
  console.log('API searchUsersForMentions вызван с:', { query, sectionId })

  const supabase = createClient()
  
  try {
    let supabaseQuery = supabase
      .from('profiles')
      .select('user_id, first_name, last_name, avatar_url')
      .limit(15) // Увеличиваем лимит для лучшего выбора

    // Если есть query, фильтруем по нему (убираем проверку минимальной длины!)
    if (query && query.trim().length > 0) {
      supabaseQuery = supabaseQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    }

    console.log('Выполняем запрос к БД...')
    const { data, error } = await supabaseQuery

    if (error) {
      console.error('Ошибка поиска пользователей:', error)
      return []
    }

    console.log('Получены данные из БД:', data?.length || 0, 'пользователей')

    const users = data?.map((profile: any) => ({
      user_id: profile.user_id,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Без имени',
      avatar_url: profile.avatar_url
    })) || []

    // Сортируем: сначала точные совпадения, потом по алфавиту
    if (query && query.trim().length > 0) {
      const lowerQuery = query.toLowerCase()
      users.sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        
        // Приоритет точным совпадениям в начале имени
        const aStartsWith = aName.startsWith(lowerQuery)
        const bStartsWith = bName.startsWith(lowerQuery)
        
        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1
        
        // Потом по алфавиту
        return aName.localeCompare(bName)
      })
    }

    const result = users.slice(0, 10) // Топ-10 после сортировки
    console.log('Обработанные пользователи для упоминаний:', result)
    return result

  } catch (error) {
    console.error('Исключение в searchUsersForMentions:', error)
    return []
  }
}

/**
 * Обновляет контент комментария (для состояния чекбоксов)
 */
export async function updateCommentContent(
  commentId: string, 
  newContent: string
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Пользователь не авторизован')
  }

  if (!commentId?.trim()) {
    throw new Error('ID комментария обязателен')
  }
  if (!newContent?.trim()) {
    throw new Error('Контент обязателен')
  }

  const { error } = await supabase
    .from('section_comments')
    .update({ content: newContent })
    .eq('comment_id', commentId)
    .eq('author_id', user.id) // Только автор может изменять свои комментарии

  if (error) {
    console.error('Ошибка обновления комментария:', error)
    throw error
  }
}

 