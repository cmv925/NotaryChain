import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';

export const ServiceHealthPanel = ({ serviceHealth, fetchServiceHealth, loadingHealth }) => (
  <Card className="bg-white border-slate-200" data-testid="service-health-panel">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-coral-600" />
          Service Health
        </h3>
        <Button size="sm" variant="outline" className="border-slate-200" onClick={fetchServiceHealth} disabled={loadingHealth} data-testid="health-refresh-btn">
          <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {serviceHealth ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {serviceHealth.services.map((svc, i) => {
              const isHealthy = svc.status === 'healthy';
              const isDegraded = svc.status === 'degraded';
              return (
                <div key={i} className={`rounded-xl p-4 border transition-all ${isHealthy ? 'bg-coral-500/5 border-coral-200' : isDegraded ? 'bg-red-500/5 border-red-500/20' : 'bg-navy-800/30 border-slate-200'}`} data-testid={`health-${svc.service.toLowerCase().replace(' ', '-')}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-navy-900 text-sm font-medium">{svc.service}</span>
                    <div className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-red-400 animate-pulse' : 'bg-gray-500'}`} />
                  </div>
                  <p className={`text-xs ${isHealthy ? 'text-coral-600' : isDegraded ? 'text-red-400' : 'text-slate-500'}`}>
                    {svc.status === 'healthy' ? 'Operational' : svc.status === 'degraded' ? 'Degraded' : 'Not Configured'}
                  </p>
                  <p className="text-slate-600 text-xs mt-1 truncate">{svc.detail}</p>
                </div>
              );
            })}
          </div>

          {serviceHealth.recent_alerts?.length > 0 && (
            <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-navy-900 mb-2">Recent Alerts (24h)</h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {serviceHealth.recent_alerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${alert.status === 'recovered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    <span className={alert.status === 'recovered' ? 'text-coral-600' : 'text-red-400'}>{alert.service}</span>
                    <span className="text-slate-600">{alert.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-slate-600 text-xs">Last checked: {new Date(serviceHealth.checked_at).toLocaleString()}</p>
        </div>
      ) : (
        <div className="flex items-center justify-center py-6">
          <p className="text-slate-500 text-sm">Click refresh to check service health</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default ServiceHealthPanel;
