import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email обязателен' },
        { status: 400 }
      )
    }

    // Создаем admin клиент для проверки
    const adminClient = createAdminClient()

    // Проверяем существование пользователя через таблицу profiles
    const { data: existingProfile, error } = await adminClient
      .from('profiles')
      .select('user_id, email')
      .eq('email', email.toLowerCase().trim())
      .single()

    // Если пользователь не найден, это нормально
    if (error && error.code !== 'PGRST116') { // PGRST116 = "The result contains 0 rows"
      console.error('Ошибка при проверке email:', error)
      return NextResponse.json(
        { error: 'Ошибка при проверке email' },
        { status: 500 }
      )
    }

    const existingUser = existingProfile

    return NextResponse.json({
      exists: !!existingUser,
      message: existingUser ? 'Пользователь с таким email уже существует' : 'Email доступен'
    })

  } catch (error) {
    console.error('Неожиданная ошибка при проверке email:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
