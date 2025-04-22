import { AuthDebugPanel } from "@/components/debug/auth-debug-panel"
import { StoreDebugPanel } from "@/components/debug/store-debug-panel"

export default function DebugPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Панель отладки приложения</h1>
      
      <div className="space-y-8">
        <AuthDebugPanel />
        <StoreDebugPanel />
      </div>
    </div>
  )
} 