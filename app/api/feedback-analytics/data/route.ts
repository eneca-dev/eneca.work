import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100') || 100), 500)
    const offset = (page - 1) * limit

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in feedback analytics data:', authError?.message)
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

    const { count, error: countError } = await supabase
      .from("user_feedback")
      .select("*", { count: 'exact', head: true })
      .eq("completed", true)
      .not("score", "is", null)

    if (countError) {
      console.error('Error fetching count:', countError.message)
      return NextResponse.json(
        { error: 'Failed to fetch data count', data: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data: feedbackData, error: feedbackError } = await supabase
      .from("user_feedback")
      .select("id, user_id, first_name, last_name, score, had_problems, problem_text, created_at, updated_at, completed, answers, next_survey_at")
      .eq("completed", true)
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (feedbackError) {
      console.error('Error fetching feedback data:', feedbackError.message)
      return NextResponse.json(
        { error: 'Failed to fetch data', data: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json(
      {
        data: feedbackData || [],
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
    console.error('Unexpected error in feedback analytics data:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error', data: [] },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
