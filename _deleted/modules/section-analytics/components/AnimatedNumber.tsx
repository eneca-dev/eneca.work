"use client";

import React, { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Длительность анимации в миллисекундах */
  durationMs?: number;
  /** Количество знаков после запятой */
  decimals?: number;
  /** Кастомное форматирование вывода */
  format?: (value: number) => React.ReactNode;
  /** CSS классы для текста */
  className?: string;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Плавно анимирует изменение числа при обновлении пропса value
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  durationMs = 600,
  decimals = 0,
  format,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(Number(value || 0));
  const startValueRef = useRef<number>(displayValue);
  const targetValueRef = useRef<number>(displayValue);
  const startTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const next = Number.isFinite(value) ? Number(value) : 0;
    if (next === targetValueRef.current) return;

    startValueRef.current = displayValue;
    targetValueRef.current = next;
    startTsRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (ts: number) => {
      if (startTsRef.current === null) startTsRef.current = ts;
      const elapsed = ts - startTsRef.current;
      const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
      const eased = easeOutCubic(t);
      const nextValue = startValueRef.current + (targetValueRef.current - startValueRef.current) * eased;
      setDisplayValue(nextValue);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(targetValueRef.current);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  const formatted = (() => {
    const rounded = Number(displayValue.toFixed(decimals));
    if (format) return format(rounded);
    if (decimals > 0) return rounded.toLocaleString();
    return Math.round(rounded).toLocaleString();
  })();

  return <span className={className}>{formatted}</span>;
};

export default AnimatedNumber;


