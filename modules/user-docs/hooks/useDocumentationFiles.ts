"use client"

import { useState, useEffect } from 'react'
import * as Sentry from "@sentry/nextjs"
import { DocumentationFile } from '../types'
import FlexSearch from 'flexsearch'

// Интерфейс для результатов поиска
interface SearchResult {
  file: DocumentationFile
  score: number
  excerpt?: string
}

// Новая структура дерева по основным модулям системы
const mockDocumentationStructure: DocumentationFile[] = [
  { name: 'Моя работа', path: 'my-work', type: 'folder', children: [
    { name: 'Главная страница', path: 'my-work/glavnaya-stranitsa.md', type: 'file' },
  ]},
  { name: 'Проекты', path: 'projects', type: 'folder', children: [
    { name: 'Проекты', path: 'projects/proekty.md', type: 'file' },
    { name: 'Декомпозиции', path: 'projects/dekompozicii.md', type: 'file' },
    { name: 'Задания', path: 'projects/zadaniya.md', type: 'file' },
    { name: 'Комментарии', path: 'projects/kommentarii.md', type: 'file' },
  ]},
  { name: 'Планирование', path: 'planirovanie', type: 'folder', children: [
    { name: 'Общая информация', path: 'planirovanie/planirovanie.md', type: 'file' },
  ]},
  { name: 'Заметки', path: 'notions', type: 'folder', children: [
    { name: 'Руководство по заметкам', path: 'notions/notions.md', type: 'file' },
  ]},
  { name: 'Уведомления', path: 'notifications', type: 'folder', children: [
    { name: 'Руководство по уведомлениям', path: 'notifications/notifications.md', type: 'file' },
    { name: 'Объявления', path: 'notifications/announcements.md', type: 'file' },
  ]},
  { name: 'Пользователи', path: 'users', type: 'folder', children: [
    { name: 'Общая информация', path: 'users/index.md', type: 'file' },
    { name: 'Администратор', path: 'users/administrator.md', type: 'file' },
    { name: 'Руководитель отдела', path: 'users/department-head.md', type: 'file' },
    { name: 'Руководитель проекта', path: 'users/project-manager.md', type: 'file' },
    { name: 'Руководитель команды', path: 'users/team-lead.md', type: 'file' },
    { name: 'Пользователь', path: 'users/user.md', type: 'file' },
  ]},
]

export function useDocumentationFiles() {
  const [files] = useState<DocumentationFile[]>(mockDocumentationStructure)
  const [selectedFile, setSelectedFile] = useState<string | null>('my-work/glavnaya-stranitsa.md')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['my-work', 'projects', 'notions', 'notifications', 'users']))
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // FlexSearch состояния
  const [searchIndex, setSearchIndex] = useState<any | null>(null)
  const [contentCache, setContentCache] = useState<Map<string, string>>(new Map())
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isIndexing, setIsIndexing] = useState(false)

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const selectFile = (path: string) => {
    setSelectedFile(path)
  }

  // Функция для получения всех файлов из дерева
  const getAllFiles = (files: DocumentationFile[]): DocumentationFile[] => {
    let allFiles: DocumentationFile[] = []
    
    for (const file of files) {
      if (file.type === 'file') {
        allFiles.push(file)
      } else if (file.type === 'folder' && file.children) {
        allFiles = allFiles.concat(getAllFiles(file.children))
      }
    }
    
    return allFiles
  }

  // Создание поискового индекса
  const buildSearchIndex = async () => {
    setIsIndexing(true)
    
    try {
      // Создаем FlexSearch индекс с поддержкой русского языка
      const index = new FlexSearch.Index({
        tokenize: "reverse",
        resolution: 3
      })

      const allFiles = getAllFiles(mockDocumentationStructure)
      const newContentCache = new Map<string, string>()

      // Загружаем и индексируем все файлы
      for (const file of allFiles) {
        try {
          const content = await getFileContent(file.path)
          newContentCache.set(file.path, content)
          
          // Индексируем название файла + содержимое
          const searchText = `${file.name} ${content}`
          index.add(file.path, searchText)
        } catch (error) {
          console.warn(`Не удалось загрузить файл ${file.path}:`, error)
          Sentry.captureException(error, { tags: { module: 'user-docs', hook: 'useDocumentationFiles', action: 'load_file', error_type: 'unexpected' }, extra: { path: file.path } })
        }
      }

      setContentCache(newContentCache)
      setSearchIndex(index)
    } catch (error) {
      console.error('Ошибка при создании поискового индекса:', error)
      Sentry.captureException(error, { tags: { module: 'user-docs', hook: 'useDocumentationFiles', action: 'build_index', error_type: 'unexpected' } })
    } finally {
      setIsIndexing(false)
    }
  }

  // Функция поиска с FlexSearch
  const performSearch = (query: string): SearchResult[] => {
    if (!searchIndex || !query.trim()) {
      return []
    }

    try {
      const results = searchIndex.search(query, {
        limit: 20,
        suggest: true
      })

      const allFiles = getAllFiles(mockDocumentationStructure)
      const fileMap = new Map(allFiles.map(file => [file.path, file]))

      return results.map((id: string) => {
        const file = fileMap.get(id)
        const content = contentCache.get(id) || ''
        
        // Создаем excerpt вокруг найденного слова
        const excerpt = createExcerpt(content, query)
        
        return {
          file: file!,
          score: 1, // FlexSearch не возвращает score в простом режиме
          excerpt
        }
      }).filter((result: any) => result.file)
    } catch (error) {
      console.error('Ошибка при поиске:', error)
      Sentry.captureException(error, { tags: { module: 'user-docs', hook: 'useDocumentationFiles', action: 'search', error_type: 'unexpected' } })
      return []
    }
  }

  // Создание excerpt с контекстом вокруг найденного слова
  const createExcerpt = (content: string, query: string): string => {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerContent.indexOf(lowerQuery)
    
    if (index === -1) return ''
    
    const start = Math.max(0, index - 100)
    const end = Math.min(content.length, index + query.length + 100)
    
    let excerpt = content.slice(start, end)
    if (start > 0) excerpt = '...' + excerpt
    if (end < content.length) excerpt = excerpt + '...'
    
    return excerpt
  }

  // Новая функция фильтрации с FlexSearch
  const filterFiles = (files: DocumentationFile[], query: string): DocumentationFile[] => {
    if (!query.trim()) {
      return files
    }

    // Используем результаты FlexSearch
    const searchResultPaths = new Set(searchResults.map(result => result.file.path))
    
    const filteredFiles: DocumentationFile[] = []
    
    for (const file of files) {
      if (file.type === 'file') {
        // Показываем файл если он найден в поиске
        if (searchResultPaths.has(file.path)) {
          filteredFiles.push(file)
        }
      } else if (file.type === 'folder' && file.children) {
        // Для папок рекурсивно фильтруем детей
        const filteredChildren = filterFiles(file.children, query)
        if (filteredChildren.length > 0) {
          filteredFiles.push({
            ...file,
            children: filteredChildren
          })
        }
      }
    }
    
    return filteredFiles
  }

  // Обработка поискового запроса
  useEffect(() => {
    if (searchQuery.trim() && searchIndex) {
      const results = performSearch(searchQuery)
      setSearchResults(results)
      
      // Автоматически выбираем первый найденный файл
      if (results.length > 0) {
        setSelectedFile(results[0].file.path)
      }
    } else {
      setSearchResults([])
    }
  }, [searchQuery, searchIndex])

  // Получаем отфильтрованные файлы
  const filteredFiles = filterFiles(files, searchQuery)

  // Создание индекса при монтировании
  useEffect(() => {
    buildSearchIndex()
  }, [])

  // Автоматически раскрываем папки при поиске
  const getExpandedFoldersForSearch = (files: DocumentationFile[]): Set<string> => {
    const expanded = new Set(expandedFolders)
    
    if (searchQuery.trim()) {
      const addExpandedFolders = (files: DocumentationFile[]) => {
        for (const file of files) {
          if (file.type === 'folder') {
            expanded.add(file.path)
            if (file.children) {
              addExpandedFolders(file.children)
            }
          }
        }
      }
      addExpandedFolders(filteredFiles)
    }
    
    return expanded
  }

  const currentExpandedFolders = getExpandedFoldersForSearch(filteredFiles)

  // Функция для получения контента файла
  const getFileContent = async (path: string): Promise<string> => {
    try {
      // Загружаем файл через API роут
      const response = await fetch(`/api/docs/${path}`)
      if (response.ok) {
        return await response.text()
      }
    } catch (error) {
      console.warn('Could not load file from API:', error)
      Sentry.captureException(error, { tags: { module: 'user-docs', hook: 'useDocumentationFiles', action: 'api_fetch', error_type: 'external_api_error' }, extra: { path } })
    }

    // Fallback контент для демонстрации
    const fallbackContent = {
      'getting-started.md': `# Начало работы с eneca.work

Добро пожаловать в **eneca.work** — современную платформу для управления проектами!

## 🚀 Быстрый старт

### 1. Вход в систему
- Откройте страницу входа
- Введите ваши учетные данные  
- Нажмите "Войти"

### 2. Основные возможности
- 📁 **Проекты** — управление проектами и задачами
- 📅 **Календарь** — планирование событий и встреч
- 📊 **Отчёты** — аналитика и отчетность

Выберите другие файлы из меню слева для изучения документации.`,

      'modules/projects.md': `# Модуль "Проекты"

Управление проектами в eneca.work.

## Создание проекта
1. Перейдите в раздел **Проекты**
2. Нажмите **"Создать проект"**
3. Заполните необходимые поля

## Структура проекта
- **Стадии** — основные этапы
- **Объекты** — конкретные результаты
- **Разделы** — детализация объектов`,

      'modules/calendar.md': `# Модуль "Календарь"

Планирование событий и управление временем.

## Типы событий
- Рабочие встречи
- Личные события  
- Корпоративные мероприятия

## Создание события
1. Кликните на нужную дату
2. Введите название
3. Заполните детали`,

      'api/overview.md': `# API Документация

Программный интерфейс eneca.work.

## Базовая информация
- **URL:** https://api.eneca.work/v1
- **Аутентификация:** JWT токены
- **Формат:** JSON

## Основные эндпоинты
- \`GET /projects\` — список проектов
- \`POST /projects\` — создать проект
- \`GET /users\` — список пользователей`,

      'faq.md': `# Часто задаваемые вопросы

## Забыл пароль
1. Нажмите "Забыли пароль?"
2. Введите email
3. Проверьте почту

## Как создать проект?
1. Перейдите в "Проекты"
2. Нажмите "Создать проект"
3. Заполните форму`
    }

    return fallbackContent[path as keyof typeof fallbackContent] || `# Документация

Файл: ${path}

Содержимое файла документации будет здесь.

Это демонстрационная версия модуля документации для eneca.work.`
  }

  return {
    files: filteredFiles,
    selectedFile,
    expandedFolders: currentExpandedFolders,
    toggleFolder,
    selectFile,
    getFileContent,
    searchQuery,
    setSearchQuery,
    searchResults,
    isIndexing
  }
}
