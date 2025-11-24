# Интеграция Python AI агента с Eneca Chat

## Обзор

В приложение добавлена поддержка параллельной работы двух AI агентов:
- **N8N агент** (по умолчанию) - существующая интеграция через N8N workflow
- **Python агент** - новая интеграция с пользовательским Python ботом

Переключение между агентами происходит через UI в чате, выбор сохраняется в localStorage.

---

## Архитектура

### Backend
```
Frontend → /api/chat/python → Python Agent (FastAPI) → Response
     ↓
  Supabase Realtime (опционально для статусов)
```

### Файлы
- **API Route:** [app/api/chat/python/route.ts](../app/api/chat/python/route.ts)
- **Frontend Hook:** [modules/chat/hooks/useChat.ts](../modules/chat/hooks/useChat.ts)
- **UI Component:** [modules/chat/components/ChatInterface.tsx](../modules/chat/components/ChatInterface.tsx)
- **Types:** [modules/chat/types/chat.ts](../modules/chat/types/chat.ts)
- **Cache Utils:** [modules/chat/utils/chatCache.ts](../modules/chat/utils/chatCache.ts)
- **API Client:** [modules/chat/api/chat.ts](../modules/chat/api/chat.ts)

---

## Требования к Python агенту

### Минимальный FastAPI сервер

```python
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# CORS для локальной разработки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модели данных
class Message(BaseModel):
    role: str  # "user" или "assistant"
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversationHistory: Optional[List[Message]] = []
    conversationId: Optional[str] = None
    taskId: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    conversationId: Optional[str] = None

# Основной endpoint
@app.post("/api/chat")
async def chat_endpoint(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)  # JWT токен
):
    """
    Обработка чат-запросов от Eneca

    Args:
        request: Сообщение пользователя + история
        authorization: Bearer JWT токен от Supabase

    Returns:
        ChatResponse с ответом бота
    """
    # Ваша логика обработки
    bot_response = your_ai_logic(
        message=request.message,
        history=request.conversationHistory
    )

    return ChatResponse(
        message=bot_response,
        conversationId=request.conversationId
    )

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Requirements.txt
```txt
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.0.0
python-multipart>=0.0.6
openai>=1.0.0  # если используете OpenAI
```

---

## Настройка локальной разработки

### 1. Подготовка Python агента

```bash
# Перейдите в директорию вашего Python бота
cd /path/to/your/python-agent

# Установите зависимости
pip install -r requirements.txt

# Запустите агента
python main.py  # или uvicorn main:app --reload
```

Агент должен запуститься на порту 8000.

### 2. Настройка ngrok

```bash
# Запустите ngrok для туннелирования
ngrok http 8000
```

Вы получите URL вида: `https://abc123.ngrok-free.app`

### 3. Конфигурация Next.js приложения

Создайте/обновите `.env.local`:

```env
# Supabase (получите из Supabase Dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# N8N (существующее)
N8N_THINKING_SECRET=your_n8n_secret

# Python Agent (ваш ngrok URL)
PYTHON_AGENT_URL=https://abc123.ngrok-free.app

# Sentry (опционально)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

**Важно:** Каждый раз при перезапуске ngrok URL меняется. Обновляйте `PYTHON_AGENT_URL` соответственно.

### 4. Запуск Next.js приложения

```bash
# Установите зависимости (если еще не установлены)
npm install

# Запустите dev сервер
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

---

## Использование

### 1. Откройте чат
- Нажмите на кнопку чата в правом нижнем углу дашборда

### 2. Переключение агента
- В header чата найдите бейдж с текущим агентом (N8N или Python)
- Нажмите на кнопку с иконкой RotateCcw (стрелки по кругу)
- Агент переключится, выбор сохранится в localStorage

### 3. Отправка сообщений
- Введите сообщение в поле ввода
- Сообщение будет отправлено на выбранного агента

### 4. Debug панель
- Нажмите "Debug" в header чата
- Посмотрите:
  - `agent`: текущий активный агент (n8n/python)
  - `conversationId`: ID текущей беседы
  - `lastLatencyMs`: задержка последнего запроса
  - `lastError`: последняя ошибка (если была)

---

## Форматы данных

### Запрос к Python агенту

```typescript
POST /chat

Headers:
  Authorization: Bearer <supabase_jwt_token>
  Content-Type: application/json

Body:
{
  "message": "Привет, покажи мои проекты",
  "conversationHistory": [
    {
      "role": "user",
      "content": "предыдущий вопрос",
      "timestamp": "2025-01-19T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "предыдущий ответ",
      "timestamp": "2025-01-19T10:00:05Z"
    }
  ],
  "conversationId": "uuid-беседы",
  "taskId": "uuid-задачи"  // опционально
}
```

### Ответ от Python агента

```json
{
  "message": "Вот список ваших проектов: ..."
}
```

---

## Доступ к базе данных Supabase (опционально)

Если ваш Python агент должен запрашивать данные из Supabase:

### 1. Установите Supabase клиент

```bash
pip install supabase
```

### 2. Инициализация клиента

```python
from supabase import create_client
import os

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Admin access

supabase = create_client(supabase_url, supabase_key)
```

### 3. Пример запроса

```python
# Получить проекты пользователя
user_id = "user-uuid-from-jwt"

response = supabase.table("projects") \
    .select("*") \
    .eq("owner_id", user_id) \
    .execute()

projects = response.data
```

### 4. Декодирование JWT токена

```python
import jwt

def get_user_id_from_token(token: str) -> str:
    """Извлечь user_id из JWT токена Supabase"""
    try:
        # Убираем "Bearer " prefix
        clean_token = token.replace("Bearer ", "")

        # Декодируем без проверки подписи (для получения payload)
        decoded = jwt.decode(
            clean_token,
            options={"verify_signature": False}
        )

        return decoded.get("sub")  # user_id в поле 'sub'
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## Production развертывание

### Вариант 1: Отдельный сервис

1. Разверните Python агент на отдельном сервере (AWS, GCP, DigitalOcean)
2. Получите постоянный URL (например, `https://agent.yourdomain.com`)
3. Обновите environment variable:
   ```env
   PYTHON_AGENT_URL=https://agent.yourdomain.com
   ```

### Вариант 2: Serverless (AWS Lambda, Google Cloud Functions)

1. Адаптируйте FastAPI под serverless (Mangum для AWS Lambda)
2. Развертывание через API Gateway
3. Получите URL endpoint
4. Обновите `PYTHON_AGENT_URL`

### Вариант 3: Docker контейнер

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Troubleshooting

### Проблема: "Python agent not configured"

**Решение:** Проверьте, что `PYTHON_AGENT_URL` установлен в `.env.local`

```bash
# Перезапустите Next.js после изменения .env.local
npm run dev
```

### Проблема: "Upstream network error"

**Причины:**
- Python агент не запущен
- Неверный ngrok URL
- Firewall блокирует соединение

**Решение:**
1. Проверьте, что Python агент работает: `curl http://localhost:8000/health`
2. Проверьте ngrok URL в браузере
3. Обновите `PYTHON_AGENT_URL` в `.env.local`

### Проблема: "Upstream timeout"

**Причины:**
- Python агент обрабатывает запрос > 20 секунд
- Медленное интернет-соединение

**Решение:**
- Оптимизируйте логику агента
- Увеличьте timeout в [app/api/chat/python/route.ts:99](../app/api/chat/python/route.ts#L99)

### Проблема: CORS ошибки

**Решение:** Добавьте localhost:3000 в CORS настройки Python агента

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Расширенные возможности

### Real-time статусы ("думаю...", "ищу в базе...")

Если хотите показывать промежуточные статусы (как у N8N), Python агент может вызывать `/api/chat/thinking`:

```python
import httpx

async def send_thinking_status(
    conversation_id: str,
    user_id: str,
    content: str,
    kind: str = "thinking"
):
    """Отправить промежуточный статус в чат"""
    async with httpx.AsyncClient() as client:
        await client.post(
            "http://localhost:3000/api/chat/thinking",
            headers={
                "X-N8N-Secret": os.getenv("N8N_THINKING_SECRET"),
                "Content-Type": "application/json"
            },
            json={
                "conversationId": conversation_id,
                "userId": user_id,
                "kind": kind,  # "thinking" | "tool" | "observation" | "message"
                "content": content,
                "isFinal": kind == "message"
            }
        )

# Использование:
await send_thinking_status(
    conversation_id=request.conversationId,
    user_id=user_id,
    content="Анализирую ваш вопрос...",
    kind="thinking"
)

# ... ваша логика ...

await send_thinking_status(
    conversation_id=request.conversationId,
    user_id=user_id,
    content="Ищу данные в базе...",
    kind="tool"
)

# ... запрос к БД ...

await send_thinking_status(
    conversation_id=request.conversationId,
    user_id=user_id,
    content="Вот результат: ...",
    kind="message"
)
```

---

## Дополнительные ресурсы

- **FastAPI Documentation:** https://fastapi.tiangolo.com/
- **Supabase Python Client:** https://github.com/supabase-community/supabase-py
- **ngrok Documentation:** https://ngrok.com/docs
- **Existing Chat Module README:** [modules/chat/README.md](../modules/chat/README.md)

---

## Контакты и поддержка

При возникновении вопросов:
1. Проверьте Debug панель в чате
2. Проверьте логи Python агента
3. Проверьте Network tab в DevTools браузера
4. Проверьте логи Next.js сервера

**Sentry:** Все ошибки автоматически логируются в Sentry с тегами `module: chat`, `upstream: python-agent`
