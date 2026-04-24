'use client'

import { useState } from 'react'
import { GraduationCap, Play } from 'lucide-react'
import { NotesSidebar, NotesTabButton } from '@/modules/notions'
import { Button } from '@/components/ui/button'
import { useUserStore } from '@/stores/useUserStore'
import { useOnboardingStore } from '@/stores/useOnboardingStore'

const TUTORIAL_TOPICS = [
  { page: 0, title: 'Как отправить баг или предложение' },
  { page: 1, title: 'Как пользоваться канбаном' },
  { page: 2, title: 'Как создать загрузку в отделах' },
  { page: 3, title: 'Как перетащить загрузку' },
  { page: 4, title: 'Загрузка в отделах — обзор' },
  { page: 5, title: 'Как поставить ёмкость на раздел' },
  { page: 6, title: 'Разделы — загрузки и ёмкость' },
  { page: 7, title: 'Загрузка на сотрудника или раздел' },
  { page: 8, title: 'Настройка вкладок и фильтров' },
  { page: 9, title: 'Перетаскивание дат в календаре' },
  { page: 10, title: 'Куда вносить «Прочие работы»' },
] as const

export default function DashboardPage() {
  const firstName = useUserStore((state) => state.profile?.first_name) || 'Пользователь'
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false)
  const openOnboarding = useOnboardingStore((s) => s.open)
  const goToPage = useOnboardingStore((s) => s.goToPage)

  const handleOpenTopic = (page: number) => {
    openOnboarding()
    goToPage(page)
  }

  return (
    <main className="w-full h-screen flex items-center justify-center bg-background animate-fade-in transition-colors duration-200">
      <div className="space-y-8 max-w-xl w-full px-6">
        <div className="text-center space-y-3">
          <h1
            className="text-3xl font-semibold tracking-tight text-foreground animate-slide-up"
            style={{ animationDuration: '0.6s', animationFillMode: 'backwards' }}
          >
            Добро пожаловать, {firstName}
          </h1>
          <p
            className="text-muted-foreground text-lg animate-slide-up"
            style={{ animationDelay: '0.15s', animationDuration: '0.6s', animationFillMode: 'backwards' }}
          >
            Система управления проектами{' '}
            <span className="text-primary font-medium">eneca.work</span>
          </p>
        </div>

        <div
          className="bg-card border border-border rounded-xl p-5 space-y-4 animate-slide-up"
          style={{ animationDelay: '0.3s', animationDuration: '0.6s', animationFillMode: 'backwards' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Обучение</h2>
                <p className="text-xs text-muted-foreground">11 уроков по работе с системой</p>
              </div>
            </div>
            <Button size="sm" onClick={() => openOnboarding()} className="gap-1.5">
              <Play className="w-3.5 h-3.5" />
              Начать
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-1">
            {TUTORIAL_TOPICS.map(({ page, title }, i) => (
              <button
                key={page}
                onClick={() => handleOpenTopic(page)}
                className="text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="text-primary/50 mr-1.5">{i + 1}.</span>
                {title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <NotesTabButton
        onClick={() => setIsNotesSidebarOpen(true)}
        isOpen={isNotesSidebarOpen}
      />

      <NotesSidebar
        isOpen={isNotesSidebarOpen}
        onClose={() => setIsNotesSidebarOpen(false)}
      />
    </main>
  )
}
