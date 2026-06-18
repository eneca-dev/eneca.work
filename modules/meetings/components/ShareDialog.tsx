'use client'

import { useState } from 'react'
import { Share2, Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useUsers } from '@/modules/cache'
import { useReportShares, useShareReport, useUnshareReport } from '../hooks/use-report-shares'

/** Управление доступом к созвону: владелец открывает протокол выбранным пользователям. */
export function ShareDialog({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: users } = useUsers()
  const { data: sharedIds } = useReportShares(open ? reportId : undefined)
  const share = useShareReport()
  const unshare = useUnshareReport()

  const sharedSet = new Set(sharedIds ?? [])

  const query = search.trim().toLowerCase()
  const filtered = (users ?? []).filter((u) =>
    !query ? true : `${u.full_name} ${u.email}`.toLowerCase().includes(query),
  )

  // Уже расшаренные — наверх (сортировка стабильная: внутри групп порядок по имени сохраняется).
  const sorted = [...filtered].sort(
    (a, b) => Number(sharedSet.has(b.user_id)) - Number(sharedSet.has(a.user_id)),
  )

  const toggle = (userId: string) => {
    if (sharedSet.has(userId)) unshare.mutate({ reportId, userId })
    else share.mutate({ reportId, userId })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 className="mr-2 h-4 w-4" />
          Поделиться
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle>Поделиться созвоном</DialogTitle>
          <DialogDescription>Выберите, кому открыть доступ к протоколу.</DialogDescription>
        </DialogHeader>

        <div className="border-t border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или email…"
              className="pl-9"
              aria-label="Поиск пользователей"
            />
          </div>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto px-2 pb-2">
          {sorted.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">Никого не найдено</li>
          ) : (
            sorted.map((user) => {
              const isShared = sharedSet.has(user.user_id)
              return (
                <li key={user.user_id}>
                  <button
                    type="button"
                    onClick={() => toggle(user.user_id)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {user.full_name || user.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                    <span
                      className={cn(
                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border',
                        isShared
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border',
                      )}
                    >
                      {isShared && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
