import React from 'react';
import { cn } from '../../lib/utils';
import { STYLES } from '../../lib/ui-constants';
import type { LucideIcon } from 'lucide-react';

interface StatusCardProps {
  title: string;
  value: string | number | React.ReactNode;
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  icon: Icon,
  variant = 'default',
  className,
}) => {
  const variantStyles = {
    default: 'text-white border-white/10',
    danger: 'text-danger border-danger/50 bg-danger/10',
    warning: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10',
    success: 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10',
  };

  return (
    <div className={cn(
      STYLES.GLASS_PANEL,
      "p-4 flex flex-col items-center justify-center relative overflow-hidden h-32",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-center gap-2 mb-2 w-full">
        <Icon className="w-5 h-5 opacity-80" />
        <span className="text-sm font-medium opacity-70 uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">
        {value}
      </div>
    </div>
  );
};
