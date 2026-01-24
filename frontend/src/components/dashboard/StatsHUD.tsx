import { CloudRain, Droplets, MapPin } from 'lucide-react';

interface WeatherData {
  risk_index: string | number;
  rain: number;
  temp: number;
}

interface StatsHUDProps {
  weather: WeatherData;
  battery: number;
  mode: string;
  isAlarm: boolean;
  cityName: string;
  waterLevel: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const StatsHUD = ({ weather, battery: _battery, mode, isAlarm, cityName, waterLevel }: StatsHUDProps) => (
  <>
    {/* Top - Status indicators */}
    <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start z-20 pointer-events-none">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-1">TRYB SYSTEMU</span>
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              isAlarm 
                ? 'bg-red-500' 
                : mode === 'MANUAL' 
                  ? 'bg-orange-400 shadow-[0_0_10px_#fb923c]' 
                  : 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
            }`} />
            <span className="text-lg font-medium text-white tracking-wide">
              {mode === 'AUTOMATIC' ? 'AUTOMATYCZNY' : (mode === 'KONTROLA' ? 'KONTROLA' : 'MANUALNY')}
            </span>
        </div>
      </div>
    </div>

    {/* Bottom - Weather and details */}
    <div className="absolute bottom-24 left-0 right-0 px-8 z-20 flex justify-between items-end pointer-events-none">
      <div className="flex flex-col gap-1">
         <div className="flex items-center gap-2 text-white/50 mb-1">
            <CloudRain size={16} />
            <span className="text-[10px] uppercase tracking-widest">POGODA</span>
         </div>
         <div className="text-3xl font-light text-white">{weather.temp}°</div>
         <div className="text-xs text-white/60">{weather.rain} mm/h</div>
         <div className="flex items-center gap-1 text-white/60 mt-1">
            <MapPin size={12} />
            <span className="text-xs">{cityName}</span>
         </div>
      </div>

      <div className="flex flex-col items-end gap-1">
         <div className="flex items-center gap-2 text-white/50 mb-1">
            <Droplets size={16} />
            <span className="text-[10px] uppercase tracking-widest">CZUJNIK</span>
         </div>
         <div className={`text-xl font-bold tracking-tight ${isAlarm ? 'text-red-500' : 'text-sky-300'}`}>
           {isAlarm ? 'WODA WYKRYTA' : 'SUCHO'}
         </div>
         <div className="text-xs text-white/40">Poziom wody: {waterLevel} cm</div>
      </div>
    </div>
  </>
);
