import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    // Получаем ID пользователя из URL или body
    const { searchParams } = new URL(request.url)
    const userIdFromUrl = searchParams.get('userId')
    
    let userId: string
    if (userIdFromUrl) {
      userId = userIdFromUrl
    } else {
      const body = await request.json()
      userId = body.userId
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'ID пользователя обязателен' },
        { status: 400 }
      )
    }

    // Получаем текущего пользователя
    const supabase = await createClient()
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Неавторизован' },
        { status: 401 }
      )
    }

    // Проверяем, удаляет ли пользователь свой собственный профиль
    const isDeletingOwnProfile = currentUser.id === userId

    // Если пользователь не удаляет свой профиль, проверяем права доступа
    if (!isDeletingOwnProfile) {
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

      // Проверяем, есть ли разрешение на удаление других пользователей
      const canDeleteUsers = permissions.includes('user.delete') || 
                            permissions.includes('users_can_edit_all') ||
                            (profile?.roles as any)?.name === 'admin'

      if (!canDeleteUsers) {
        return NextResponse.json(
          { error: 'Недостаточно прав для удаления других пользователей' },
          { status: 403 }
        )
      }
    }

    // Создаем admin клиент для удаления
    const adminClient = createAdminClient()

    // Сначала удаляем профиль из таблицы profiles
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('user_id', userId)

    if (profileError) {
      console.error('Ошибка удаления профиля:', profileError)
      return NextResponse.json(
        { error: `Ошибка удаления профиля: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Затем удаляем пользователя из auth
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Ошибка удаления пользователя из auth:', authDeleteError)
      return NextResponse.json(
        { error: `Ошибка удаления пользователя: ${authDeleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Пользователь успешно удален',
      deletedUserId: userId 
    })

  } catch (error) {
    console.error('Неожиданная ошибка при удалении пользователя:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
} 