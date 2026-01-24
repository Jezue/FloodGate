import { useState, useEffect } from 'react';
import { Wind, Droplets } from 'lucide-react';
import { SmartBatteryIcon } from './SmartBatteryIcon';

interface TopRightInfoProps {
  battery: number;
  weather: {
    wind?: number;
    humidity?: number;
  };
  systemMode?: 'AUTOMATIC' | 'MANUAL' | 'KONTROLA';
}

export function TopRightInfo({ battery, weather, systemMode = 'AUTOMATIC' }: TopRightInfoProps) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  const isManual = systemMode === 'MANUAL' || systemMode === 'KONTROLA';

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
      
      const day = now.toLocaleDateString('pl-PL', { weekday: 'short' }).toUpperCase().replace('.', '');
      const dayOfMonth = String(now.getDate()).padStart(2, '0');
      const month = now.toLocaleDateString('pl-PL', { month: 'short' }).toUpperCase().replace('.', '');
      
      setDate(`${day}, ${dayOfMonth} ${month}`);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000 * 60); // Update every minute
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-4 text-white/90">
      <div className="flex items-center gap-3 text-sm font-mono">
        <div className="flex flex-col items-center gap-1">
          <SmartBatteryIcon percentage={battery} />
          <span>{battery}%</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="text-center">
          <div>{time}</div>
          <div className="text-xs text-white/50">{date}</div>
        </div>
      </div>
      
      <div className="flex flex-col items-start gap-2">
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 flex items-center gap-3 w-40">
          <Wind size={16} className="text-sky-300" />
          <div className="text-xs">
            <div className="text-white/50">WIATR</div>
            <div className="font-bold">{weather.wind ?? 0} km/h</div>
          </div>
        </div>
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 flex items-center gap-3 w-40">
          <Droplets size={16} className="text-sky-300" />
          <div className="text-xs">
            <div className="text-white/50">WILGOTNOŚĆ</div>
            <div className="font-bold">{weather.humidity ?? 0}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
