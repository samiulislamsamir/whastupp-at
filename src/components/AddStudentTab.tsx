import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserPlus, Save, CheckCircle, FileSpreadsheet, Search, Filter, Users, Hash, Phone, X, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { appendToSheet, ensureSheetHeader, syncToAppsScript } from '../services/sheetsService';
import { getCachedAccessToken } from '../lib/googleAuth';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { uploadImageToImgBB } from '../services/imageUpload';

interface Student {
  id: string;
  name: string;
  roll: number;
  phone: string;
  class: string;
  section: string;
  photoURL?: string;
}

interface AddStudentTabProps {
  onComplete: () => void;
  staff?: any;
  attendance: Record<string, boolean>;
  setAttendance: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const AddStudentTab: React.FC<AddStudentTabProps> = ({ onComplete, staff, attendance, setAttendance }) => {
  const [formData, setFormData] = useState({
    name: '',
    roll: '',
    phone: '',
    class: '10',
    section: 'A',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  
  // List and Search State
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [isListLoading, setIsListLoading] = useState(true);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("এই শিক্ষার্থীকে কি আপনি রেজিস্ট্রি থেকে মুছে ফেলতে চান? এটি পুনরায় ফিরিয়ে আনা যাবে না।")) return;
    try {
      await deleteDoc(doc(db, 'students', studentId));
      setSelectedStudentForProfile(null);
      alert("শিক্ষার্থীর তথ্য সফলভাবে মুছে ফেলা হয়েছে!");
    } catch (err: any) {
      console.error("Failed to delete student:", err);
      alert("মুছে ফেলতে ব্যর্থ হয়েছে: " + err.message);
    }
  };

  const handleStudentImageError = async (studentId: string) => {
    // Graceful error logging to prevent deleting user's saved photo URL on transient failures.
    console.warn(`Student image failed to load for studentId: ${studentId}`);
  };

  // Fetch students for management
  useEffect(() => {
    if (!staff?.ownerId) return;
    
    // Simplifed query to avoid needing custom multi-field composite indexes
    const q = query(
      collection(db, 'students'), 
      where('ownerId', '==', staff.ownerId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData: Student[] = [];
      snapshot.forEach((doc) => {
        studentData.push({ id: doc.id, ...doc.data() } as Student);
      });
      
      // Sort client-side
      studentData.sort((a, b) => {
        const classComp = (a.class || '').localeCompare(b.class || '');
        if (classComp !== 0) return classComp;
        const secComp = (a.section || '').localeCompare(b.section || '');
        if (secComp !== 0) return secComp;
        return (Number(a.roll) || 0) - (Number(b.roll) || 0);
      });
      
      setStudents(studentData);
      setIsListLoading(false);
    }, (error) => {
      console.error("AddStudentTab List Fetch Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    return () => unsubscribe();
  }, [staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !auth.currentUser) return;

    setLoading(true);
    let phoneFormatted = formData.phone.trim();
    
    // International format filtering
    if (!phoneFormatted.startsWith('+')) {
      if (phoneFormatted.startsWith('0')) {
        phoneFormatted = '+88' + phoneFormatted;
      } else if (phoneFormatted.startsWith('880')) {
        phoneFormatted = '+' + phoneFormatted;
      } else {
        phoneFormatted = '+880' + phoneFormatted;
      }
    }

    try {
      let photoURL = '';
      if (photo) {
        setSyncStatus('Uploading picture to ImgBB...');
        try {
          photoURL = await uploadImageToImgBB(photo);
        } catch (imgbbErr: any) {
          console.error("ImgBB upload failed:", imgbbErr);
          throw new Error(`ছবি আপলোড ব্যর্থ হয়েছে: ${imgbbErr.message || imgbbErr}`);
        }
      }

      // Step 1: Save to Firestore
      const studentData = {
        ...formData,
        roll: parseInt(formData.roll),
        phone: phoneFormatted,
        photoURL,
        ownerId: auth.currentUser!.uid,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'students'), studentData);
      
      // Step 2: Sync to Google Sheets
      const appsScriptUrl = staff?.appsScriptUrl || "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec";
      if (appsScriptUrl) {
        try {
          const payload = {
            action: 'add_student',
            sheetName: 'Students',
            headers: ['Name', 'Roll', 'Class', 'Section', 'Phone', 'Created At'],
            values: [[
              formData.name,
              formData.roll,
              formData.class,
              formData.section,
              phoneFormatted,
              new Date().toISOString()
            ]],
            rows: [[
              formData.name,
              formData.roll,
              formData.class,
              formData.section,
              phoneFormatted,
              new Date().toISOString()
            ]],
            data: [{
              Name: formData.name,
              Roll: formData.roll,
              Class: formData.class,
              Section: formData.section,
              Phone: phoneFormatted,
              'Created At': new Date().toISOString()
            }]
          };
          await syncToAppsScript(appsScriptUrl, payload);
          setSyncStatus('Synced via Apps Script!');
        } catch (scriptErr) {
          console.error("Apps Script Student Sync Failed:", scriptErr);
          setSyncStatus('Apps Script sync fail.');
        }
      }

      const token = getCachedAccessToken();
      const sheetId = staff?.spreadsheetId || "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4";
      if (token && sheetId) {
        setSyncStatus('Syncing to Google Sheets with OAuth...');
        try {
          const headers = ['Name', 'Roll', 'Class', 'Section', 'Phone', 'Created At'];
          await ensureSheetHeader(sheetId, 'Students', headers);
          await appendToSheet(sheetId, 'Students!A1', [[
            formData.name,
            formData.roll,
            formData.class,
            formData.section,
            phoneFormatted,
            new Date().toISOString()
          ]]);
          setSyncStatus(prev => prev ? `${prev} & OAuth Sheets Synced!` : 'Synced successfully!');
        } catch (syncErr) {
          console.error("Sheets Sync Error:", syncErr);
          if (!syncStatus) {
            setSyncStatus('Cloud sync failed.');
          }
        }
      }

      setSuccess(true);
      setLoading(false);
      setPhoto(null);
      // We don't auto-redirect anymore to allow adding more students or viewing the list
    } catch (error) {
      console.error("Error adding student:", error);
      alert("Failed to save student data. Please check your connection.");
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         String(s.roll).includes(searchQuery) ||
                         s.phone.includes(searchQuery);
    const matchesClass = filterClass === '' || s.class === filterClass;
    const matchesSection = filterSection === '' || s.section === filterSection;
    return matchesSearch && matchesClass && matchesSection;
  });

  // Get unique classes and sections for filters
  const classes = Array.from(new Set(students.map(s => s.class))).sort();
  const sections = Array.from(new Set(students.map(s => s.section))).sort();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-6 items-start">
      {/* Registration Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-40">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Register New Student</h2>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-10 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">Registered!</h3>
                <p className="text-xs text-slate-500 font-bold">Updating cloud registry...</p>
                {syncStatus && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                    <FileSpreadsheet className="w-3 h-3" />
                    {syncStatus}
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  setFormData({ name: '', roll: '', phone: '', class: formData.class, section: formData.section });
                  setPhoto(null);
                  setSyncStatus('');
                  setSuccess(false);
                }}
                className="text-[10px] font-black text-indigo-600 uppercase hover:underline mt-2"
              >
                Register Another Student
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-bold"
                  placeholder="e.g. Samiul Islam Samir"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Roll Number</label>
                  <input
                    type="number"
                    required
                    value={formData.roll}
                    onChange={(e) => setFormData({ ...formData, roll: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-mono font-bold"
                    placeholder="01"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">WhatsApp Mobile</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-mono font-bold"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Photo</label>
                <div className="flex items-center gap-3">
                  {photo ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                      <img 
                        src={URL.createObjectURL(photo)} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                      />
                      <button 
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="absolute top-0 right-0 p-0.5 bg-rose-500 text-white rounded-full translate-x-1/3 -translate-y-1/3 shadow hover:bg-rose-600 flex items-center justify-center"
                      >
                        <X className="w-3 h-3 cursor-pointer" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <input
                    key={photo ? 'has-photo' : 'no-photo'}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Class</label>
                  <input
                    type="text"
                    required
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-bold"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Section</label>
                  <input
                    type="text"
                    required
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-bold"
                    placeholder="A"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full ${
                  loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg shadow-md transition-all mt-4 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]`}
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving Data...' : 'Save to Cloud Database'}
              </button>
            </form>
          )}
        </AnimatePresence>
      </div>

      {/* Student List & Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[600px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Student Registry
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>{filteredStudents.length} Students Found</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search name, roll, or phone..."
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
                <option value="">All Classes</option>
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
                <option value="">All Sections</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 font-mono text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="py-3 px-6">Class/Sec</th>
                <th className="py-3 px-4">Roll</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Today's Attendance</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isListLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">Scanning student records...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">No students match your criteria.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isPresent = attendance[student.id] !== false;
                  return (
                    <tr
                      key={student.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${
                        !isPresent ? 'bg-rose-50/50 hover:bg-rose-100/50' : ''
                      }`}
                    >
                      <td className="py-3 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-600">
                          {student.class}-{student.section}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-500">
                          <Hash className="w-3 h-3 text-slate-300" />
                          {String(student.roll).padStart(2, '0')}
                        </div>
                      </td>
                      <td 
                        onClick={() => setSelectedStudentForProfile(student)}
                        className={`py-3 px-4 font-bold cursor-pointer hover:text-indigo-600 transition-all ${isPresent ? 'text-slate-700' : 'text-rose-900 line-through decoration-rose-300 opacity-80'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          {student.photoURL ? (
                            <img 
                              src={student.photoURL} 
                              alt={student.name} 
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" 
                              onError={() => handleStudentImageError(student.id)}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600 uppercase shrink-0">
                              {student.name.charAt(0)}
                            </div>
                          )}
                          <span className="hover:underline">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          {student.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setAttendance((prev) => ({
                              ...prev,
                              [student.id]: prev[student.id] === undefined ? false : !prev[student.id]
                            }));
                          }}
                          className={`inline-block w-24 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter transition-all cursor-pointer border ${
                            isPresent
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200/60'
                              : 'bg-rose-100 border-rose-200 text-rose-700 hover:bg-rose-200/60'
                          }`}
                        >
                          {isPresent ? 'PRESENT' : 'ABSENT'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Profile Modal */}
      <AnimatePresence>
        {selectedStudentForProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudentForProfile(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl z-[151] p-6 border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-sm font-black uppercase text-indigo-600 tracking-widest">Student Profile</h3>
                <button 
                  onClick={() => setSelectedStudentForProfile(null)} 
                  className="p-1 hover:bg-slate-100 rounded-full cursor-pointer transition-all"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-indigo-50 border-4 border-indigo-50 shadow-lg mb-4 flex items-center justify-center shrink-0">
                  {selectedStudentForProfile.photoURL ? (
                    <img 
                      src={selectedStudentForProfile.photoURL} 
                      alt={selectedStudentForProfile.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover animate-fade-in" 
                      onError={() => {
                        handleStudentImageError(selectedStudentForProfile.id);
                        setSelectedStudentForProfile(prev => prev ? { ...prev, photoURL: '' } : null);
                      }}
                    />
                  ) : (
                    <div className="text-3xl font-black text-indigo-400 uppercase">
                      {selectedStudentForProfile.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h2 className="text-lg font-black text-slate-900 text-center">{selectedStudentForProfile.name}</h2>
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100 leading-none">
                    Class {selectedStudentForProfile.class}-{selectedStudentForProfile.section}
                  </span>
                  <span className="text-[10px] font-black uppercase bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-100 leading-none">
                    Roll #{String(selectedStudentForProfile.roll).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">WhatsApp Mobile</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-700">{selectedStudentForProfile.phone}</span>
                    <a 
                      href={`https://wa.me/${selectedStudentForProfile.phone.replace(/[^0-9+]/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 rounded px-2 py-1 text-[9px] font-black text-emerald-700 uppercase transition-all"
                    >
                      <Phone className="w-3 h-3" /> Parents WP
                    </a>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">System Registry Details</p>
                  <p className="text-xs font-bold text-slate-650">অবস্থান: এই শিক্ষার্থীর অ্যাকাউন্ট প্রোটোকল উপস্থিতি খাতা এবং ওয়াটসঅ্যাপ তালিকায় সংরক্ষিত আছে।</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForProfile(null)}
                  className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStudent(selectedStudentForProfile.id)}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  Delete Student
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
