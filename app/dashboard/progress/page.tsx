"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function ProgressPage() {
  return (
    <main className="w-full h-screen p-0 m-0">
      <iframe
        src="https://project-dynamic.vercel.app/"
        style={{ border: "1px solid #ccc", width: "100%", height: "100vh", minHeight: 400, minWidth: 320, borderRadius: 6 }}
        frameBorder={"0"}
        allowFullScreen
        title="Прогресс проектов"
      />
    </main>
  )
} 