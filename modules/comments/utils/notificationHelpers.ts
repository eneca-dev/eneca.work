import { createClient } from '@/utils/supabase/client'

/**
 * Проверяет и создает entity_type 'section_comment' если его нет
 */
async function ensureSectionCommentEntityType(): Promise<void> {
  const supabase = createClient()
  
  try {
    // Проверяем существует ли entity_type 'section_comment'
    const { data: existingType, error: checkError } = await supabase
      .from('entity_types')
      .select('id')
      .eq('entity_name', 'section_comment')
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Ошибка проверки entity_type:', checkError)
      return
    }

    if (existingType) {
      return
    }

    // Создаем entity_type если его нет
    const { data: newType, error: createError } = await supabase
      .from('entity_types')
      .insert({ entity_name: 'section_comment' })
      .select('id')
      .single()

    if (createError) {
      console.error('Ошибка создания entity_type:', createError)
    }
  } catch (error) {
    console.error('Ошибка при работе с entity_types:', error)
  }
}

/**
 * Отправляет уведомления напрямую к Supabase Edge Function
 * (обходим проблему с отсутствующим API route)
 */
async function sendCommentNotificationDirect(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
    section_comment?: {
      section_id: string
      section_name: string
      author_name: string
      comment_preview: string
    }
  },
  userIds: string[]
): Promise<{ notificationId: string }> {
  const supabase = createClient()
  
  try {
    // Получаем токен пользователя
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('Пользователь не авторизован')
    }

    const requestData = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        entityType,
        payload,
        userIds,
      }),
    }

    // Используем переменную окружения вместо хардкода URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL не установлена')
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/notifications`, requestData)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }
    
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Ошибка отправки уведомления о комментарии:', error)
    throw error
  }
}

/**
 * Отправляет уведомления о новом комментарии к разделу
 */
export async function sendCommentNotifications(
  sectionId: string, 
  mentions: string[], 
  commentContent: string
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return

  try {
    // Убеждаемся что entity_type section_comment существует
    await ensureSectionCommentEntityType()

    // Получаем данные раздела и автора
    const [sectionResult, authorResult] = await Promise.all([
      supabase
        .from('sections')
        .select('section_responsible, section_name')
        .eq('section_id', sectionId)
        .single(),
      supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single()
    ])

    if (!sectionResult.data) return

    const sectionData = sectionResult.data
    const authorData = authorResult.data
    const authorName = authorData 
      ? `${authorData.first_name} ${authorData.last_name}`.trim()
      : user.email || 'Аноним'

    // Формируем список получателей:
    // - @упомянутые пользователи (кроме автора)
    // - ответственный за раздел (если он не автор)
    const recipients = new Set<string>()
    
    // Добавляем упомянутых пользователей (исключая автора)
    mentions.forEach(userId => {
      if (userId !== user.id) {
        recipients.add(userId)
      }
    })
    
    // Добавляем ответственного за раздел (если он не автор)
    if (sectionData.section_responsible && 
        sectionData.section_responsible !== user.id) {
      recipients.add(sectionData.section_responsible)
    }

    // Принудительно исключаем автора если он попал в recipients
    if (recipients.has(user.id)) {
      recipients.delete(user.id)
    }

    const finalRecipients = Array.from(recipients).filter(id => id !== user.id)
    
    if (finalRecipients.length === 0) return

    // Отправляем уведомления
    const commentPreview = commentContent.replace(/<[^>]*>/g, '').substring(0, 100)

    await sendCommentNotificationDirect(
      'section_comment',
      {
        title: `Комментарий к разделу "${sectionData.section_name}"`,
        message: `${authorName}: "${commentPreview}${commentPreview.length === 100 ? '...' : ''}"`,
        type: 'info',
        action: {
          type: 'navigate',
          url: `/dashboard/projects?section=${sectionId}&tab=comments`
        },
        section_comment: {
          section_id: sectionId,
          section_name: sectionData.section_name,
          author_name: authorName,
          comment_preview: commentPreview
        }
      },
      finalRecipients
    )

  } catch (error) {
    console.error('Ошибка отправки уведомлений о комментарии:', error)
    // Не прерываем процесс добавления комментария из-за ошибки уведомлений
  }
} 