# Модуль Chat

AI-чат для приложения Eneca с асинхронной архитектурой на базе Supabase.

## Архитектура

```
1. Frontend → INSERT chat_messages (role='user') → БД
2. PostgreSQL Trigger → Webhook → Python Agent (https://ai-bot.eneca.work)
3. Python Agent → обработка → INSERT chat_messages (role='assistant') → БД
4. Supabase Realtime → WebSocket → Frontend
5. Frontend отображает ответ в реальном времени
```

## Возможности

### UI компоненты
- 🟢 **Зелёная кнопка** — открыть/закрыть чат
- 💬 **Окно чата** — список сообщений (ваши справа зелёные, бота слева серые)
- 📐 **Resize** — тянуть за левый верхний угол для изменения размера
- 🖥️ **Fullscreen** — кнопка развернуть/свернуть
- 🗑️ **Очистить** — удаляет все сообщения из БД
- ✨ **Sparkles** — быстрые команды (План на день, Собрать отчёт)
- ⌨️ **Ввод** — Enter отправляет, Shift+Enter новая строка, макс 500 символов

### Логика
- Сообщения хранятся в **Supabase PostgreSQL** (таблицы `chat_conversations`, `chat_messages`)
- Асинхронная доставка через **Supabase Realtime** (WebSocket)
- Python агент получает сообщения через **PostgreSQL Webhook Trigger**
- JWT токен из Supabase для безопасности
- История изолирована по userId через RLS политики

## Структура модуля

```
chat/
├── components/
│   ├── ChatInterface.tsx    # Главный компонент (кнопка + окно)
│   ├── MessageList.tsx      # Список сообщений + индикатор "Печатаю..."
│   ├── MessageInput.tsx     # Поле ввода + Sparkles + Send
│   └── MarkdownRenderer.tsx # Рендер markdown в сообщениях
├── hooks/
│   └── useChat.ts           # Вся логика (state + DB + Realtime)
├── types/
│   └── chat.ts              # ChatMessage, ChatConversation
└── utils/
    └── formatTime.ts        # Форматирование времени сообщений
```

## База данных

### Таблицы

**chat_conversations:**
- `id` — UUID
- `user_id` — владелец разговора
- `task_id` — опциональная привязка к задаче
- `status` — 'active' | 'closed'
- `created_at` — время создания

**chat_messages:**
- `id` — UUID
- `conversation_id` — FK на chat_conversations
- `user_id` — автор сообщения
- `role` — 'user' | 'assistant' | 'system'
- `kind` — 'message' | 'thinking' | 'tool' | 'observation'
- `content` — текст сообщения
- `is_final` — флаг завершённости
- `created_at` — время создания

### RLS политики

```sql
-- Чтение всех сообщений в своих conversations
CREATE POLICY "Users can read messages in own conversations"
ON chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE chat_conversations.id = chat_messages.conversation_id
    AND chat_conversations.user_id = auth.uid()
  )
);

-- Вставка только своих сообщений
CREATE POLICY "Users can insert own messages"
ON chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Удаление сообщений в своих conversations
CREATE POLICY "Users can delete messages in own conversations"
ON chat_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE chat_conversations.id = chat_messages.conversation_id
    AND chat_conversations.user_id = auth.uid()
  )
);
```

### Webhook Trigger

При вставке сообщения от пользователя срабатывает триггер:

```sql
CREATE TRIGGER on_user_message_insert
AFTER INSERT ON chat_messages
FOR EACH ROW
WHEN (NEW.role = 'user' AND NEW.kind = 'message')
EXECUTE FUNCTION notify_python_agent();
```

Функция `notify_python_agent()` отправляет HTTP POST на `https://ai-bot.eneca.work/webhook`.

## Как работает?

1. Пользователь пишет сообщение → **optimistic update** (сразу в UI с temp ID)
2. INSERT в `chat_messages` → триггер → webhook → Python агент
3. Индикатор "Печатаю..." с 60-секундным таймаутом
4. Python агент обрабатывает и записывает ответ в БД
5. **Supabase Realtime** доставляет ответ через WebSocket
6. Frontend обновляет UI с реальным сообщением

## Типы данных

```typescript
interface ChatMessage {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  kind: 'message' | 'thinking' | 'tool' | 'observation'
  content: string
  is_final: boolean
  created_at: Date
}

interface ChatConversation {
  id: string
  user_id: string
  task_id?: string
  status: 'active' | 'closed'
  created_at: Date
}
```

## useChat хук

Управляет всем состоянием:
- `messages` — массив сообщений из БД
- `conversationId` — ID текущего разговора
- `isLoading`, `isTyping` — индикаторы
- `isOpen`, `isFullscreen` — состояние окна
- `input` — текст в поле
- `chatSize` — размер окна
- `sendMessage()` — отправить (INSERT в БД)
- `clearMessages()` — удалить все сообщения из БД
- `toggleChat()`, `toggleFullscreen()` — переключатели

## Миграции

- `2025-12-02_chat_webhook_and_realtime.sql` — триггер, функция webhook, RLS
- `2025-12-03_fix_chat_rls_realtime.sql` — исправление RLS для Realtime

## История изменений

### Декабрь 2024 - Асинхронная архитектура

Модуль полностью переписан на асинхронную архитектуру:

**Добавлено:**
- ✅ Хранение в Supabase PostgreSQL (вместо localStorage)
- ✅ Supabase Realtime для доставки сообщений
- ✅ PostgreSQL Webhook Trigger для вызова Python агента
- ✅ Optimistic UI updates с временными ID
- ✅ Таймаут 60 секунд для индикатора "Печатаю..."
- ✅ RLS политики для безопасности

**Удалено:**
- ❌ localStorage (ограничение 10 сообщений)
- ❌ Синхронный HTTP запрос к Python агенту
- ❌ `/api/chat/python` API route
- ❌ `chatCache.ts` утилита
- ❌ N8N агент и вся связанная инфраструктура

### Ноябрь 2024 - Удаление N8N

- ❌ N8N агент и все связанные файлы
- ❌ Debug панель
- ❌ agentType переключатель

## Преимущества текущей архитектуры

- ✅ **Безлимитная история** — нет ограничения на количество сообщений
- ✅ **Синхронизация** — история доступна на всех устройствах
- ✅ **Асинхронность** — frontend не ждёт ответа Python агента
- ✅ **Масштабируемость** — Python агент может обрабатывать долго
- ✅ **Надёжность** — если Python упадёт, сообщение сохранено в БД
- ✅ **Realtime** — мгновенное отображение ответов через WebSocket
- ✅ **Безопасность** — RLS политики изолируют данные пользователей

## Технические детали

### Безопасность
- JWT токен из Supabase для аутентификации
- RLS политики на уровне БД
- Изоляция данных по user_id и conversation_id

### Python Agent
- **URL:** `https://ai-bot.eneca.work`
- **Webhook endpoint:** `/webhook`
- Получает: `{ message_id, conversation_id, user_id, content, created_at }`
- Записывает ответ напрямую в БД через service role

### Realtime
- Подписка на `postgres_changes` для таблицы `chat_messages`
- Фильтр по `conversation_id`
- Автоматическое переподключение

## Debug

В консоли браузера доступны логи:
- `[Realtime] Creating subscription for conversation: ...`
- `[Realtime] Subscription status: SUBSCRIBED`
- `[Realtime] Received message: ...`
- `[sendMessage] Starting...`
- `[sendMessage] Insert success: ...`
- `[clearMessages] Messages deleted for conversation: ...`
