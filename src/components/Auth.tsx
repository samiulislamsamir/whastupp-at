import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, ShieldCheck, Fingerprint, Lock, User, ArrowRight, Loader2, Mail } from 'lucide-react';
import { googleSignIn } from '../lib/googleAuth';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedId, setGeneratedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    id: '',
    email: '',
    password: ''
  });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await googleSignIn();
      if (result) {
        const user = result.user;
        
        // Check if staff profile exists to preserve existing numeric ID & password
        const { getDoc } = await import('firebase/firestore');
        const staffRef = doc(db, 'staff', user.uid);
        const staffDoc = await getDoc(staffRef);
        
        let numericId = generateNumericId();
        let password = `google${generateNumericId()}`;
        
        if (staffDoc.exists()) {
          const data = staffDoc.data();
          numericId = data.numericId || numericId;
          password = data.password || password;
        }

        try {
          await setDoc(staffRef, {
            numericId: numericId,
            password: password,
            name: user.displayName || 'Google User',
            email: user.email,
            photoURL: user.photoURL || '',
            updatedAt: new Date().toISOString(),
            ownerId: user.uid,
            authMethod: 'google',
            spreadsheetId: "13DIM8MAaLVjPoG0aCgyGAiaQjP5DeqZCxMKW5t4"
          }, { merge: true });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.WRITE, `staff/${user.uid}`);
        }
        
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setError(`Google Sign-In failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInAnonymously(auth);
      if (result) {
        const user = result.user;
        try {
          await setDoc(doc(db, 'staff', user.uid), {
            numericId: '999999',
            name: 'Anonymous Teacher',
            email: 'anonymous@school.com',
            photoURL: '',
            createdAt: new Date().toISOString(),
            ownerId: user.uid,
            authMethod: 'anonymous',
            spreadsheetId: "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4"
          });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.WRITE, `staff/${user.uid}`);
        }
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error("Anonymous Sign-In Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(`Anonymous Sign-In is disabled for project "${auth.app.options.projectId}". Please enable it in Firebase Console > Authentication > Sign-in method.`);
      } else {
        setError(`Anonymous Login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateNumericId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (formData.password.length < 6) {
        throw { code: 'auth/weak-password', message: 'Password must be at least 6 characters.' };
      }

      const numericId = generateNumericId();
      const registeredEmail = formData.email ? formData.email.trim() : `${numericId}@school.com`;
      
      console.log(`Attempting registration for: ${registeredEmail} on project ${auth.app.options.projectId}`);
      
      // Step 1: Create Auth Account
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, registeredEmail, formData.password);
      } catch (authErr: any) {
        console.error("Auth Error Code:", authErr.code);
        if (authErr.code === 'auth/email-already-in-use') {
          if (!formData.email) {
            // Retry once with a new ID if email was generated
            const newId = generateNumericId();
            const newEmail = `${newId}@school.com`;
            userCredential = await createUserWithEmailAndPassword(auth, newEmail, formData.password);
          } else {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      const user = userCredential.user;

      // NOW the user is authenticated. Let's run the uniqueness check query on 'staff' passwords.
      let isPasswordUnique = true;
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'staff'), where('password', '==', formData.password));
        const snapshot = await getDocs(q);
        const conflictingDocs = snapshot.docs.filter(doc => doc.id !== user.uid);
        if (conflictingDocs.length > 0) {
          isPasswordUnique = false;
        }
      } catch (checkErr) {
        console.warn("Uniqueness check skipped or failed due to permission check:", checkErr);
      }

      if (!isPasswordUnique) {
        // Rollback creation of auth user
        await user.delete();
        throw { 
          code: 'custom/duplicate-password', 
          message: 'এই পাসওয়ার্ডটি ইতিমধ্যেই অন্য একজন ব্যবহার করছেন। প্রতিটি অ্যাকাউন্টের জন্য একটি ইউনিক পাসওয়ার্ড থাকা আবশ্যক।' 
        };
      }

      // Step 2: Create Professional Profile in Firestore
      const userNumericId = userCredential.user.email?.includes('@school.com') 
        ? userCredential.user.email.split('@')[0] 
        : numericId;

      try {
        await setDoc(doc(db, 'staff', user.uid), {
          numericId: userNumericId,
          name: formData.name,
          email: userCredential.user.email,
          password: formData.password,
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
          spreadsheetId: "13DIM8MAaLVjPoG0aCgyGAiaQjP0bPd5DeqZCxMKW5t4",
          appsScriptUrl: "https://script.google.com/macros/s/AKfycbwkgdF0lzyyWU_OGUaGNxQOXpttjt12hWcWiXuI4WG-rGQE7q1Jrt-PRKShXGX-o52e9A/exec"
        });
      } catch (fsErr: any) {
        handleFirestoreError(fsErr, OperationType.WRITE, `staff/${user.uid}`);
      }

      setGeneratedId(userNumericId);
    } catch (err: any) {
      console.error("Full Registration Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(`CRITICAL SETUP ERROR: The "Email/Password" authentication provider is NOT enabled for project "${auth.app.options.projectId}". Even if you enabled "Email Link", you MUST enable the main "Email/Password" toggle. Please go to your Firebase Console > Authentication > Sign-in method and enable it.`);
      } else if (err.code === 'auth/weak-password') {
        setError('পাসওয়ার্ডটি অবশ্যই অন্তত ৬ অক্ষরের হতে হবে। (Password must be at least 6 characters.)');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email or ID is already registered. Try logging in or use a different email.');
      } else if (err.code === 'custom/duplicate-password') {
        setError(err.message);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection or any extension that might be blocking Firebase.');
      } else {
        setError(`Error (${err.code || 'unknown'}): ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let loginEmail = formData.id.trim();
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@school.com`;
      }
      
      console.log(`Attempting login for ID/Email: ${formData.id} (${loginEmail}) on project ${auth.app.options.projectId}`);
      await signInWithEmailAndPassword(auth, loginEmail, formData.password);
      onAuthSuccess();
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(`CRITICAL: Email/Password is disabled for project "${auth.app.options.projectId}". Please enable it in Firebase Console.`);
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid ID/Email or Password. Make sure you registered first on the "Register" tab.');
      } else {
        setError(`Login Error (${err.code}): ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const { collection, addDoc, deleteDoc, doc } = await import('firebase/firestore');
      const testRef = await addDoc(collection(db, 'test'), { checked: true, time: new Date().toISOString() });
      await deleteDoc(doc(db, 'test', testRef.id));
      alert("Firestore Connection Success! Read/Write test passed.");
    } catch (err: any) {
      console.error("Connection test failed:", err);
      alert(`Firestore Connection FAILED: ${err.message}`);
    }
  };

  const DiagnosticFooter = () => (
    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <ShieldCheck className="w-3 h-3 text-slate-400" />
          Project: {auth.app.options.projectId}
        </div>
        <button 
          type="button"
          onClick={testConnection}
          className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
        >
          Run Infrastructure Diagnostics
        </button>
      </div>
      <p className="mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] px-4">
        Authentication via Firebase & bull; SSL Secured & bull; Production Ready
      </p>
    </div>
  );

  if (generatedId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Registration Success!</h2>
          <p className="text-slate-500 mb-8 font-bold text-sm">Please save your 6-digit Login ID. You will need it to login next time.</p>
          
          <div className="bg-slate-50 rounded-xl p-6 border-2 border-dashed border-slate-200 mb-8">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Your Unique Login ID</div>
            <div className="text-4xl font-black text-indigo-600 tracking-[0.2em] font-mono">{generatedId}</div>
          </div>

          <button
            onClick={() => onAuthSuccess()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            Start Working <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
            <Fingerprint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">School Protocol</h1>
          <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest">{isLogin ? 'Authentication Required' : 'Staff Registration'}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleSignUp} className="p-8 space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs font-bold"
              >
                {error}
              </motion.div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address (Optional)</label>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Or auto-generate ID</span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      placeholder="teacher@school.com"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">ফাঁকা রাখলে সিস্টেম থেকে ইউনিক ৬ সংখ্যার আইডি তৈরি করা হবে।</p>
                </div>
              </>
            )}

            {isLogin && (
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Login ID or Email Address</label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold tracking-normal"
                    placeholder="6-digit ID or email address"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Secret Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs mt-4 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {isLogin ? 'Access System' : 'Create Account'}
                </>
              )}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                <span className="bg-white px-4 text-slate-400">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-50 border-2 border-slate-100 text-slate-700 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest active:scale-95 mb-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google Account
            </button>

            <button
              type="button"
              onClick={handleAnonymousSignIn}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-50 border-2 border-slate-100 text-slate-700 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest active:scale-95"
            >
              <User className="w-4 h-4 text-slate-500" />
              Anonymous Guest Login
            </button>
          </form>
          <DiagnosticFooter />
        </div>
        
        <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Secure Infrastructure &bull; Cloud Integrated
        </p>
      </div>
    </div>
  );
};
