import React from 'react';
import { XCircle, UserCheck, UserX } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Modal showing detailed profile + notary credentials for a single user,
 * with enable / disable action footer. Lifted out of AdminDashboard.jsx.
 */
export default function UserDetailsModal({
  user,
  processingAction,
  onClose,
  onStatusChange,
}) {
  if (!user) return null;
  const profile = user.user || {};
  const notary = user.notary_profile;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">User Details</h2>
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-500 hover:text-navy-900"
            >
              <XCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-navy-900 font-semibold mb-3">Profile</h3>
            <div className="bg-cream-100 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-xs">Email</p>
                <p className="text-navy-900">{profile.email}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Full Name</p>
                <p className="text-navy-900">{profile.full_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Role</p>
                <p className="text-navy-900 capitalize">{profile.role || 'user'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Status</p>
                <p
                  className={
                    profile.status === 'active' ? 'text-green-400' : 'text-red-400'
                  }
                >
                  {profile.status || 'active'}
                </p>
              </div>
            </div>
          </div>

          {notary && (
            <div>
              <h3 className="text-navy-900 font-semibold mb-3">Notary Profile</h3>
              <div className="bg-cream-100 rounded-lg p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs">Commission #</p>
                  <p className="text-navy-900">{notary.commission_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">State</p>
                  <p className="text-navy-900">{notary.state || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      notary.status === 'approved'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {notary.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {profile.status === 'active' ? (
              <Button
                onClick={() => onStatusChange(profile.id, 'disabled')}
                disabled={processingAction === profile.id}
                className="bg-red-600 hover:bg-red-700"
              >
                <UserX className="w-4 h-4 mr-2" />
                Disable User
              </Button>
            ) : (
              <Button
                onClick={() => onStatusChange(profile.id, 'active')}
                disabled={processingAction === profile.id}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Enable User
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
