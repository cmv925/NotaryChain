import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';

export const BalanceAlertsSection = ({ hedera, hbarAlerts }) => (
  <>
    {/* Low Balance Alert */}
    {hedera.balance_hbar != null && hedera.balance_hbar < 10 && (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3" data-testid="ops-hbar-alert">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div>
          <p className="text-red-300 font-medium">Low HBAR Balance Warning</p>
          <p className="text-red-400/70 text-sm">
            Balance is {hedera.balance_hbar.toFixed(2)} HBAR.
            Fund account {hedera.account_id} to avoid service interruption.
          </p>
        </div>
      </div>
    )}

    {/* HBAR Alert History */}
    {hbarAlerts && hbarAlerts.length > 0 && (
      <Card className="bg-white border-slate-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            Balance Alert History
          </h3>
          <div className="space-y-2" data-testid="ops-alert-history">
            {hbarAlerts.map((alert, idx) => (
              <div key={idx} className={`flex items-center justify-between rounded-lg p-3 border ${
                alert.level === 'emergency' ? 'bg-red-500/5 border-red-500/20' :
                alert.level === 'critical' ? 'bg-coral-500/5 border-orange-500/20' :
                'bg-yellow-500/5 border-yellow-500/20'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    alert.level === 'emergency' ? 'bg-red-500/20 text-red-400' :
                    alert.level === 'critical' ? 'bg-coral-500/20 text-coral-600' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>{alert.level.toUpperCase()}</span>
                  <span className="text-slate-500 text-sm">{alert.balance_hbar.toFixed(2)} HBAR</span>
                  <span className="text-slate-500 text-xs">threshold: {alert.threshold_hbar}</span>
                </div>
                <span className="text-slate-500 text-xs">{new Date(alert.alerted_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
  </>
);

export default BalanceAlertsSection;
