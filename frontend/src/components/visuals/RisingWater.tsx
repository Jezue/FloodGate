import { motion } from 'framer-motion';

interface RisingWaterProps {
  isWater: boolean;
  waterLevelCm?: number; // Water level in cm
}

// Water level to screen height percentage mapping
// 0cm = 5% (small wave at bottom)
// 50cm = 50% (half screen)
// 100cm = 90% (almost full screen)
const calculateWaterHeight = (cm: number): string => {
  if (cm === 0) return '1%'; // Idle (minimal)
  // 1:1 Mapping: 1cm = 1% height (approx matching screen height for flood scale)
  // Max 100%
  const percentage = Math.min(100, cm);
  return `${percentage}%`;
};

export const RisingWater = ({ isWater, waterLevelCm = 0 }: RisingWaterProps) => {
  const height = isWater && waterLevelCm > 0 
    ? calculateWaterHeight(waterLevelCm) 
    : '1%'; // Minimal wave height

  return (
    <motion.div
      initial={{ height: "1%" }}
      animate={{ height }}
      transition={{ type: "spring", stiffness: 20, damping: 10 }}
      className="fixed bottom-0 left-0 right-0 z-10 bg-[rgba(59,130,246,0.8)] backdrop-blur-sm pointer-events-none"
    >
      
      {/* Animated wave */}
      <div className="absolute -top-12 left-0 w-full h-12 overflow-hidden">
        <svg className="w-[200%] h-auto absolute bottom-0 left-0" preserveAspectRatio="none" viewBox="0 0 1440 32">
          <motion.path 
            fill="rgba(59, 130, 246, 0.8)" 
            d="M0,15.3C240,30,480,0,720,15.3S1200,30,1440,15.3V32H0V15.3Z"
            animate={{
              x: ['-50%', '0%']
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: 'linear',
              repeatType: 'loop'
            }}
          />
        </svg>
      </div>
    </motion.div>
  );
};
