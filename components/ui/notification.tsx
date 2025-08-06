"use client"

import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { useUiStore, type Notification, type NotificationType } from '@/stores/useUiStore';

interface NotificationComponentProps {
  notification: Notification;
  onClose: () => void;
}

const getNotificationStyles = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return {
        container: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
        text: 'text-green-800 dark:text-green-300',
        button: 'text-green-400 hover:text-green-600 dark:text-green-500 dark:hover:text-green-400',
        icon: CheckCircle
      };
    case 'error':
      return {
        container: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
        text: 'text-red-800 dark:text-red-300',
        button: 'text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400',
        icon: AlertCircle
      };
    case 'warning':
      return {
        container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-300',
        button: 'text-yellow-400 hover:text-yellow-600 dark:text-yellow-500 dark:hover:text-yellow-400',
        icon: AlertTriangle
      };
    case 'info':
    default:
      return {
        container: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
        text: 'text-blue-800 dark:text-blue-300',
        button: 'text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-400',
        icon: Info
      };
  }
};

export function NotificationComponent({ notification, onClose }: NotificationComponentProps) {
  const styles = getNotificationStyles(notification.type);
  const IconComponent = styles.icon;

  return (
    <div className={`border rounded-lg p-4 shadow-lg ${styles.container}`}>
      <div className="flex items-start">
        <IconComponent className={`h-5 w-5 mr-3 mt-0.5 ${styles.text}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${styles.text}`}>
            {notification.message}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={`ml-3 h-6 w-6 p-0 ${styles.button} hover:bg-transparent`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Глобальный компонент уведомлений, который можно использовать везде
export function GlobalNotification() {
  const { notification, clearNotification } = useUiStore();

  if (!notification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <NotificationComponent 
        notification={notification} 
        onClose={clearNotification} 
      />
    </div>
  );
} 