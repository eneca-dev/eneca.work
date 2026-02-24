"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Check, ChevronRight, Plus, Search, Settings, Star, Trash2, User } from "lucide-react"

export default function DesignTestPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="page-title">Design System</h1>
          <p className="text-muted-foreground">Обзор стилей и компонентов eneca.work</p>
        </div>

        <Separator />

        {/* Colors */}
        <section className="space-y-6">
          <h2 className="section-title">Цветовая палитра</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Primary */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-primary flex items-end p-2">
                <span className="text-primary-foreground text-xs font-mono">#1e7260</span>
              </div>
              <p className="text-sm font-medium">Primary</p>
              <p className="text-xs text-muted-foreground">Основной бренд-цвет</p>
            </div>

            {/* Secondary */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-secondary flex items-end p-2 border">
                <span className="text-secondary-foreground text-xs font-mono">secondary</span>
              </div>
              <p className="text-sm font-medium">Secondary</p>
              <p className="text-xs text-muted-foreground">Вторичный цвет</p>
            </div>

            {/* Destructive */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-destructive flex items-end p-2">
                <span className="text-destructive-foreground text-xs font-mono">destructive</span>
              </div>
              <p className="text-sm font-medium">Destructive</p>
              <p className="text-xs text-muted-foreground">Опасные действия</p>
            </div>

            {/* Muted */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-muted flex items-end p-2 border">
                <span className="text-muted-foreground text-xs font-mono">muted</span>
              </div>
              <p className="text-sm font-medium">Muted</p>
              <p className="text-xs text-muted-foreground">Приглушённый</p>
            </div>

            {/* Accent */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-accent flex items-end p-2 border">
                <span className="text-accent-foreground text-xs font-mono">accent</span>
              </div>
              <p className="text-sm font-medium">Accent</p>
              <p className="text-xs text-muted-foreground">Акцентный</p>
            </div>

            {/* Card */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-card flex items-end p-2 border shadow-sm">
                <span className="text-card-foreground text-xs font-mono">card</span>
              </div>
              <p className="text-sm font-medium">Card</p>
              <p className="text-xs text-muted-foreground">Фон карточек</p>
            </div>
          </div>

          {/* Background & Foreground */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-background border flex items-center justify-center">
                <span className="text-foreground text-sm">Background + Foreground</span>
              </div>
              <p className="text-xs text-muted-foreground">Основной фон и текст</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-popover border flex items-center justify-center">
                <span className="text-popover-foreground text-sm">Popover</span>
              </div>
              <p className="text-xs text-muted-foreground">Фон поповеров и меню</p>
            </div>
          </div>

          {/* Semantic Colors */}
          <div className="space-y-3 mt-6">
            <h3 className="subsection-title">Семантические цвета</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                <Check className="h-4 w-4" />
                <span className="text-sm">Success</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Warning</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                <Trash2 className="h-4 w-4" />
                <span className="text-sm">Error</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                <Star className="h-4 w-4" />
                <span className="text-sm">Info</span>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="section-title">Типографика</h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="page-title">Page Title (text-2xl font-bold)</p>
              <code className="text-xs text-muted-foreground">.page-title</code>
            </div>

            <div className="space-y-1">
              <p className="section-title">Section Title (text-lg font-semibold)</p>
              <code className="text-xs text-muted-foreground">.section-title</code>
            </div>

            <div className="space-y-1">
              <p className="subsection-title">Subsection Title (text-base font-medium)</p>
              <code className="text-xs text-muted-foreground">.subsection-title</code>
            </div>

            <div className="space-y-1">
              <p className="card-title">Card Title (text-base font-medium)</p>
              <code className="text-xs text-muted-foreground">.card-title</code>
            </div>

            <div className="space-y-1">
              <p className="list-item-title">List Item Title (text-sm font-medium)</p>
              <code className="text-xs text-muted-foreground">.list-item-title</code>
            </div>

            <div className="space-y-1">
              <p className="body-text">Body Text (text-sm) - Основной текст приложения</p>
              <code className="text-xs text-muted-foreground">.body-text</code>
            </div>

            <div className="space-y-1">
              <p className="secondary-text">Secondary Text - Вторичный текст, подписи</p>
              <code className="text-xs text-muted-foreground">.secondary-text</code>
            </div>

            <div className="space-y-1">
              <p className="metadata">Metadata - Метаданные, даты, ID</p>
              <code className="text-xs text-muted-foreground">.metadata</code>
            </div>
          </div>
        </section>

        <Separator />

        {/* Buttons */}
        <section className="space-y-6">
          <h2 className="section-title">Кнопки</h2>

          {/* Variants */}
          <div className="space-y-3">
            <h3 className="subsection-title">Варианты</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">
                <Plus className="h-4 w-4" />
                Primary
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Destructive
              </Button>
            </div>
          </div>

          {/* Sizes */}
          <div className="space-y-3">
            <h3 className="subsection-title">Размеры</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* States */}
          <div className="space-y-3">
            <h3 className="subsection-title">Состояния</h3>
            <div className="flex flex-wrap gap-3">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* Badges */}
        <section className="space-y-6">
          <h2 className="section-title">Бейджи</h2>

          <div className="flex flex-wrap gap-3">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>

          <div className="space-y-3">
            <h3 className="subsection-title">Статусные бейджи (из globals.css)</h3>
            <div className="flex flex-wrap gap-3">
              <span className="badge-success inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Успех
              </span>
              <span className="badge-destructive inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Ошибка
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="subsection-title">Бейджи расположения</h3>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                Офис
              </span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                Удалённо
              </span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                Гибридный
              </span>
            </div>
          </div>
        </section>

        <Separator />

        {/* Cards */}
        <section className="space-y-6">
          <h2 className="section-title">Карточки</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Заголовок карточки</CardTitle>
                <CardDescription>Описание карточки, вторичный текст</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Основной контент карточки.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Действие</Button>
              </CardFooter>
            </Card>

            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  С акцентом
                </CardTitle>
                <CardDescription>Карточка с выделенной границей</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">border-primary для выделения.</p>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Приглушённая</CardTitle>
                <CardDescription>Карточка с muted фоном</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">bg-muted/50 для вторичных элементов.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Form Elements */}
        <section className="space-y-6">
          <h2 className="section-title">Формы</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="form-label">Input</label>
                <Input placeholder="Введите текст..." />
              </div>

              <div className="space-y-2">
                <label className="form-label">Input с иконкой</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Поиск..." />
                </div>
              </div>

              <div className="space-y-2">
                <label className="form-label">Disabled Input</label>
                <Input placeholder="Недоступно" disabled />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox id="checkbox" />
                <label htmlFor="checkbox" className="text-sm">Checkbox</label>
              </div>

              <div className="flex items-center gap-2">
                <Switch id="switch" />
                <label htmlFor="switch" className="text-sm">Switch</label>
              </div>

              <div className="space-y-2">
                <label className="form-label">Progress</label>
                <Progress value={66} />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Radius & Shadows */}
        <section className="space-y-6">
          <h2 className="section-title">Радиусы и тени</h2>

          <div className="space-y-3">
            <h3 className="subsection-title">Border Radius (--radius: 0.5rem)</h3>
            <div className="flex flex-wrap gap-4">
              <div className="w-20 h-20 bg-primary rounded-sm flex items-center justify-center text-primary-foreground text-xs">
                sm
              </div>
              <div className="w-20 h-20 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-xs">
                md
              </div>
              <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs">
                lg
              </div>
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs">
                full
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="subsection-title">Тени</h3>
            <div className="flex flex-wrap gap-4">
              <div className="w-24 h-24 bg-card rounded-lg shadow-sm flex items-center justify-center text-sm border">
                shadow-sm
              </div>
              <div className="w-24 h-24 bg-card rounded-lg shadow flex items-center justify-center text-sm border">
                shadow
              </div>
              <div className="w-24 h-24 bg-card rounded-lg shadow-md flex items-center justify-center text-sm border">
                shadow-md
              </div>
              <div className="w-24 h-24 bg-card rounded-lg shadow-lg flex items-center justify-center text-sm border">
                shadow-lg
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Loading States */}
        <section className="space-y-6">
          <h2 className="section-title">Состояния загрузки</h2>

          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="subsection-title">Skeleton</h3>
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="subsection-title">Анимации</h3>
              <div className="flex flex-wrap gap-4">
                <div className="w-12 h-12 bg-primary rounded-full animate-pulse" />
                <div className="w-12 h-12 bg-primary rounded-lg animate-bounce" />
                <div className="w-12 h-12 bg-primary rounded-lg animate-spin-slow" />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Spacing */}
        <section className="space-y-6">
          <h2 className="section-title">Отступы и spacing</h2>

          <div className="space-y-3">
            <h3 className="subsection-title">Padding шкала</h3>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                <div
                  key={n}
                  className={`bg-primary/20 border border-primary rounded text-xs flex items-center justify-center p-${n}`}
                >
                  p-{n}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="subsection-title">Gap шкала</h3>
            <div className="space-y-2">
              <div className="flex gap-1 bg-muted p-2 rounded">
                {[1,2,3,4,5].map(i => <div key={i} className="w-8 h-8 bg-primary rounded" />)}
                <span className="text-xs ml-2 self-center">gap-1</span>
              </div>
              <div className="flex gap-2 bg-muted p-2 rounded">
                {[1,2,3,4,5].map(i => <div key={i} className="w-8 h-8 bg-primary rounded" />)}
                <span className="text-xs ml-2 self-center">gap-2</span>
              </div>
              <div className="flex gap-4 bg-muted p-2 rounded">
                {[1,2,3,4,5].map(i => <div key={i} className="w-8 h-8 bg-primary rounded" />)}
                <span className="text-xs ml-2 self-center">gap-4</span>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Icons */}
        <section className="space-y-6">
          <h2 className="section-title">Иконки (Lucide)</h2>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground">User</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground">Settings</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Search className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground">Search</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground">Plus</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Check className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground">Check</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <ChevronRight className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground">Chevron</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Используется библиотека lucide-react</p>
        </section>

        <Separator />

        {/* Summary */}
        <section className="space-y-4 pb-8">
          <h2 className="section-title">Сводка дизайн-системы</h2>

          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-2">
                  <p className="font-medium">Primary Color</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">#1e7260 (teal)</code>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Border Radius</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">0.5rem (8px)</code>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Dark Mode</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">Нейтральная схема (0% saturation)</code>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Шрифт</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">system-ui, -apple-system</code>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">UI Components</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">Radix UI + Shadcn/ui</code>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Icons</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">Lucide React</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
