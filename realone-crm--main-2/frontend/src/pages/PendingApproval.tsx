import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowLeft, ShieldAlert } from 'lucide-react';

export const PendingApproval: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-sm border border-slate-200 rounded-xl text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Account Pending Approval</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your account has been registered, but an Administrator has not approved your access yet. In accordance with security policy, you cannot view CRM data or participate in the round-robin rotation until verified.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-600 mb-6 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              If you are an agent, please notify your team administrator to approve your account from the <strong>Account Approvals</strong> portal.
            </span>
          </div>

          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
