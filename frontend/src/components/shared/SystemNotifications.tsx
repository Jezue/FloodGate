import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSystemData } from '../../hooks/useSystemData';
import { useEffect, useState, useRef } from 'react';

export function SystemNotifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const { addNotification, removeNotification } = useNotificationStore();
  const { isOffline, data } = useSystemData();
  
  const [wasConnected, setWasConnected] = useState(true);
  const [wasBackendConnected, setWasBackendConnected] = useState(true);
    const backendErrorNotifIdRef = useRef<string | null>(null);
    const espErrorNotifIdRef = useRef<string | null>(null);

  // Monitor Backend connection (robust: always add/remove error on offline/online)
  useEffect(() => {
    if (isOffline) {
      if (!backendErrorNotifIdRef.current) {
        const notifId = addNotification({
          type: 'error',
          message: 'Brak połączenia z serwerem',
          icon: <XCircle size={14} />,
          persistent: true,
        });
        backendErrorNotifIdRef.current = notifId;
        setWasBackendConnected(false);
      }
    } else {
      if (backendErrorNotifIdRef.current) {
        removeNotification(backendErrorNotifIdRef.current);
        backendErrorNotifIdRef.current = null;
      }
      if (!wasBackendConnected) {
        addNotification({
          type: 'success',
          message: 'Połączono z serwerem',
          icon: <CheckCircle size={14} />,
          persistent: false,
        });
        setWasBackendConnected(true);
      }
    }
  }, [isOffline, addNotification, removeNotification, wasBackendConnected]);

  // Monitor ESP32 connection (use backend's connection_status)
  useEffect(() => {
    const espConnectionStatus = data?.connection_status;
    
    // Skip if no data yet
    if (!espConnectionStatus) return;

    const isESPConnected = espConnectionStatus === 'ONLINE';

    if (!isESPConnected && wasConnected) {
      // ESP32 just went offline (backend determined)
      const notifId = addNotification({
        type: 'warning',
        message: 'Brak połączenia z bramą',
        icon: <AlertTriangle size={14} />,
        persistent: true,
      });
      espErrorNotifIdRef.current = notifId;
      setWasConnected(false);
    } else if (isESPConnected && !wasConnected) {
      // ESP32 reconnected
      if (espErrorNotifIdRef.current) {
        removeNotification(espErrorNotifIdRef.current);
        espErrorNotifIdRef.current = null;
      }
      addNotification({
        type: 'success',
        message: 'Połączono z bramą',
        icon: <CheckCircle size={14} />,
        persistent: false,
      });
      setWasConnected(true);
    }
  }, [data?.connection_status, wasConnected, addNotification, removeNotification]);

  const getNotificationStyle = (type: 'success' | 'warning' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100';
      case 'warning':
        return 'bg-amber-500/20 border-amber-400/30 text-amber-100';
      case 'error':
        return 'bg-red-500/20 border-red-400/30 text-red-100';
      case 'info':
      default:
        return 'bg-blue-500/20 border-blue-400/30 text-blue-100';
    }
  };

  return (
    <div className="fixed top-[140px] inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notif) => (
          <motion.div
            layout
            key={notif.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3 }}
            className={`
              backdrop-blur-md border rounded-full px-4 py-2 
              flex items-center gap-2 shadow-lg
              ${getNotificationStyle(notif.type)}
            `}
          >
            <div className="flex-shrink-0">{notif.icon}</div>
            <span className="text-xs font-medium whitespace-nowrap">
              {notif.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
