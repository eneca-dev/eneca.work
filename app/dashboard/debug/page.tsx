"use client"

import { AuthDebugPanel } from "@/components/auth-debug-panel"
import { ReduxDebugPanel } from "@/components/redux-debug-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function DebugPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Отладка системы</h1>
      </div>

      <Tabs defaultValue="auth" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="auth">Аутентификация</TabsTrigger>
          <TabsTrigger value="redux">Redux</TabsTrigger>
          <TabsTrigger value="system">Система</TabsTrigger>
        </TabsList>
        
        <TabsContent value="auth" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-xl font-bold">Отладка аутентификации</CardTitle>
                <CardDescription>
                  Подробная информация о состоянии аутентификации в приложении
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  На этой странице представлена информация о текущем состоянии аутентификации 
                  пользователя в Supabase и Redux. Используйте эту информацию для отладки 
                  проблем с аутентификацией.
                </p>
                
                <AuthDebugPanel />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="redux" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-xl font-bold">Отладка Redux</CardTitle>
                <CardDescription>
                  Информация о состоянии Redux Store и его слайсах
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  На этой странице представлена детальная информация о состоянии Redux store, 
                  включая все его слайсы. Вы можете просматривать и манипулировать данными 
                  в реальном времени для отладки.
                </p>
                
                <ReduxDebugPanel />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-xl font-bold">Отладка системы</CardTitle>
              <CardDescription>
                Системная информация и инструменты отладки
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-lg border p-4 mb-4">
                <h3 className="text-lg font-semibold mb-2">Системная информация</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Версия Next.js:</span> 14.0.0
                    </div>
                    <div>
                      <span className="font-medium">Режим приложения:</span> Production
                    </div>
                    <div>
                      <span className="font-medium">Версия React:</span> 18.3.0
                    </div>
                    <div>
                      <span className="font-medium">Режим React:</span> Concurrent
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Этот раздел будет расширен в будущем для включения дополнительных 
                инструментов отладки и системной информации.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
} 