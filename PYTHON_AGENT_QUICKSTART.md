# Python AI Agent - Quick Start

## Быстрый старт для тестирования

### 1. Подготовьте ваш Python бот

Убедитесь, что ваш Python бот имеет endpoint `/api/chat`:

```python
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    return ChatResponse(message="Ответ бота")
```

### 2. Запустите Python бот

```bash
# В директории вашего Python проекта
python main.py  # или uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Запустите ngrok

```bash
ngrok http 8000
```

Скопируйте URL (например: `https://fb20164ddeaf.ngrok-free.app`)

### 4. Настройте Eneca приложение

Обновите `.env.local`:

```env
PYTHON_AGENT_URL=https://fb20164ddeaf.ngrok-free.app
```

### 5. Запустите Next.js

```bash
npm install  # если еще не установлены зависимости
npm run dev
```

### 6. Используйте чат

1. Откройте http://localhost:3000
2. Войдите в систему
3. Откройте чат (кнопка в правом нижнем углу)
4. Нажмите на кнопку с иконкой RotateCcw для переключения на Python агента
5. Бейдж изменится с "N8N" на "Python"
6. Отправьте сообщение - оно уйдет на ваш Python бот!

---

## Что было добавлено

✅ **Backend:**
- Новый API endpoint: `/api/chat/python`
- Environment variable: `PYTHON_AGENT_URL`

✅ **Frontend:**
- Переключатель агентов в header чата (кнопка RotateCcw)
- Индикатор активного агента (бейдж "N8N" или "Python")
- Сохранение выбора в localStorage

✅ **Types:**
- `ChatAgentType = 'n8n' | 'python'`
- Обновлены все типы для поддержки выбора агента

✅ **Documentation:**
- Полная документация: [docs/python-agent-setup.md](docs/python-agent-setup.md)

---

## Формат запроса к вашему боту

```json
POST https://your-ngrok-url.ngrok-free.app/api/chat

Headers:
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

Body:
{
  "message": "Привет",
  "conversationHistory": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "conversationId": "uuid",
  "taskId": "uuid"
}
```

## Формат ответа

```json
{
  "message": "Ответ вашего бота"
}
```

---

## Debug

В чате есть Debug панель:
- Нажмите "Debug" в header
- Смотрите `agent`: показывает текущий агент (n8n/python)
- Смотрите `lastLatencyMs`: задержка запроса
- Смотрите `lastError`: ошибки (если есть)

---

## Troubleshooting

**Проблема:** Сообщение не отправляется

**Решение:**
1. Проверьте, что Python бот запущен: `curl http://localhost:8000/health`
2. Проверьте, что ngrok работает: откройте ngrok URL в браузере
3. Проверьте `PYTHON_AGENT_URL` в `.env.local`
4. Перезапустите `npm run dev` после изменения `.env.local`

**Проблема:** Timeout ошибка

**Решение:** Ваш бот должен отвечать быстрее чем за 20 секунд

**Проблема:** CORS ошибка

**Решение:** Добавьте CORS middleware в Python бот:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Полная документация

См. [docs/python-agent-setup.md](docs/python-agent-setup.md)
