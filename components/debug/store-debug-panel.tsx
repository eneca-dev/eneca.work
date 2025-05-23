"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import { useUserStore } from "@/stores/useUserStore"
import { useUiStore } from "@/stores/useUiStore"
import { useSettingsStore } from "@/stores/useSettingsStore"

export function StoreDebugPanel() {
  const { toast } = useToast()
  
  // Получаем состояние всех сторов из Zustand
  const userState = useUserStore()
  const uiState = useUiStore()
  const settingsState = useSettingsStore()
  
  // Получаем действия из сторов
  const { clearUser } = useUserStore()
  const { setLoading, setNotification, clearNotification } = useUiStore()
  const { setTheme } = useSettingsStore()
  
  // Состояние для форм модификации
  const [notificationText, setNotificationText] = useState("")
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">(settingsState.theme)
  
  // Функции для изменения состояния Zustand
  const handleClearUser = () => {
    clearUser()
    toast({
      title: "Действие выполнено",
      description: "Пользователь был очищен из Zustand store",
    })
  }
  
  const handleToggleLoading = () => {
    setLoading(!uiState.loading)
    toast({
      title: "Действие выполнено",
      description: `Состояние загрузки изменено на ${!uiState.loading ? "активное" : "неактивное"}`,
    })
  }
  
  const handleSetNotification = () => {
    if (notificationText.trim()) {
      setNotification(notificationText)
      toast({
        title: "Действие выполнено",
        description: "Уведомление было добавлено",
      })
    }
  }
  
  const handleClearNotification = () => {
    clearNotification()
    setNotificationText("")
    toast({
      title: "Действие выполнено",
      description: "Уведомление было очищено",
    })
  }
  
  const handleChangeTheme = (value: string) => {
    const theme = value as "light" | "dark" | "system"
    setSelectedTheme(theme)
    setTheme(theme)
    toast({
      title: "Действие выполнено",
      description: `Тема изменена на ${theme}`,
    })
  }
  
  // Объединяем все состояния в один объект для отображения полного состояния
  const fullState = {
    user: userState,
    ui: uiState,
    settings: settingsState
  }
  
  return (
    <Card className="w-full bg-white dark:bg-gray-800 shadow-md">
      <CardHeader className="bg-primary/5">
        <CardTitle className="text-xl font-bold">Состояние Zustand</CardTitle>
        <CardDescription>
          Информация о текущем состоянии Zustand сторов и возможность манипуляции данными
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <Tabs defaultValue="view" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="view">Просмотр состояния</TabsTrigger>
            <TabsTrigger value="actions">Действия</TabsTrigger>
          </TabsList>
          
          {/* Вкладка просмотра состояния */}
          <TabsContent value="view" className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              {/* Полное состояние */}
              <AccordionItem value="item-full">
                <AccordionTrigger className="text-base font-medium">
                  Полное состояние Zustand
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-4">
                    <pre className="text-xs overflow-auto max-h-[400px] whitespace-pre-wrap">
                      {JSON.stringify(fullState, null, 2)}
                    </pre>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* User Store */}
              <AccordionItem value="item-user">
                <AccordionTrigger className="text-base font-medium">
                  User Store
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md text-sm">
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Аутентифицирован:</p>
                        <p className={userState.isAuthenticated ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                          {userState.isAuthenticated ? "Да" : "Нет"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">ID пользователя:</p>
                        <p className="truncate">{userState.id || "Не задано"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Имя пользователя:</p>
                        <p>{userState.name || "Не задано"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Email пользователя:</p>
                        <p>{userState.email || "Не задано"}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">JSON представление:</p>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                        {JSON.stringify(userState, null, 2)}
                      </pre>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* UI Store */}
              <AccordionItem value="item-ui">
                <AccordionTrigger className="text-base font-medium">
                  UI Store
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md text-sm">
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Состояние загрузки:</p>
                        <p className={uiState.loading ? "text-yellow-600 dark:text-yellow-400 font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                          {uiState.loading ? "Загрузка..." : "Не загружается"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Уведомление:</p>
                        <p className="truncate">{uiState.notification || "Нет активных уведомлений"}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">JSON представление:</p>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                        {JSON.stringify(uiState, null, 2)}
                      </pre>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* Settings Store */}
              <AccordionItem value="item-settings">
                <AccordionTrigger className="text-base font-medium">
                  Settings Store
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md text-sm">
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Текущая тема:</p>
                        <p className="capitalize">{settingsState.theme}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">JSON представление:</p>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                        {JSON.stringify(settingsState, null, 2)}
                      </pre>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
          
          {/* Вкладка действий */}
          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">User Store</CardTitle>
                  <CardDescription>Действия с данными пользователя</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-gray-500">
                    {userState.isAuthenticated 
                      ? `Пользователь авторизован как ${userState.name || userState.email}`
                      : "Пользователь не авторизован"}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    disabled={!userState.isAuthenticated}
                    onClick={handleClearUser}
                  >
                    Очистить данные пользователя
                  </Button>
                </CardFooter>
              </Card>
              
              {/* UI Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">UI Store</CardTitle>
                  <CardDescription>Управление интерфейсом</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Уведомление:</p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Текст уведомления" 
                        value={notificationText}
                        onChange={(e) => setNotificationText(e.target.value)}
                      />
                      <Button 
                        variant="outline" 
                        onClick={handleSetNotification}
                      >
                        Задать
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-2">
                  <Button 
                    variant={uiState.loading ? "destructive" : "default"}
                    className="w-full"
                    onClick={handleToggleLoading}
                  >
                    {uiState.loading ? "Остановить загрузку" : "Начать загрузку"}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={!uiState.notification}
                    onClick={handleClearNotification}
                  >
                    Очистить уведомление
                  </Button>
                </CardFooter>
              </Card>
              
              {/* Settings Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Settings Store</CardTitle>
                  <CardDescription>Настройки приложения</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Текущая тема: <span className="font-medium capitalize">{settingsState.theme}</span></p>
                    <Select 
                      value={selectedTheme} 
                      onValueChange={handleChangeTheme}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тему" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Светлая</SelectItem>
                        <SelectItem value="dark">Тёмная</SelectItem>
                        <SelectItem value="system">Системная</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-sm text-gray-500">
                    Тема будет применена ко всему приложению.
                  </p>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="bg-gray-50 dark:bg-gray-900/30 p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Этот компонент предоставляет информацию о Zustand сторах приложения и позволяет манипулировать их состоянием для отладки.
        </p>
      </CardFooter>
    </Card>
  )
} 