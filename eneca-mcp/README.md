# Eneca MCP Server v2.0.0

Model Context Protocol сервер для системы планирования проектов Eneca с поддержкой SDK 1.15.1 и Streamable HTTP транспорта.

## 🚀 Обзор

Этот MCP сервер предоставляет:
- **Resources** (Ресурсы): Доступ к данным проектов, задач, этапов
- **Prompts** (Промпты): Шаблоны для анализа проектов и планирования 
- **Tools** (Инструменты): Функции для работы с проектными данными
- **Dual Transport**: Поддержка как STDIO, так и HTTP транспорта

## 📋 Требования

- Node.js 18+
- TypeScript 4.5+
- База данных Supabase (для данных проектов)

## 🔧 Установка

```bash
# Установка зависимостей
npm install

# Сборка проекта
npm run build
```

## 🚀 Запуск

### STDIO транспорт (по умолчанию)
```bash
# Стандартный запуск для клиентов MCP
npm run start:stdio
# или
node build/index.js
```

### HTTP транспорт (для n8n, веб-клиентов)
```bash
# HTTP сервер на порту 8080
npm run start:http
# или
node build/index.js --transport=http
# или с кастомным портом
PORT=3000 node build/index.js --transport=http
```

## 🔗 Подключение

### Для n8n
```json
{
  "transport": "streamable-http",
  "url": "http://localhost:8080/mcp"
}
```

### Для Cursor IDE
```json
{
  "mcp.mcpServers": {
    "eneca": {
      "command": "node",
      "args": ["./eneca-mcp/build/index.js"],
      "env": {}
    }
  }
}
```

**Или через интерфейс Cursor:**
1. Откройте Settings (Ctrl+,)
2. Найдите "MCP Servers"  
3. Добавьте новый сервер:
   - Name: `eneca`
   - Command: `node`
   - Args: `["./eneca-mcp/build/index.js"]`
   - Working Directory: `./`

### Для Claude Desktop
```json
{
  "mcpServers": {
    "eneca": {
      "command": "node",
      "args": ["path/to/eneca-mcp/build/index.js"]
    }
  }
}
```

## 🧪 Тестирование

### MCP Inspector
```bash
# Запуск inspector для тестирования
npx @modelcontextprotocol/inspector
```

В inspector:
1. Выберите **"Streamable HTTP"** как транспорт
2. URL: `http://localhost:8080/mcp`
3. Нажмите **Connect**

### Ручное тестирование HTTP API
```bash
# Инициализация сессии
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {
        "roots": {"listChanged": true},
        "sampling": {}
      }
    },
    "id": 1
  }'
```

## 📖 Как работает MCP Streamable HTTP

### Архитектура
```
┌─────────────────┐    HTTP/SSE    ┌─────────────────┐
│   MCP Client    │◄──────────────►│   MCP Server    │
│ (n8n, Claude)   │                │ (Eneca MCP)     │
└─────────────────┘                └─────────────────┘
```

### Транспорты

#### 1. STDIO Transport
- **Для**: Локальных клиентов (Claude Desktop)
- **Протокол**: JSON-RPC через stdin/stdout
- **Сообщения**: Разделены переводами строк
- **Формат**: `{"jsonrpc":"2.0","method":"...","params":{...},"id":1}`

#### 2. Streamable HTTP Transport
- **Для**: Веб-клиентов, n8n, удаленных сервисов
- **Протокол**: HTTP POST/GET/DELETE на единый эндпоинт `/mcp`
- **Session Management**: Автоматическое управление сессиями
- **SSE Support**: Server-Sent Events для уведомлений

### Жизненный цикл Streamable HTTP

```
1. POST /mcp (initialize) → Response с Mcp-Session-Id
2. POST /mcp + Mcp-Session-Id → JSON-RPC запросы
3. GET /mcp + Mcp-Session-Id → SSE stream (уведомления)
4. DELETE /mcp + Mcp-Session-Id → Закрытие сессии
```

### Формат сообщений

#### Initialize Request
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {"listChanged": true},
      "sampling": {}
    }
  },
  "id": 1
}
```

#### Tool Call Request
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_project_info",
    "arguments": {
      "projectId": "123"
    }
  },
  "id": 2
}
```

#### Resource Request
```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": {
    "uri": "eneca://project/123"
  },
  "id": 3
}
```

### Чанки и Streaming

#### Обычный JSON Response
```json
{
  "jsonrpc": "2.0",
  "result": {"content": "..."},
  "id": 1
}
```

#### SSE Stream (для больших данных)
```
Content-Type: text/event-stream

data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progressToken":"abc","progress":0.5}}

data: {"jsonrpc":"2.0","result":{"content":"..."},"id":1}
```

## 🛠️ Отладка

### Запуск с отладкой
```bash
# Включение детального логирования
DEBUG=mcp:* node build/index.js --transport=http

# Просмотр активных сессий
curl http://localhost:8080/health
```

### Типичные проблемы

1. **Сессия не создается**
   - Проверьте, что первый запрос - это `initialize`
   - Убедитесь в правильности headers

2. **CORS ошибки**
   - Проверьте настройки CORS в `http-server.ts`
   - Добавьте нужные домены в `allowedOrigins`

3. **Сессия разрывается**
   - Проверьте session ID в headers
   - Убедитесь, что сессия не истекла

## 📝 Доступные Resources

- `eneca://projects` - Список всех проектов
- `eneca://project/{id}` - Детали проекта
- `eneca://project/{id}/stages` - Этапы проекта
- `eneca://project/{id}/objects` - Объекты проекта

## 🔧 Доступные Tools

- `list_projects` - Получить список проектов
- `get_project_info` - Получить информацию о проекте
- `list_stages` - Получить этапы проекта
- `get_stage_info` - Получить информацию об этапе

## 📋 Доступные Prompts

- `analyze_project` - Анализ проекта
- `plan_tasks` - Планирование задач
- `generate_report` - Генерация отчета

## 🌐 Интеграция с n8n

1. **Установка HTTP Node**
2. **Конфигурация**:
   ```json
   {
     "method": "POST",
     "url": "http://localhost:8080/mcp",
     "headers": {
       "Content-Type": "application/json",
       "Accept": "application/json, text/event-stream"
     }
   }
   ```

## 📊 Мониторинг

### Health Check
```bash
curl http://localhost:8080/health
```

### Metrics
```bash
curl http://localhost:8080/metrics
```

## 🔒 Безопасность

- **CORS**: Настраивается в `http-server.ts`
- **Session Management**: Автоматическое управление и cleanup
- **Input Validation**: Проверка всех входящих данных
- **Rate Limiting**: Можно добавить middleware

## 📚 Дополнительные ресурсы

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [n8n MCP Integration](https://docs.n8n.io/integrations/mcp/)

## 🔄 Версии

- **v2.0.0**: SDK 1.15.1, Streamable HTTP, Session Management
- **v1.0.0**: Базовая версия с SDK 0.6.0
