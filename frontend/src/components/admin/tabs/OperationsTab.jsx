import React from 'react';
import { Server, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import RecentActivityPanel from '../RecentActivityPanel';
import SystemStatusStrip from './operations/SystemStatusStrip';
import HederaSection from './operations/HederaSection';
import StoragePaymentsSection from './operations/StoragePaymentsSection';
import BalanceAlertsSection from './operations/BalanceAlertsSection';
import ServiceHealthPanel from './operations/ServiceHealthPanel';
import IncidentsPanel from './operations/IncidentsPanel';
import StorageAnalyticsPanel from './operations/StorageAnalyticsPanel';
import AlertSettingsPanel from './operations/AlertSettingsPanel';

export const OperationsTab = ({
  alertForm, alertSettings, editingAlerts, exportIncidentPdf, exportingIncidents,
  fetchIncidents, fetchOpsMetrics, fetchServiceHealth, fetchStorageAnalytics, incidents,
  loadingHealth, loadingIncidents, loadingOps, loadingStorageAnalytics, opsData,
  saveAlertSettings, savingAlerts, serviceHealth, setAlertForm, setEditingAlerts, storageAnalytics,
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
        <Server className="w-6 h-6 text-coral-500" />
        Production Operations
      </h2>
      <Button
        onClick={fetchOpsMetrics}
        disabled={loadingOps}
        variant="outline"
        className="border-slate-200"
        data-testid="ops-refresh-btn"
      >
        <RefreshCw className={`w-4 h-4 ${loadingOps ? 'animate-spin' : ''}`} />
      </Button>
    </div>

    {loadingOps && !opsData ? (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-12 h-12 text-coral-500 animate-spin" />
      </div>
    ) : opsData ? (
      <>
        <SystemStatusStrip system={opsData.system} />
        <HederaSection hedera={opsData.hedera} />
        <StoragePaymentsSection storage={opsData.storage} payments={opsData.payments} />
        <BalanceAlertsSection hedera={opsData.hedera} hbarAlerts={opsData.hbar_alerts} />
        <ServiceHealthPanel serviceHealth={serviceHealth} fetchServiceHealth={fetchServiceHealth} loadingHealth={loadingHealth} />
        <IncidentsPanel
          incidents={incidents}
          fetchIncidents={fetchIncidents}
          loadingIncidents={loadingIncidents}
          exportIncidentPdf={exportIncidentPdf}
          exportingIncidents={exportingIncidents}
        />
        <StorageAnalyticsPanel
          storageAnalytics={storageAnalytics}
          fetchStorageAnalytics={fetchStorageAnalytics}
          loadingStorageAnalytics={loadingStorageAnalytics}
        />
        <AlertSettingsPanel
          alertForm={alertForm}
          alertSettings={alertSettings}
          editingAlerts={editingAlerts}
          setAlertForm={setAlertForm}
          setEditingAlerts={setEditingAlerts}
          saveAlertSettings={saveAlertSettings}
          savingAlerts={savingAlerts}
        />
      </>
    ) : (
      <Card className="bg-white border-slate-200">
        <CardContent className="p-12 text-center">
          <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500">Click refresh to load operations data</p>
        </CardContent>
      </Card>
    )}

    {/* Live operator activity feed — fed by useDashboardTelemetry. */}
    <RecentActivityPanel />
  </div>
);

export default OperationsTab;
