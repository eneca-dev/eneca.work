"use client"

interface ScrollbarStylesProps {
  theme: string
}

export function ScrollbarStyles({ theme }: ScrollbarStylesProps) {
  return (
    <style jsx>{`
      /* Стили для Webkit (Chrome, Safari, Edge) */
      div::-webkit-scrollbar {
        height: 6px;
        width: 6px;
      }
      div::-webkit-scrollbar-track {
        background: ${theme === "dark" ? "rgba(30, 41, 59, 0.2)" : "rgba(241, 245, 249, 0.2)"};
        border-radius: 3px;
      }
      div::-webkit-scrollbar-thumb {
        background: ${theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)"};
        border-radius: 3px;
      }
      div::-webkit-scrollbar-thumb:hover {
        background: ${theme === "dark" ? "rgba(51, 65, 85, 0.7)" : "rgba(203, 213, 225, 0.7)"};
      }
    `}</style>
  )
}
