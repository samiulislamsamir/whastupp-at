import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Settings, 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Link2, 
  Loader2, 
  ExternalLink,
  Users,
  Database,
  CloudLightning,
  Sparkles,
  ArrowLeft,
  Menu,
  X,
  Home
} from 'lucide-react';
import { appendToSheet, ensureSheetHeader, syncToAppsScript } from '../services/sheetsService';
import { getCachedAccessToken } from '../lib/googleAuth';
import { uploadImageToImgBB } from '../services/imageUpload';

interface AdminPanelProps {
  staff?: any;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ staff }) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'home' | 'config' | 'sync' | 'connections' | 'dev_edit'>('home');
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Administrative Credentials State
  const [spreadsheetId, setSpreadsheetId] = useState<string>(
    staff?.spreadsheetId || '13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4'
  );
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(
    staff?.appsScriptUrl || 'https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec'
  );

  // New Developer Card Customization State
  const [devPhotoURL, setDevPhotoURL] = useState<string>(staff?.devPhotoURL || '');
  const [devLabel, setDevLabel] = useState<string>(staff?.devLabel || '');
  const [devName, setDevName] = useState<string>(staff?.devName || '');
  const [devPhone, setDevPhone] = useState<string>(staff?.devPhone || '');
  const [devWhatsapp, setDevWhatsapp] = useState<string>(staff?.devWhatsapp || '');
  const [devWhatsappLink, setDevWhatsappLink] = useState<string>(staff?.devWhatsappLink || '');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (staff?.spreadsheetId) {
      setSpreadsheetId(staff.spreadsheetId);
    }
    if (staff?.appsScriptUrl) {
      setAppsScriptUrl(staff.appsScriptUrl);
    }
    if (staff?.devPhotoURL !== undefined) setDevPhotoURL(staff.devPhotoURL || '');
    if (staff?.devLabel !== undefined) setDevLabel(staff.devLabel || '');
    if (staff?.devName !== undefined) setDevName(staff.devName || '');
    if (staff?.devPhone !== undefined) setDevPhone(staff.devPhone || '');
    if (staff?.devWhatsapp !== undefined) setDevWhatsapp(staff.devWhatsapp || '');
    if (staff?.devWhatsappLink !== undefined) setDevWhatsappLink(staff.devWhatsappLink || '');
  }, [staff]);

  // Load active stats
  useEffect(() => {
    const fetchStats = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const studentsQuery = query(collection(db, 'students'), where('ownerId', '==', uid));
        const snapshot = await getDocs(studentsQuery);
        setStudentCount(snapshot.size);
      } catch (err) {
        console.error("Failed to fetch students length:", err);
      }
    };
    fetchStats();
  }, [staff]);

  // Save Settings handler
  const handleSaveConfigs = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(doc(db, 'staff', auth.currentUser.uid), {
        spreadsheetId: spreadsheetId.trim(),
        appsScriptUrl: appsScriptUrl.trim(),
        adminSettingsUpdatedAt: new Date().toISOString()
      });
      setSuccess('Admin configurations have been updated successfully!');
      setTimeout(() => setSuccess(null), 3500);
      
      // Update local storage cache to keep interface fast
      const cacheKey = `staff_cache_${auth.currentUser.uid}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        data.spreadsheetId = spreadsheetId.trim();
        data.appsScriptUrl = appsScriptUrl.trim();
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (err: any) {
      setError(`Failed to save configurations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Avatar Quick Presets
  const avatarPresets = [
    { name: 'Male Pro', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' },
    { name: 'Female Pro', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
    { name: 'Developer Male', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80' },
    { name: 'Developer Female', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' },
    { name: 'Creative Tech', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
  ];

  // Direct image upload handler to ImgBB
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image (png, jpeg, webp, etc) file.');
      return;
    }

    setUploadingImage(true);
    setError(null);
    setSuccess('Uploading image to ImgBB...');

    try {
      const hostedUrl = await uploadImageToImgBB(file);
      setDevPhotoURL(hostedUrl);
      setSuccess('Image uploaded successfully to ImgBB! Click "Save Developer Card" to finalize changes.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("ImgBB upload failed on dev photo setup:", err);
      setError(`Failed to upload to ImgBB: ${err.message || err}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Developer Card configurations
  const handleSaveDevConfigs = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(doc(db, 'staff', auth.currentUser.uid), {
        devPhotoURL: devPhotoURL.trim(),
        devLabel: devLabel.trim(),
        devName: devName.trim(),
        devPhone: devPhone.trim(),
        devWhatsapp: devWhatsapp.trim(),
        devWhatsappLink: devWhatsappLink.trim(),
        devSettingsUpdatedAt: new Date().toISOString()
      });
      setSuccess('Developer configurations updated successfully!');
      setTimeout(() => setSuccess(null), 3500);
      
      // Update local storage cache to keep interface fast
      const cacheKey = `staff_cache_${auth.currentUser.uid}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        data.devPhotoURL = devPhotoURL.trim();
        data.devLabel = devLabel.trim();
        data.devName = devName.trim();
        data.devPhone = devPhone.trim();
        data.devWhatsapp = devWhatsapp.trim();
        data.devWhatsappLink = devWhatsappLink.trim();
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (err: any) {
      setError(`Failed to save developer configuration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual Trigger to sync students
  const handleSyncStudents = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    setSyncing(true);
    setError(null);
    setSuccess(null);
    
    try {
      const studentsQuery = query(collection(db, 'students'), where('ownerId', '==', uid));
      const snapshot = await getDocs(studentsQuery);
      const students = snapshot.docs.map(doc => doc.data());
      setStudentCount(students.length);

      if (students.length === 0) {
        setSuccess('No active student profiles found in the database.');
        setSyncing(false);
        return;
      }

      const headers = ['Name', 'Roll', 'Class', 'Section', 'Phone', 'Created At'];
      const values = [
        headers,
        ...students.map(s => [
          s.name || '', 
          s.roll || '', 
          s.class || '', 
          s.section || '', 
          s.phone || '', 
          s.createdAt?.toDate ? s.createdAt.toDate().toISOString() : (s.createdAt || '')
        ])
      ];

      // 1. Google OAuth append
      let oauthSynced = false;
      const token = getCachedAccessToken();
      const activeSheetId = spreadsheetId.trim() || staff?.spreadsheetId || "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4";
      
      if (token && activeSheetId) {
        try {
          await ensureSheetHeader(activeSheetId, 'Students', headers);
          await appendToSheet(activeSheetId, 'Students!A1', values);
          oauthSynced = true;
        } catch (oauthErr) {
          console.warn("OAuth direct sync failed, falling back:", oauthErr);
        }
      }

      // 2. Apps Script sync payload
      let scriptSynced = false;
      const targetUrl = appsScriptUrl.trim() || staff?.appsScriptUrl || "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec";
      if (targetUrl) {
        try {
          const payload = {
            action: 'sync_students',
            sheetName: 'Students',
            headers: headers,
            values: values,
            rows: values.slice(1),
            data: students.map(s => ({
              Name: s.name || '',
              Roll: s.roll || '',
              Class: s.class || '',
              Section: s.section || '',
              Phone: s.phone || '',
              'Created At': s.createdAt?.toDate ? s.createdAt.toDate().toISOString() : (s.createdAt || '')
            }))
          };
          await syncToAppsScript(targetUrl, payload);
          scriptSynced = true;
        } catch (scriptErr) {
          console.warn("Apps script student backup sync failed:", scriptErr);
        }
      }

      if (oauthSynced || scriptSynced) {
        setSuccess(`Successfully backed up ${students.length} student records to Google Sheets!`);
      } else {
        throw new Error("Unable to establish sync connection via Google OAuth or Apps Script gateway.");
      }
    } catch (err: any) {
      console.error("Manual Backup Error:", err);
      setError(`Manual backup failed: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-x-hidden">
      
      {/* 1. Custom Standalone Security Header */}
      <header className="h-16 bg-slate-900 text-white shadow-lg z-50 shrink-0 flex items-center px-4 sm:px-6 sticky top-0 border-b border-slate-800">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          
          {/* Back Action on the LEFT */}
          <div className="flex items-center gap-3 justify-start">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-[10px] font-black text-slate-300 hover:text-white transition-all uppercase tracking-widest cursor-pointer bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl shadow-sm hover:bg-white/10"
              title="Return to Staff View"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Staff View</span>
            </button>
          </div>

          {/* Secure Platform Title in the CENTER */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <h1 className="text-xs sm:text-sm font-black tracking-widest uppercase">Admin Terminal</h1>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Control Registry Workspace</p>
          </div>

          {/* 3-line Hamburger Menu Toggle Button on the RIGHT */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setIsAdminSidebarOpen(!isAdminSidebarOpen)}
              className="p-2 hover:bg-white/5 active:bg-white/10 rounded-xl transition-all cursor-pointer group flex items-center gap-2 border border-slate-700 bg-slate-800/40 shadow-sm relative z-50"
              title={isAdminSidebarOpen ? "Close Admin Menu" : "Open Admin Menu"}
            >
              <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-slate-200 group-hover:text-white pl-1">
                {isAdminSidebarOpen ? "Close" : "Admin Menu"}
              </span>
              {isAdminSidebarOpen ? (
                <X className="w-5 h-5 text-slate-200 group-hover:text-white" />
              ) : (
                <Menu className="w-5 h-5 text-slate-200 group-hover:text-white" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* 2. Slide-in Admin Sidebar Navigation Drawer */}
      <AnimatePresence>
        {isAdminSidebarOpen && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-40 pointer-events-auto"
            />

            {/* Sidebar drawer content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed right-0 top-0 h-screen w-80 max-w-full bg-slate-900 text-white shadow-2xl z-40 flex flex-col border-l border-slate-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-200">Admin Options</span>
                </div>
                <button onClick={() => setIsAdminSidebarOpen(false)} className="p-1 hover:bg-white/15 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Navigation Options - Menu Features */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
                
                <button
                  onClick={() => { setActiveSubTab('home'); setIsAdminSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer border ${
                    activeSubTab === 'home'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg font-bold'
                      : 'hover:bg-white/5 text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeSubTab === 'home' ? 'bg-white/10' : 'bg-white/5'}`}>
                    <Home className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-black tracking-tight leading-tight">Home</div>
                    <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-slate-300">Terminal Home Workspace</div>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveSubTab('config'); setIsAdminSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer border ${
                    activeSubTab === 'config'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg font-bold'
                      : 'hover:bg-white/5 text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeSubTab === 'config' ? 'bg-white/10' : 'bg-white/5'}`}>
                    <Settings className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-black tracking-tight leading-tight">Config Endpoints</div>
                    <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-slate-300">Set Sheets and script Url</div>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveSubTab('sync'); setIsAdminSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer border ${
                    activeSubTab === 'sync'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg font-bold'
                      : 'hover:bg-white/5 text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeSubTab === 'sync' ? 'bg-white/10' : 'bg-white/5'}`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-black tracking-tight leading-tight">Backup & Sync</div>
                    <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-slate-300">Sync database registries</div>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveSubTab('connections'); setIsAdminSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer border ${
                    activeSubTab === 'connections'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg font-bold'
                      : 'hover:bg-white/5 text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeSubTab === 'connections' ? 'bg-white/10' : 'bg-white/5'}`}>
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-black tracking-tight leading-tight">Connections</div>
                    <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-slate-300">Go to live Google spreadsheet</div>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveSubTab('dev_edit'); setIsAdminSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer border ${
                    activeSubTab === 'dev_edit'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg font-bold'
                      : 'hover:bg-white/5 text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeSubTab === 'dev_edit' ? 'bg-white/10' : 'bg-white/5'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-black tracking-tight leading-tight">Dev Edit</div>
                    <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-slate-300">Configure Developer Card</div>
                  </div>
                </button>

              </div>

              <div className="p-6 border-t border-slate-800">
                <button
                  onClick={() => { navigate('/'); setIsAdminSidebarOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all border border-slate-700 shadow-md cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  Staff Main Portal
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. Main Workspace container */}
      <main className="flex-grow max-w-5xl w-full mx-auto p-4 lg:p-6 space-y-6">
        
        {/* Visual Admin Header Block */}
        {activeSubTab === 'home' && (
          <div className="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl border border-indigo-700/30">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute left-0 bottom-0 -translate-x-12 translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 z-10 relative">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-200 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  Welcome, Authorized Administrator
                </div>
                <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight">System Configuration Terminal</h2>
                <p className="text-xs text-indigo-100 font-medium leading-relaxed max-w-xl">
                  Manage the core integration endpoints and Google Spreadsheet configurations. This control workspace is isolated from standard staff views to ensure state safety.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center md:text-left shrink-0 md:w-60">
                <span className="text-[10px] font-black uppercase text-indigo-200 tracking-wider block mb-1">Active Gateway Node</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2 justify-center md:justify-start">
                  <CloudLightning className="w-4 h-4 text-emerald-400" />
                  <span>Real-time Backup Live</span>
                </div>
                <p className="text-[10px] text-indigo-100 font-medium leading-tight">
                  Student details and daily roll calls are structured automatically into column schemas inside Google Sheets.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync State Alerts */}
        {syncing && (
          <div id="sync-loader-alert" className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 text-indigo-700 text-xs font-bold animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
            <span>Processing database schema and synchronizing with Google Spreadsheet service. Please wait...</span>
          </div>
        )}

        {error && (
          <div id="error-alert" className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && !syncing && (
          <div id="success-alert" className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Render selected Feature Tab */}
        <div className="transition-all duration-200">
          
          {activeSubTab === 'home' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Active System Connections</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Spreadsheet ID Gateway</span>
                  <div className="text-xs font-bold text-slate-800 truncate font-mono">{spreadsheetId}</div>
                  <div className="text-[10px] font-medium text-slate-400">Holds active academic logs and student databases.</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">Apps Script Web App</span>
                  <div className="text-xs font-bold text-slate-800 truncate font-mono">{appsScriptUrl}</div>
                  <div className="text-[10px] font-medium text-slate-400">Custom web engine for real-time duplicated records sorting.</div>
                </div>
              </div>
              <div className="p-4 bg-indigo-50/50 rounded-2xl text-xs text-indigo-700 font-semibold border border-indigo-100/30 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 animate-pulse" />
                <span>To edit endpoints, trigger manual synchronizations, review connected sheets, or design the Dev Tab profile, click the 3-line panel menu on the right.</span>
              </div>
            </div>
          )}

          {activeSubTab === 'config' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Settings className="w-5 h-5 text-slate-400" />
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Interface & Endpoint Settings</h3>
              </div>

              <div className="space-y-4">
                
                {/* Spreadsheet ID block */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Google Spreadsheet ID</label>
                    <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded font-mono">A1 Column Mappings Enabled</span>
                  </div>
                  <input
                    id="input-spreadsheet-id"
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="e.g. 13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZC..."
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-mono font-bold text-slate-700 outline-none transition-all shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    * Specify the unique Google Spreadsheet ID extracted from the document's URL path. Daily student lists and log entries are parsed here.
                  </p>
                </div>

                {/* Apps Script Endpoint URL */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Google Apps Script Web App URL</label>
                  <input
                    id="input-apps-script"
                    type="text"
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-mono font-bold text-slate-700 outline-none transition-all shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    * Custom Apps Script endpoint to manage background database submissions. Handles duplicate prevention patterns automatically.
                  </p>
                </div>

              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  id="btn-save-settings"
                  onClick={handleSaveConfigs}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider px-6 py-3.5 rounded-2xl cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Configuration
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'sync' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Database className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Manual Synchronization</h3>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Registered Students in Database:</span>
                    <span className="text-indigo-600 px-2.5 py-1 bg-indigo-50 rounded font-black">{studentCount ?? '...'} profiles</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Re-sync all Firestore classroom profiles directly to Google Sheets.</p>
                </div>

                <button
                  id="btn-sync-students"
                  onClick={handleSyncStudents}
                  disabled={syncing}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-widest py-3 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-white ${syncing ? 'animate-spin' : ''}`} />
                  Synchronize Student Records
                </button>

                <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/30 text-[10px] font-medium text-slate-500 leading-relaxed">
                  💡 <span className="font-extrabold text-indigo-700">Automatic range mapping:</span> We target the first column range sequentially. This ensures student name rows represent correct record pairings without offset truncation.
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'connections' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              {/* Direct Link to Google Sheets Workbook */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Workbook Connection</h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mb-4">
                    Launch the active Google Sheets workbook online to view or structure recorded student registries immediately.
                  </p>
                </div>

                <a
                  id="link-open-sheets"
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId.trim() || "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-shadow-sm justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                  Open Google Sheets
                </a>
              </div>

              {/* Standalone Admin Link */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Dedicated Window</h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mb-4">
                    Open this system management configuration workspace inside a standalone browser window.
                  </p>
                </div>

                <a
                  id="link-standalone-admin"
                  href="/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-shadow-sm justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                  Launch Standalone Window
                </a>
              </div>
            </div>
          )}

          {activeSubTab === 'dev_edit' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="w-5 h-5 text-slate-400" />
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Developer Workspace Card Settings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                
                {/* Developer Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Developer Name</label>
                  <input
                    type="text"
                    value={devName}
                    onChange={(e) => setDevName(e.target.value)}
                    placeholder="e.g. Al-Amin Razzak"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all shadow-inner"
                  />
                </div>

                {/* Developer Designation / Label */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Name/Designation Label</label>
                  <input
                    type="text"
                    value={devLabel}
                    onChange={(e) => setDevLabel(e.target.value)}
                    placeholder="e.g. Senior App Architect"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all shadow-inner"
                  />
                </div>

                {/* Photo Setup Section - Fully Custom & Direct */}
                <div className="space-y-4 md:col-span-2 p-5 bg-slate-50 rounded-3xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    
                    {/* Live Avatar Preview Circle */}
                    <div className="space-y-1.5 text-center shrink-0">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Live Preview</label>
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-indigo-400 font-black overflow-hidden shadow-md uppercase shrink-0">
                        {devPhotoURL ? (
                          <img 
                            src={devPhotoURL} 
                            referrerPolicy="no-referrer" 
                            className="w-full h-full object-cover animate-fadeIn" 
                            alt="Live Avatar Preview"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-indigo-600/10 flex items-center justify-center text-indigo-600 text-3xl font-black shadow-inner">
                            {devName ? devName.charAt(0) : '?'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direct Upload File Selector */}
                    <div className="flex-grow space-y-3 w-full text-center sm:text-left">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Direct Developer Photo Upload</span>
                        <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                          Directly import any picture file from your device. It will automatically convert to a secure, offline-ready, system-compatible format.
                        </p>
                      </div>

                      {/* File input button wrapper */}
                      <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                        <label className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 cursor-pointer text-center select-none ${uploadingImage ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                          {uploadingImage ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              Uploading...
                            </>
                          ) : (
                            <>📁 Browse Image File</>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileChange} 
                            disabled={uploadingImage}
                            className="hidden" 
                          />
                        </label>
                        {devPhotoURL && !uploadingImage && (
                          <button
                            type="button"
                            onClick={() => {
                              setDevPhotoURL('');
                              setSuccess('Photo removed. Click Save to apply changes.');
                              setTimeout(() => setSuccess(null), 3000);
                            }}
                            className="w-full sm:w-auto text-[10px] uppercase font-black tracking-wider text-rose-500 hover:text-rose-600 transition-colors py-3 px-4 bg-rose-50 border border-rose-100 rounded-xl cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Quick Select Avatar Presets */}
                  <div className="pt-4 border-t border-slate-200 space-y-2 text-left">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Quick High-Quality Presets</span>
                    <div className="flex flex-wrap gap-3">
                      {avatarPresets.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDevPhotoURL(preset.url);
                            setSuccess(`Preset "${preset.name}" selected! Click Save to apply.`);
                            setTimeout(() => setSuccess(null), 3000);
                          }}
                          className={`flex items-center gap-2 p-1.5 rounded-full border transition-all cursor-pointer text-xs font-bold leading-none ${
                            devPhotoURL === preset.url 
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-black ring-2 ring-indigo-100 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-800'
                          }`}
                        >
                          <img 
                            src={preset.url} 
                            referrerPolicy="no-referrer" 
                            className="w-6 h-6 rounded-full object-cover" 
                            alt={preset.name} 
                          />
                          <span className="pr-2 text-[10px]">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Explicit Text URL Fallback */}
                  <div className="pt-4 border-t border-slate-200 space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Or Manual Image Web URL</label>
                    <input
                      type="text"
                      value={devPhotoURL}
                      onChange={(e) => setDevPhotoURL(e.target.value)}
                      placeholder="e.g. https://images.unsplash.com/photo-1544005313-94ddf0286df2"
                      className="w-full bg-white border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-mono text-slate-700 outline-none transition-all shadow-inner"
                    />
                  </div>

                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Phone Number</label>
                  <input
                    type="text"
                    value={devPhone}
                    onChange={(e) => setDevPhone(e.target.value)}
                    placeholder="e.g. +880 1700 000000"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all shadow-inner"
                  />
                </div>

                {/* WhatsApp Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">WhatsApp Number</label>
                  <input
                    type="text"
                    value={devWhatsapp}
                    onChange={(e) => setDevWhatsapp(e.target.value)}
                    placeholder="e.g. +880 1700 000000"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all shadow-inner"
                  />
                </div>

                {/* WhatsApp Link */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">WhatsApp Number Link</label>
                  <input
                    type="text"
                    value={devWhatsappLink}
                    onChange={(e) => setDevWhatsappLink(e.target.value)}
                    placeholder="e.g. https://wa.me/8801700000000"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-xs font-mono text-slate-700 outline-none transition-all shadow-inner"
                  />
                </div>

              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={handleSaveDevConfigs}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider px-6 py-3.5 rounded-2xl cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Developer Card
                </button>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* Security note footer */}
      <footer className="h-12 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
        <p className="font-bold uppercase tracking-widest">
          Powered by School Intelligence Protocol &bull; Secure Audit Base Node
        </p>
      </footer>

    </div>
  );
};
