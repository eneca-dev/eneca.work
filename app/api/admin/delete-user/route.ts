import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

interface ProfileWithRole {
  role_id: string | null
  roles: {
    name: string
  }[] | null
}

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
      // Сначала достаем роль текущего пользователя
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id, roles(name)')
        .eq('user_id', currentUser.id)
        .single()

      // Проверяем ошибку запроса
      if (profileError) {
        console.error('Ошибка получения профиля текущего пользователя:', {
          userId: currentUser.id,
          error: profileError
        })
        return NextResponse.json(
          { error: 'Ошибка получения профиля пользователя' },
          { status: 500 }
        )
      }

      // Проверяем, что профиль существует
      if (!profile) {
        console.error('Профиль не найден для пользователя:', {
          userId: currentUser.id
        })
        return NextResponse.json(
          { error: 'Профиль пользователя не найден' },
          { status: 404 }
        )
      }

      const typedProfile = profile as ProfileWithRole
      const roleId = typedProfile.role_id ?? null
      const roleName = typedProfile.roles?.[0]?.name ?? null

      let permissions: string[] = []
      if (roleId) {
        const { data: rolePerms, error: rolePermsError } = await supabase
          .from('role_permissions')
          .select('permissions(name)')
          .eq('role_id', roleId)

        if (rolePermsError) {
          console.error('Ошибка получения разрешений роли:', {
            roleId,
            userId: currentUser.id,
            error: rolePermsError
          })
          return NextResponse.json(
            { error: 'Ошибка проверки прав доступа' },
            { status: 500 }
          )
        }

        permissions = (rolePerms || [])
          .map((rp: any) => rp?.permissions?.name)
          .filter(Boolean)
      }

      // Проверяем, есть ли разрешение на удаление других пользователей
      // Поддерживаем оба варианта названия пермишена на случай расхождений в данных
      const canDeleteUsers = permissions.includes('users.delete') ||
                            permissions.includes('user.delete') ||
                            permissions.includes('users_can_edit_all') ||
                            roleName === 'admin'

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