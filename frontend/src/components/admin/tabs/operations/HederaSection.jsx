import React from 'react';
import { Zap } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';

export const HederaSection = ({ hedera }) => (
  <Card className="bg-white border-slate-200">
    <CardContent className="p-6">
      <h3 className="text-lg font-bold text-navy-900 mb-5 flex items-center gap-2">
        <Zap className="w-5 h-5 text-coral-600" />
        Hedera Hashgraph
        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
          hedera.network === 'mainnet' ? 'bg-coral-500/20 text-coral-600' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {hedera.network}
        </span>
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-hbar-balance">
          <p className="text-slate-500 text-xs mb-1">HBAR Balance</p>
          <p className="text-2xl font-bold text-coral-600">
            {hedera.balance_hbar != null ? hedera.balance_hbar.toFixed(2) : '--'}
          </p>
          <p className="text-slate-500 text-xs mt-1">{hedera.account_id}</p>
        </div>
        <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-total-seals">
          <p className="text-slate-500 text-xs mb-1">Total Seals</p>
          <p className="text-2xl font-bold text-navy-900">{hedera.total_seals}</p>
          <p className="text-slate-500 text-xs mt-1">{hedera.hcs_submitted} on-chain</p>
        </div>
        <div className="bg-cream-100 rounded-lg p-4">
          <p className="text-slate-500 text-xs mb-1">Seals (30d)</p>
          <p className="text-2xl font-bold text-navy-900">{hedera.seals_30d}</p>
          <p className="text-slate-500 text-xs mt-1">{hedera.seals_7d} last 7d</p>
        </div>
        <div className="bg-cream-100 rounded-lg p-4">
          <p className="text-slate-500 text-xs mb-1">Est. Cost (30d)</p>
          <p className="text-2xl font-bold text-coral-600">${hedera.estimated_cost_30d}</p>
          <p className="text-slate-500 text-xs mt-1">{hedera.total_topics} topics</p>
        </div>
      </div>

      {hedera.seal_trend.length > 0 && (
        <div>
          <p className="text-slate-500 text-sm mb-3">Seal Activity (30 days)</p>
          <div className="h-24 flex items-end gap-1">
            {hedera.seal_trend.map((day, idx) => {
              const max = Math.max(...hedera.seal_trend.map(d => d.count)) || 1;
              const pct = (day.count / max) * 100;
              return (
                <div key={idx} className="flex-1 group relative">
                  <div
                    className="w-full bg-gradient-to-t from-coral-500 to-cyan-400 rounded-t transition-all hover:from-coral-500 hover:to-cyan-300"
                    style={{ height: `${Math.max(pct, 8)}%` }}
                    title={`${day.date}: ${day.count} seals`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);

export default HederaSection;
