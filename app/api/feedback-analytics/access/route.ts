import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Проверка доступа к аналитике опросов
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in analytics access check:', authError?.message)
      return NextResponse.json(
        { hasAccess: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Проверяем наличие пользователя в таблице доступа
    const { data: accessRecord, error: accessError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessError) {
      console.error('Error checking analytics access:', accessError.message)
      return NextResponse.json(
        { hasAccess: false, error: 'Database error' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json(
      { hasAccess: !!accessRecord },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error in analytics access check:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { hasAccess: false, error: 'Internal error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
