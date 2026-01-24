import { motion } from 'framer-motion';

interface AtmosphereProps {
  isAlarm: boolean;
}

export const Atmosphere = ({ isAlarm }: AtmosphereProps) => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
    {/* Main gradient */}
    <motion.div 
      animate={{ 
        background: isAlarm 
          ? 'radial-gradient(circle at 50% 120%, #450a0a 0%, #000000 70%)' 
          : 'radial-gradient(circle at 50% 120%, #0c4a6e 0%, #000000 70%)' 
      }}
      className="absolute inset-0 transition-all duration-1000 ease-in-out"
    />
    
    {/* Fog / Noise texture */}
    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none" />
    
    {/* Floating particles (Ambient light) */}
    <motion.div 
      animate={{ opacity: isAlarm ? 0.8 : 0.3, scale: [1, 1.2, 1] }}
      transition={{ duration: 8, repeat: Infinity }}
      className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] ${isAlarm ? 'bg-red-900' : 'bg-sky-900'}`}
    />
  </div>
);
