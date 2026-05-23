import React, { useState } from 'react';
import { X, User, Camera, Mail, Lock, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadImageToImgBB } from '../services/imageUpload';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: any;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, staff }) => {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setImgError(false);
    }
  }, [isOpen, staff?.photoURL, photo]);

  const handleUpdate = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      let photoURL = staff?.photoURL || auth.currentUser.photoURL;

      if (photo) {
        try {
          photoURL = await uploadImageToImgBB(photo);
        } catch (imgbbErr: any) {
          console.error("ImgBB upload failed:", imgbbErr);
          throw new Error(`প্রোফাইল ছবি আপলোড ব্যর্থ হয়েছে: ${imgbbErr.message || imgbbErr}`);
        }
        await updateProfile(auth.currentUser, { photoURL });
        await updateDoc(doc(db, 'staff', auth.currentUser.uid), { photoURL });
      }

      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('পাসওয়ার্ডটি অবশ্যই অন্তত ৬ অক্ষরের হতে হবে।');
        }

        // Check uniqueness of new password
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'staff'), where('password', '==', newPassword));
        const snapshot = await getDocs(q);
        const conflictingDocs = snapshot.docs.filter(doc => doc.id !== auth.currentUser?.uid);
        if (conflictingDocs.length > 0) {
          throw new Error('এই পাসওয়ার্ডটি ইতিমধ্যেই অন্য একজন ব্যবহার করছেন। অনুগ্রহ করে একটি ইউনিক পাসওয়ার্ড দিন।');
        }

        await updatePassword(auth.currentUser, newPassword);
        await updateDoc(doc(db, 'staff', auth.currentUser.uid), { password: newPassword });
        setNewPassword('');
      }

      alert("Profile updated successfully!");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login' || (err.message && err.message.includes('requires-recent-login'))) {
        alert("নিরাপত্তার স্বার্থে পাসওয়ার্ড পরিবর্তন করার জন্য আপনাকে অনুগ্রহ করে একবার লগআউট করে আবার লগইন করতে হবে। ও তারপর পাসওয়ার্ড পরিবর্তন করুন।\n\n(For security reasons, please log out and log back in before changing your password.)");
      } else if (err.message && (err.message.includes('পাসওয়ার্ড') || err.message.includes('ছবি'))) {
        alert(err.message);
      } else {
        alert("Error updating profile: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl z-[101] p-6 border border-slate-100 max-h-[90vh] overflow-y-auto flex flex-col"
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Protocol Profile</h3>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            
            <div className="flex flex-col items-center mb-6">
              <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-indigo-100 border-4 border-indigo-50 shadow-lg mb-4 cursor-pointer">
                {staff?.photoURL && !imgError ? (
                  <img 
                    src={staff.photoURL} 
                    alt="Profile" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover animate-fade-in" 
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <User className="w-full h-full p-4 text-indigo-400" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                  <input type="file" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
              <h2 className="text-lg font-black text-slate-900">{staff?.name || 'User'}</h2>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">User ID / numeric ID</p>
                <p className="text-sm font-black text-indigo-700 tracking-wider font-mono">{staff?.numericId || 'N/A'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Email Address</p>
                <p className="text-xs font-bold text-slate-700">{auth.currentUser?.email || staff?.email || 'N/A'}</p>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Current Password (পাসওয়ার্ড)</p>
                <p className="text-xs font-bold text-amber-800 font-mono tracking-wide">{staff?.password || 'N/A'}</p>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">New Password (নতুন পাসওয়ার্ড)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold mt-1"
                  placeholder="পরিবর্তন করতে চাইলে লিখুন"
                />
              </div>

              <button
                onClick={handleUpdate}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Profile & Password'}
              </button>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={async () => {
                    await auth.signOut();
                    onClose();
                  }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 border border-red-100 transition-all cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
