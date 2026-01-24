import React from 'react';
import { cn } from '../../lib/utils';
import { Wifi, WifiOff } from 'lucide-react';

interface ConnectionBadgeProps {
  status: 'ONLINE' | 'OFFLINE';
  className?: string;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ status, className }) => {
  const isOnline = status === 'ONLINE';

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-300",
      isOnline 
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
        : "bg-danger/10 border-danger/30 text-danger",
      className
    )}>
      {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      <span className="text-xs font-bold tracking-wider">
        {status}
      </span>
    </div>
  );
};
