import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, RefreshCw, Plus, FileText, CheckCircle, Star,
} from 'lucide-react';
import { Button } from '../ui/button';
import { NotificationBell } from '../NotificationBell';
import UserDropdown from '../UserDropdown';

/**
 * Top header for the Command Authority Suite.
 * Shows mode-aware quick actions: admin sees Blueprint + RON Compliance,
 * notary-mode toggles in approvals/journal/session shortcuts.
 */
export default function AdminHeader({ isNotaryMode, onRefresh, token }) {
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-coral-500" />
              <span className="text-lg sm:text-xl font-bold text-navy-900">
                Notary<span className="text-coral-500">Chain</span>
              </span>
            </div>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-coral-600 font-semibold hidden sm:inline-flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-coral-500 text-coral-500" />
              Command Authority Suite
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {!isNotaryMode ? (
              <>
                <Button
                  onClick={() => navigate('/admin/blueprints/create')}
                  variant="outline"
                  size="sm"
                  className="border-green-600/50 text-green-700 hover:bg-green-50 hidden sm:flex"
                  data-testid="header-blueprint-btn"
                >
                  <Plus className="w-4 h-4 sm:mr-1" />
                  <span className="hidden lg:inline">Blueprint</span>
                </Button>
                <Button
                  onClick={() => navigate('/admin/ron-compliance')}
                  variant="outline"
                  size="sm"
                  className="border-coral-500/50 text-coral-600 hover:bg-coral-50 hidden sm:flex"
                  data-testid="ron-compliance-btn"
                >
                  <Shield className="w-4 h-4 sm:mr-1" />
                  <span className="hidden lg:inline">RON Compliance</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/approvals')}
                  variant="outline"
                  size="sm"
                  className="border-coral-500/50 text-coral-600 hover:bg-coral-50 hidden sm:flex"
                  data-testid="header-approvals-btn"
                >
                  <CheckCircle className="w-4 h-4 sm:mr-1" />
                  <span className="hidden lg:inline">Approvals queue</span>
                </Button>
                <Button
                  onClick={() => navigate('/notary/journal')}
                  variant="outline"
                  size="sm"
                  className="border-navy-300 text-navy-800 hover:bg-cream-200 hidden sm:flex"
                  data-testid="header-journal-btn"
                >
                  <FileText className="w-4 h-4 sm:mr-1" />
                  <span className="hidden lg:inline">Journal</span>
                </Button>
                <Button
                  onClick={() => navigate('/transactions/new')}
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 hidden sm:flex"
                  data-testid="header-start-session-btn"
                >
                  <Plus className="w-4 h-4 sm:mr-1" />
                  <span className="hidden lg:inline">Start session</span>
                </Button>
              </>
            )}
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-navy-900"
              data-testid="header-refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <NotificationBell token={token} />
            <UserDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
