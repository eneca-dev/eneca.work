import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'

export async function DELETE(request: NextRequest) {
  return Sentry.startSpan({ op: 'api.admin.delete-department', name: 'Удаление отдела' }, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const idFromUrl = searchParams.get('departmentId')

      let departmentId: string
      if (idFromUrl) {
        departmentId = idFromUrl
      } else {
        const body = await request.json().catch(() => null)
        departmentId = body?.departmentId
      }

      if (!departmentId) {
        return NextResponse.json({ error: 'departmentId обязателен' }, { status: 400 })
      }

      // Аутентификация текущего пользователя
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Неавторизован' }, { status: 401 })
      }

      // Проверка права на удаление отдела
      const permsToCheck = ['departments.delete', 'users.delete.department', 'users_can_edit_all', 'hierarchy.is_admin']
      let allowed = false
      for (const perm of permsToCheck) {
        const { data: has, error } = await supabase.rpc('user_has_permission', {
          p_user_id: user.id,
          p_permission_name: perm,
        })
        if (error) {
          // пробуем следующий пермишен
          continue
        }
        if (has) {
          allowed = true
          break
        }
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Недостаточно прав для удаления отдела' }, { status: 403 })
      }

      const admin = createAdminClient()

      // 1) Починка конфликтных тимлидов, чтобы не упереться в P0001 триггера check_teams_integrity
      const { data: teams, error: loadTeamsErr } = await admin
        .from('teams')
        .select('team_id, team_lead_id')
        .eq('department_id', departmentId)
        .not('team_lead_id', 'is', null)

      if (loadTeamsErr) {
        Sentry.captureException(loadTeamsErr, { tags: { action: 'load_teams' }, extra: { departmentId } })
        return NextResponse.json({ error: `Ошибка чтения команд отдела: ${loadTeamsErr.message}` }, { status: 500 })
      }

      if (Array.isArray(teams) && teams.length > 0) {
        const leadIds = teams
          .map(t => t.team_lead_id as string | null)
          .filter((v): v is string => !!v)

        if (leadIds.length > 0) {
          const { data: profiles, error: loadProfilesErr } = await admin
            .from('profiles')
            .select('user_id, team_id')
            .in('user_id', leadIds)

          if (loadProfilesErr) {
            Sentry.captureException(loadProfilesErr, { tags: { action: 'load_profiles' }, extra: { departmentId } })
            return NextResponse.json({ error: `Ошибка чтения профилей тимлидов: ${loadProfilesErr.message}` }, { status: 500 })
          }

          const userIdToTeamId = new Map<string, string | null>()
          for (const p of profiles || []) {
            userIdToTeamId.set(p.user_id as string, p.team_id as string | null)
          }

          const teamsToNullLead: string[] = []
          for (const t of teams) {
            const leadId = t.team_lead_id as string | null
            if (!leadId) continue
            const profileTeamId = userIdToTeamId.get(leadId) ?? null
            if (!profileTeamId || profileTeamId !== (t.team_id as string)) {
              teamsToNullLead.push(t.team_id as string)
            }
          }

          if (teamsToNullLead.length > 0) {
            const { error: nullifyErr } = await admin
              .from('teams')
              .update({ team_lead_id: null })
              .in('team_id', teamsToNullLead)

            if (nullifyErr) {
              Sentry.captureException(nullifyErr, { tags: { action: 'nullify_team_leads' }, extra: { departmentId, teamsToNullLead } })
              return NextResponse.json({ error: `Ошибка подготовки данных команд: ${nullifyErr.message}` }, { status: 500 })
            }
          }
        }
      }

      // 2) Защитная проверка наличия зависимостей в decomposition_templates (там FK без SET NULL)
      const { count: dtCount, error: dtErr } = await admin
        .from('decomposition_templates')
        .select('decomposition_template_id', { count: 'exact', head: true })
        .eq('decomposition_department_id', departmentId)

      if (dtErr) {
        Sentry.captureException(dtErr, { tags: { action: 'count_templates' }, extra: { departmentId } })
        return NextResponse.json({ error: `Ошибка проверки шаблонов декомпозиции: ${dtErr.message}` }, { status: 500 })
      }

      if ((dtCount ?? 0) > 0) {
        return NextResponse.json({
          error: 'Удаление невозможно: есть шаблоны декомпозиции, привязанные к отделу',
          details: { decomposition_templates: dtCount }
        }, { status: 409 })
      }

      // 3) Удаляем отдел (FK: teams.department_id ON DELETE SET NULL; loadings.shortage_department_id SET NULL)
      const { error: delErr } = await admin
        .from('departments')
        .delete()
        .eq('department_id', departmentId)

      if (delErr) {
        Sentry.captureException(delErr, { tags: { action: 'delete_department' }, extra: { departmentId } })
        return NextResponse.json({ error: `Ошибка удаления отдела: ${delErr.message}` }, { status: 400 })
      }

      return NextResponse.json({ success: true, deletedDepartmentId: departmentId })
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'delete_department_unhandled' } })
      return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
    }
  })
}


