import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

interface UserAvatarProps {
  avatarUrl?: string | null
  name: string
  email?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showFallback?: boolean
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm', 
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg'
}

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5', 
  xl: 'h-6 w-6'
}

function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?'
  
  const words = name.trim().split(' ')
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase()
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

export function UserAvatar({ 
  avatarUrl, 
  name, 
  email,
  size = 'md', 
  className,
  showFallback = true 
}: UserAvatarProps) {
  const [imageError, setImageError] = React.useState(false)
  const [imageLoading, setImageLoading] = React.useState(true)
  
  const initials = getInitials(name)
  const shouldShowImage = avatarUrl && !imageError
  
  const handleImageError = () => {
    setImageError(true)
    setImageLoading(false)
  }
  
  const handleImageLoad = () => {
    setImageLoading(false)
  }

  return (
    <div 
      className={cn(
        'relative flex items-center justify-center rounded-full bg-primary/10 flex-shrink-0 overflow-hidden',
        sizeClasses[size],
        className
      )}
      title={name || email || 'Пользователь'}
    >
      {shouldShowImage ? (
        <>
          <Image
            src={avatarUrl}
            alt={`Аватар ${name}`}
            fill
            className={cn(
              'object-cover transition-opacity duration-200',
              imageLoading ? 'opacity-0' : 'opacity-100'
            )}
            onError={handleImageError}
            onLoad={handleImageLoad}
            sizes="(max-width: 768px) 32px, 40px"
          />
          {imageLoading && showFallback && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
              <User className={cn('text-primary animate-pulse', iconSizeClasses[size])} />
            </div>
          )}
        </>
      ) : showFallback ? (
        <span className="font-medium text-primary select-none">
          {initials}
        </span>
      ) : (
        <User className={cn('text-primary', iconSizeClasses[size])} />
      )}
    </div>
  )
} 