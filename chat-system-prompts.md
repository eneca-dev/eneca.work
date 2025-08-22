# ГОТОВЫЕ ПРОМПТЫ ДЛЯ СИСТЕМЫ ЧАТА ENECA

## 🎯 АРХИТЕКТУРА СИСТЕМЫ

```
Пользователь → Основной GPT (порт 5000) → SQL-агент (порт 5001) → Supabase → Ответ пользователю
```

---

## 🚀 ПРОМПТ #1: ОСНОВНОЙ ЧАТ-СЕРВЕР (ПОРТ 5000)

```
ОБНОВИ ОСНОВНОЙ ЧАТ-СЕРВЕР: ДОБАВЬ ИНТЕГРАЦИЮ С SQL-АГЕНТОМ

ЗАДАЧА: Модифицировать существующий сервер для работы с SQL-агентом на порту 5001

ПОЛНЫЙ КОД APP.JS:

```javascript
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { OpenAI } = require('openai')

const app = express()
app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json())

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Функция для определения нужности данных из БД
function needsDatabaseInfo(message) {
  const dbKeywords = [
    'проект', 'задач', 'команд', 'коллег', 'руководител', 'отдел', 
    'статистик', 'прогресс', 'участник', 'контакт', 'сотрудник',
    'мои', 'наш', 'кто', 'сколько', 'когда', 'где', 'статус',
    'профиль', 'обо мне', 'информаци', 'данные'
  ]
  
  return dbKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  )
}

// Функция вызова SQL-агента
async function callSqlAgent(userContext, question) {
  try {
    console.log('🔍 Отправляем запрос SQL-агенту...')
    
    const response = await fetch('http://localhost:5001/api/sql-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userContext,
        question,
        requestId: Date.now()
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SQL Agent error ${response.status}: ${errorText}`)
    }
    
    const result = await response.json()
    console.log('✅ SQL-агент ответил:', result.summary)
    
    return {
      success: true,
      type: result.type,
      data: result.data,
      summary: result.summary
    }
  } catch (error) {
    console.error('❌ Ошибка SQL-агента:', error)
    return { 
      success: false, 
      error: error.message 
    }
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, userContext, systemRules } = req.body
    
    console.log('💬 Основной чат получил запрос:', {
      user: userContext.store.name,
      message: message.substring(0, 100) + '...',
      needsDB: needsDatabaseInfo(message)
    })
    
    let enhancedSystemRules = systemRules
    let contextData = null
    
    // Проверяем нужны ли данные из БД
    if (needsDatabaseInfo(message)) {
      console.log('🔍 Определена необходимость данных из БД')
      
      const sqlResult = await callSqlAgent(userContext, message)
      
      if (sqlResult.success) {
        contextData = sqlResult.data
        
        // Добавляем данные в системные правила
        enhancedSystemRules += `

═══════════════════════════════════════
АКТУАЛЬНЫЕ ДАННЫЕ ИЗ БАЗЫ ДАННЫХ
═══════════════════════════════════════

ТИП ДАННЫХ: ${sqlResult.type.toUpperCase()}
КРАТКОЕ ОПИСАНИЕ: ${sqlResult.summary}

ПОЛНЫЕ ДАННЫЕ:
${JSON.stringify(contextData, null, 2)}

═══════════════════════════════════════
ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ ДАННЫХ:
═══════════════════════════════════════

1. Используй ТОЛЬКО эти актуальные данные для ответа
2. Отвечай конкретно и точно на основе полученной информации
3. Если данных недостаточно - честно скажи об этом
4. Структурируй ответ понятно и логично
5. Обращайся к пользователю по имени
6. Давай практические советы и рекомендации

`
        console.log('✅ Данные добавлены в контекст:', sqlResult.summary)
      } else {
        console.log('❌ Не удалось получить данные:', sqlResult.error)
        enhancedSystemRules += `

⚠️ ВНИМАНИЕ: Не удалось получить актуальные данные из базы данных.
Причина: ${sqlResult.error}

Сообщи пользователю что произошла временная ошибка при получении данных,
но постарайся помочь на основе общих знаний о системе управления проектами.
`
      }
    }
    
    // Основной запрос к GPT
    console.log('🤖 Отправляем запрос к GPT-4o-mini...')
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: enhancedSystemRules },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
    
    const response = completion.choices[0].message.content
    
    // Логируем результат
    console.log('📤 Ответ сформирован:', {
      hasContextData: !!contextData,
      responseLength: response.length,
      user: userContext.store.name
    })
    
    res.json({ message: response })
    
  } catch (error) {
    console.error('💥 Критическая ошибка основного чата:', error)
    res.status(500).json({ 
      message: 'Извините, произошла ошибка при обработке запроса. Попробуйте еще раз.',
      error: error.message 
    })
  }
})

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'main-chat',
    timestamp: new Date().toISOString(),
    sqlAgent: 'http://localhost:5001'
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log('🚀 Основной чат-сервер запущен на порту', PORT)
  console.log('🔗 Ожидает SQL-агента на порту 5001')
  console.log('🌐 Принимает запросы от фронтенда на localhost:3000')
})
```

ТРЕБОВАНИЯ К .ENV:
```
OPENAI_API_KEY=твой_openai_ключ
PORT=5000
```

ТРЕБОВАНИЯ К PACKAGE.JSON:
```json
{
  "name": "eneca-main-chat",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

СОЗДАЙ ЭТОТ СЕРВЕР И УБЕДИСЬ ЧТО ОН РАБОТАЕТ!
```

---

## 🗄️ ПРОМПТ #2: SQL-АГЕНТ СЕРВЕР (ПОРТ 5001)

```
СОЗДАЙ НОВЫЙ SQL-АГЕНТ СЕРВЕР С НУЛЯ

ЗАДАЧА: Создать отдельный сервер для работы с базой данных через Supabase SDK

СТРУКТУРА ПРОЕКТА:
```
sql-agent/
├── .env
├── package.json
└── src/
    ├── app.js
    └── database.js
```

PACKAGE.JSON:
```json
{
  "name": "eneca-sql-agent",
  "version": "1.0.0",
  "description": "SQL Agent for Eneca Chat System",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "@supabase/supabase-js": "^2.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

.ENV:
```
SUPABASE_URL=твой_supabase_url
SUPABASE_ANON_KEY=твой_supabase_anon_key
PORT=5001
```

SRC/DATABASE.JS:
```javascript
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// Класс для работы с базой данных
class DatabaseService {
  
  // Получить полный профиль пользователя
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          employee_profiles(
            department_id,
            team_id,
            position_id,
            role_id,
            work_format,
            salary,
            is_hourly,
            employment_rate,
            is_active,
            departments(id, name, description),
            teams(id, name, description),
            positions(id, title, description),
            roles(id, name, display_name, permissions)
          )
        `)
        .eq('id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data || null
    } catch (error) {
      console.error('Ошибка получения профиля:', error)
      throw error
    }
  }

  // Получить проекты пользователя
  async getUserProjects(userId) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          departments(name, description),
          profiles!projects_owner_id_fkey(first_name, last_name, full_name),
          project_members(
            role,
            joined_at,
            profiles(first_name, last_name, full_name)
          )
        `)
        .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка получения проектов:', error)
      throw error
    }
  }

  // Получить задачи пользователя
  async getUserTasks(userId, status = null) {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          projects(id, name, status),
          profiles!tasks_assignee_id_fkey(first_name, last_name, full_name),
          profiles!tasks_reporter_id_fkey(first_name, last_name, full_name)
        `)
        .eq('assignee_id', userId)
        .order('due_date', { ascending: true })
        .limit(50)
      
      if (status) {
        query = query.eq('status', status)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка получения задач:', error)
      throw error
    }
  }

  // Получить команду пользователя
  async getUserTeam(userId) {
    try {
      // Сначала получаем team_id пользователя
      const { data: userProfile, error: userError } = await supabase
        .from('employee_profiles')
        .select('team_id, teams(id, name, description)')
        .eq('id', userId)
        .single()
      
      if (userError || !userProfile?.team_id) {
        return { team: null, members: [] }
      }

      // Затем получаем всех участников команды
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select(`
          *,
          employee_profiles(
            work_format,
            is_active,
            positions(title),
            roles(display_name)
          )
        `)
        .eq('employee_profiles.team_id', userProfile.team_id)
        .eq('employee_profiles.is_active', true)
      
      if (membersError) throw membersError
      
      return {
        team: userProfile.teams,
        members: members || []
      }
    } catch (error) {
      console.error('Ошибка получения команды:', error)
      throw error
    }
  }

  // Получить статистику проектов
  async getProjectStats(userId) {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('status, priority, progress, created_at')
        .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
      
      if (error) throw error
      
      const stats = {
        total: projects.length,
        byStatus: {},
        byPriority: {},
        avgProgress: 0,
        recent: projects.filter(p => {
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return new Date(p.created_at) > weekAgo
        }).length
      }
      
      projects.forEach(project => {
        stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1
        stats.byPriority[project.priority] = (stats.byPriority[project.priority] || 0) + 1
        stats.avgProgress += project.progress || 0
      })
      
      stats.avgProgress = projects.length > 0 ? Math.round(stats.avgProgress / projects.length) : 0
      
      return stats
    } catch (error) {
      console.error('Ошибка получения статистики проектов:', error)
      throw error
    }
  }

  // Получить статистику задач
  async getTaskStats(userId) {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status, priority, due_date, created_at, completed_at')
        .eq('assignee_id', userId)
      
      if (error) throw error
      
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'done').length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length,
        thisWeek: tasks.filter(t => new Date(t.created_at) > weekAgo).length,
        byStatus: {},
        byPriority: {}
      }
      
      tasks.forEach(task => {
        stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1
        stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1
      })
      
      return stats
    } catch (error) {
      console.error('Ошибка получения статистики задач:', error)
      throw error
    }
  }

  // Получить отделы и структуру
  async getDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          profiles!departments_head_id_fkey(first_name, last_name, full_name),
          teams(id, name, description, lead_id, profiles!teams_lead_id_fkey(first_name, last_name))
        `)
        .order('name')
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка получения отделов:', error)
      throw error
    }
  }

  // Поиск по проектам
  async searchProjects(userId, searchTerm) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          departments(name),
          profiles!projects_owner_id_fkey(first_name, last_name, full_name)
        `)
        .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
        .ilike('name', `%${searchTerm}%`)
        .limit(10)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка поиска проектов:', error)
      throw error
    }
  }
}

// Главная функция для обработки запросов
async function processUserQuery(userContext, question) {
  const db = new DatabaseService()
  const userId = userContext.jwt.id
  const questionLower = question.toLowerCase()

  console.log('🔍 Обрабатываем запрос:', {
    userId: userId.substring(0, 8) + '...',
    question: question.substring(0, 50) + '...'
  })

  try {
    // Определяем тип запроса и вызываем соответствующую функцию
    if (questionLower.includes('мои проект') || questionLower.includes('проект')) {
      console.log('📋 Получаем проекты пользователя...')
      const projects = await db.getUserProjects(userId)
      return {
        type: 'projects',
        data: projects,
        summary: `Найдено ${projects.length} проектов пользователя`
      }
    }
    
    if (questionLower.includes('мои задач') || questionLower.includes('задач')) {
      console.log('✅ Получаем задачи пользователя...')
      const tasks = await db.getUserTasks(userId)
      return {
        type: 'tasks', 
        data: tasks,
        summary: `Найдено ${tasks.length} задач пользователя`
      }
    }
    
    if (questionLower.includes('команд') || questionLower.includes('коллег')) {
      console.log('👥 Получаем команду пользователя...')
      const teamData = await db.getUserTeam(userId)
      return {
        type: 'team',
        data: teamData,
        summary: `Команда: ${teamData.team?.name || 'не назначена'}, участников: ${teamData.members.length}`
      }
    }
    
    if (questionLower.includes('статистик') || questionLower.includes('сколько')) {
      console.log('📊 Получаем статистику...')
      const [projectStats, taskStats] = await Promise.all([
        db.getProjectStats(userId),
        db.getTaskStats(userId)
      ])
      return {
        type: 'statistics',
        data: { projects: projectStats, tasks: taskStats },
        summary: `Статистика: ${projectStats.total} проектов, ${taskStats.total} задач, ${taskStats.overdue} просрочено`
      }
    }
    
    if (questionLower.includes('отдел') || questionLower.includes('структур')) {
      console.log('🏢 Получаем структуру отделов...')
      const departments = await db.getDepartments()
      return {
        type: 'departments',
        data: departments,
        summary: `Найдено ${departments.length} отделов в организации`
      }
    }
    
    if (questionLower.includes('профиль') || questionLower.includes('обо мне')) {
      console.log('👤 Получаем профиль пользователя...')
      const profile = await db.getUserProfile(userId)
      return {
        type: 'profile',
        data: profile,
        summary: 'Полная информация о профиле пользователя'
      }
    }
    
    // Поиск по ключевым словам
    const searchMatch = questionLower.match(/найди|поиск|ищи (.+)/)
    if (searchMatch) {
      console.log('🔎 Выполняем поиск...')
      const searchTerm = searchMatch[1]
      const projects = await db.searchProjects(userId, searchTerm)
      return {
        type: 'search',
        data: projects,
        summary: `Найдено ${projects.length} результатов по запросу "${searchTerm}"`
      }
    }
    
    // Если не определили конкретный тип - возвращаем общую информацию
    console.log('ℹ️ Возвращаем общую информацию...')
    const profile = await db.getUserProfile(userId)
    return {
      type: 'general',
      data: profile,
      summary: 'Базовая информация о пользователе'
    }
    
  } catch (error) {
    console.error('💥 Ошибка выполнения запроса:', error)
    throw error
  }
}

module.exports = { processUserQuery, DatabaseService }
```

SRC/APP.JS:
```javascript
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { processUserQuery } = require('./database')

const app = express()
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5000'], 
  credentials: true 
}))
app.use(express.json())

app.post('/api/sql-query', async (req, res) => {
  const startTime = Date.now()
  
  try {
    const { userContext, question, requestId } = req.body
    
    // Валидация входных данных
    if (!userContext || !question) {
      return res.status(400).json({
        error: 'Отсутствуют обязательные параметры: userContext, question',
        requestId
      })
    }

    if (!userContext.jwt?.id) {
      return res.status(400).json({
        error: 'Отсутствует ID пользователя в JWT',
        requestId
      })
    }
    
    console.log(`🔍 SQL-агент получил запрос ${requestId}:`, {
      user: userContext.store?.name || 'Неизвестный',
      userId: userContext.jwt.id.substring(0, 8) + '...',
      question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    })
    
    // Обрабатываем запрос
    const result = await processUserQuery(userContext, question)
    
    const processingTime = Date.now() - startTime
    
    console.log(`✅ Запрос ${requestId} обработан за ${processingTime}мс:`, {
      type: result.type,
      summary: result.summary,
      dataSize: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0)
    })
    
    res.json({
      type: result.type,
      data: result.data,
      summary: result.summary,
      requestId,
      processingTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    
    console.error(`❌ Ошибка обработки запроса ${req.body?.requestId}:`, {
      error: error.message,
      stack: error.stack,
      processingTime,
      timestamp: new Date().toISOString()
    })
    
    res.status(500).json({
      error: 'Ошибка при получении данных из базы',
      details: error.message,
      requestId: req.body?.requestId,
      processingTime
    })
  }
})

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'sql-agent',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})

// Информация о поддерживаемых запросах
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Eneca SQL Agent',
    supportedQueries: [
      'Мои проекты',
      'Мои задачи', 
      'Моя команда',
      'Статистика',
      'Отделы и структура',
      'Мой профиль',
      'Поиск проектов'
    ],
    endpoints: {
      'POST /api/sql-query': 'Основной endpoint для обработки запросов',
      'GET /health': 'Проверка состояния сервиса',
      'GET /api/info': 'Информация о сервисе'
    }
  })
})

const PORT = process.env.PORT || 5001
app.listen(PORT, () => {
  console.log('🗄️  SQL-агент успешно запущен!')
  console.log('📍 Порт:', PORT)
  console.log('🔗 Основной чат:', 'http://localhost:5000')
  console.log('🌐 Фронтенд:', 'http://localhost:3000')
  console.log('📊 Healthcheck:', `http://localhost:${PORT}/health`)
  console.log('ℹ️  Информация:', `http://localhost:${PORT}/api/info`)
  console.log('✅ Готов к обработке запросов!')
})
```

ИНСТРУКЦИИ ПО ЗАПУСКУ:

1. Создай папку sql-agent
2. Скопируй все файлы
3. Выполни: npm install
4. Настрой .env с данными Supabase
5. Запусти: npm start
6. Проверь: http://localhost:5001/health

СОЗДАЙ ЭТОТ СЕРВЕР ТОЧНО ПО ИНСТРУКЦИИ!
```

---

## ✅ ФИНАЛЬНАЯ ПРОВЕРКА

После создания обоих серверов проверь:

1. **Основной чат (5000)**: `http://localhost:5000/health`
2. **SQL-агент (5001)**: `http://localhost:5001/health`
3. **Фронтенд (3000)**: Отправь сообщение "Мои проекты"

Система должна работать по схеме:
```
Фронтенд → Основной чат → SQL-агент → Supabase → Ответ пользователю
```

## 🎯 ПОДДЕРЖИВАЕМЫЕ ЗАПРОСЫ

- "Мои проекты" / "Какие у меня проекты"
- "Мои задачи" / "Что мне нужно сделать"
- "Моя команда" / "Кто работает со мной"
- "Статистика" / "Сколько у меня задач"
- "Отделы" / "Структура компании"
- "Мой профиль" / "Информация обо мне"

СИСТЕМА ГОТОВА К РАБОТЕ! 