'use client'

import { useChat } from '../hooks/useChat'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { MessageCircle, X, RotateCcw, Maximize2, Minimize2 } from 'lucide-react'

export function ChatInterface() {
  const {
    messages,
    isLoading,
    isTyping,
    isOpen,
    input,
    setInput,
    toggleChat,
    sendMessage,
    clearMessages,
    isFullscreen,
    toggleFullscreen,
    chatSize,
    handleResizeStart,
  } = useChat()

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col mb-2 animate-slide-up ${
            isFullscreen
              ? 'fixed top-4 right-4 bottom-4 w-[28%]'
              : 'relative min-w-[280px] min-h-[400px] max-w-[90vw] max-h-[90vh]'
          }`}
          style={!isFullscreen ? { width: chatSize.width, height: chatSize.height } : {}}
        >
          {!isFullscreen && (
            <div
              className="absolute top-0 left-0 w-5 h-5 cursor-nw-resize z-10 flex items-center justify-center"
              onMouseDown={handleResizeStart}
              title="Изменить размер"
            >
              <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full opacity-60"></div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-xl">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                <MessageCircle size={12} className="text-white" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                Eneca чат
              </h3>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                title={isFullscreen ? "Свернуть" : "Развернуть"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={clearMessages}
                className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Очистить"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={toggleChat}
                className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Закрыть"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <MessageList messages={messages} isLoading={isLoading} isTyping={isTyping} />

          <MessageInput
            onSendMessage={sendMessage}
            isLoading={isLoading}
            input={input}
            setInput={setInput}
          />
        </div>
      )}

      {!isOpen && (
        <button
          onClick={toggleChat}
          className="w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 hover:scale-105 hover:shadow-xl"
          title="Открыть чат"
        >
          <MessageCircle size={22} className="text-white" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-green-400 to-green-500 rounded-full border-2 border-white">
            <div className="w-full h-full bg-green-300 rounded-full animate-pulse"></div>
          </div>
        </button>
      )}
    </div>
  )
}
