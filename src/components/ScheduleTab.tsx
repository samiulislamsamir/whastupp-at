import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Clock, Send, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScheduleTabProps {
  onComplete: () => void;
  staff?: any;
  initialContent?: string;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ onComplete, staff, initialContent }) => {
  const [content, setContent] = useState(initialContent || '');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !auth.currentUser) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'scheduled_messages'), {
        content,
        scheduledTime: new Date(time).toISOString(),
        status: 'pending',
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error("Error scheduling message:", error);
      alert("Failed to schedule message. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Clock className="w-5 h-5 text-indigo-600" />
        </div>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Schedule Auto Message</h2>
      </div>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-10 flex flex-col items-center justify-center text-center space-y-4"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <Calendar className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase">Notice Scheduled!</h3>
              <p className="text-xs text-slate-500 font-bold">Queued for delivery...</p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Notice/Message Content</label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none font-mono text-slate-700 shadow-inner"
                placeholder="Type the message you want to post to the group..."
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Target Post Date & Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all pl-10 font-bold"
                />
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${
                loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white font-black text-xs uppercase tracking-widest py-3 squared-lg shadow-md transition-all mt-4 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]`}
            >
              <Send className="w-4 h-4" />
              {loading ? 'Confirming...' : 'Confirm Schedule'}
            </button>
          </form>
        )}
      </AnimatePresence>
    </div>
  );
};
