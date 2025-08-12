import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, isActive } = body

    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'ID пользователя и статус активности обязательны' },
        { status: 400 }
      )
    }

    // Проверяем права доступа текущего пользователя
    const supabase = await createClient()
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Неавторизован' },
        { status: 401 }
      )
    }

    // Проверяем разрешения пользователя
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        role_id,
        roles!inner(
          name,
          role_permissions!inner(
            permissions!inner(name)
          )
        )
      `)
      .eq('user_id', currentUser.id)
      .single()

    const permissions = (profile?.roles as any)?.role_permissions?.map(
      (rp: any) => rp.permissions.name
    ) || []

    // Проверяем, есть ли разрешение на деактивацию пользователей
    const canDeactivateUsers = permissions.includes('user.deactivate') || 
                              permissions.includes('users_can_edit_all') ||
                              (profile?.roles as any)?.name === 'admin'

    if (!canDeactivateUsers) {
      return NextResponse.json(
        { error: 'Недостаточно прав для деактивации пользователей' },
        { status: 403 }
      )
    }

    // Обновляем статус активности пользователя
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Ошибка обновления статуса пользователя:', updateError)
      return NextResponse.json(
        { error: `Ошибка обновления статуса: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: `Пользователь успешно ${isActive ? 'активирован' : 'деактивирован'}`,
      userId,
      isActive
    })

  } catch (error) {
    console.error('Неожиданная ошибка при изменении статуса пользователя:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
} 