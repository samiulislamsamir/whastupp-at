import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, serverTimestamp, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ClipboardList, CheckCircle2, XCircle, Settings, MessageSquare, Send, Bell, FileSpreadsheet, RefreshCw, Filter, Search, X, Hash, User } from 'lucide-react';
import { appendToSheet, ensureSheetHeader, syncToAppsScript } from '../services/sheetsService';
import { getCachedAccessToken, googleSignIn } from '../lib/googleAuth';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

interface Student {
  id: string;
  name: string;
  roll: number;
  phone: string;
  class: string;
  section: string;
  photoURL?: string;
}

interface AttendanceTabProps {
  staff?: any;
  attendance: Record<string, boolean>;
  setAttendance: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onScheduleDraft: (content: string) => void;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({ staff, attendance, setAttendance, onScheduleDraft }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const [googleConnected, setGoogleConnected] = useState<boolean>(!!getCachedAccessToken());
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load today's attendance document for the selected class/section from Firestore
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      if (!auth.currentUser || !staff?.ownerId) return;
      const dateStr = new Date().toISOString().split('T')[0];
      const activeClass = filterClass || 'All';
      const activeSection = filterSection || 'All';
      const docId = `${dateStr}_${activeClass.replace(/\s+/g, '_')}_${activeSection.replace(/\s+/g, '_')}_${auth.currentUser.uid}`;
      
      try {
        const attendanceDocSnap = await getDoc(doc(db, 'attendance', docId));
        if (attendanceDocSnap.exists()) {
          const data = attendanceDocSnap.data();
          const loadedAttendance: Record<string, boolean> = {};
          const absRolls = data.absentRolls || [];
          const presRolls = data.presentRolls || [];
          
          students.forEach(student => {
            if (
              (activeClass === 'All' || student.class === activeClass) && 
              (activeSection === 'All' || student.section === activeSection)
            ) {
              if (absRolls.includes(student.roll)) {
                loadedAttendance[student.id] = false;
              } else if (presRolls.includes(student.roll)) {
                loadedAttendance[student.id] = true;
              }
            }
          });
          
          setAttendance(prev => ({
            ...prev,
            ...loadedAttendance
          }));
        }
      } catch (err) {
        console.error("Error loading today's attendance:", err);
      }
    };
    
    if (students.length > 0) {
      fetchTodayAttendance();
    }
  }, [filterClass, filterSection, students, staff]);

  // Debounced Auto-save to Database & Sheets on attendance state changes
  useEffect(() => {
    if (loading || filteredStudents.length === 0) return;

    const keys = Object.keys(attendance);
    if (keys.length === 0) return;

    setAutoSaveStatus('saving');

    const delayDebounce = setTimeout(async () => {
      try {
        await saveToFirestorePayload();
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (dbErr) {
        console.error("Auto-save to Database failed:", dbErr);
        setAutoSaveStatus('error');
      }

      // Sync to Google Apps Script Web App
      const appsScriptUrl = staff?.appsScriptUrl || "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec";
      if (appsScriptUrl) {
        try {
          const dateStr = new Date().toLocaleDateString('en-US');
          const headers = ['Date', 'Roll', 'Name', 'Class', 'Section', 'Status'];
          const values = filteredStudents.map(s => [
            dateStr,
            s.roll,
            s.name,
            s.class,
            s.section,
            attendance[s.id] !== false ? 'PRESENT' : 'ABSENT'
          ]);

          const presentCount = filteredStudents.filter(s => attendance[s.id] !== false).length;
          const absentCount = filteredStudents.length - presentCount;
          const absentRolls = filteredStudents.filter(s => attendance[s.id] === false).map(s => s.roll);
          const presentRolls = filteredStudents.filter(s => attendance[s.id] !== false).map(s => s.roll);

          const payload = {
            action: 'add_attendance',
            sheetName: 'Attendance',
            headers,
            values,
            rows: values,
            data: filteredStudents.map(s => ({
              Date: dateStr,
              Roll: s.roll,
              Name: s.name,
              Class: s.class,
              Section: s.section,
              Status: attendance[s.id] !== false ? 'PRESENT' : 'ABSENT'
            })),
            date: dateStr,
            class: filterClass || 'All',
            section: filterSection || 'All',
            totalStudentsCount: filteredStudents.length,
            presentCount,
            absentCount,
            absentRolls,
            presentRolls
          };

          await syncToAppsScript(appsScriptUrl, payload);
          console.log("Auto-saved to Apps Script Web App successfully.");
        } catch (appsScriptErr) {
          console.error("Auto-save to Apps Script failed:", appsScriptErr);
        }
      }

      const token = getCachedAccessToken();
      setGoogleConnected(!!token);
      
      const spreadsheetId = staff?.spreadsheetId || "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4";
      if (token && spreadsheetId) {
        try {
          const dateStr = new Date().toLocaleDateString('en-US');
          const headers = ['Date', 'Roll', 'Name', 'Class', 'Section', 'Status'];
          await ensureSheetHeader(spreadsheetId, 'Attendance', headers);
          
          const values = filteredStudents.map(s => [
            dateStr,
            s.roll,
            s.name,
            s.class,
            s.section,
            attendance[s.id] !== false ? 'PRESENT' : 'ABSENT'
          ]);

          await appendToSheet(spreadsheetId, 'Attendance!A1', values);
          console.log("Auto-saved to Google Sheets successfully.");
        } catch (sheetErr) {
          console.error("Auto-save to Google Sheets failed:", sheetErr);
        }
      }
    }, 1500);

    return () => clearTimeout(delayDebounce);
  }, [attendance, loading, filterClass, filterSection, staff]);

  // Student Profile Modal States
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [absentLogs, setAbsentLogs] = useState<any[]>([]);
  const [totalClassSessions, setTotalClassSessions] = useState<number>(0);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  const handleStudentImageError = async (studentId: string) => {
    // Graceful error logging to prevent deleting user's saved photo URL on transient failures.
    console.warn(`Student image failed to load for studentId: ${studentId}`);
  };

  // Target WhatsApp settings
  const [targetGroup, setTargetGroup] = useState('Class 10-A Parents');
  const [customNumber, setCustomNumber] = useState('');

  useEffect(() => {
    if (!staff?.ownerId) return;
    
    // Filter by own students without orderBy to avoid needing a composite index
    const q = query(
      collection(db, 'students'), 
      where('ownerId', '==', staff.ownerId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Fetched ${snapshot.size} students for owner ${staff?.ownerId}`);
      const studentData: Student[] = [];
      snapshot.forEach((doc) => {
        studentData.push({ id: doc.id, ...doc.data() } as Student);
      });
      
      // Sort client-side
      studentData.sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
      
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      console.error("AttendanceTab Fetch Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    return () => unsubscribe();
  }, [staff]);

  const toggleAttendance = (id: string) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         String(s.roll).includes(searchQuery);
    const matchesClass = filterClass === '' || s.class === filterClass;
    const matchesSection = filterSection === '' || s.section === filterSection;
    return matchesSearch && matchesClass && matchesSection;
  });

  const classes = Array.from(new Set(students.map(s => s.class))).sort();
  const sections = Array.from(new Set(students.map(s => s.section))).sort();

  const calculateMetrics = () => {
    const total = filteredStudents.length;
    const absentRolls: number[] = [];
    let presentCount = 0;

    filteredStudents.forEach((s) => {
      const isPresent = attendance[s.id] !== false; // Default to present if not touched
      if (isPresent) presentCount++;
      else absentRolls.push(s.roll);
    });

    return { total, present: presentCount, absent: total - presentCount, absentRolls };
  };

  const metrics = calculateMetrics();

  const generateReport = () => {
    const dateStr = new Date().toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const classInfo = filterClass ? `${filterClass} (${filterSection || 'সব শাখা'})` : 'সকল শিক্ষার্থী';
    const msg = `🚨 *দৈনিক উপস্থিতি রিপোর্ট* 🚨\n\n📅 তারিখ: ${dateStr}\n🏫 শ্রেণী: ${classInfo}\n👤 শিক্ষক: ${staff?.name || 'শিক্ষক'}\n\n📊 মোট শিক্ষার্থী: ${metrics.total} জন\n✅ উপস্থিত: ${metrics.present} জন\n❌ অনুপস্থিত: ${metrics.absent} জন\n\n${metrics.absentRolls.length > 0 ? `অনুপস্থিত রোল: ${metrics.absentRolls.map(r => `#${String(r).padStart(2, '0')}`).join(', ')}` : 'সবাই উপস্থিত আছে!'}`;
    setReport(msg);
  };

  const saveToFirestorePayload = async () => {
    if (!auth.currentUser) return;
    const dateStr = new Date().toISOString().split('T')[0]; // "2026-05-20"
    const activeClass = filterClass || 'All';
    const activeSection = filterSection || 'All';
    
    const { absentRolls, presentRolls } = filteredStudents.reduce(
      (acc, s) => {
        const isPresent = attendance[s.id] !== false;
        if (isPresent) {
          acc.presentRolls.push(s.roll);
        } else {
          acc.absentRolls.push(s.roll);
        }
        return acc;
      },
      { absentRolls: [] as number[], presentRolls: [] as number[] }
    );
    
    const docId = `${dateStr}_${activeClass.replace(/\s+/g, '_')}_${activeSection.replace(/\s+/g, '_')}_${auth.currentUser.uid}`;
    
    const attendanceData = {
      date: dateStr,
      class: activeClass,
      section: activeSection,
      absentRolls,
      presentRolls,
      totalStudentsCount: filteredStudents.length,
      ownerId: auth.currentUser.uid,
      timestamp: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'attendance', docId), attendanceData);
  };

  const saveToDatabaseOnly = async () => {
    if (filteredStudents.length === 0) {
      return alert("No students loaded to submit attendance.");
    }
    setSyncing(true);
    try {
      await saveToFirestorePayload();
      alert("Attendance records successfully saved/updated in the Database!");
    } catch (err: any) {
      console.error("Database Save Error:", err);
      alert(`Database Save Failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const showStudentProfile = async (student: Student) => {
    setSelectedStudent(student);
    setLogsLoading(true);
    setAbsentLogs([]);
    setTotalClassSessions(0);
    
    try {
      if (!auth.currentUser) return;
      
      // Query 1: Fetch total attendance sessions recorded for this class/section
      const totalQ = query(
        collection(db, 'attendance'),
        where('ownerId', '==', auth.currentUser.uid),
        where('class', '==', student.class),
        where('section', '==', student.section)
      );
      
      const totalSnap = await getDocs(totalQ);
      const totalCount = totalSnap.size;
      setTotalClassSessions(totalCount);
      
      // Query 2: Fetch attendance records where this student was absent during roll call
      const absentQ = query(
        collection(db, 'attendance'),
        where('ownerId', '==', auth.currentUser.uid),
        where('class', '==', student.class),
        where('section', '==', student.section),
        where('absentRolls', 'array-contains', student.roll)
      );
      
      const absentSnap = await getDocs(absentQ);
      const logs: any[] = [];
      absentSnap.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          date: data.date,
          timestamp: data.timestamp
        });
      });
      
      // Client-side sort by date descending to prevent requiring complex index files manually
      logs.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      
      setAbsentLogs(logs);
    } catch (err: any) {
      console.error("Error fetching student profile logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const saveToSheets = async () => {
    setSyncing(true);
    let syncedToWebApp = false;
    let syncedToApi = false;
    let errors: string[] = [];

    const appsScriptUrl = staff?.appsScriptUrl || "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec";
    const dateStr = new Date().toLocaleDateString('en-US');
    const headers = ['Date', 'Roll', 'Name', 'Class', 'Section', 'Status'];
    const values = filteredStudents.map(s => [
      dateStr,
      s.roll,
      s.name,
      s.class,
      s.section,
      attendance[s.id] !== false ? 'PRESENT' : 'ABSENT'
    ]);

    // 1. Sync via Google Apps Script Web App
    if (appsScriptUrl) {
      try {
        const presentCount = filteredStudents.filter(s => attendance[s.id] !== false).length;
        const absentCount = filteredStudents.length - presentCount;
        const absentRolls = filteredStudents.filter(s => attendance[s.id] === false).map(s => s.roll);
        const presentRolls = filteredStudents.filter(s => attendance[s.id] !== false).map(s => s.roll);

        const payload = {
          action: 'add_attendance',
          sheetName: 'Attendance',
          headers,
          values,
          rows: values,
          data: filteredStudents.map(s => ({
            Date: dateStr,
            Roll: s.roll,
            Name: s.name,
            Class: s.class,
            Section: s.section,
            Status: attendance[s.id] !== false ? 'PRESENT' : 'ABSENT'
          })),
          date: dateStr,
          class: filterClass || 'All',
          section: filterSection || 'All',
          totalStudentsCount: filteredStudents.length,
          presentCount,
          absentCount,
          absentRolls,
          presentRolls
        };

        await syncToAppsScript(appsScriptUrl, payload);
        syncedToWebApp = true;
      } catch (err: any) {
        console.error("Apps Script sync failed:", err);
        errors.push(`Apps Script: ${err.message}`);
      }
    }

    // 2. Sync via OAuth API Spreadsheet Link
    const spreadsheetId = staff?.spreadsheetId;
    const isGoogleUser = auth.currentUser?.providerData.some((p: any) => p.providerId === 'google.com') || staff?.authMethod === 'google';
    let token = getCachedAccessToken();
    
    if (spreadsheetId && (token || isGoogleUser)) {
      try {
        if (!token) {
          const result = await googleSignIn();
          token = result?.accessToken || null;
        }
        
        if (token) {
          await ensureSheetHeader(spreadsheetId, 'Attendance', headers);
          await appendToSheet(spreadsheetId, 'Attendance!A1', values);
          syncedToApi = true;
        }
      } catch (err: any) {
        console.error("OAuth Direct Sheets API Sync Failed:", err);
        errors.push(`Direct Sheet Link: ${err.message}`);
      }
    }

    // 3. Save to database
    try {
      await saveToFirestorePayload();
    } catch (dbErr: any) {
      console.error("Auto Database Backup Failed:", dbErr);
    }

    setSyncing(false);

    if (syncedToWebApp || syncedToApi) {
      let msg = "Attendance records successfully synchronized!\n";
      if (syncedToWebApp) msg += "✓ Saved to Google Sheets using Apps Script Web App.\n";
      if (syncedToApi) msg += "✓ Saved to Spreadsheet using OAuth Drive Link.";
      alert(msg);
    } else {
      alert(`Sync Failed:\n${errors.join('\n')}`);
    }
  };

  const sendToGroup = async () => {
    if (!report) return alert("দয়া করে প্রথমে 'Process Report' বাটনে ক্লিক করুন।");
    
    let target = targetGroup;
    if (targetGroup === 'Custom WhatsApp Number') {
      if (!customNumber.trim()) {
        return alert("দয়া করে নির্দিষ্ট মোবাইল নম্বরটি দিন।");
      }
      target = customNumber.trim();
    }
    
    setSyncing(true);
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: target, message: report })
      });
      if (!response.ok) throw new Error("WhatsApp API transmission failed");
      alert(`${target} এ রিপোর্টটি সফলভাবে পাঠানো হয়েছে!`);
    } catch (err: any) {
      console.error(err);
      alert("Error sending message: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const sendToSchedule = () => {
    if (!report) return alert("দয়া করে প্রথমে 'Process Report' বাটনে ক্লিক করুন।");
    onScheduleDraft(report);
  };

  const sendReminders = async () => {
    const absents = students.filter(s => {
      const matchesClass = !filterClass || s.class === filterClass;
      const matchesSection = !filterSection || s.section === filterSection;
      return matchesClass && matchesSection && attendance[s.id] === false;
    });

    if (absents.length === 0) {
      return alert("আজ কোনো অনুপস্থিত শিক্ষার্থী নেই।");
    }

    setSyncing(true);
    for (const s of absents) {
      const msg = `সম্মানিত অভিভাবক, আপনার সন্তান ${s.name} (রোল: ${s.roll}) আজ স্কুলে অনুপস্থিত রয়েছে। জরুরি কোনো সমস্যা থাকলে স্কুল কতৃপক্ষকে অবগত করুন।`;
      try {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: s.phone, message: msg }) 
        });
      } catch (err) {
        console.error(`Failed to send to ${s.phone}`, err);
      }
    }
    setSyncing(false);
    alert("রিমাইন্ডার পাঠানো সম্পন্ন হয়েছে!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-4">
      {/* Student Roll Call List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="space-y-1.5">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                Daily Roll Call: {filterClass ? `Class ${filterClass}` : 'All Students'} {filterSection && `(${filterSection})`}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="flex items-center gap-1 bg-indigo-50/80 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">
                  <span className={`w-1.5 h-1.5 rounded-full ${autoSaveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : autoSaveStatus === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                  {autoSaveStatus === 'saving' ? 'Autosaving to DB...' : autoSaveStatus === 'error' ? 'DB Error' : 'Database: Active (Auto-Saved)'}
                </span>
                
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Google Sheets: Auto-Sync Active
                </span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {new Date().toLocaleDateString('bn-BD')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search roll or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
            
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold appearance-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="">Classes</option>
                {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>

            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold appearance-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="">Sections</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-slate-100 font-mono">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">
                <th className="py-3 px-6 w-20">Roll</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Attendance Options</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400 font-medium italic">Loading database registry...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400 font-medium italic">No students match selection criteria.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isPresent = attendance[student.id] !== false;
                  return (
                    <tr
                      key={student.id}
                      onClick={() => toggleAttendance(student.id)}
                      className={`group border-b border-slate-50 cursor-pointer transition-colors select-none ${
                        isPresent ? 'hover:bg-slate-50' : 'bg-rose-50/60 hover:bg-rose-100/40'
                      }`}
                    >
                      <td className="py-2.5 px-6 font-mono font-bold text-slate-500">
                        <div className="flex items-center gap-1">
                          {String(student.roll).padStart(2, '0')}
                          {!filterClass && (
                            <span className="text-[8px] opacity-40 ml-1">({student.class}-{student.section})</span>
                          )}
                        </div>
                      </td>
                      <td 
                        className="py-2.5 px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          showStudentProfile(student);
                        }}
                      >
                        <div className={`font-bold transition-all flex items-center justify-between cursor-pointer hover:text-indigo-600 ${isPresent ? 'text-slate-700' : 'text-rose-950 opacity-90'}`}>
                          <div className="flex items-center gap-2">
                            {student.photoURL ? (
                              <img 
                                src={student.photoURL} 
                                alt={student.name} 
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full object-cover border border-slate-200" 
                                onError={() => handleStudentImageError(student.id)} 
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <span className="hover:underline">{student.name}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-1 shrink-0">
                            Profile
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setAttendance(prev => ({ ...prev, [student.id]: true }))}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
                              isPresent 
                                ? 'bg-emerald-600 text-white shadow-sm font-black' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Present
                          </button>
                          <button
                            onClick={() => setAttendance(prev => ({ ...prev, [student.id]: false }))}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
                              !isPresent 
                                ? 'bg-rose-600 text-white shadow-sm font-black' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics & Communication */}
      <aside className="flex flex-col gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4">Live Analytics</h2>
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="Total" value={metrics.total} color="slate" />
            <SummaryCard label="Present" value={metrics.present} color="emerald" />
            <SummaryCard label="Absent" value={metrics.absent} color="rose" />
          </div>
          
          <div className="mt-4">
            <div className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Absent Roll Numbers</div>
            <div className="flex flex-wrap gap-1 min-h-[24px]">
              {metrics.absentRolls.length > 0 ? (
                metrics.absentRolls.map(roll => (
                  <span key={roll} className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-black shadow-sm">
                    #{String(roll).padStart(2, '0')}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-400 font-bold italic">Verification Pending / None</span>
              )}
            </div>
          </div>
          
          <button
            onClick={generateReport}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-3 px-4 rounded-lg shadow-md transition-all mt-4 flex justify-center items-center gap-2 cursor-pointer active:scale-[0.98] uppercase tracking-widest"
          >
            <Settings className="w-3.5 h-3.5" />
            Process Report
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-1 flex flex-col">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Communication Panel</h2>
          <div className="flex-1 flex flex-col gap-3 min-h-[300px]">
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 leading-relaxed focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-all resize-none shadow-inner"
              placeholder="Draft Report will appear here..."
            />
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={sendToGroup}
                id="gp-send"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-3 rounded-lg transition-all flex justify-center items-center gap-2 cursor-pointer active:scale-[0.98] uppercase tracking-widest"
              >
                <div className="p-1 bg-emerald-500/50 rounded-md">
                  <Send className="w-3 h-3 text-white" />
                </div>
                GP SEND
              </button>
              <button
                onClick={sendReminders}
                id="sd-send"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-black py-3 rounded-lg transition-all flex justify-center items-center gap-2 cursor-pointer active:scale-[0.98] uppercase tracking-widest"
              >
                 <div className="p-1 bg-amber-400/50 rounded-md">
                  <Bell className="w-3 h-3 text-white" />
                </div>
                SD SEND
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Student Profile & Absent History Tracker Modal */}
      {selectedStudent && (
        <>
          {/* Background Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] transition-opacity" 
            onClick={() => setSelectedStudent(null)}
          />

          {/* Modal Content Centered */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-white rounded-2xl shadow-2xl z-[151] overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                Student Profile
              </h3>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile details */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center gap-4 mb-6">
                {selectedStudent.photoURL ? (
                  <img 
                    src={selectedStudent.photoURL} 
                    alt={selectedStudent.name} 
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-md"
                    onError={() => {
                      handleStudentImageError(selectedStudent.id);
                      setSelectedStudent(prev => prev ? { ...prev, photoURL: '' } : null);
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl uppercase shadow-inner">
                    {selectedStudent.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="text-base font-black text-slate-800 tracking-tight leading-tight">{selectedStudent.name}</h4>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Roll #{String(selectedStudent.roll).padStart(2, '0')} • Class {selectedStudent.class}-{selectedStudent.section}
                  </p>
                </div>
              </div>

              {/* Info Card Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200/50">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Class & Sec</span>
                  <span className="text-xs font-bold text-slate-700">{selectedStudent.class} ({selectedStudent.section})</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Roll Number</span>
                  <span className="text-xs font-bold text-slate-700">#{selectedStudent.roll}</span>
                </div>
                <div className="col-span-2 border-t border-slate-200/50 pt-2.5 mt-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Parent WhatsApp Phone</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {selectedStudent.phone}
                  </span>
                </div>
              </div>

              {/* Absent History Tracker Panel */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-rose-500" />
                    Absent Logs
                  </h5>
                  
                  {/* Performance Percentage Badge */}
                  {!logsLoading && totalClassSessions > 0 && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm ${
                      (totalClassSessions - absentLogs.length) / totalClassSessions >= 0.85
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {Math.round(((totalClassSessions - absentLogs.length) / totalClassSessions) * 100)}% Attendance
                    </span>
                  )}
                </div>

                {logsLoading ? (
                  <div className="py-8 text-center text-slate-400 italic text-[11px] font-bold flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Querying database archive...
                  </div>
                ) : (
                  <div>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-slate-50 border border-slate-200/50 rounded-lg p-2.5 text-center">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Total Sessions</span>
                        <span className="text-sm font-black text-slate-700">{totalClassSessions} days</span>
                      </div>
                      <div className="bg-rose-50 border border-rose-200/30 rounded-lg p-2.5 text-center">
                        <span className="text-[8px] font-black uppercase text-rose-400 block tracking-wider">Total Absences</span>
                        <span className="text-sm font-black text-rose-700">{absentLogs.length} days</span>
                      </div>
                    </div>

                    {/* Absences list */}
                    <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50/50 p-2 text-xs">
                      {absentLogs.length > 0 ? (
                        <div className="space-y-1.5">
                          {absentLogs.map((log, idx) => (
                            <div key={log.id || idx} className="flex justify-between items-center bg-white p-2 border border-slate-100 rounded-md font-mono">
                              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Absent Date:
                              </span>
                              <span className="font-black text-slate-800 bg-rose-50 px-2 py-0.5 rounded text-[10px]">
                                {new Date(log.date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 italic text-[11px] font-medium">
                          🎉 No absences registered. Perfect attendance!
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; color: 'slate' | 'emerald' | 'rose' }> = ({ label, value, color }) => {
  const colors = {
    slate: 'bg-slate-100 border-slate-200 text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    rose: 'bg-rose-50 border-rose-200 text-rose-600',
  };

  return (
    <div className={`p-2.5 rounded-lg border text-center shadow-sm ${colors[color]}`}>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</div>
      <div className="text-xl font-black tabular-nums">{value}</div>
    </div>
  );
};
