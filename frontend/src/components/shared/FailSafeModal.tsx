import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, X } from 'lucide-react';

interface FailSafeModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onAccept: () => void;
  onReject: () => void;
}

export const FailSafeModal = ({ isOpen, remainingSeconds, onAccept, onReject }: FailSafeModalProps) => {
  const [countdown, setCountdown] = useState(remainingSeconds);

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(remainingSeconds);
    
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, remainingSeconds]);

  const progress = (countdown / remainingSeconds) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onReject}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-gradient-to-br from-red-900/90 to-orange-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-red-500/30 max-w-md w-full pointer-events-auto overflow-hidden">
              
              {/* Header */}
              <div className="p-6 border-b border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">FAIL-SAFE AKTYWNY</h2>
                    <p className="text-sm text-red-300">Wykryto wodę - tryb KONTROLA</p>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <div className="p-8 text-center">
                <div className="text-7xl font-bold text-white mb-4 tabular-nums">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </div>
                <p className="text-red-200 mb-6">
                  Kurtyna zostanie automatycznie opuszczona za
                </p>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-red-950/50 rounded-full overflow-hidden mb-8">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={onReject}
                    className="flex-1 py-4 px-6 rounded-xl bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 text-white font-semibold transition-all flex items-center justify-center gap-2 hover:scale-105"
                  >
                    <X className="w-5 h-5" />
                    Anuluj
                  </button>
                  <button
                    onClick={onAccept}
                    className="flex-1 py-4 px-6 rounded-xl bg-red-600 hover:bg-red-500 border border-red-400/30 text-white font-semibold transition-all flex items-center justify-center gap-2 hover:scale-105 shadow-lg shadow-red-500/30"
                  >
                    <Check className="w-5 h-5" />
                    Opuść Teraz
                  </button>
                </div>
              </div>

              {/* Footer Info */}
              <div className="px-6 py-4 bg-red-950/30 border-t border-red-500/20">
                <p className="text-xs text-red-300 text-center">
                  ⚠️ Zaakceptowanie spowoduje natychmiastowe opuszczenie kurtyny. Anulowanie pozostawi kurtynę w górze.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
