import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'

export async function DELETE(request: NextRequest) {
  return Sentry.startSpan({ op: 'api.admin.delete-subdivision', name: 'Удаление подразделения' }, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const idFromUrl = searchParams.get('subdivisionId')

      let subdivisionId: string
      if (idFromUrl) {
        subdivisionId = idFromUrl
      } else {
        const body = await request.json().catch(() => null)
        subdivisionId = body?.subdivisionId
      }

      if (!subdivisionId) {
        return NextResponse.json({ error: 'subdivisionId обязателен' }, { status: 400 })
      }

      // Аутентификация текущего пользователя
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Неавторизован' }, { status: 401 })
      }

      // Проверка права на удаление подразделения (только admin)
      const { data: isAdmin, error: permError } = await supabase.rpc('user_has_permission', {
        p_user_id: user.id,
        p_permission_name: 'hierarchy.is_admin',
      })

      if (permError || !isAdmin) {
        return NextResponse.json({ error: 'Недостаточно прав для удаления подразделения' }, { status: 403 })
      }

      const admin = createAdminClient()

      // Проверка наличия отделов в подразделении
      const { count: deptCount, error: deptErr } = await admin
        .from('departments')
        .select('department_id', { count: 'exact', head: true })
        .eq('subdivision_id', subdivisionId)

      if (deptErr) {
        Sentry.captureException(deptErr, { tags: { action: 'count_departments' }, extra: { subdivisionId } })
        return NextResponse.json({ error: `Ошибка проверки отделов: ${deptErr.message}` }, { status: 500 })
      }

      if ((deptCount ?? 0) > 0) {
        return NextResponse.json({
          error: 'Удаление невозможно: в подразделении есть отделы',
          details: { departments_count: deptCount }
        }, { status: 409 })
      }

      // Удаляем подразделение
      const { error: delErr } = await admin
        .from('subdivisions')
        .delete()
        .eq('subdivision_id', subdivisionId)

      if (delErr) {
        Sentry.captureException(delErr, { tags: { action: 'delete_subdivision' }, extra: { subdivisionId } })
        return NextResponse.json({ error: `Ошибка удаления подразделения: ${delErr.message}` }, { status: 400 })
      }

      return NextResponse.json({ success: true, deletedSubdivisionId: subdivisionId })
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'delete_subdivision_unhandled' } })
      return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
    }
  })
}
