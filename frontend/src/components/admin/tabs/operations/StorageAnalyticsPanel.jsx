import React from 'react';
import { HardDrive, RefreshCw, DollarSign } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';

export const StorageAnalyticsPanel = ({ storageAnalytics, fetchStorageAnalytics, loadingStorageAnalytics }) => (
  <Card className="bg-white border-slate-200" data-testid="storage-analytics-panel">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-coral-600" />
          Storage Analytics
        </h3>
        <Button size="sm" variant="outline" className="border-slate-200" onClick={fetchStorageAnalytics} disabled={loadingStorageAnalytics} data-testid="storage-refresh-btn">
          <RefreshCw className={`w-4 h-4 ${loadingStorageAnalytics ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {storageAnalytics ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Files', value: storageAnalytics.total_vault_docs, color: 'blue' },
              { label: 'Storage Used', value: `${storageAnalytics.total_vault_size_mb} MB`, color: 'cyan' },
              { label: 'Downloads', value: storageAnalytics.total_downloads, color: 'purple' },
              { label: 'Uploads (30d)', value: storageAnalytics.cost_projection?.uploads_30d || 0, color: 'emerald' },
            ].map((s, i) => (
              <div key={i} className="bg-cream-100 rounded-xl p-4 border border-slate-200">
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className={`text-xl font-bold text-${s.color}-400`}>{s.value}</p>
              </div>
            ))}
          </div>

          {storageAnalytics.cost_projection && (
            <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-coral-600" />
                Cost Projection (AWS S3 Standard)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Current Usage</p>
                  <p className="text-navy-900 font-medium">{storageAnalytics.cost_projection.current_gb} GB</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Monthly Cost</p>
                  <p className="text-coral-600 font-medium">${storageAnalytics.cost_projection.monthly_cost_usd}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Growth Rate (30d)</p>
                  <p className={`font-medium ${storageAnalytics.cost_projection.growth_rate_pct >= 0 ? 'text-yellow-400' : 'text-coral-600'}`}>
                    {storageAnalytics.cost_projection.growth_rate_pct > 0 ? '+' : ''}{storageAnalytics.cost_projection.growth_rate_pct}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">12-Month Projected</p>
                  <p className="text-navy-900 font-medium">${storageAnalytics.cost_projection.projected_12m_cost_usd}</p>
                </div>
              </div>
              <p className="text-slate-600 text-xs mt-2">Based on $0.023/GB/month S3 Standard pricing</p>
            </div>
          )}

          {storageAnalytics.activity_trend?.length > 0 && (
            <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-navy-900 mb-3">Upload Activity (Last 30 Days)</h4>
              <div className="flex items-end gap-1 h-20">
                {storageAnalytics.activity_trend.map((d, i) => {
                  const maxUploads = Math.max(...storageAnalytics.activity_trend.map(t => t.uploads), 1);
                  const height = Math.max((d.uploads / maxUploads) * 100, 4);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                      <div className="absolute -top-6 hidden group-hover:block bg-navy-900 text-cream-100 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: {d.uploads} files ({d.size_mb} MB)
                      </div>
                      <div
                        className="w-full bg-coral-500/60 rounded-t hover:bg-coral-400/80 transition-colors cursor-pointer"
                        style={{ height: `${height}%`, minHeight: '3px' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {storageAnalytics.per_user?.length > 0 && (
            <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-navy-900 mb-3">Storage by User (Top 10)</h4>
              <div className="space-y-2">
                {storageAnalytics.per_user.slice(0, 10).map((u, i) => {
                  const maxMB = Math.max(...storageAnalytics.per_user.map(x => x.total_size_mb), 1);
                  const pct = (u.total_size_mb / maxMB) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 w-48 truncate">{u.email}</span>
                      <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                        <div className="h-full bg-coral-500/60 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-slate-500 w-24 text-right">{u.total_size_mb} MB ({u.file_count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <p className="text-slate-500 text-sm">Click refresh to load storage analytics</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default StorageAnalyticsPanel;
