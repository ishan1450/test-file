import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';

export const RejectedAccount: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState((location.state as any)?.email || '');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleReapply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your email address');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await authService.reapply({
        email,
        full_name: fullName || undefined,
        password: password || undefined,
      });
      setIsSubmitted(true);
      setTimeout(() => {
        navigate('/pending-approval');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to re-submit access request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-sm border border-slate-200 rounded-xl text-center">
          {/* Header Icon & Status */}
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your registration request for this CRM system was denied by an administrator.
            If you need authorization to access leads, you may try again by submitting a new access request below.
          </p>

          {isSubmitted ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-center gap-2 mb-6">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Access request submitted! Redirecting to pending approval...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs mb-4 text-left">
                  {error}
                </div>
              )}

              {!showForm ? (
                <div className="space-y-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    <Send className="w-4 h-4" /> Try Again for Access
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReapply} className="space-y-4 mb-6 text-left border-t border-slate-100 pt-5">
                  <p className="text-xs font-semibold text-slate-700">Re-apply for Account Access:</p>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@realestate.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      New Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Request</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
