import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'

const payloadSchema = z.object({
	conversationId: z.string().uuid(),
	userId: z.string().uuid(),
	taskId: z.string().uuid().optional().nullable(),
	runId: z.string().min(1).max(256).optional(),
	kind: z.enum(['thinking', 'tool', 'observation', 'message']),
	content: z.string().min(1).max(5000),
	isFinal: z.boolean().optional(),
	meta: z.record(z.any()).optional(),
})

type Payload = z.infer<typeof payloadSchema>

export async function POST(request: NextRequest) {
	return await Sentry.startSpan({ name: 'api.chat.thinking', op: 'http.server' }, async () => {
		const requestId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
		Sentry.addBreadcrumb({ category: 'chat', level: 'info', message: 'thinking request start', data: { requestId } })
		try {
		// 1) Проверка секрета из n8n
		const secret = request.headers.get('x-n8n-secret') || ''
		const expected = process.env.N8N_THINKING_SECRET || ''
		if (!expected) {
			const err = new Error('N8N_THINKING_SECRET не задан в окружении')
			Sentry.captureException(err, { tags: { module: 'chat', endpoint: 'thinking', error_type: 'env_missing', critical: true } })
			return NextResponse.json({ error: 'Сервер не сконфигурирован' }, { status: 500 })
		}
		if (secret !== expected) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// 2) Читаем и валидируем тело
		const raw = await request.json().catch(() => ({}))
		const parse = payloadSchema.safeParse({
			...raw,
			runId: raw?.runId ?? request.headers.get('x-run-id') ?? undefined,
		})
		if (!parse.success) {
			return new NextResponse(JSON.stringify({ error: 'Invalid payload', phase: 'validation', details: parse.error.flatten(), requestId }), { status: 400, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}
		const body: Payload = parse.data

		const admin = createAdminClient()

		// 3) Опционально убеждаемся, что беседа существует (создадим при отсутствии)
		await Sentry.startSpan({ name: 'db.ensure_conversation', op: 'db' }, async () => {
			const { data: conv, error: convErr } = await admin
				.from('chat_conversations')
				.select('id')
				.eq('id', body.conversationId)
				.single()

			if (convErr && (convErr as any).code === 'PGRST116') {
				// not found → создаём
				const { error: insertConvErr } = await admin
					.from('chat_conversations')
					.insert({ id: body.conversationId, user_id: body.userId, task_id: body.taskId ?? null, status: 'active' })
				if (insertConvErr) throw insertConvErr
			}
		})

		// 4) Идемпотентность по stepIndex отключена

		// 5) Вставка сообщения
		const result = await Sentry.startSpan({ name: 'db.insert_message', op: 'db', attributes: { kind: body.kind } }, async () => {
			const { data, error } = await admin
				.from('chat_messages')
				.insert({
					conversation_id: body.conversationId,
					user_id: body.userId,
					role: body.kind === 'message' ? 'assistant' : 'assistant',
					kind: body.kind,
					content: body.content,
					run_id: body.runId ?? null,
					is_final: body.isFinal ?? false,
					meta: body.meta ?? {},
				})
				.select('id')
				.single()
			if (error) throw error
			return data
		})

		return new NextResponse(JSON.stringify({ ok: true, id: result.id, requestId }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		} catch (error) {
			Sentry.captureException(error, { tags: { module: 'chat', endpoint: 'thinking', critical: true }, extra: { requestId } })
			console.error('thinking endpoint error:', error)
			const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Internal Server Error'
			return new NextResponse(JSON.stringify({ error: message, phase: 'handler', requestId }), { status: 500, headers: { 'Content-Type': 'application/json', 'X-Debug-Id': requestId } })
		}
	})
}
