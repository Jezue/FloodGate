import { Home, Calendar, Settings } from 'lucide-react';

interface BottomDockProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const BottomDock = ({ activeView, setActiveView }: BottomDockProps) => (
  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
    <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
      <button 
        onClick={() => setActiveView('HOME')}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeView === 'HOME' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'text-white/50 hover:text-white'}`}
      >
        <Home size={20} />
      </button>
      
      <button 
        onClick={() => setActiveView('SCHEDULE')}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeView === 'SCHEDULE' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'text-white/50 hover:text-white'}`}
      >
        <Calendar size={20} />
      </button>

      <button 
        onClick={() => setActiveView('SETTINGS')}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeView === 'SETTINGS' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'text-white/50 hover:text-white'}`}
      >
        <Settings size={20} />
      </button>
    </div>
  </div>
);
