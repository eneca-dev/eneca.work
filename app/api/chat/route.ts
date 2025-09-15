import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { rateLimit, GENERAL_API_RATE_LIMIT } from '@/utils/rate-limiting'

const requestSchema = z.object({
	message: z.string().min(1).max(4000),
	conversationId: z.string().uuid().optional(),
	taskId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
	const span = Sentry.startSpan({ name: 'api.chat.gateway', op: 'http.server' })
	try {
		// 1) Rate limit по IP
		const rl = rateLimit(request, GENERAL_API_RATE_LIMIT)
		if (!rl.success) {
			return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
		}

		// 2) Аутентификация Supabase JWT (через Authorization: Bearer)
		const auth = request.headers.get('authorization') || ''
		if (!auth.startsWith('Bearer ')) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const jwt = auth.slice('Bearer '.length)

		// 3) Валидация тела
		const body = await request.json().catch(() => ({}))
		const parse = requestSchema.safeParse(body)
		if (!parse.success) {
			return NextResponse.json({ error: 'Invalid payload', details: parse.error.flatten() }, { status: 400 })
		}
		const { message, conversationId, taskId } = parse.data

		// 4) Проксируем в n8n webhook (как в старом фронте)
		const n8nUrl = process.env.N8N_WEBHOOK_URL || 'https://eneca.app.n8n.cloud/webhook/0378ba55-d98b-4983-b0ef-83a0ac4ee28c'
		const n8nResp = await Sentry.startSpan({ name: 'http.client.n8n', op: 'http.client' }, () =>
			fetch(n8nUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${jwt}`,
				},
				body: JSON.stringify({ message, conversationId, taskId })
			})
		)

		if (!n8nResp.ok) {
			let errorMessage = `Upstream error: ${n8nResp.status}`
			try {
				const errJson = await n8nResp.json()
				errorMessage = errJson?.message || errJson?.error || errorMessage
			} catch {}
			return NextResponse.json({ error: errorMessage }, { status: 502 })
		}

		const data = await n8nResp.json().catch(() => ({}))
		return NextResponse.json({ message: data?.message ?? '', conversationId: conversationId ?? null })
	} catch (error) {
		Sentry.captureException(error, { tags: { module: 'chat', endpoint: 'gateway', critical: true } })
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	} finally {
		span.end()
	}
}
