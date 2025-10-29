"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload } from "lucide-react"
import AvatarUploadDialog from "./avatar-upload-dialog"

interface AvatarUploaderProps {
  avatarUrl?: string | null
  name: string
  className?: string
  onAvatarUploaded?: (url: string) => void
}

export function AvatarUploader({ avatarUrl, name, className = "h-12 w-12", onAvatarUploaded }: AvatarUploaderProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const hasAvatar = Boolean(avatarUrl)
  
  // Получаем инициалы для случая, если аватара нет
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")

  return (
    <>
      <div 
        className={`relative ${className} rounded-full cursor-pointer`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsDialogOpen(true)}
      >
        <Avatar className={`${className} transition-opacity`} style={isHovered ? { opacity: 0.7 } : {}}>
          <AvatarImage src={avatarUrl || "/placeholder.svg"} alt={name} />
          <AvatarFallback>
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {/* Оверлей с иконкой загрузки */}
        {(isHovered || !hasAvatar) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-full transition-opacity">
            <Upload className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      <AvatarUploadDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        onAvatarUploaded={onAvatarUploaded}
      />
    </>
  )
} 