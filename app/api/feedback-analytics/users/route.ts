import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Получение списка всех пользователей для добавления
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in get users:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized', users: [] },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Проверяем доступ текущего пользователя
    const { data: accessRecord, error: accessCheckError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessCheckError) {
      console.error('Error checking access:', accessCheckError.message)
      return NextResponse.json(
        { error: 'Failed to verify access', users: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!accessRecord) {
      console.warn('User does not have analytics access:', user.id)
      return NextResponse.json(
        { error: 'Forbidden', users: [] },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Получаем пользователей из profiles c фильтром q
    let profilesQuery = supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .order('first_name', { ascending: true })

    if (q) {
      const like = `%${q}%`
      profilesQuery = profilesQuery.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
    }

    const { data: profiles, error: profilesError } = await profilesQuery

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError.message)
      return NextResponse.json(
        { error: 'Failed to fetch users', users: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Получаем список пользователей с доступом
    const { data: accessList, error: accessListError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')

    if (accessListError) {
      console.error('Error fetching access list:', accessListError.message)
      return NextResponse.json(
        { error: 'Failed to fetch access list', users: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userIdsWithAccess = new Set(accessList?.map(a => a.user_id) || [])
    // Маркируем пользователей с доступом
    const usersWithAccessStatus = profiles?.map(profile => ({
      ...profile,
      hasAccess: userIdsWithAccess.has(profile.user_id)
    }))

    return NextResponse.json(
      { users: usersWithAccessStatus || [] },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error in get users:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error', users: [] },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Добавление пользователя к доступу
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in grant access:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Проверяем доступ текущего пользователя
    const { data: accessRecord, error: accessCheckError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessCheckError) {
      console.error('Error checking access:', accessCheckError.message)
      return NextResponse.json(
        { error: 'Failed to verify access' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!accessRecord) {
      console.warn('User does not have analytics access:', user.id)
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify user exists
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Error checking user profile:', profileError.message)
      return NextResponse.json(
        { error: 'Failed to verify user' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Добавляем пользователя в таблицу доступа
    const { error: insertError } = await supabase
      .from('feedback_analytics_access')
      .insert({
        user_id: userId,
        granted_by: user.id
      })

    if (insertError) {
      // Проверяем, не добавлен ли пользователь уже
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'User already has access' },
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      console.error('Error granting access:', insertError.message)
      return NextResponse.json(
        { error: 'Failed to grant access' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Access granted' },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error in grant access:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Удаление доступа пользователя
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in revoke access:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Проверяем доступ текущего пользователя
    const { data: accessRecord, error: accessCheckError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessCheckError) {
      console.error('Error checking access:', accessCheckError.message)
      return NextResponse.json(
        { error: 'Failed to verify access' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!accessRecord) {
      console.warn('User does not have analytics access:', user.id)
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-revocation
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot revoke your own access' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Delete with count check in a single query to reduce race window
    const { data: remaining, error: countError } = await supabase
      .from('feedback_analytics_access')
      .select('user_id')
      .neq('user_id', userId)

    if (countError) {
      console.error('Error checking remaining users:', countError.message)
      return NextResponse.json(
        { error: 'Failed to check access count' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!remaining || remaining.length === 0) {
      return NextResponse.json(
        { error: 'Cannot revoke access for the last user' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { error: deleteError } = await supabase
      .from('feedback_analytics_access')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error revoking access:', deleteError.message)
      return NextResponse.json(
        { error: 'Failed to revoke access' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Access revoked' },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error in revoke access:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
