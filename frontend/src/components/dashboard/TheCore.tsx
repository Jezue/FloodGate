import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Shield, Power } from 'lucide-react';

interface TheCoreProps {
  isClosed: boolean;
  isAlarm: boolean;
  onClick: () => void;
  isLoading?: boolean;
}

export const TheCore = ({ isClosed, isAlarm, onClick, isLoading = false }: TheCoreProps) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center group cursor-pointer" onClick={!isLoading ? onClick : undefined}>
      
      {/* Outer status ring */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className={`absolute inset-0 rounded-full border border-dashed opacity-30 ${isAlarm ? 'border-red-500' : 'border-white'}`}
      />
      
      {/* Pulsating ring */}
      <motion.div 
        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
        className={`absolute inset-4 rounded-full border border-white/10 ${isAlarm ? 'bg-red-500/10' : 'bg-sky-500/10'} backdrop-blur-md`}
      />

      {/* Main button / visualization */}
      <motion.div
        layout
        className={`
          relative w-48 h-48 rounded-full shadow-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-500
          ${isClosed 
            ? isAlarm 
              ? 'bg-gradient-to-br from-red-900 to-black border-2 border-red-500 shadow-[0_0_60px_rgba(220,38,38,0.6)]' // Alarm + Closed
              : 'bg-gradient-to-br from-slate-800 to-black border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)]' // Closed (Normal)
            : isAlarm
              ? 'bg-gradient-to-br from-sky-400 to-blue-600 border-4 border-red-500 shadow-[0_0_60px_rgba(220,38,38,0.5)] animate-pulse' // Alarm + Open
              : 'bg-gradient-to-br from-sky-400 to-blue-600 border border-white/20 shadow-[0_0_40px_rgba(56,189,248,0.4)]' // Open (Normal)
          }
        `}
      >
        {/* Internal liquid animation */}
        {!isClosed && (
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay animate-spin-slow" />
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full z-10"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 border-4 border-white/30 border-t-sky-400 rounded-full"
            />
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {isAlarm ? (
            isClosed ? (
              // Alarm + Closed = SECURED (Red/Black)
              <motion.div key="alarm-closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <Shield size={48} className="text-red-500 mb-3" />
                <span className="text-xl font-bold text-white tracking-tight">ZABEZPIECZONA</span>
                <div className="text-[10px] text-white/60 mt-2 uppercase tracking-widest text-center">
                  <div>Dotknij by otworzyć</div>
                  <div>bramę</div>
                </div>
              </motion.div>
            ) : (
              // Alarm + Open = DANGER (Blue with Red Border)
              <motion.div key="alarm-open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <Shield size={48} className="text-white mb-3" />
                <span className="text-xl font-bold text-white tracking-tight">WODA!</span>
                <div className="text-[10px] text-white/80 mt-2 uppercase tracking-widest text-center font-bold">
                  <div>Dotknij by zamknąć</div>
                  <div>bramę</div>
                </div>
              </motion.div>
            )
          ) : isClosed ? (
            <motion.div key="closed" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="flex flex-col items-center">
              <Lock size={48} className="text-slate-400 mb-3" />
              <span className="text-xl font-bold text-white tracking-tight">ZAMKNIĘTA</span>
              <div className="text-[10px] text-white/60 mt-2 uppercase tracking-widest text-center">
                <div>Dotknij by otworzyć</div>
                <div>bramę</div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="flex flex-col items-center">
              <Power size={48} className="text-white mb-3" />
              <span className="text-xl font-bold text-white tracking-tight">OTWARTA</span>
              <div className="text-[10px] text-white/60 mt-2 uppercase tracking-widest text-center">
                <div>Dotknij by zamknąć</div>
                <div>bramę</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
