import React from 'react';
import { motion } from 'framer-motion';
import { CurtainState } from '../../api/types';
import { cn } from '../../lib/utils';
import { STYLES } from '../../lib/ui-constants';

interface CurtainVisualProps {
  curtainState: CurtainState;
  isWaterDetected: boolean;
  className?: string;
}

export const CurtainVisual: React.FC<CurtainVisualProps> = ({
  curtainState,
  isWaterDetected,
  className,
}) => {
  // 0 = UP (Open), 1 = DOWN (Closed/Protected)
  // We want visual height: 0% when UP, 100% when DOWN
  const isClosed = curtainState === CurtainState.DOWN;
  const isMoving = curtainState === CurtainState.MOVING;
  
  // Animation variants
  const curtainVariants = {
    open: { height: "10%" },
    closed: { height: "100%" },
  };

  const waterVariants = {
    dry: { height: "0%" },
    flood: { height: "30%" }, // Water rises to 30% of view
  };

  return (
    <div className={cn("relative h-64 w-full overflow-hidden border-white/5 bg-black/20", STYLES.GLASS_PANEL, className)}>
      
      {/* Background / Sky / Garage Interior */}
      <div className="absolute inset-0 bg-gradient-to-b from-deep-800 to-deep-900 opacity-50" />

      {/* Grid Lines (Decoration) */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

      {/* The Curtain/Barrier */}
      <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col pointer-events-none">
        {/* Top Motor Housing */}
        <div className="h-4 bg-deep-800 border-b border-white/10 z-20 shadow-lg" />
        
        {/* Animated Barrier */}
        <motion.div
          initial={false}
          animate={isClosed ? "closed" : "open"}
          variants={curtainVariants}
          transition={{ 
            duration: 2, 
            ease: "easeInOut",
            type: "spring",
            stiffness: 50
          }}
          className={cn(
            "w-full bg-gradient-to-b from-gray-700 to-gray-600 border-b-4 relative shadow-xl z-10",
            isWaterDetected ? "border-danger" : "border-emerald-500/50"
          )}
        >
          {/* Barrier Texture */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.2)_1px,transparent_1px)] bg-[size:100%_20px]" />
          
          {/* Status Light on Barrier */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <motion.div 
              animate={{ opacity: isMoving ? [1, 0.5, 1] : 1 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className={cn(
                "w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]",
                isMoving ? "bg-yellow-400 text-yellow-400" :
                isClosed ? "bg-emerald-400 text-emerald-400" : "bg-gray-400 text-gray-400"
              )}
            />
          </div>
        </motion.div>
      </div>

      {/* Water Effect (Overlay) */}
      <motion.div
        initial="dry"
        animate={isWaterDetected ? "flood" : "dry"}
        variants={waterVariants}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute bottom-0 left-0 right-0 z-30"
      >
        {/* Water Surface Animation */}
        <div className="relative w-full h-full bg-blue-500/40 backdrop-blur-sm border-t border-blue-400/50">
           <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="absolute -top-3 left-0 w-[200%] h-4 bg-repeat-x opacity-50"
              style={{ 
                backgroundImage: 'radial-gradient(circle at 10px -5px, transparent 12px, #3b82f6 13px)', 
                backgroundSize: '40px 20px' 
              }} 
           />
           {/* Danger Tint if flood */}
           {isWaterDetected && (
             <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
           )}
        </div>
      </motion.div>

       {/* Labels */}
       <div className="absolute bottom-2 right-2 text-[10px] text-white/20 font-mono z-0">
          VISUALIZATION_MODULE_V1
       </div>
    </div>
  );
};
