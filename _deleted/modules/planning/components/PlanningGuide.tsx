"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  Calendar, 
  Users, 
  Building, 
  Filter, 
  Plus, 
  Eye, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Target,
  BarChart3,
  Layers,
  Settings,
  CheckCircle,
  AlertCircle,
  Info,
  User,
  FolderOpen,
  Play,
  Pause,
  Archive
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlanningGuideProps {
  onClose?: () => void
}

export function PlanningGuide({ onClose }: PlanningGuideProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [openFAQ, setOpenFAQ] = useState<string | null>(null)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Заголовок */}
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          📋 Система планирования eneca.work
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Полное руководство по планированию загрузок сотрудников
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">🏗️ Как работает</TabsTrigger>
          <TabsTrigger value="loadings">⚡ Загрузки</TabsTrigger>
          <TabsTrigger value="filters">🔍 Фильтры</TabsTrigger>
          <TabsTrigger value="faq">❓ FAQ</TabsTrigger>
        </TabsList>

        {/* Как работает система планирования */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-500" />
                Иерархия системы
              </CardTitle>
              <CardDescription>
                Система планирования построена на 4-уровневой иерархии
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Визуальная схема иерархии */}
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg">
                  <div className="space-y-4">
                    {/* Уровень 1: Руководитель проекта */}
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span className="font-semibold text-purple-700 dark:text-purple-300">Руководитель проекта</span>
                      <Badge variant="outline">Уровень 1</Badge>
                    </div>
                    
                    {/* Уровень 2: Проект */}
                    <div className="ml-6 flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">Проект</span>
                      <Badge variant="outline">Уровень 2</Badge>
                    </div>
                    
                    {/* Уровень 3: Стадия */}
                    <div className="ml-12 flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-semibold text-green-700 dark:text-green-300">Стадия</span>
                      <Badge variant="outline">Уровень 3</Badge>
                    </div>
                    
                    {/* Уровень 4: Объект */}
                    <div className="ml-18 flex items-center gap-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="font-semibold text-orange-700 dark:text-orange-300">Объект</span>
                      <Badge variant="outline">Уровень 4</Badge>
                    </div>
                    
                    {/* Уровень 5: Раздел */}
                    <div className="ml-24 flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="font-semibold text-red-700 dark:text-red-300">Раздел</span>
                      <Badge variant="outline">Уровень 5</Badge>
                      <span className="text-sm text-slate-500">← Здесь создаются загрузки</span>
                    </div>
                  </div>
                </div>

                {/* Описание уровней */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-purple-200 dark:border-purple-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Руководитель проекта</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Ответственный за проект, планирует ресурсы и контролирует выполнение
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Проект</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Крупная задача или заказ клиента
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Стадия</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Этап выполнения проекта (проектирование, согласование, реализация)
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-200 dark:border-orange-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Объект</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Конкретный объект или часть проекта
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline интерфейс */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-500" />
                Timeline интерфейс
              </CardTitle>
              <CardDescription>
                Основной экран для работы с планированием
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Мокап Timeline */}
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border-2 border-dashed border-slate-300 relative">
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                      Интерактивный пример
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {/* Заголовок таймлайна */}
                    <div className="flex items-center justify-between bg-white dark:bg-slate-700 p-2 rounded shadow-sm">
                      <span className="text-sm font-medium">Разделы и загрузки</span>
                      <div className="flex gap-1">
                        {Array.from({length: 7}, (_, i) => (
                          <div key={i} className="w-8 h-6 bg-slate-200 dark:bg-slate-600 rounded text-xs flex items-center justify-center font-medium">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Подпись к заголовку */}
                    <div className="text-xs text-slate-500 px-2">
                      ↑ Дни месяца отображаются в заголовке Timeline
                    </div>
                    
                    {/* Пример раздела */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-700 p-2 rounded shadow-sm border border-slate-200 dark:border-slate-600">
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                      <span className="text-sm">📋 Раздел: Проектирование системы</span>
                      <Badge variant="outline" className="text-xs ml-2">
                        3 загрузки
                      </Badge>
                      <div className="flex gap-1 ml-auto">
                        <div className="w-8 h-4 bg-blue-200 rounded" title="Частичная загрузка"></div>
                        <div className="w-8 h-4 bg-blue-300 rounded" title="Средняя загрузка"></div>
                        <div className="w-8 h-4 bg-blue-400 rounded" title="Высокая загрузка"></div>
                      </div>
                    </div>
                    
                    {/* Подпись к разделу */}
                    <div className="text-xs text-slate-500 px-2">
                      ↑ Клик на стрелку раскрывает/скрывает загрузки раздела
                    </div>
                    
                    {/* Пример загрузки */}
                    <div className="ml-6 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-500">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">И</div>
                      <span className="text-sm font-medium">Иван Петров</span>
                      <Badge variant="secondary" className="text-xs">0.5</Badge>
                      <span className="text-xs text-slate-500">50% времени</span>
                      <div className="flex gap-1 ml-auto">
                        <div className="w-8 h-4 bg-blue-500 rounded" title="Активная загрузка"></div>
                        <div className="w-8 h-4 bg-blue-500 rounded" title="Активная загрузка"></div>
                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-600 rounded" title="Нет загрузки"></div>
                      </div>
                    </div>
                    
                    {/* Подпись к загрузке */}
                    <div className="text-xs text-slate-500 px-2 ml-6">
                      ↑ Цветные блоки показывают период загрузки сотрудника
                    </div>
                  </div>
                </div>

                {/* Объяснение элементов */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <ChevronDown className="h-5 w-5 text-slate-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Раскрытие разделов</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Клик на стрелку показывает/скрывает загрузки раздела
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded mt-0.5"></div>
                    <div>
                      <p className="font-medium text-sm">Загрузка сотрудника</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Цветной блок показывает загрузку в конкретные дни
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded mt-0.5">(0.5)</span>
                    <div>
                      <p className="font-medium text-sm">Коэффициент загрузки</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        0.5 = 50% рабочего времени, 1.0 = 100%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Что такое загрузка */}
        <TabsContent value="loadings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Что такое загрузка?
              </CardTitle>
              <CardDescription>
                Загрузка — это назначение сотрудника на работу в конкретном разделе проекта
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Структура загрузки */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Из чего состоит загрузка:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Ответственный:</span> Иван Петров
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Период:</span> 01.03.2024 - 15.03.2024
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Загрузка:</span> 0.75 (75%)
                      </div>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Раздел:</span> Проектирование
                      </div>
                    </div>
                  </div>
                </div>

                {/* Коэффициенты загрузки */}
                <div>
                  <h3 className="font-semibold mb-2">Коэффициенты загрузки:</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Коэффициент показывает, какую долю рабочего дня сотрудник тратит на задачу. 
                    Полный рабочий день = 8 часов = коэффициент 1.0
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-green-200 dark:border-green-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 mb-2">0.25</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">25% времени</div>
                        <div className="text-xs text-slate-500">2 часа в день</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-yellow-200 dark:border-yellow-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600 mb-2">0.5</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">50% времени</div>
                        <div className="text-xs text-slate-500">4 часа в день</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600 mb-2">0.75</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">75% времени</div>
                        <div className="text-xs text-slate-500">6 часов в день</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-red-200 dark:border-red-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-600 mb-2">1.0</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">100% времени</div>
                        <div className="text-xs text-slate-500">8 часов в день</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Создание загрузки */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Plus className="h-5 w-5 text-green-500" />
                      Как создать загрузку
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                        <div>
                          <p className="font-medium">Найдите нужный раздел в Timeline</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Используйте фильтры для быстрого поиска</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                        <div>
                          <p className="font-medium">Нажмите кнопку "+" рядом с разделом</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Откроется модальное окно создания загрузки</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                        <div>
                          <p className="font-medium">Заполните данные загрузки</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Выберите сотрудника, период и коэффициент загрузки</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                        <div>
                          <p className="font-medium">Сохраните загрузку</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Загрузка сразу появится в Timeline</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Статусы загрузок */}
                <div>
                  <h3 className="font-semibold mb-4">Статусы загрузок:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-green-200 dark:border-green-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Play className="h-4 w-4 text-green-500" />
                          <span className="font-medium text-green-700 dark:text-green-300">Активная</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Загрузка в работе, отображается в Timeline
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-yellow-200 dark:border-yellow-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Pause className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium text-yellow-700 dark:text-yellow-300">Приостановлена</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Временно неактивна, можно возобновить
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Archive className="h-4 w-4 text-slate-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">Архивная</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Завершенная загрузка, хранится в архиве
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Как работают фильтры */}
        <TabsContent value="filters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-purple-500" />
                Система фильтрации
              </CardTitle>
              <CardDescription>
                Фильтры помогают найти нужные разделы и загрузки
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Два ряда фильтров */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Два ряда фильтров:</h3>
                  
                  {/* Первый ряд */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-medium mb-3 text-blue-700 dark:text-blue-300">
                      🏗️ Первый ряд — Структура проектов
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-purple-300">Руководитель проекта</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400 my-auto" />
                      <Badge variant="outline" className="border-blue-300">Проект</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400 my-auto" />
                      <Badge variant="outline" className="border-green-300">Стадия</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400 my-auto" />
                      <Badge variant="outline" className="border-orange-300">Объект</Badge>
                    </div>
                  </div>
                  
                  {/* Второй ряд */}
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="font-medium mb-3 text-green-700 dark:text-green-300">
                      👥 Второй ряд — Организационная структура
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-teal-300">Отдел</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400 my-auto" />
                      <Badge variant="outline" className="border-cyan-300">Команда</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400 my-auto" />
                      <Badge variant="outline" className="border-indigo-300">Сотрудник</Badge>
                    </div>
                  </div>
                </div>

                {/* Примеры использования */}
                <div>
                  <h3 className="font-semibold mb-4">Примеры использования фильтров:</h3>
                  <div className="space-y-4">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="font-medium mb-2">🎯 Задача: Найти все разделы проекта "Офисный центр"</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <strong>Решение:</strong> Выберите проект "Офисный центр" в первом ряду фильтров
                        </div>
                        <div className="flex gap-2">
                          <Badge className="bg-blue-100 text-blue-800">Проект: Офисный центр</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="font-medium mb-2">👤 Задача: Посмотреть загрузки Ивана Петрова</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <strong>Решение:</strong> Выберите "Иван Петров" во втором ряду фильтров
                        </div>
                        <div className="flex gap-2">
                          <Badge className="bg-green-100 text-green-800">Сотрудник: Иван Петров</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="font-medium mb-2">🏢 Задача: Найти все разделы отдела разработки на стадии проектирования</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <strong>Решение:</strong> Комбинируйте фильтры из обоих рядов
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge className="bg-green-100 text-green-800">Стадия: Проектирование</Badge>
                          <Badge className="bg-teal-100 text-teal-800">Отдел: Разработка</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Сброс фильтров */}
                <Card className="bg-orange-50 dark:bg-orange-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Сброс фильтров</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Чтобы сбросить все фильтры и показать все разделы, нажмите кнопку "Сбросить фильтры"
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Частые вопросы
              </CardTitle>
              <CardDescription>
                Ответы на самые популярные вопросы о системе планирования
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* FAQ Item 1 */}
                <Collapsible open={openFAQ === "load-calc"} onOpenChange={() => setOpenFAQ(openFAQ === "load-calc" ? null : "load-calc")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span className="font-medium text-left">Как рассчитывается коэффициент загрузки?</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openFAQ === "load-calc" && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-3">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Коэффициент загрузки показывает, какую долю рабочего времени сотрудник тратит на задачу:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <strong>0.25</strong> — 25% времени (2 часа из 8-часового дня)
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <strong>0.5</strong> — 50% времени (4 часа из 8-часового дня)
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <strong>1.0</strong> — 100% времени (полный рабочий день)
                        </li>
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* FAQ Item 2 */}
                <Collapsible open={openFAQ === "no-sections"} onOpenChange={() => setOpenFAQ(openFAQ === "no-sections" ? null : "no-sections")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span className="font-medium text-left">Почему не отображаются разделы?</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openFAQ === "no-sections" && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-3">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Возможные причины:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <div>
                            <strong>Активные фильтры:</strong> Проверьте настройки фильтров, возможно они слишком ограничивающие
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <div>
                            <strong>Права доступа:</strong> У вас может не быть прав на просмотр определенных проектов
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <div>
                            <strong>Разделы скрыты:</strong> Нажмите кнопку "Показать разделы" в заголовке Timeline
                          </div>
                        </li>
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* FAQ Item 3 */}
                <Collapsible open={openFAQ === "edit-loading"} onOpenChange={() => setOpenFAQ(openFAQ === "edit-loading" ? null : "edit-loading")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span className="font-medium text-left">Как изменить или удалить загрузку?</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openFAQ === "edit-loading" && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-3">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Для работы с существующими загрузками:
                      </p>
                      <ol className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                          <div>Кликните на загрузку сотрудника в Timeline</div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                          <div>Откроется контекстное меню с действиями</div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                          <div>Выберите нужное действие: "Редактировать", "Архивировать" или "Удалить"</div>
                        </li>
                      </ol>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* FAQ Item 4 */}
                <Collapsible open={openFAQ === "timeline-navigation"} onOpenChange={() => setOpenFAQ(openFAQ === "timeline-navigation" ? null : "timeline-navigation")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span className="font-medium text-left">Как переключаться между периодами в Timeline?</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openFAQ === "timeline-navigation" && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-3">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Для навигации по времени используйте:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <strong>Кнопки "←" и "→"</strong> — перемещение на неделю назад/вперед
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <strong>Кнопка "Сегодня"</strong> — быстрый переход к текущему периоду
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <strong>Горизонтальный скролл</strong> — прокрутка Timeline мышью
                        </li>
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* FAQ Item 5 */}
                <Collapsible open={openFAQ === "overload"} onOpenChange={() => setOpenFAQ(openFAQ === "overload" ? null : "overload")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span className="font-medium text-left">Что делать, если сотрудник перегружен?</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openFAQ === "overload" && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-3">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Система автоматически показывает перегрузку красным цветом. Варианты решения:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <strong>Уменьшить коэффициент</strong> загрузки в одной из задач
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <strong>Перенести сроки</strong> одной из загрузок
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <strong>Назначить другого сотрудника</strong> на одну из задач
                        </li>
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>

          {/* Контакты поддержки */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Нужна помощь?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Если у вас остались вопросы или нужна дополнительная помощь:
              </p>
              <div className="flex gap-4">
                <Button variant="outline" size="sm">
                  📧 Написать в поддержку
                </Button>
                <Button variant="outline" size="sm">
                  📱 Обратиться к администратору
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Кнопка закрытия */}
      {onClose && (
        <div className="flex justify-center pt-4">
          <Button onClick={onClose} variant="outline">
            Закрыть руководство
          </Button>
        </div>
      )}
    </div>
  )
}