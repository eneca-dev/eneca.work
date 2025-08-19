import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name: string = (body?.name ?? '').trim()
    const email: string = (body?.email ?? '').trim().toLowerCase()
    const password: string = body?.password ?? ''

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Имя, email и пароль обязательны' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1) Создаем пользователя в БД (БЕЗ отправки письма подтверждения)
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: false,
    })

    if (createError) {
      const message = createError.message?.toLowerCase?.() || ''
      if (message.includes('user already registered') || message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Пользователь с таким email уже зарегистрирован' },
          { status: 409 }
        )
      }
      console.error('Ошибка создания пользователя:', createError)
      return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 })
    }

    const userId = created.user?.id ?? null

    // 2) Отправляем письмо подтверждения после успешного создания пользователя
    const redirectTo = `${request.nextUrl.origin}/auth/callback`
    const { error: resendError } = await admin.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo },
    })

    // Возвращаем успех даже если письмо не ушло, так как пользователь уже создан
    return NextResponse.json(
      {
        userId,
        emailSent: !resendError,
        message: resendError
          ? 'Аккаунт создан, но не удалось отправить письмо подтверждения. Обратитесь к администратору.'
          : 'Аккаунт создан. Проверьте почту для подтверждения.'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Неожиданная ошибка при регистрации:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}


