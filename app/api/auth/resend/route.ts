import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email: string = (body?.email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email обязателен' }, { status: 400 })
    }

    const admin = createAdminClient()
    const redirectTo = `${request.nextUrl.origin}/auth/callback`
    const { error } = await admin.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      return NextResponse.json(
        { emailSent: false, error: 'Не удалось отправить письмо подтверждения' },
        { status: 400 }
      )
    }

    return NextResponse.json({ emailSent: true })
  } catch (error) {
    console.error('Ошибка при повторной отправке письма:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}




