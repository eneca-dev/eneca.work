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
    
    console.log('Auth check result:', {
      hasUser: !!currentUser,
      userId: currentUser?.id,
      authError: authError?.message
    })
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Неавторизован', details: authError?.message },
        { status: 401 }
      )
    }

    // Проверяем, удаляет ли пользователь свой собственный профиль
    const isDeletingOwnProfile = currentUser.id === userId

    // Если пользователь не удаляет свой профиль, проверяем права доступа через новую систему
    if (!isDeletingOwnProfile) {
      console.log('Checking permission via RPC user_has_permission for user:', currentUser.id)

      // Разрешаем при наличии любого из указанных пермишенов
      const permissionsToCheck = ['users.delete', 'user.delete', 'users_can_edit_all', 'hierarchy.is_admin']

      let hasPermission = false
      // Проверяем по одному, чтобы быть совместимыми с различиями в именах
      for (const perm of permissionsToCheck) {
        const { data: allowed, error: rpcError } = await supabase.rpc('user_has_permission', {
          p_user_id: currentUser.id,
          p_permission_name: perm,
        })

        if (rpcError) {
          console.error('Ошибка RPC user_has_permission:', { perm, rpcError })
          // Не прерываем — пробуем другие варианты имен пермишена
          continue
        }
        if (allowed) {
          hasPermission = true
          break
        }
      }

      console.log('Permission RPC result:', { hasPermission, isDeletingOwnProfile })

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Недостаточно прав для удаления других пользователей' },
          { status: 403 }
        )
      }
    }

    // Создаем admin клиент для удаления
    const adminClient = createAdminClient()

    // Сначала удаляем назначения ролей пользователя (если FK без CASCADE)
    const { error: rolesDeleteError } = await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (rolesDeleteError) {
      console.error('Ошибка очистки ролей пользователя перед удалением профиля:', rolesDeleteError)
      // Не критично, если настроен CASCADE, но лучше вернуть ошибку, чтобы избежать зависаний FK
      return NextResponse.json(
        { error: `Ошибка очистки ролей пользователя: ${rolesDeleteError.message}` },
        { status: 500 }
      )
    }

    // Затем удаляем профиль из таблицы profiles
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