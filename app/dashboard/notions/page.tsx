"use client"

import { NotesBlock } from '@/modules/notions'

export default function NotionsPage() {
  return (
    <main className="w-full h-screen md:h-[calc(100vh)] flex flex-col">
      <NotesBlock />
    </main>
  )
}
