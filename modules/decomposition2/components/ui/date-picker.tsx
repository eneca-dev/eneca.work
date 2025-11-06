import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

type DatePickerProps = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  triggerClassName?: string;
  onFocus?: (e: React.FocusEvent<HTMLButtonElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
  openOnToday?: boolean;
  plainTrigger?: boolean; // для чёрного (plain) вида кнопки-триггера
};

const RU_MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseISODate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthMatrix(year: number, month: number): Date[] {
  // Monday-first calendar, 6 weeks (42 days)
  const firstOfMonth = new Date(year, month, 1);
  const weekday = firstOfMonth.getDay(); // 0..6 (Sun..Sat)
  const mondayIndex = (weekday + 6) % 7; // 0..6 (Mon..Sun)
  const start = new Date(year, month, 1 - mondayIndex);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    days.push(dt);
  }
  return days;
}

export function DatePicker({
  value,
  onChange,
  triggerClassName,
  onFocus,
  onKeyDown,
  triggerRef,
  openOnToday,
  plainTrigger,
}: DatePickerProps) {
  const selected = parseISODate(value) ?? new Date();
  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState<number>(selected.getFullYear());
  const [viewMonth, setViewMonth] = React.useState<number>(selected.getMonth());
  const [focusedISO, setFocusedISO] = React.useState<string>(toISODate(selected));

  const triggerElRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const prevOpenRef = React.useRef<boolean>(false);

  // expose ref
  React.useEffect(() => {
    if (!triggerRef) return;
    if (typeof triggerRef === "function") {
      triggerRef(triggerElRef.current);
    } else {
      try {
        (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = triggerElRef.current;
      } catch {}
    }
  }, [triggerRef]);

  const updatePosition = React.useCallback(() => {
    const el = triggerElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 320;
    const left = Math.min(
      Math.max(rect.left + window.scrollX, 8),
      Math.max(8, window.scrollX + window.innerWidth - width - 8)
    );
    const top = rect.bottom + window.scrollY + 6;
    setPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popoverRef.current?.contains(t)) return;
      if (triggerElRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onWin = () => updatePosition();
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, updatePosition]);

  // Keep dependency array stable; align only when popup just opened
  React.useEffect(() => {
    if (!open) return;
    const justOpened = !prevOpenRef.current && open;
    if (!justOpened) return;
    const d = parseISODate(focusedISO) ?? new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    const id = window.setTimeout(() => {
      gridRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, focusedISO]);

  // Track previous open state
  React.useEffect(() => {
    prevOpenRef.current = open;
  }, [open]);

  const days = getMonthMatrix(viewYear, viewMonth);
  const todayISO = toISODate(new Date());
  const selectedISO = toISODate(selected);

  const goPrevMonth = () => {
    const d = new Date(viewYear, viewMonth, 1);
    d.setMonth(d.getMonth() - 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNextMonth = () => {
    const d = new Date(viewYear, viewMonth, 1);
    d.setMonth(d.getMonth() + 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setFocusedISO(toISODate(now));
    gridRef.current?.focus();
  };

  const selectDate = (d: Date) => {
    onChange(toISODate(d));
    setOpen(false);
  };

  const isCurrentMonth = (d: Date) => d.getMonth() === viewMonth && d.getFullYear() === viewYear;

  const formatDisplay = (iso?: string) => {
    const dt = parseISODate(iso ?? "");
    const date = dt ?? new Date();
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  };

  return (
    <>
      <button
        ref={triggerElRef}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-between gap-1 rounded-full border-0 px-3 text-xs h-6 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-offset-2",
          plainTrigger ? "bg-transparent hover:bg-muted/30 text-foreground" : "bg-muted/60 hover:bg-muted/80",
          triggerClassName
        )}
        onFocus={(e) => {
          setOpen(true);
          const iso = value || toISODate(new Date());
          setFocusedISO(iso);
          const d = parseISODate(iso) ?? new Date();
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
          onFocus?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
            const iso = value || toISODate(new Date());
            setFocusedISO(iso);
            const d = parseISODate(iso) ?? new Date();
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }
          onKeyDown?.(e);
        }}
        onClick={() => {
          setOpen(true);
          const iso = value || toISODate(new Date());
          setFocusedISO(iso);
          const d = parseISODate(iso) ?? new Date();
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        }}
      >
        <span className="tabular-nums select-none">{formatDisplay(value)}</span>
        <CalendarIcon className={cn("h-3.5 w-3.5", plainTrigger ? "text-foreground" : "text-muted-foreground")} />
      </button>

      {open && pos && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[300px] rounded-2xl border border-border/40 bg-popover shadow-lg p-1.5"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-muted"
                onClick={goPrevMonth}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-muted"
                onClick={goToday}
                aria-label="Сегодня"
                title="Сегодня"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-[13px] font-medium">
              {RU_MONTHS[viewMonth]} {viewYear}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-muted"
                onClick={goNextMonth}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-[3px] px-1">
            {RU_WEEKDAYS.map((d) => (
              <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground text-center py-[2px]">
                {d}
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-[3px] p-1"
            ref={gridRef}
            onKeyDown={(e) => {
              const current = parseISODate(focusedISO) ?? new Date();
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                const d = new Date(current);
                d.setDate(d.getDate() - 1);
                setFocusedISO(toISODate(d));
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                const d = new Date(current);
                d.setDate(d.getDate() + 1);
                setFocusedISO(toISODate(d));
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const d = new Date(current);
                d.setDate(d.getDate() - 7);
                setFocusedISO(toISODate(d));
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const d = new Date(current);
                d.setDate(d.getDate() + 7);
                setFocusedISO(toISODate(d));
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              } else if (e.key === "Enter") {
                e.preventDefault();
                const d = parseISODate(focusedISO) ?? new Date();
                selectDate(d);
              }
            }}
            tabIndex={0}
          >
            {days.map((d) => {
              const iso = toISODate(d);
              const isSel = iso === selectedISO;
              const isToday = iso === todayISO;
              const isOut = !isCurrentMonth(d);
              const isFocus = iso === focusedISO;
              const isPast = iso < todayISO;

              return (
                <button
                  key={iso + (isOut ? "-out" : "")}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-full text-[11px] inline-flex items-center justify-center transition-colors",
                    isPast ? "text-muted-foreground/50" : "text-foreground",
                    !isSel && !isOut && "hover:bg-muted",
                    isSel && "bg-primary text-primary-foreground hover:bg-primary",
                    !isSel && isToday && "ring-1 ring-primary",
                    isFocus && "ring-2 ring-ring"
                  )}
                  onClick={() => selectDate(d)}
                  onMouseEnter={() => setFocusedISO(iso)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}


