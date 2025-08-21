import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const firstName: string = (body?.firstName ?? '').trim()
    const lastName: string = (body?.lastName ?? '').trim()
    const email: string = (body?.email ?? '').trim().toLowerCase()
    const password: string = body?.password ?? ''

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Имя, фамилия, email и пароль обязательны' }, { status: 400 })
    }

    // Создаем серверный Supabase клиент с anon-ключом
    let response = NextResponse.next()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      const err = new Error('Отсутствуют переменные окружения Supabase')
      Sentry.captureException(err, {
        tags: { module: 'auth', action: 'register', error_type: 'env_missing', critical: true },
        extra: { has_url: !!supabaseUrl, has_anon: !!supabaseAnonKey, origin: request.nextUrl.origin },
      })
      console.error('Отсутствуют переменные окружения Supabase')
      return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next()
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next()
          response.cookies.set({ name, value: '', ...options })
        },
      },
    })

    // 1) Регистрация через anon клиент — Supabase сам отправит письмо подтверждения
    const redirectTo = `${request.nextUrl.origin}/auth/callback`
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { 
          first_name: firstName,
          last_name: lastName,
          name: `${firstName} ${lastName}` // Keep for backward compatibility
        },
      },
    })

    if (signUpError) {
      const msg = signUpError.message?.toLowerCase?.() || ''
      if (msg.includes('user already registered') || msg.includes('already exists')) {
        return NextResponse.json(
          { error: 'Пользователь с таким email уже зарегистрирован' },
          { status: 409 }
        )
      }
      Sentry.captureException(signUpError, {
        tags: { module: 'auth', action: 'register', error_type: 'signup_failed', critical: true },
        user: { email },
        extra: { redirect_to: redirectTo },
      })
      console.error('Ошибка регистрации пользователя:', signUpError)
      return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 })
    }

    // Возвращаем успех. Письмо отправляет Supabase
    return NextResponse.json(
      {
        userId: data.user?.id ?? null,
        emailSent: true,
        message: 'Аккаунт создан. Проверьте почту для подтверждения.'
      },
      { status: 201 }
    )
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'auth', action: 'register', error_type: 'unexpected_error', critical: true },
      extra: { url: request.url },
    })
    console.error('Неожиданная ошибка при регистрации:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}


