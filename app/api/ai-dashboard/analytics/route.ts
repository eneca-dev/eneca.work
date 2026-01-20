import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Конфигурация
const AI_AGENT_URL = process.env.PYTHON_AGENT_URL || 'https://ai-bot.eneca.work'
const AI_AGENT_TIMEOUT = 60000 // 60 секунд
const WEBHOOK_SECRET = process.env.AI_WEBHOOK_SECRET // Для верификации

/**
 * POST /api/ai-dashboard/analytics
 *
 * Отправляет запрос к Python AI агенту для аналитики
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Аутентификация пользователя
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Парсинг запроса
    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // 3. Подготовка payload для AI агента
    const payload = {
      query,
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      context: {
        module: 'ai-dashboard',
        version: '1.0'
      }
    }

    // 4. Отправка webhook к AI агенту с timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_AGENT_TIMEOUT)

    try {
      const response = await fetch(`${AI_AGENT_URL}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WEBHOOK_SECRET && { 'X-Webhook-Secret': WEBHOOK_SECRET })
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`AI Agent responded with ${response.status}`)
      }

      // 5. Парсинг ответа от AI агента
      const aiResponse = await response.json()

      // 6. Возврат результата клиенту
      return NextResponse.json({
        success: true,
        data: aiResponse,
        executionTime: response.headers.get('X-Execution-Time')
      })

    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout - AI agent took too long to respond' },
          { status: 504 }
        )
      }

      throw fetchError
    }

  } catch (error) {
    console.error('[AI Dashboard API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
