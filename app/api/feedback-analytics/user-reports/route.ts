import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100') || 100), 500)
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
    const offset = (page - 1) * limit

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in user reports:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized', data: [] },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data: accessRecord, error: accessError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessError) {
      console.error('Error checking access:', accessError.message)
      return NextResponse.json(
        { error: 'Failed to verify access', data: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!accessRecord) {
      console.warn('User does not have analytics access:', user.id)
      return NextResponse.json(
        { error: 'Forbidden', data: [] },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Получаем общее количество записей
    const { count, error: countError } = await supabase
      .from("user_reports")
      .select("*", { count: 'exact', head: true })

    if (countError) {
      console.error('Error fetching count:', countError.message)
      return NextResponse.json(
        { error: 'Failed to fetch data count', data: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Получаем данные с JOIN к profiles
    const { data: reportsData, error: reportsError } = await supabase
      .from("user_reports")
      .select(`
        user_report_id,
        user_report_short_description,
        user_report_detailed_description,
        user_report_created_at,
        user_report_created_by,
        profiles:user_report_created_by (
          first_name,
          last_name
        )
      `)
      .order("user_report_created_at", { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    if (reportsError) {
      console.error('Error fetching user reports data:', reportsError.message)
      return NextResponse.json(
        { error: 'Failed to fetch data', data: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Преобразуем данные для удобства использования на фронтенде
    const formattedData = (reportsData || []).map((report: any) => ({
      user_report_id: report.user_report_id,
      user_report_short_description: report.user_report_short_description,
      user_report_detailed_description: report.user_report_detailed_description,
      user_report_created_at: report.user_report_created_at,
      user_report_created_by: report.user_report_created_by,
      first_name: report.profiles?.first_name || 'Неизвестно',
      last_name: report.profiles?.last_name || '',
    }))

    return NextResponse.json(
      {
        data: formattedData,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error in user reports:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error', data: [] },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
