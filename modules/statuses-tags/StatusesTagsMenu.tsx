import React from 'react';
import { Tags } from 'lucide-react';
import Link from 'next/link';

export function StatusesTagsMenu() {
  return (
    <Link 
      href="/dashboard/statuses-tags" 
      className="flex items-center p-2 hover:bg-accent rounded-md transition-colors"
    >
      <Tags className="mr-2 h-4 w-4" />
      <span>Статусы и теги</span>
    </Link>
  );
} 