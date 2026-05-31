import React from 'react';

export const SystemStatusStrip = ({ system }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ops-system-status">
    {Object.entries(system).map(([service, status]) => (
      <div key={service} className={`rounded-lg p-3 border flex items-center gap-3 ${
        status === 'live' || status === 'healthy' || status === 's3'
          ? 'bg-coral-500/10 border-coral-200'
          : status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/30'
          : 'bg-gray-500/10 border-slate-200'
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full ${
          status === 'live' || status === 'healthy' || status === 's3'
            ? 'bg-emerald-400 animate-pulse' : status === 'degraded' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
        }`} />
        <div>
          <p className="text-navy-900 text-sm font-medium capitalize">{service}</p>
          <p className="text-slate-500 text-xs capitalize">{status}</p>
        </div>
      </div>
    ))}
  </div>
);

export default SystemStatusStrip;
