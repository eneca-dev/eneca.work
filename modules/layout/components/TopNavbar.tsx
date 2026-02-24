"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bell, Search, Users, LogOut, Settings } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface TopNavbarProps {
  user?: {
    name: string
    email: string
    avatarUrl?: string | null
  }
}

export function TopNavbar({ user }: TopNavbarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { label: "Главная", href: "/" },
    { label: "Задачи", href: "/tasks" },
    { label: "Заметки", href: "/notions" },
    { label: "Отчёты", href: "/reports" },
    { label: "Аналитика", href: "/analytics" },
    { label: "Документация", href: "/docs" },
  ]

  const displayName = user?.name || "Пользователь"
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#0c1015] border-b border-[#1e2530] z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image__10_-removebg-preview-DH3poORK5SwnmDnICGNszX6XADuVhH.png"
              alt="eneca.work"
              width={26}
              height={26}
            />
            <span className="font-mono text-lg font-semibold">
              <span className="text-amber-500">eneca</span>
              <span className="text-slate-400">.work</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Search + Actions + Profile */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151b23] border border-[#262f3d] rounded-md w-52">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск..."
              className="bg-transparent border-none outline-none text-sm text-slate-300 placeholder:text-slate-500 w-full"
            />
            <kbd className="text-[10px] text-slate-500 bg-[#0c1015] px-1.5 py-0.5 rounded border border-[#262f3d]">⌘K</kbd>
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Users */}
          <Link
            href="/users"
            className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Users className="w-5 h-5" />
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-[#262f3d]" />

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-md hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-xs font-bold text-black">
                {initials}
              </div>
              <span className="text-sm text-slate-300">{displayName}</span>
            </button>

            {profileOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#151b23] border border-[#262f3d] rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[#262f3d]">
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                  >
                    <Settings className="w-4 h-4" />
                    Настройки
                  </Link>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5">
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
