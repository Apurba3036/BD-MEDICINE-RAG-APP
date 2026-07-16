import { useState, useEffect, useRef } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './firebase';
import { Activity, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { gsap } from 'gsap';
import heroImage from './assets/image.png';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const containerRef = useRef(null);
  const formRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Setup initial states
      gsap.set(formRef.current.children, { y: 20, opacity: 0 });
      gsap.set(imageRef.current, { scale: 1.1, opacity: 0, filter: "blur(10px)" });

      // Animate in
      gsap.to(imageRef.current, { 
        scale: 1, 
        opacity: 1, 
        filter: "blur(0px)",
        duration: 1.5, 
        ease: "power3.out" 
      });
      
      gsap.to(formRef.current.children, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.out",
        delay: 0.3
      });
    }, containerRef);

    return () => ctx.revert();
  }, [isLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen w-full flex bg-slate-50 font-sans overflow-hidden">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative z-10">
        <div className="w-full max-w-md space-y-8 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50" ref={formRef}>
          
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-6 transform hover:scale-105 transition-transform">
              <Activity size={32} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
              BD-Medicine AI
            </h1>
            <p className="text-slate-500 flex items-center justify-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              {isLogin ? 'Welcome back, sign in to continue' : 'Create your account to get started'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 mt-8">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-indigo-500/50 hover:-translate-y-0.5"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                {isLogin ? 'Sign up for free' : 'Sign in instead'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block w-1/2 relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-600/40 mix-blend-overlay z-10" />
        <img
          ref={imageRef}
          src={heroImage}
          alt="Medical AI Dashboard"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
        />
        {/* Decorative overlay text or gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-20" />
        
        <div className="absolute bottom-12 left-12 right-12 z-30 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4">
            <Sparkles size={14} className="text-amber-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-white">Next Generation</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">Empowering Health with AI</h2>
          <p className="text-slate-300 max-w-md">
            Seamlessly navigate the Bangladeshi medicine database, analyze prescriptions, and receive instant health insights.
          </p>
        </div>
      </div>
    </div>
  );
}
