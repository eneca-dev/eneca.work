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
	return await Sentry.startSpan({ name: 'api.chat.python', op: 'http.server' }, async () => {
		const requestId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
		Sentry.addBreadcrumb({ category: 'chat', level: 'info', message: 'python agent request start', data: { requestId } })

		try {
			// 1) Rate limit по IP
			const rl = rateLimit(request, GENERAL_API_RATE_LIMIT)
			Sentry.addBreadcrumb({ category: 'chat', level: 'debug', message: 'rateLimit', data: { requestId, success: rl.success, remaining: rl.remaining } })
			if (!rl.success) {
				return new NextResponse(JSON.stringify({ error: 'Too Many Requests', phase: 'rate_limit', requestId }), {
					status: 429,
					headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
				})
			}

			// 2) Аутентификация Supabase JWT (через Authorization: Bearer)
			const auth = request.headers.get('authorization') || ''
			if (!auth.startsWith('Bearer ')) {
				return new NextResponse(JSON.stringify({ error: 'Unauthorized', phase: 'auth', requestId }), {
					status: 401,
					headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
				})
			}
			const jwt = auth.slice('Bearer '.length)

			// 3) Валидация тела
			const body = await request.json().catch((e) => {
				Sentry.addBreadcrumb({ category: 'chat', level: 'error', message: 'request.json failed', data: { requestId, error: String(e) } })
				return {}
			})
			const parse = requestSchema.safeParse(body)
			if (!parse.success) {
				return new NextResponse(JSON.stringify({
					error: 'Invalid payload',
					phase: 'validation',
					details: parse.error.flatten(),
					requestId
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
				})
			}
			const { message, conversationId, taskId, conversationHistory } = parse.data
			Sentry.addBreadcrumb({
				category: 'chat',
				level: 'debug',
				message: 'payload.parsed',
				data: {
					requestId,
					hasConversationId: Boolean(conversationId),
					hasHistory: Array.isArray(conversationHistory) && conversationHistory.length > 0
				}
			})

			// 4) Вызов Python агента
			const pythonAgentUrl = process.env.PYTHON_AGENT_URL
			if (!pythonAgentUrl) {
				Sentry.captureException(new Error('PYTHON_AGENT_URL not configured'), {
					tags: { module: 'chat', agent: 'python' },
					extra: { requestId }
				})
				return new NextResponse(JSON.stringify({
					error: 'Python agent not configured',
					phase: 'config',
					requestId
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
				})
			}

			console.log("========================================");
            console.log("🚨 ПРОВЕРКА АДРЕСА 🚨");
            console.log("URL из .env:", `'${pythonAgentUrl}'`); 
            console.log("Итоговый URL:", `'${pythonAgentUrl}/api/chat'`);
            console.log("========================================");

			const agentEndpoint = `${pythonAgentUrl}/api/chat`
			Sentry.addBreadcrumb({
				category: 'chat',
				level: 'debug',
				message: 'upstream.prepare',
				data: { requestId, agentEndpoint }
			})

			const controller = new AbortController()
			const timeout = setTimeout(() => controller.abort(), 20000) // 20 секунд таймаут

			let agentResp: Response
			try {
				agentResp = await Sentry.startSpan({ name: 'http.client.python-agent', op: 'http.client' }, () =>
					fetch(agentEndpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${jwt}`,
						'ngrok-skip-browser-warning': 'true',
						},
						body: JSON.stringify({
						    message: message,
						    // ВОТ ГЛАВНОЕ ИСПРАВЛЕНИЕ:
						    thread_id: conversationId || taskId || "default_session",
						}),
						signal: controller.signal,
					})
				)
			} catch (err: any) {
				clearTimeout(timeout)
				// Классифицируем ошибку сети/таймаута
				const isAbort = err?.name === 'AbortError' || /aborted|timeout/i.test(String(err?.message))
				const isNetwork = /ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|fetch failed/i.test(String(err?.message))
				const status = isAbort ? 504 : isNetwork ? 502 : 500
				const errorMessage = isAbort
					? 'Upstream timeout: Python агент не ответил за 20s'
					: isNetwork
					? 'Upstream network error: не удалось подключиться к Python агенту'
					: 'Internal error при обращении к Python агенту'

				Sentry.captureException(err, {
					tags: { module: 'chat', upstream: 'python-agent', phase: 'fetch' },
					extra: { requestId, agentEndpoint }
				})

				return new NextResponse(JSON.stringify({
					error: errorMessage,
					phase: 'upstream.fetch',
					requestId
				}), {
					status,
					headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
				})
			}

			clearTimeout(timeout)

			if (!agentResp.ok) {
                
                // --- ВСТАВИТЬ ЭТОТ БЛОК ---
                console.log("====================================");
                console.log("🔥 ПИТОН ВЕРНУЛ ОШИБКУ:", agentResp.status);
                // Читаем текст ошибки, клонируя ответ (чтобы не сломать логику ниже)
                const errText = await agentResp.clone().text(); 
                console.log("ТЕКСТ ОШИБКИ:", errText);
                console.log("====================================");
                // --------------------------
				// Нормализация ошибок upstream
				let errorMessage = `Upstream error: ${agentResp.status}`
				let statusToClient = 502
				try {
					const errJson = await agentResp.clone().json()
					const m = (errJson?.message || errJson?.error || errJson?.detail || '').toString()
					if (m) errorMessage = m
				} catch {
					// Если тело — HTML/текст, не включаем его в ответ клиенту
				}

				if (agentResp.status === 504 || agentResp.status === 524) {
					statusToClient = 504
					if (!/timeout|таймаут/i.test(errorMessage)) {
						errorMessage = 'Таймаут: upstream не ответил вовремя'
					}
				}

				Sentry.captureException(new Error(errorMessage), {
					tags: { module: 'chat', upstream: 'python-agent' },
					extra: { upstreamStatus: agentResp.status, requestId }
				})

				return new NextResponse(
					JSON.stringify({
						error: errorMessage,
						phase: 'upstream.response',
						status: agentResp.status,
						requestId
					}),
					{
						status: statusToClient,
						headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
					}
				)
			}

			let data: any = {}
			try {
				data = await agentResp.json()
                // --- ВСТАВИТЬ ЭТО ---
    console.log("🐍 ОТВЕТ ОТ ПИТОНА:", JSON.stringify(data, null, 2));
                // --------------------
				
			} catch {
				Sentry.addBreadcrumb({
					category: 'chat',
					level: 'warning',
					message: 'upstream.empty_json',
					data: { requestId }
				})
			}

			return new NextResponse(JSON.stringify({
				message: data?.response || data?.message || '',
				conversationId: conversationId ?? null,
				requestId
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
			})

		} catch (error) {
			Sentry.captureException(error, {
				tags: { module: 'chat', endpoint: 'python-agent', critical: true },
				extra: { requestId }
			})
			const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Internal Server Error'
			return new NextResponse(JSON.stringify({
				error: message,
				phase: 'handler',
				requestId
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId }
			})
		}
	})
}
