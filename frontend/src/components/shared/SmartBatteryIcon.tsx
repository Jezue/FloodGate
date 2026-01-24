import { Battery } from 'lucide-react';

interface SmartBatteryIconProps {
  percentage: number;
}

export function SmartBatteryIcon({ percentage }: SmartBatteryIconProps) {
  const getBatteryColor = () => {
    if (percentage >= 51) return 'text-green-400';
    if (percentage >= 26) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <Battery size={16} className={getBatteryColor()} />
  );
}
