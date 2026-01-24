import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulerApi } from '../../api/scheduler';
import type { CreateScheduleDto } from '../../api/scheduler';
import { useSystemData } from '../../hooks/useSystemData';

const DAYS_MAP = [
  { id: 1, label: 'Pn' },
  { id: 2, label: 'Wt' },
  { id: 3, label: 'Śr' },
  { id: 4, label: 'Cz' },
  { id: 5, label: 'Pt' },
  { id: 6, label: 'Sb' },
  { id: 7, label: 'Nd' },
];

export const ScheduleDrawer = () => {
  const { data: systemData } = useSystemData();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form State
  const [label, setLabel] = useState('');
  const [actionType, setActionType] = useState<'OPEN' | 'CLOSE'>('CLOSE');
  const [hour, setHour] = useState('22');
  const [minute, setMinute] = useState('00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Queries
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulerApi.getSchedules,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: schedulerApi.createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsModalOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: schedulerApi.deleteSchedule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] })
  });

  const toggleMutation = useMutation({
    mutationFn: schedulerApi.toggleSchedule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] })
  });

  const resetForm = () => {
    setLabel('');
    setActionType('CLOSE');
    setHour('22');
    setMinute('00');
    setSelectedDays([]);
  };

  const handleCreate = () => {
    if (selectedDays.length === 0) {
      setValidationError('Wybierz przynajmniej jeden dzień!');
      return;
    }

    const finalLabel = label.trim() || 'Harmonogram';

    const payload: CreateScheduleDto = {
      device_id: systemData?.device_id || 'ESP32_MAIN_001',
      action_type: actionType,
      custom_label: finalLabel,
      hour: parseInt(hour),
      minute: parseInt(minute),
      days: selectedDays
    };
    createMutation.mutate(payload);
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const toggleDay = (id: number) => {
    if (selectedDays.includes(id)) {
      setSelectedDays(selectedDays.filter(d => d !== id));
    } else {
      setSelectedDays([...selectedDays, id]);
    }
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Codziennie';
    if (days.length === 5 && days.every(d => d <= 5)) return 'Pn-Pt';
    if (days.length === 2 && days.includes(6) && days.includes(7)) return 'Weekend';
    return days.sort().map(d => DAYS_MAP.find(dm => dm.id === d)?.label).join(', ');
  };

  return (
    <motion.div 
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-40 bg-[#0a0a0a] pt-12 px-6 pb-24 overflow-y-auto"
    >
       <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
          <div>
             <h2 className="text-3xl font-light text-white">Harmonogram</h2>
             <p className="text-white/40 text-xs mt-1">Automatyczne blokady i reguły</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center hover:bg-sky-500 transition-colors shadow-lg shadow-sky-900/20"
          >
            <Plus size={24} />
          </button>
       </div>

       {isLoading ? (
         <div className="text-white/30 text-center py-10">Ładowanie reguł...</div>
       ) : (
         <div className="space-y-4">
           {schedules?.length === 0 && (
             <div className="text-white/30 text-center py-10 italic">Brak zaplanowanych zadań</div>
           )}
           
           {schedules?.map((item) => (
             <motion.div 
               layout 
               key={item.id} 
               className={`p-4 rounded-2xl border ${item.active ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-50'} flex items-center justify-between group relative overflow-hidden`}
             >
                {/* Visual Indicator Line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.action_type === 'CLOSE' ? 'bg-red-500' : 'bg-green-500'}`} />

                <div className="flex items-center gap-4 pl-2">
                   <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border ${item.active ? 'bg-white/5 border-white/10' : 'bg-white/0 border-transparent'}`}>
                      <span className="text-lg font-bold text-white leading-none">
                        {String(item.hour).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] text-white/40 leading-none mt-0.5">
                        {String(item.minute).padStart(2, '0')}
                      </span>
                   </div>
                   
                   <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${item.action_type === 'CLOSE' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                          {item.action_type === 'CLOSE' ? 'ZAMYKANIE' : 'OTWIERANIE'}
                        </span>
                        <div className="text-sm font-bold text-white">{item.custom_label}</div>
                      </div>
                      <div className="text-xs text-white/50 flex items-center gap-2 mt-1">
                         <Calendar size={12} className="text-sky-500"/>
                         <span className="text-sky-400">{formatDays(item.days)}</span>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleMutation.mutate(item.id)}
                    className={`w-10 h-6 rounded-full p-1 flex transition-colors ${item.active ? 'justify-end bg-sky-600' : 'justify-start bg-white/10'}`}
                  >
                     <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </button>
                  
                  <button 
                    onClick={() => setDeleteId(item.id)}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
             </motion.div>
           ))}
         </div>
       )}

       {/* VALIDATION ERROR MODAL */}
       <AnimatePresence>
         {validationError && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={() => setValidationError(null)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-[#1a1a1a] w-full max-w-xs rounded-2xl p-6 border border-white/10 shadow-2xl text-center"
             >
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                   <X size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Błąd</h3>
                <p className="text-sm text-white/70 mb-6">{validationError}</p>
                
                <button 
                  onClick={() => setValidationError(null)}
                  className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                >
                  OK
                </button>
             </motion.div>
           </div>
         )}
       </AnimatePresence>

       {/* DELETE CONFIRMATION MODAL */}
       <AnimatePresence>
         {deleteId && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={() => setDeleteId(null)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-[#1a1a1a] w-full max-w-xs rounded-2xl p-6 border border-white/10 shadow-2xl text-center"
             >
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                   <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Usunąć regułę?</h3>
                <p className="text-sm text-white/50 mb-6 font-light">
                    Tej operacji nie można cofnąć.
                </p>
                
                <div className="flex gap-3">
                   <button 
                     onClick={() => setDeleteId(null)}
                     className="flex-1 py-3 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
                   >
                     Anuluj
                   </button>
                   <button 
                     onClick={handleDeleteConfirm}
                     className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/30"
                   >
                     Usuń
                   </button>
                </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>

       {/* CREATE MODAL */}
       <AnimatePresence>
         {isModalOpen && (
           <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={() => setIsModalOpen(false)}
             />
             
             <motion.div 
               initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
               className="relative bg-[#1a1a1a] w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl"
             >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Nowa Reguła</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Label */}
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Nazwa</label>
                    <input 
                      type="text" 
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="np. Nocna Blokada"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>

                  {/* Action Type */}
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Akcja</label>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => setActionType('CLOSE')}
                         className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${actionType === 'CLOSE' ? 'bg-red-500/20 border-red-500 text-red-100' : 'bg-white/5 border-transparent text-white/30'}`}
                       >
                         ZAMYKANIE
                       </button>
                       <button 
                         onClick={() => setActionType('OPEN')}
                         className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${actionType === 'OPEN' ? 'bg-green-500/20 border-green-500 text-green-100' : 'bg-white/5 border-transparent text-white/30'}`}
                       >
                         OTWIERANIE
                       </button>
                    </div>
                  </div>

                  {/* Time Picker */}
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Godzina</label>
                    <div className="flex gap-4 items-center justify-center bg-black/30 rounded-xl p-6 border border-white/5">
                        <input 
                          type="text"
                          inputMode="numeric" 
                          maxLength={2}
                          value={hour}
                          onChange={(e) => {
                             const v = e.target.value.replace(/\D/g, '');
                             if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= 23)) setHour(v);
                          }}
                          onBlur={() => {
                             if(hour === '') setHour('00');
                             else if(hour.length === 1) setHour('0' + hour);
                          }}
                          className="w-20 bg-transparent text-5xl font-light text-white text-center focus:outline-none border-b border-white/10 focus:border-sky-500 transition-colors placeholder-white/10"
                          placeholder="12"
                        />
                        <span className="text-4xl text-white/20 -mt-2">:</span>
                        <input 
                          type="text"
                          inputMode="numeric" 
                          maxLength={2}
                          value={minute}
                          onChange={(e) => {
                             const v = e.target.value.replace(/\D/g, '');
                             if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= 59)) setMinute(v);
                          }}
                          onBlur={() => {
                             if(minute === '') setMinute('00');
                             else if(minute.length === 1) setMinute('0' + minute);
                          }}
                          className="w-20 bg-transparent text-5xl font-light text-white text-center focus:outline-none border-b border-white/10 focus:border-sky-500 transition-colors placeholder-white/10"
                          placeholder="30"
                        />
                    </div>
                  </div>

                  {/* Days Selector */}
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Dni Tygodnia</label>
                    <div className="flex justify-between">
                       {DAYS_MAP.map((day) => (
                         <button
                           key={day.id}
                           onClick={() => toggleDay(day.id)}
                           className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                             selectedDays.includes(day.id) 
                               ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.4)]' 
                               : 'bg-white/5 text-white/30 hover:bg-white/10'
                           }`}
                         >
                           {day.label}
                         </button>
                       ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleCreate}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-gray-200 transition-colors"
                  >
                    Dodaj do Harmonogramu
                  </button>
                </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </motion.div>
  );
};
