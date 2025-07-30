"use client"

import React from 'react';
import { StatusesList } from './statuses/components/StatusesList';

export default function StatusesTagsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Статусы и теги
        </h1>
        <p className="text-gray-600 dark:text-slate-400">
          Управление статусами проектов и тегами для организации работы
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <StatusesList />
      </div>
    </div>
  );
} 