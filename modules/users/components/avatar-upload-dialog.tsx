"use client"

import { useState, useRef, useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { toast } from "sonner"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, X, Trash2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useUserStore } from "@/stores/useUserStore"

interface AvatarUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAvatarUploaded?: (url: string) => void
}

function AvatarUploadDialog({ open, onOpenChange, onAvatarUploaded }: AvatarUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAgreementChecked, setIsAgreementChecked] = useState(false)
  const [lastUploadTime, setLastUploadTime] = useState<number | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const userState = useUserStore()
  const supabase = createClient()

  // Проверяем время последней загрузки
  const isUploadAllowed = () => {
    if (!lastUploadTime) return true
    
    // Проверка 15-минутного ограничения
    const fifteenMinutesInMs = 15 * 60 * 1000
    return Date.now() - lastUploadTime > fifteenMinutesInMs
  }

  // Обработка загруженного файла
  useEffect(() => {
    if (!selectedFile) {
      setPreview(null)
      return
    }

    // Создаем предварительный просмотр выбранного изображения
    const objectUrl = URL.createObjectURL(selectedFile)
    
    // Загружаем изображение для обработки
    const img = new Image()
    img.onload = () => {
      if (canvasRef.current) {
        // Создаем квадратное изображение 1024x1024
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        canvas.width = 1024
        canvas.height = 1024
        
        // Определяем параметры для центральной обрезки
        const size = Math.min(img.width, img.height)
        const x = (img.width - size) / 2
        const y = (img.height - size) / 2
        
        // Рисуем обрезанное изображение
        ctx.drawImage(img, x, y, size, size, 0, 0, 1024, 1024)
        
        // Обновляем превью
        setPreview(canvas.toDataURL())
      }
    }
    img.src = objectUrl
    
    // Очищаем объект URL при размонтировании
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  // Обработчик выбора файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Sentry.addBreadcrumb({ category: 'ui.input', level: 'info', message: 'AvatarUploadDialog: file selected' })
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null)
      return
    }
    
    const file = e.target.files[0]
    
    // Проверяем, что файл является изображением JPEG или PNG
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      toast.error("Поддерживаются только форматы JPEG и PNG")
      return
    }
    
    setSelectedFile(file)
    setProcessingError(null)
  }
  
  // Обработчик удаления фотографии
  const handleRemoveFile = () => {
    Sentry.addBreadcrumb({ category: 'ui.action', level: 'info', message: 'AvatarUploadDialog: remove file' })
    setSelectedFile(null)
    setPreview(null)
    setProcessingError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Симуляция отправки аватара на сервер
  const uploadAvatar = async () => {
    if (!selectedFile || !canvasRef.current || !isUploadAllowed()) return

    setIsProcessing(true)
    setProcessingError(null)

    try {
      // Получаем access_token пользователя
      const { data: sessionData, error: sessionError } = await Sentry.startSpan({ name: 'Users/AvatarUploadDialog getSession', op: 'auth' }, async () => supabase.auth.getSession())
      if (sessionError || !sessionData.session) {
        throw new Error("Не удалось получить access_token пользователя")
      }
      const access_token = sessionData.session.access_token

      // Получаем user_id
      const user_id = sessionData.session.user.id

      // Готовим изображение (Blob)
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          setIsProcessing(false)
          setProcessingError("Не удалось подготовить изображение")
          toast.error("Не удалось подготовить изображение")
          return
        }

        // Формируем FormData
        const formData = new FormData()
        formData.append("avatar", blob, "avatar.png")

        // Отправляем на Edge Function
        let resp
        try {
          Sentry.addBreadcrumb({ category: 'http', level: 'info', message: 'AvatarUploadDialog: call edge function' })
          resp = await Sentry.startSpan({ name: 'Users/AvatarUploadDialog edgeFunction', op: 'http' }, async () => fetch("https://gvrcbvifirhxxdnvrwlz.supabase.co/functions/v1/generate-avatar-from-photo", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${access_token}`
            },
            body: formData
          }))
        } catch (err) {
          setIsProcessing(false)
          setProcessingError("Ошибка сети при отправке изображения")
          toast.error("Ошибка сети при отправке изображения")
          return
        }

        // DEBUG: временно выводим ответ сервера
        console.log("[DEBUG] Edge Function response:", resp)

        let data
        try {
          data = await resp.json()
        } catch {
          setIsProcessing(false)
          setProcessingError("Некорректный ответ от сервера")
          toast.error("Некорректный ответ от сервера")
          return
        }

        // DEBUG: временно выводим data
        console.log("[DEBUG] Edge Function data:", data)

        if (!resp.ok || !data?.url) {
          setIsProcessing(false)
          setProcessingError(data?.error || "Ошибка генерации аватара")
          toast.error(data?.error || "Ошибка генерации аватара")
          return
        }

        // Обновляем профиль пользователя в Supabase (таблица profiles)
        const { error: updateError } = await Sentry.startSpan({ name: 'Users/AvatarUploadDialog updateProfile', op: 'db.write' }, async () =>
          supabase
            .from("profiles")
            .update({ avatar_url: data.url })
            .eq("user_id", user_id)
        )

        if (updateError) {
          setIsProcessing(false)
          setProcessingError("Не удалось обновить профиль пользователя")
          toast.error("Не удалось обновить профиль пользователя")
          return
        }

        // Обновляем время последней загрузки
        setLastUploadTime(Date.now())

        // Вызываем обработчик и уведомляем пользователя
        if (onAvatarUploaded) onAvatarUploaded(data.url)
        toast.success("Аватар успешно обновлён!")
        setIsProcessing(false)
        setSelectedFile(null)
        setPreview(null)
        setIsAgreementChecked(false)
        onOpenChange(false)
      }, "image/png")
    } catch (error) {
      setIsProcessing(false)
      setProcessingError(error instanceof Error ? error.message : "Неизвестная ошибка")
      toast.error(error instanceof Error ? error.message : "Неизвестная ошибка")
    }
  }

  // Кнопка загрузки
  const handleUpload = async () => {
    if (!isAgreementChecked) {
      toast.error("Пожалуйста, подтвердите согласие на обработку фотографии")
      return
    }
    Sentry.addBreadcrumb({ category: 'ui.submit', level: 'info', message: 'AvatarUploadDialog: upload clicked' })
    await uploadAvatar()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Загрузка фотографии для аватара</DialogTitle>
          <DialogDescription>
            Загрузите свою фотографию для создания аватара.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Скрытый canvas для обработки изображения */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          
          {/* Информационный блок */}
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <h3 className="font-medium mb-1">Требования к фотографии:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Четкое и крупное изображение лица</li>
              <li>На фотографии должен быть только один человек</li>
              <li>Поддерживаемые форматы: JPEG, PNG</li>
              <li>Ориентация изображения должна быть правильной</li>
            </ul>
            <p className="mt-2">Фотография будет автоматически обрезана до квадратного формата 1024×1024 пикселей.</p>
          </div>
          
          {/* Блок загрузки */}
          <div className="grid gap-4">
            {preview ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                  <img src={preview} alt="Предпросмотр" className="object-cover w-full h-full" />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-500 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={handleRemoveFile}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Удалить фото
                </Button>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Нажмите для выбора файла</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">JPEG или PNG, максимум 5 МБ</p>
                </div>
              </div>
            )}
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/jpeg,image/png"
            />
            
            {/* Сообщение об ошибке */}
            {processingError && (
              <div className="text-red-500 text-sm">{processingError}</div>
            )}
            
            {/* Согласие на обработку */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="agreement" 
                checked={isAgreementChecked} 
                onCheckedChange={(checked) => setIsAgreementChecked(!!checked)} 
              />
              <Label htmlFor="agreement" className="text-sm">
                Я согласен на обработку фотографии нейросетью для создания аватара
              </Label>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isProcessing || !isAgreementChecked || !isUploadAllowed()}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              "Загрузить фотографию"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default Sentry.withProfiler(AvatarUploadDialog, { name: 'AvatarUploadDialog' })