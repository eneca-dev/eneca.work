import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Публичные роуты, которые не требуют авторизации
  const publicRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/pending-verification',
    '/auth/password-reset-sent',
    '/auth/callback',
  ]

  // API роуты, которые обрабатывают авторизацию самостоятельно
  const apiRoutes = [
    '/api/auth',
    '/api/debug',
    '/api/geo',
    '/api/docs',
    // Чатовые API обрабатывают авторизацию самостоятельно (Bearer JWT)
    '/api/chat',
    '/api/chat/thinking'
  ]

  // Проверяем, является ли роут публичным или API
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isApiRoute = apiRoutes.some(route => pathname.startsWith(route))

  // Пропускаем публичные роуты и API роуты без проверки авторизации
  if (isPublicRoute || isApiRoute) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Отсутствуют переменные окружения Supabase")
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: "",
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value: "",
              ...options,
            })
          },
        },
      },
    )

    // Проверяем пользователя
    const { data: { user }, error } = await supabase.auth.getUser()

    // Если есть ошибка или пользователь не найден - редиректим на логин
    if (error || !user) {
      const loginUrl = new URL('/auth/login', request.url)
      // Сохраняем текущий URL для редиректа после логина
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Пользователь авторизован, продолжаем
    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // В случае ошибки редиректим на логин
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }
}
