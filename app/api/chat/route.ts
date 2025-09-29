import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { rateLimit, GENERAL_API_RATE_LIMIT } from '@/utils/rate-limiting'

const requestSchema = z.object({
    message: z.string().min(1).max(4000),
    conversationId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
	conversationHistory: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']).optional(),
				content: z.string().optional(),
				timestamp: z.any().optional(),
			})
		)
		.optional(),
})

export async function POST(request: NextRequest) {
	return await Sentry.startSpan({ name: 'api.chat.gateway', op: 'http.server' }, async () => {
		const requestId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
		Sentry.addBreadcrumb({ category: 'chat', level: 'info', message: 'chat gateway request start', data: { requestId } })
		try {
		// 1) Rate limit по IP
		const rl = rateLimit(request, GENERAL_API_RATE_LIMIT)
		Sentry.addBreadcrumb({ category: 'chat', level: 'debug', message: 'rateLimit', data: { requestId, success: rl.success, remaining: rl.remaining } })
		if (!rl.success) {
			return new NextResponse(JSON.stringify({ error: 'Too Many Requests', phase: 'rate_limit', requestId }), { status: 429, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}

		// 2) Аутентификация Supabase JWT (через Authorization: Bearer)
		const auth = request.headers.get('authorization') || ''
		if (!auth.startsWith('Bearer ')) {
			return new NextResponse(JSON.stringify({ error: 'Unauthorized', phase: 'auth', requestId }), { status: 401, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}
		const jwt = auth.slice('Bearer '.length)

		// 3) Валидация тела
		const body = await request.json().catch((e) => { Sentry.addBreadcrumb({ category: 'chat', level: 'error', message: 'request.json failed', data: { requestId, error: String(e) } }); return {} })
		const parse = requestSchema.safeParse(body)
		if (!parse.success) {
			return new NextResponse(JSON.stringify({ error: 'Invalid payload', phase: 'validation', details: parse.error.flatten(), requestId }), { status: 400, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}
        const { message, conversationId, taskId, conversationHistory } = parse.data
		Sentry.addBreadcrumb({ category: 'chat', level: 'debug', message: 'payload.parsed', data: { requestId, hasConversationId: Boolean(conversationId), hasHistory: Array.isArray(conversationHistory) && conversationHistory.length > 0 } })

        // 4) Вебхук (только PROD)
        const n8nUrl = 'https://eneca.app.n8n.cloud/webhook/0378ba55-d98b-4983-b0ef-83a0ac4ee28c'
		Sentry.addBreadcrumb({ category: 'chat', level: 'debug', message: 'upstream.prepare', data: { requestId, n8nUrl } })
		const controller = new AbortController()
		let n8nResp: Response
		try {
			n8nResp = await Sentry.startSpan({ name: 'http.client.n8n', op: 'http.client' }, () =>
				fetch(n8nUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${jwt}`,
					},
					body: JSON.stringify({ message, conversationHistory: conversationHistory ?? [], conversationId, taskId }),
					signal: controller.signal,
				})
			)
		} catch (err: any) {
			// Классифицируем ошибку сети/таймаута, чтобы не маскировать как 500
			const isAbort = err?.name === 'AbortError' || /aborted|timeout/i.test(String(err?.message))
			const isNetwork = /ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|fetch failed/i.test(String(err?.message))
			const status = isAbort ? 504 : isNetwork ? 502 : 500
			const errorMessage = isAbort
				? 'Upstream timeout: n8n не ответил за 20s'
				: isNetwork
				? 'Upstream network error: не удалось подключиться к n8n'
				: 'Internal error при обращении к n8n'
			Sentry.captureException(err, { tags: { module: 'chat', upstream: 'n8n', phase: 'fetch' }, extra: { requestId } })
			return new NextResponse(JSON.stringify({ error: errorMessage, phase: 'upstream.fetch', requestId }), { status, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}

		if (!n8nResp.ok) {
			// Нормализация ошибок upstream без прокидывания HTML
			let errorMessage = `Upstream error: ${n8nResp.status}`
			let statusToClient = 502
			try {
				const errJson = await n8nResp.clone().json()
				const m = (errJson?.message || errJson?.error || '').toString()
				if (m) errorMessage = m
			} catch {
				// Если тело — HTML/текст, не включаем его в ответ клиенту
			}
			// Cloudflare 524 → Gateway Timeout
			if (n8nResp.status === 524) {
				statusToClient = 504
				if (!/timeout|таймаут/i.test(errorMessage)) {
					errorMessage = 'Таймаут: upstream не ответил вовремя'
				}
			}
			Sentry.captureException(new Error(errorMessage), { tags: { module: 'chat', upstream: 'n8n' }, extra: { upstreamStatus: n8nResp.status, requestId } })
			return new NextResponse(
				JSON.stringify({ error: errorMessage, phase: 'upstream.response', status: n8nResp.status, requestId }),
				{ status: statusToClient, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } }
			)
		}

		let data: any = {}
		try {
			data = await n8nResp.json()
		} catch {
			// допустим пустой ответ, но зафиксируем
			Sentry.addBreadcrumb({ category: 'chat', level: 'warning', message: 'upstream.empty_json', data: { requestId } })
		}
		return new NextResponse(JSON.stringify({ message: data?.message ?? '', conversationId: conversationId ?? null, requestId }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		} catch (error) {
		Sentry.captureException(error, { tags: { module: 'chat', endpoint: 'gateway', critical: true }, extra: { requestId } })
		const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Internal Server Error'
		return new NextResponse(JSON.stringify({ error: message, phase: 'handler', requestId }), { status: 500, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}
	})
}
