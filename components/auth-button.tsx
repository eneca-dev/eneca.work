import type React from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuthButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: "default" | "outline" | "secondary"
  spacing?: "none" | "sm" | "md" | "lg"
}

export function AuthButton({
  children,
  className,
  loading = false,
  variant = "default",
  spacing = "md",
  ...props
}: AuthButtonProps) {
  return (
    <Button
      className={cn(
        "w-full relative",
        spacing === "sm" && "mb-2",
        spacing === "md" && "mb-4",
        spacing === "lg" && "mb-6",
        className,
      )}
      variant={variant}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 absolute left-3 animate-spin" />}
      {children}
    </Button>
  )
}
