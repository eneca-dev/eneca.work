### Инструкция для разработчика n8n: трансляция "мышления" бота в UI

Цель: при каждом шаге агента отправлять событие в наш эндпоинт, чтобы пользователь видел процесс в реальном времени в чате.

#### 1) Эндпоинт и аутентификация
- URL: `https://<ваш-домен>/api/chat/thinking`
- Метод: `POST`
- Заголовки:
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `X-N8N-Secret: {{$env.N8N_THINKING_SECRET}}` (секрет в ENV n8n)
  - `X-Run-Id: {{$executionId}}`

#### 2) Тело запроса (JSON)
```json
{
  "conversationId": "<uuid>",
  "userId": "<uuid>",
  "runId": "{{$executionId}}",
  "stepIndex": 1,
  "kind": "thinking",
  "content": "текст шага",
  "isFinal": false,
  "meta": { "optional": true }
}
```
- `conversationId`: id беседы, выдаётся фронтом (передайте из входного webhook или сохраните в переменных выполнения).
- `userId`: id владельца беседы (тот же пользователь, который пишет в чат).
- `runId`: используйте `{{$executionId}}` n8n.
- `stepIndex`: увеличивайте на каждом шаге (1,2,3…).
- `kind`: одно из `thinking | tool | observation | message`.
- `isFinal`: `true` только на финальном `kind="message"`.
- `meta`: опционально (диагностика, тайминги).

Финальный ответ ассистента:
```json
{
  "conversationId": "<uuid>",
  "userId": "<uuid>",
  "runId": "{{$executionId}}",
  "stepIndex": 999,
  "kind": "message",
  "content": "Готово. Нашёл 3 результата.",
  "isFinal": true
}
```

#### 3) Идемпотентность
- Дедупликация по `(conversationId, runId, stepIndex, kind)`. Повтор с теми же значениями будет проигнорирован.

#### 4) Поток
- На каждый шаг агента → один POST на `/api/chat/thinking`.
- Финальный ответ — `kind="message"`, `isFinal=true`.

#### 5) Проверка
- В UI `/dashboard/debug` нажмите "Новая беседа" → получите `conversationId` и подпишитесь.
- Запустите workflow → события появятся в реальном времени.

#### 6) Прод/локал
- Прод: используйте домен Vercel `https://<ваш-домен>/api/chat/thinking`.
- Локал: поднимите туннель к `http://localhost:3000` и используйте публичный URL туннеля.

#### 7) Переменные окружения (n8n)
- `N8N_THINKING_SECRET` — должен совпадать с серверным `N8N_THINKING_SECRET` на Vercel.

#### 8) Замечания по безопасности
- Не отправляйте чувствительное в `content` — это видит пользователь.
- Используйте `meta` для внутренних деталей (не показываются в UI).
