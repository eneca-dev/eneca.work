import { CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CalendarMenuProps {
  className?: string;
  isActive?: boolean;
}

export function CalendarMenu({ className, isActive }: CalendarMenuProps) {
  return (
    <Link 
      href="/dashboard/calendar" 
      className={cn(
        "flex items-center p-2 hover:bg-accent rounded-md transition-colors",
        isActive && "bg-accent text-accent-foreground",
        className
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      <span>Календарь</span>
    </Link>
  );
} 