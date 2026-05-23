import React, { useState } from 'react';
import { School, ClipboardList, UserPlus, Clock, LogOut, Settings, ShieldAlert, Sparkles, User as UserIcon, ShieldCheck, Menu, X, Home, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { ProfileModal } from './ProfileModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'home' | 'attendance' | 'students' | 'schedule' | 'ai' | 'admin';
  setActiveTab: (tab: 'home' | 'attendance' | 'students' | 'schedule' | 'ai' | 'admin') => void;
  staff?: any;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, staff }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const handleLogout = () => signOut(auth);

  React.useEffect(() => {
    setImgError(false);
  }, [staff?.photoURL]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-x-hidden">
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} staff={staff} />
      
      {/* Navbar with centered layout */}
      <header id="header" className="h-16 bg-indigo-700 text-white shadow-lg z-50 shrink-0 flex items-center px-4 sm:px-6 sticky top-0">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-3 items-center">
          
          {/* Profile Option on the LEFT */}
          <div className="flex items-center gap-3 justify-start">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-full bg-indigo-500 border-2 border-indigo-300 flex items-center justify-center text-sm font-bold shadow-inner uppercase overflow-hidden hover:scale-105 hover:border-white transition-all cursor-pointer shadow-md"
              title="প্রোফাইল সেটিংস (Profile Settings)"
            >
              {staff?.photoURL && !imgError ? (
                <img 
                  src={staff.photoURL} 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover" 
                  onError={() => setImgError(true)}
                />
              ) : (
                staff?.name?.charAt(0) || 'A'
              )}
            </button>
            {staff && (
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 leading-none">Operative Staff</span>
                <span className="text-xs font-bold leading-tight mt-0.5 truncate max-w-[120px]" title={staff.name}>{staff.name}</span>
              </div>
            )}
          </div>

          {/* App Name & Badge in the CENTER */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm hidden sm:block">
                <School className="w-4 h-4" />
              </div>
              <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-none uppercase">School Intelligence</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-indigo-200">Control Registry</p>
              {staff?.numericId && (
                <span className="text-[7px] sm:text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest leading-none">
                  Authenticated: {staff.numericId}
                </span>
              )}
            </div>
          </div>

          {/* 3-line Menu Button as Toggle on the RIGHT */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all cursor-pointer group flex items-center gap-2 border border-indigo-500/30 bg-indigo-800/40 shadow-sm relative z-50"
              title={isSidebarOpen ? "Close Menu" : "Open Menu"}
            >
              <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-indigo-100 group-hover:text-white pl-1">
                {isSidebarOpen ? "Close" : "Menu"}
              </span>
              {isSidebarOpen ? (
                <X className="w-5 h-5 text-indigo-100 group-hover:text-white" />
              ) : (
                <Menu className="w-5 h-5 text-indigo-100 group-hover:text-white" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Slide-in Sidebar navigation drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-x-0 bottom-0 top-16 bg-slate-900/60 backdrop-blur-[2px] z-40 pointer-events-auto"
            />

            {/* Sidebar Content drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 max-w-full bg-white shadow-2xl z-40 flex flex-col border-l border-slate-100 overflow-hidden"
            >
              {/* Sidebar Tabs Links - Pure English */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-6 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 mb-3 font-semibold pb-1 border-b border-slate-100">Menu Sections</p>
                
                <SidebarButton
                  active={activeTab === 'home'}
                  onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }}
                  icon={<Home className="w-5 h-5" />}
                  label="Home"
                  sublabel="Main Dashboard Overview"
                />
                
                <SidebarButton
                  active={activeTab === 'students'}
                  onClick={() => { setActiveTab('students'); setIsSidebarOpen(false); }}
                  icon={<UserPlus className="w-5 h-5" />}
                  label="Student ID"
                  sublabel="Registry & Records"
                />
                
                <SidebarButton
                  active={activeTab === 'attendance'}
                  onClick={() => { setActiveTab('attendance'); setIsSidebarOpen(false); }}
                  icon={<ClipboardList className="w-5 h-5" />}
                  label="Daily Roll Call"
                  sublabel="Class Attendance Protocol"
                />
                
                <SidebarButton
                  active={activeTab === 'schedule'}
                  onClick={() => { setActiveTab('schedule'); setIsSidebarOpen(false); }}
                  icon={<Clock className="w-5 h-5" />}
                  label="Schedule Post"
                  sublabel="Daily Academic Post"
                />
                
                <SidebarButton
                  active={activeTab === 'ai'}
                  onClick={() => { setActiveTab('ai'); setIsSidebarOpen(false); }}
                  icon={<Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />}
                  label="AI Assistance"
                  sublabel="Gemini Smart Agent"
                />

                <SidebarButton
                  active={activeTab === 'admin'}
                  onClick={() => { setActiveTab('admin'); setIsSidebarOpen(false); }}
                  icon={<Terminal className="w-5 h-5" />}
                  label="Dev"
                  sublabel="Admin Configuration Panel"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 mb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="h-10 bg-slate-100 border-t border-slate-200 px-6 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <div className="flex gap-4 font-bold uppercase tracking-widest">
          <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-indigo-500" /> System Integrity Validated</span>
          <span>Latency: 28ms</span>
        </div>
        <div className="font-bold uppercase tracking-widest">© 2024 School Protocol Intelligence Network</div>
      </footer>
    </div>
  );
};

interface SidebarButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ active, onClick, icon, label, sublabel }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15 font-bold'
        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-transparent'
    }`}
  >
    <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50'}`}>
      {icon}
    </div>
    <div className="text-left flex-1 min-w-0">
      <div className={`text-xs font-black tracking-tight leading-tight ${active ? 'text-white' : 'text-slate-800'}`}>{label}</div>
      <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${active ? 'text-indigo-200' : 'text-slate-400'}`}>{sublabel}</div>
    </div>
  </button>
);
