import { useEffect, useRef } from 'react';

/**
 * Хук для обнаружения кликов вне элемента
 * @param callback - функция, которая вызывается при клике вне элемента
 * @param enabled - активен ли хук (по умолчанию true)
 * @returns ref для привязки к элементу
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void,
  enabled: boolean = true
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    // Добавляем слушатель событий
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback, enabled]);

  return ref;
} 