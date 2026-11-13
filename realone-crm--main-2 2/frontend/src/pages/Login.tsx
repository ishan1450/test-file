import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const submitInProgress = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInProgress.current) return;
    submitInProgress.current = true;
    setError(null);
    setIsLoading(true);

    try {
      setLoadingMessage('Signing in…');

      await login({ email, password });

      navigate('/dashboard'); 
    }
    catch (err: any) {
      if (err instanceof ApiError) {
        if (err.data?.detail?.toLowerCase().includes('pending approval')) {
          navigate('/pending-approval');
          return;
        }
        if (
          err.data?.detail?.toLowerCase().includes('rejected') ||
          err.data?.detail?.toLowerCase().includes('access denied')
        ) {
          navigate('/rejected-account', { state: { email } });
          return;
        }
        if (err.status === 429) {
          const source = err.viaWorker ? 'The backend is rate-limiting requests.' : 'Cloudflare is rate-limiting requests before they reach the backend.';
          setError(`${source} Wait a little before trying again.${err.retryAfter ? ` Retry-After: ${err.retryAfter}.` : ''}`);
        } else if (err.status === 0) {
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      submitInProgress.current = false;
      setIsLoading(false);
      setLoadingMessage('');
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center mx-auto shadow-sm">
          RO
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
          Real One CRM
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to access your leads and assignment rotation
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs space-y-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
              {(error.toLowerCase().includes('rejected') || error.toLowerCase().includes('access denied')) && (
                <div className="pl-7 pt-1">
                  <Link
                    to="/rejected-account"
                    state={{ email }}
                    className="inline-flex items-center gap-1 font-bold text-rose-800 underline hover:text-rose-900"
                  >
                    Try Again for Access &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@realestate.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (loadingMessage || 'Please wait…') : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
            {isLoading && (
              <p role="status" aria-live="polite" className="text-center text-xs text-slate-500">
                {loadingMessage || 'Please wait…'} Do not refresh the page.
              </p>
            )}
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
