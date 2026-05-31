import React from 'react';
import {
  Settings, Save, Mail, MailX, Bell, BellOff, ToggleLeft, ToggleRight, RefreshCw,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';

export const AlertSettingsPanel = ({
  alertForm, alertSettings, editingAlerts, setAlertForm, setEditingAlerts, saveAlertSettings, savingAlerts,
}) => (
  <Card className="bg-white border-slate-200" data-testid="alert-settings-panel">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-coral-500" />
          Alert Configuration
        </h3>
        {!editingAlerts ? (
          <Button
            size="sm"
            variant="outline"
            className="border-coral-300/50 text-coral-500 hover:bg-coral-500/10"
            onClick={() => { if (!alertForm && alertSettings) setAlertForm(JSON.parse(JSON.stringify(alertSettings))); setEditingAlerts(true); }}
            data-testid="edit-alert-settings-btn"
          >
            <Settings className="w-4 h-4 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-slate-200 text-slate-500" onClick={() => { setEditingAlerts(false); setAlertForm(JSON.parse(JSON.stringify(alertSettings))); }}>Cancel</Button>
            <Button size="sm" className="bg-coral-500 hover:bg-coral-600" onClick={saveAlertSettings} disabled={savingAlerts} data-testid="save-alert-settings-btn">
              <Save className="w-4 h-4 mr-1" /> {savingAlerts ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {alertForm ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-500 text-xs block mb-1.5">Check Interval (minutes)</label>
              <input
                type="number"
                min={5} max={1440}
                value={alertForm.check_interval_minutes}
                onChange={(e) => setAlertForm(f => ({...f, check_interval_minutes: parseInt(e.target.value) || 30}))}
                disabled={!editingAlerts}
                className="w-full px-3 py-2 rounded-lg bg-cream-100 border border-slate-200 text-navy-900 disabled:opacity-50"
                data-testid="alert-check-interval"
              />
              <p className="text-slate-600 text-xs mt-1">How often to check balance (5–1440 min)</p>
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1.5">Cooldown Period (hours)</label>
              <input
                type="number"
                min={1} max={168}
                value={alertForm.cooldown_hours}
                onChange={(e) => setAlertForm(f => ({...f, cooldown_hours: parseInt(e.target.value) || 24}))}
                disabled={!editingAlerts}
                className="w-full px-3 py-2 rounded-lg bg-cream-100 border border-slate-200 text-navy-900 disabled:opacity-50"
                data-testid="alert-cooldown"
              />
              <p className="text-slate-600 text-xs mt-1">Don't repeat same alert within this period (1–168h)</p>
            </div>
          </div>

          <div>
            <label className="text-slate-500 text-xs block mb-2">Notification Channels</label>
            <div className="flex gap-4">
              <button
                onClick={() => editingAlerts && setAlertForm(f => ({...f, email_alerts_enabled: !f.email_alerts_enabled}))}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${alertForm.email_alerts_enabled ? 'bg-coral-500/10 border-emerald-500/40 text-coral-600' : 'bg-navy-800/50 border-slate-200 text-slate-500'} ${!editingAlerts ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                data-testid="toggle-email-alerts"
              >
                {alertForm.email_alerts_enabled ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                Email Alerts
              </button>
              <button
                onClick={() => editingAlerts && setAlertForm(f => ({...f, in_app_alerts_enabled: !f.in_app_alerts_enabled}))}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${alertForm.in_app_alerts_enabled ? 'bg-coral-500/10 border-emerald-500/40 text-coral-600' : 'bg-navy-800/50 border-slate-200 text-slate-500'} ${!editingAlerts ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                data-testid="toggle-inapp-alerts"
              >
                {alertForm.in_app_alerts_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                In-App Alerts
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-500 text-xs block mb-2">Alert Thresholds</label>
            <div className="space-y-2">
              {alertForm.thresholds.map((t, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${t.enabled ? (t.level === 'emergency' ? 'bg-red-500/5 border-red-500/20' : t.level === 'critical' ? 'bg-coral-500/5 border-orange-500/20' : 'bg-yellow-500/5 border-yellow-500/20') : 'bg-navy-800/30 border-slate-200'}`}>
                  <button
                    onClick={() => {
                      if (!editingAlerts) return;
                      const updated = [...alertForm.thresholds];
                      updated[idx] = {...updated[idx], enabled: !updated[idx].enabled};
                      setAlertForm(f => ({...f, thresholds: updated}));
                    }}
                    className={!editingAlerts ? 'cursor-default' : 'cursor-pointer'}
                    data-testid={`toggle-threshold-${t.level}`}
                  >
                    {t.enabled ? <ToggleRight className="w-5 h-5 text-coral-600" /> : <ToggleLeft className="w-5 h-5 text-slate-600" />}
                  </button>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase w-24 text-center ${t.level === 'emergency' ? 'bg-red-500/20 text-red-400' : t.level === 'critical' ? 'bg-coral-500/20 text-coral-600' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {t.level}
                  </span>
                  <span className="text-slate-500 text-sm">&lt;</span>
                  <input
                    type="number"
                    min={0}
                    value={t.hbar}
                    onChange={(e) => {
                      const updated = [...alertForm.thresholds];
                      updated[idx] = {...updated[idx], hbar: parseFloat(e.target.value) || 0};
                      setAlertForm(f => ({...f, thresholds: updated}));
                    }}
                    disabled={!editingAlerts}
                    className="w-20 px-2 py-1 rounded bg-cream-100 border border-slate-200 text-navy-900 text-sm disabled:opacity-50"
                  />
                  <span className="text-slate-500 text-sm">HBAR</span>
                  <span className="text-slate-500 text-xs ml-auto hidden sm:inline">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      )}
    </CardContent>
  </Card>
);

export default AlertSettingsPanel;
