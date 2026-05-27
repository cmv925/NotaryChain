import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { OnboardingTour } from '../components/OnboardingTour';
import useViewMode from '../hooks/useViewMode';
import useAdminData from '../hooks/useAdminData';
import { useAuth } from '../contexts/AuthContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { OverviewTab } from '../components/admin/tabs/OverviewTab';
import { OperationsTab } from '../components/admin/tabs/OperationsTab';
import { SecurityTab } from '../components/admin/tabs/SecurityTab';
import { AnalyticsTab } from '../components/admin/tabs/AnalyticsTab';
import { UsersTab } from '../components/admin/tabs/UsersTab';
import { NotariesTab } from '../components/admin/tabs/NotariesTab';
import { AuditTab } from '../components/admin/tabs/AuditTab';
import AdminHeader from '../components/admin/AdminHeader';
import AdminStatsGrid from '../components/admin/AdminStatsGrid';
import AdminTabsNav from '../components/admin/AdminTabsNav';
import UserDetailsModal from '../components/admin/UserDetailsModal';

/**
 * Command Authority Suite (admin) — pure page composition.
 * All data fetching, mutations, and WebSocket subscriptions live in
 * `useAdminData`. This component only owns local UI state (active tab,
 * filters, modal visibility) and wires the hook into focused sub-components.
 */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [viewMode] = useViewMode();
  const isNotaryMode = viewMode === 'notary';

  const { data, flags, actions } = useAdminData({
    onForbidden: () => navigate('/dashboard'),
  });

  // ─── Local UI state ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [notaryStatusFilter, setNotaryStatusFilter] = useState('all');
  const [editingAlerts, setEditingAlerts] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  const openUserDetails = async (userId) => {
    const user = await actions.viewUserDetails(userId);
    if (user) setShowUserModal(true);
  };

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'audit') actions.fetchAuditLogs();
    if (tabId === 'analytics' && !data.analyticsData) actions.fetchAnalyticsData(analyticsPeriod);
    if (tabId === 'analytics' && !data.ceremonyAnalytics) actions.fetchCeremonyAnalytics();
    if (tabId === 'operations' && !data.opsData) actions.fetchOpsMetrics();
    if (tabId === 'operations' && !data.alertSettings) actions.fetchAlertSettings();
    if (tabId === 'operations' && !data.storageAnalytics) actions.fetchStorageAnalytics();
    if (tabId === 'operations' && !data.serviceHealth) actions.fetchServiceHealth();
    if (tabId === 'operations' && !data.incidents) actions.fetchIncidents();
    if (tabId === 'security' && !data.securityData) actions.fetchSecurityCompliance();
  };

  const handleSaveAlerts = async () => {
    const ok = await actions.saveAlertSettings();
    if (ok) setEditingAlerts(false);
  };

  if (flags.loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-coral-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <AdminHeader
        isNotaryMode={isNotaryMode}
        onRefresh={actions.fetchDashboardData}
        token={token}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AdminStatsGrid stats={data.stats} />

        <Breadcrumbs
          items={[
            { label: 'Home', path: '/' },
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Command Authority Suite' },
          ]}
        />

        <AdminTabsNav activeTab={activeTab} onSelect={handleTabSelect} />

        {activeTab === 'overview' && (
          <OverviewTab
            handleApproveNotary={actions.handleApproveNotary}
            handleRejectNotary={actions.handleRejectNotary}
            pendingApplications={data.pendingApplications}
            processingAction={data.processingAction}
            revenueData={data.revenueData}
            stats={data.stats}
          />
        )}

        {activeTab === 'operations' && (
          <OperationsTab
            alertForm={data.alertForm}
            alertSettings={data.alertSettings}
            editingAlerts={editingAlerts}
            exportIncidentPdf={actions.exportIncidentPdf}
            exportingIncidents={flags.exportingIncidents}
            fetchIncidents={actions.fetchIncidents}
            fetchOpsMetrics={actions.fetchOpsMetrics}
            fetchServiceHealth={actions.fetchServiceHealth}
            fetchStorageAnalytics={actions.fetchStorageAnalytics}
            incidents={data.incidents}
            loadingHealth={flags.loadingHealth}
            loadingIncidents={flags.loadingIncidents}
            loadingOps={flags.loadingOps}
            loadingStorageAnalytics={flags.loadingStorageAnalytics}
            opsData={data.opsData}
            saveAlertSettings={handleSaveAlerts}
            savingAlerts={flags.savingAlerts}
            serviceHealth={data.serviceHealth}
            setAlertForm={actions.setAlertForm}
            setEditingAlerts={setEditingAlerts}
            storageAnalytics={data.storageAnalytics}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            exportSecurityPdf={actions.exportSecurityPdf}
            exportingPdf={flags.exportingPdf}
            fetchSecurityCompliance={actions.fetchSecurityCompliance}
            loadingSecurity={flags.loadingSecurity}
            securityData={data.securityData}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            analyticsData={data.analyticsData}
            analyticsPeriod={analyticsPeriod}
            ceremonyAnalytics={data.ceremonyAnalytics}
            fetchAnalyticsData={actions.fetchAnalyticsData}
            fetchCeremonyAnalytics={actions.fetchCeremonyAnalytics}
            loadingAnalytics={flags.loadingAnalytics}
            loadingCeremonyAnalytics={flags.loadingCeremonyAnalytics}
            setAnalyticsPeriod={setAnalyticsPeriod}
            stats={data.stats}
            users={data.users}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            notaries={data.notaries}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setUserRoleFilter={setUserRoleFilter}
            userRoleFilter={userRoleFilter}
            users={data.users}
            viewUserDetails={openUserDetails}
          />
        )}

        {activeTab === 'notaries' && (
          <NotariesTab
            notaries={data.notaries}
            notaryStatusFilter={notaryStatusFilter}
            setNotaryStatusFilter={setNotaryStatusFilter}
            viewUserDetails={openUserDetails}
          />
        )}

        {activeTab === 'audit' && <AuditTab auditLogs={data.auditLogs} />}
      </div>

      {showUserModal && data.selectedUser && (
        <UserDetailsModal
          user={data.selectedUser}
          processingAction={data.processingAction}
          onClose={() => {
            setShowUserModal(false);
            actions.setSelectedUser(null);
          }}
          onStatusChange={async (userId, newStatus) => {
            await actions.handleUserStatusChange(userId, newStatus);
            setShowUserModal(false);
          }}
        />
      )}
      <OnboardingTour portal="command_authority" />
    </div>
  );
};

export default AdminDashboard;
