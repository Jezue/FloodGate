import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

interface SettingsDrawerProps {
  city: string;
  onCityChange: (city: string) => void;
  failSafeTimeout: number;
  onTimeoutChange: (min: number) => void;
  systemMode: 'AUTOMATIC' | 'MANUAL';
  onModeChange: (mode: 'AUTOMATIC' | 'MANUAL') => void;
}

interface CitySuggestion {
  name: string;
  country: string;
  admin1?: string;
}

export const SettingsDrawer = ({ city, onCityChange, failSafeTimeout, onTimeoutChange, systemMode, onModeChange }: SettingsDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState(city);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeoutVal, setTimeoutVal] = useState(failSafeTimeout);

  useEffect(() => {
    setTimeoutVal(failSafeTimeout);
  }, [failSafeTimeout]);

  const handleTimeoutCommit = () => {
     onTimeoutChange(timeoutVal);
  };

  useEffect(() => {
    setSearchQuery(city);
  }, [city]);

  const searchCities = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=pl&format=json`
      );
      const data = await response.json();
      
      if (data.results) {
        setSuggestions(data.results.map((r: any) => ({
          name: r.name,
          country: r.country,
          admin1: r.admin1
        })));
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('City search error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    searchCities(value);
  };

  const handleCitySelect = (suggestion: CitySuggestion) => {
    const cityName = suggestion.name;
    console.log('[Settings] City selected:', cityName, 'Full suggestion:', suggestion);
    
    // Close dropdown first
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Then update search query and trigger change
    setSearchQuery(cityName);
    
    // Small delay to ensure UI updates before API call
    setTimeout(() => {
      console.log('[Settings] Calling onCityChange with:', cityName);
      onCityChange(cityName);
    }, 50);
  };

  return (
    <motion.div 
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-40 bg-[#0a0a0a] pt-12 px-6 pb-24"
    >
       <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
          <div>
             <h2 className="text-3xl font-light text-white">Ustawienia</h2>
             <p className="text-white/40 text-xs mt-1">Konfiguracja systemu</p>
          </div>
       </div>
       
       {/* Simple Config Items */}
       <div className="space-y-6">
         {/* City Input with Autocomplete */}
         <div className="py-2 relative">
            <label className="text-white/80 text-sm mb-2 block">Miasto (pogoda)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Wpisz nazwę miasta..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 transition-colors"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleCitySelect(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-2 text-white/90 border-b border-white/5 last:border-0"
                  >
                    <MapPin size={14} className="text-sky-400" />
                    <div>
                      <div className="font-medium">{suggestion.name}</div>
                      <div className="text-xs text-white/50">
                        {suggestion.admin1 && `${suggestion.admin1}, `}{suggestion.country}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {loading && (
              <div className="absolute right-4 top-10 text-white/40 text-xs">
                Szukam...
              </div>
            )}
         </div>

         {/* System Mode Toggle */}
         <div className="py-4 border-t border-white/5">
            <label className="text-white/80 text-sm mb-3 block">Tryb pracy systemu</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => onModeChange('AUTOMATIC')}
                className={`flex-1 py-3 rounded-lg border transition-all ${
                  systemMode === 'AUTOMATIC'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMode === 'AUTOMATIC' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/30'
                  }`} />
                  <span className="font-medium text-sm">AUTOMATIC</span>
                </div>
                <p className="text-xs mt-1 opacity-70">Natychmiastowe zamknięcie</p>
              </button>
              <button
                onClick={() => onModeChange('MANUAL')}
                className={`flex-1 py-3 rounded-lg border transition-all ${
                  systemMode === 'MANUAL'
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-100'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMode === 'MANUAL' ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]' : 'bg-white/30'
                  }`} />
                  <span className="font-medium text-sm">MANUAL</span>
                </div>
                <p className="text-xs mt-1 opacity-70">Wymaga potwierdzenia</p>
              </button>
            </div>
            <p className="text-xs text-white/40 mt-3">
              {systemMode === 'AUTOMATIC' 
                ? 'Brama zamknie się automatycznie przy wykryciu wody.' 
                : 'System poprosi o potwierdzenie przed zamknięciem bramy.'}
            </p>
         </div>
         <div className="py-4">
            <div className="flex justify-between mb-4">
              <span className="text-white/80">Czas na reakcję</span>
              <span className="text-sky-400 font-mono">{String(timeoutVal).padStart(2, '0')}:00 min</span>
            </div>
            
            <div className="relative w-full h-10 flex items-center">
               {/* Track */}
               <div className="absolute inset-x-0 h-1 bg-white/10 rounded-full" />
               
               {/* Fill */}
               <motion.div 
                 className="absolute left-0 h-1 bg-sky-500 rounded-full" 
                 style={{ width: `${((timeoutVal - 1) / 14) * 100}%` }}
               />
               
               <input 
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={timeoutVal}
                  onChange={(e) => setTimeoutVal(Number(e.target.value))}
                  onMouseUp={handleTimeoutCommit}
                  onTouchEnd={handleTimeoutCommit}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
               />

               {/* Thumb Visual (Optional, synced with value) */}
               <motion.div
                 className="absolute h-4 w-4 bg-white rounded-full shadow-lg pointer-events-none"
                 style={{ left: `${((timeoutVal - 1) / 14) * 100}%`, x: '-50%' }}
                 layoutId="sliderThumb"
               />
            </div>
             <p className="text-xs text-white/40 mt-2">Czas oczekiwania na potwierdzenie przed automatycznym zamknięciem bramy.</p>
          </div>
       </div>
    </motion.div>
  );
};
