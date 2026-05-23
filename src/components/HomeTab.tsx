import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Home, 
  Users, 
  ClipboardList, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  Calendar, 
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomeTabProps {
  staff: any;
  setActiveTab: (tab: 'home' | 'attendance' | 'students' | 'schedule' | 'ai' | 'admin') => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ staff, setActiveTab }) => {
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    let unsubscribeStudents: (() => void) | null = null;

    // 1. Subscription to student counts for exact live metrics, filtered by authenticated ownerId
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeStudents) {
        unsubscribeStudents();
        unsubscribeStudents = null;
      }

      if (currentUser) {
        const q = query(collection(db, 'students'), where('ownerId', '==', currentUser.uid));
        unsubscribeStudents = onSnapshot(q, (snapshot) => {
          setStudentCount(snapshot.size);
        }, (err) => {
          console.error("Error setting up student count listener:", err);
        });
      } else {
        setStudentCount(null);
      }
    });

    // 2. Real-time system clock update
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => {
      unsubscribeAuth();
      if (unsubscribeStudents) {
        unsubscribeStudents();
      }
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-6 font-sans max-w-5xl mx-auto mt-2 px-2 sm:px-0">
      
      {/* 1. Welcome Card and Greeting Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl border border-indigo-600/20">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-indigo-600/30 border border-indigo-400/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-200">
              <Home className="w-3 h-3 text-indigo-300" /> Active Registry Session
            </div>
            <h2 className="text-xl md:text-3xl font-black tracking-tight mt-1">
              Welcome back, {staff?.name || 'Operative Staff'}
            </h2>
            <p className="text-xs text-indigo-200 font-medium leading-relaxed max-w-xl">
              Manage your classroom protocols, write student attendance cards, coordinate academic schedules, and use Gemini AI assistant tools effortlessly.
            </p>
          </div>
          
          {/* Live System Clock Widget */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-[200px] flex flex-col items-center justify-center text-center shadow-lg">
            <span className="text-[9px] font-black tracking-widest uppercase text-indigo-200">Active Timestamp</span>
            <span className="text-2xl font-black font-mono tracking-widest mt-1 text-white tabular-nums drop-shadow-sm">{time || '--:--:--'}</span>
            <span className="text-[10px] font-bold text-indigo-100 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-300" /> {dateStr || '...'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Grid Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Student IDs Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Registered Students</p>
            <p className="text-xl font-black text-slate-800 mt-1 font-mono">
              {studentCount !== null ? `${studentCount} Students` : 'Loading...'}
            </p>
          </div>
        </div>

        {/* Assigned Staff ID Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-600">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Your Operator ID</p>
            <p className="text-xl font-black text-slate-800 mt-1 font-mono">
              {staff?.numericId ? `ST-${staff.numericId}` : 'N/A'}
            </p>
          </div>
        </div>

        {/* System Integrity status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Authentication State</p>
            <p className="text-sm font-black text-emerald-600 mt-1 flex items-center gap-1 uppercase tracking-wider">
              ONLINE & REGISTERED
            </p>
          </div>
        </div>

      </div>

      {/* 3. Section Navigation / Quick Actions Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest pl-1">Quick Action Navigation</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quick Action: Daily Roll Call */}
          <button
            onClick={() => setActiveTab('attendance')}
            className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer text-left"
          >
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 leading-tight flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Daily Roll Call
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-600" />
              </h4>
              <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1">
                Open the attendance register to document student check-ins, record counts, and save logs.
              </p>
            </div>
          </button>

          {/* Quick Action: Student Records */}
          <button
            onClick={() => setActiveTab('students')}
            className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer text-left"
          >
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 leading-tight flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Student ID Records
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-600" />
              </h4>
              <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1">
                Access the registry to add new student IDs, run list searches, view individual statistics, or edit details.
              </p>
            </div>
          </button>

          {/* Quick Action: Schedule Post */}
          <button
            onClick={() => setActiveTab('schedule')}
            className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer text-left"
          >
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 leading-tight flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Schedule Post
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-600" />
              </h4>
              <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1">
                Post daily updates, coordinate lecture routines, and dispatch real-time calendar updates to external sources.
              </p>
            </div>
          </button>

          {/* Quick Action: AI Smart Assist */}
          <button
            onClick={() => setActiveTab('ai')}
            className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer text-left"
          >
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all select-none">
              <Sparkles className="w-6 h-6 text-indigo-500 group-hover:text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 leading-tight flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                AI Assistance
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-600" />
              </h4>
              <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1">
                Draft student notifications, auto-calculate summaries, or chat with the Gemini AI engine for smart schedule updates.
              </p>
            </div>
          </button>
          
        </div>
      </div>

      {/* 4. Administrative Controls Section (Only if they want to manage Sheets, Script, and Developer Profile attributes) */}
      <div className="pt-4 border-t border-slate-200">
        <div id="admin-terminal-shortcut" className="bg-slate-950 text-white rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-1 text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-wider border border-rose-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
              Administrative Endpoint Gateway
            </div>
            <h4 className="text-sm font-black uppercase tracking-tight text-white mt-1">System Configuration Terminal</h4>
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
              Open the secure administrative panel to link Google Spreadsheet IDs, update background Web App URLs, invoke student database synchronizations, or customize the Developer Profile card attributes.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/admin'}
            className="relative z-10 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow transition-all border border-slate-700 shrink-0 cursor-pointer text-center"
          >
            <Terminal className="w-4 h-4 text-rose-400 animate-pulse" />
            Launch Config Panel
          </button>
        </div>
      </div>

    </div>
  );
};
