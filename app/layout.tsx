import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import ClientProviders from "./ClientProviders"

const inter = Inter({ subsets: ["latin", "cyrillic"] })

export const metadata: Metadata = {
  title: "eneca.work",
  description: "Платформа для эффективной работы",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (typeof window === 'undefined') {
    const fs = require('fs');
    const path = require('path');
    const envFiles = ['.env.local', '.env.development', '.env.production', '.env'];
    const existing = envFiles.filter(f => fs.existsSync(path.join(process.cwd(), f)));
    let used = 'Неизвестно';
    if (process.env.NODE_ENV === 'development' && existing.includes('.env.local')) used = '.env.local';
    else if (process.env.NODE_ENV === 'production' && existing.includes('.env.production')) used = '.env.production';
    else if (existing.length > 0) used = existing[0];
    console.log(`\n=== eneca.work ===`);
    console.log(`Режим: ${process.env.NODE_ENV}`);
    console.log(`Используемый файл переменных окружения: ${used}`);
    console.log('=================\n');
  }

  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}


import './globals.css'