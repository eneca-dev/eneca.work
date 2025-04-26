"use client"

import { useState, useRef, useEffect } from "react"
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

export function AvatarUploadDialog({ open, onOpenChange, onAvatarUploaded }: AvatarUploadDialogProps) {
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
    
    try {
      // Подготавливаем данные для отправки
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          throw new Error("Не удалось подготовить изображение")
        }
        
        // Здесь будет логика отправки в Supabase
        // Пока просто имитируем задержку
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Имитируем ошибку как запрошено
        throw new Error("API для загрузки аватаров еще не реализован")
        
        // Реальный код отправки будет примерно таким
        // const { data, error } = await supabase.storage
        //   .from('avatars')
        //   .upload(`${userState.id}/avatar.png`, blob, {
        //     contentType: 'image/png',
        //     upsert: true
        //   })
        
        // if (error) throw error
        
        // Обновляем время последней загрузки
        // setLastUploadTime(Date.now())
        
        // Получаем URL и вызываем обработчик
        // const avatarUrl = ...
        // if (onAvatarUploaded) onAvatarUploaded(avatarUrl)
      })
    } catch (error) {
      console.error("Ошибка загрузки аватара:", error)
      setProcessingError(error instanceof Error ? error.message : "Неизвестная ошибка")
      toast.error("Не удалось загрузить аватар")
    } finally {
      setIsProcessing(false)
    }
  }

  // Кнопка загрузки
  const handleUpload = async () => {
    if (!isAgreementChecked) {
      toast.error("Пожалуйста, подтвердите согласие на обработку фотографии")
      return
    }
    
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