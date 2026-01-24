import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  icon?: ReactNode;
  timestamp: number;
  persistent?: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  removeNotificationsByType: (type: Notification['type']) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  
  addNotification: (notif) => {
    const newNotif: Notification = {
      ...notif,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    console.log('[NotificationStore] Adding notification:', newNotif.type, newNotif.message, 'persistent:', newNotif.persistent);

    set((state) => {
      // Remove old persistent notifications of same type if adding new one
      if (newNotif.persistent) {
        return {
          notifications: [
            ...state.notifications.filter(n => !n.persistent || n.type !== newNotif.type),
            newNotif
          ]
        };
      }
      return { notifications: [...state.notifications, newNotif] };
    });

    // Auto-remove after 5 seconds (only non-persistent)
    if (!newNotif.persistent) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== newNotif.id)
        }));
      }, 5000);
    }

    // Return ID so caller can remove/replace it later
    return newNotif.id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }));
  },

  removeNotificationsByType: (type) => {
    console.log('[NotificationStore] Removing notifications of type:', type);
    set((state) => {
      const before = state.notifications.length;
      const filtered = state.notifications.filter((n) => n.type !== type);
      console.log('[NotificationStore] Removed', before - filtered.length, 'notifications');
      return { notifications: filtered };
    });
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));
