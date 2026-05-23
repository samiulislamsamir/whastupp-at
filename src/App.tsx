/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AttendanceTab } from './components/AttendanceTab';
import { AddStudentTab } from './components/AddStudentTab';
import { ScheduleTab } from './components/ScheduleTab';
import { AIAssistant } from './components/AIAssistant';
import { AdminPanel } from './components/AdminPanel';
import { Auth } from './components/Auth';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { initGoogleAuth } from './lib/googleAuth';
import { HomeTab } from './components/HomeTab';
import { Settings, ShieldCheck, Terminal, Sparkles, Phone, MessageCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initGoogleAuth();
    let unsubscribeStaff: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (unsubscribeStaff) {
        unsubscribeStaff();
        unsubscribeStaff = null;
      }

      if (currentUser) {
        // Step 1: Immediately read from local storage cache to avoid loading freeze
        const cacheKey = `staff_cache_${currentUser.uid}`;
        const cached = localStorage.getItem(cacheKey);
        let currentStaff = null;
        if (cached) {
          try {
            currentStaff = JSON.parse(cached);
            setStaff(currentStaff);
          } catch (e) {
            console.error("Error parsing staff cache:", e);
          }
        }

        // Step 2: Set up live listener for the staff document
        unsubscribeStaff = onSnapshot(doc(db, 'staff', currentUser.uid), async (staffDoc) => {
          if (staffDoc.exists()) {
            const data = staffDoc.data();
            if (!data.spreadsheetId || !data.appsScriptUrl) {
              const updatedData = {
                ...data,
                spreadsheetId: data.spreadsheetId || "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4",
                appsScriptUrl: data.appsScriptUrl || "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec"
              };
              await updateDoc(doc(db, 'staff', currentUser.uid), {
                spreadsheetId: updatedData.spreadsheetId,
                appsScriptUrl: updatedData.appsScriptUrl
              });
              setStaff(updatedData);
              localStorage.setItem(cacheKey, JSON.stringify(updatedData));
            } else {
              setStaff(data);
              localStorage.setItem(cacheKey, JSON.stringify(data));
            }
          } else {
            // Document doesn't exist yet, initialize a default configuration
            const defaultStaff = {
              ownerId: currentUser.uid,
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Teacher',
              spreadsheetId: "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4",
              appsScriptUrl: "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec",
              photoURL: currentUser.photoURL || ""
            };
            await setDoc(doc(db, 'staff', currentUser.uid), defaultStaff);
            setStaff(defaultStaff);
            localStorage.setItem(cacheKey, JSON.stringify(defaultStaff));
          }
        }, (err) => {
          console.error("Error with staff live listener:", err);
          // If the listener fails and we have no cached data, assign a healthy default
          if (!currentStaff) {
            const defaultStaff = {
              ownerId: currentUser.uid,
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Teacher',
              spreadsheetId: "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4",
              appsScriptUrl: "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec",
              photoURL: currentUser.photoURL || ""
            };
            setStaff(defaultStaff);
          }
        });
      } else {
        setStaff(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubscribeStaff) unsubscribeStaff();
    };
  }, []);

  if (loading) return null; // Simplified loading
  if (!user) return <Auth onAuthSuccess={() => {}} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPanel staff={staff} />} />
        <Route path="/*" element={<MainApp staff={staff} />} />
      </Routes>
    </BrowserRouter>
  );
}

function MainApp({ staff }: { staff: any }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'students' | 'schedule' | 'ai' | 'admin'>('home');
  
  const [scheduledDraft, setScheduledDraft] = useState<string>('');
  const [todayAttendance, setTodayAttendance] = useState<Record<string, boolean>>({});

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    navigate('/');
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleTabChange} staff={staff}>
      {activeTab === 'home' && <HomeTab staff={staff} setActiveTab={handleTabChange} />}
      {activeTab === 'attendance' && (
        <AttendanceTab 
          staff={staff} 
          attendance={todayAttendance} 
          setAttendance={setTodayAttendance} 
          onScheduleDraft={(msg) => { setScheduledDraft(msg); handleTabChange('schedule'); }}
        />
      )}
      {activeTab === 'students' && (
        <AddStudentTab 
          onComplete={() => handleTabChange('attendance')} 
          staff={staff} 
          attendance={todayAttendance} 
          setAttendance={setTodayAttendance} 
        />
      )}
      {activeTab === 'schedule' && (
        <ScheduleTab 
          onComplete={() => { handleTabChange('attendance'); setScheduledDraft(''); }} 
          staff={staff} 
          initialContent={scheduledDraft}
        />
      )}
      {activeTab === 'ai' && <AIAssistant onDraftNotice={(c: string) => { setScheduledDraft(c); handleTabChange('schedule'); }} />}
      {activeTab === 'admin' && (
        <div className="max-w-3xl mx-auto">
          <div id="dev-profile-container" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
              
              {/* Photo Frame */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-400 font-black overflow-hidden shadow-inner uppercase shrink-0">
                {staff?.devPhotoURL ? (
                  <img 
                    src={staff.devPhotoURL} 
                    referrerPolicy="no-referrer" 
                    className="w-full h-full object-cover animate-fadeIn" 
                    alt="Developer Picture"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-600/10 flex items-center justify-center text-indigo-600 text-3xl font-black">
                    {staff?.devName ? staff.devName.charAt(0) : <Settings className="w-10 h-10 text-indigo-400 animate-spin" />}
                  </div>
                )}
              </div>

              {/* Text Fields */}
              <div className="text-center sm:text-left flex-grow space-y-2.5">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                    <Sparkles className="w-3 h-3 text-rose-500" />
                    Authorized Developer Profile
                  </div>
                  <h3 id="dev-name" className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-800">
                    {staff?.devName || 'Developer Name'}
                  </h3>
                  <p id="dev-label" className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                    {staff?.devLabel || 'System Architect / Developer'}
                  </p>
                </div>

                {/* Phone & WhatsApp displays */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center sm:justify-start text-xs font-bold text-slate-600">
                  {staff?.devPhone && (
                    <span className="flex items-center gap-1.5 font-mono">
                      📞 <a href={`tel:${staff.devPhone}`} className="hover:text-indigo-600 transition-colors">{staff.devPhone}</a>
                    </span>
                  )}
                  {staff?.devWhatsapp && (
                    <span className="flex items-center gap-1.5 font-mono">
                      💬 WhatsApp: {staff.devWhatsapp}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Quick Interactive Actions */}
            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
              <a 
                href={staff?.devPhone ? `tel:${staff.devPhone}` : '#'}
                onClick={(e) => { if (!staff?.devPhone) e.preventDefault(); }}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all text-center ${
                  staff?.devPhone 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer active:scale-95' 
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Phone className="w-4 h-4" />
                Call Developer
              </a>

              <a 
                href={staff?.devWhatsappLink || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { if (!staff?.devWhatsappLink) e.preventDefault(); }}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all text-center ${
                  staff?.devWhatsappLink 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-md' 
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-100" />
                WhatsApp Chat
              </a>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}
