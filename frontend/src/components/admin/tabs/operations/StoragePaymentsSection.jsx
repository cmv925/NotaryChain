import React from 'react';
import { HardDrive, DollarSign } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';

export const StoragePaymentsSection = ({ storage, payments }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* S3 Storage */}
    <Card className="bg-white border-slate-200">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-5 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-coral-600" />
          Cloud Storage (S3)
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-coral-500/20 text-coral-600">
            {storage.bucket}
          </span>
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-s3-files">
            <p className="text-slate-500 text-xs mb-1">Total Files</p>
            <p className="text-2xl font-bold text-coral-600">{storage.total_files}</p>
          </div>
          <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-s3-size">
            <p className="text-slate-500 text-xs mb-1">Total Size</p>
            <p className="text-2xl font-bold text-navy-900">{storage.total_size_mb || 0} MB</p>
          </div>
        </div>

        <p className="text-slate-500 text-sm mb-3">Storage by Category</p>
        {Object.keys(storage.categories).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(storage.categories).map(([cat, info]) => {
              const maxFiles = Math.max(...Object.values(storage.categories).map(c => c.count)) || 1;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm w-24 truncate">{cat}</span>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-coral-500 rounded-full" style={{ width: `${(info.count / maxFiles) * 100}%` }} />
                  </div>
                  <span className="text-slate-500 text-xs w-20 text-right">{info.count} files</span>
                  <span className="text-slate-500 text-xs w-16 text-right">{info.size_mb} MB</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-4">No files stored yet</p>
        )}
      </CardContent>
    </Card>

    {/* Stripe Payments */}
    <Card className="bg-white border-slate-200">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-5 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Stripe Payments
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-coral-500/20 text-coral-600">
            live
          </span>
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-stripe-revenue">
            <p className="text-slate-500 text-xs mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-green-400">${payments.total_revenue_usd}</p>
          </div>
          <div className="bg-cream-100 rounded-lg p-4">
            <p className="text-slate-500 text-xs mb-1">Revenue (30d)</p>
            <p className="text-2xl font-bold text-navy-900">${payments.revenue_30d_usd}</p>
          </div>
          <div className="bg-cream-100 rounded-lg p-4">
            <p className="text-slate-500 text-xs mb-1">Total Payments</p>
            <p className="text-2xl font-bold text-navy-900">{payments.total_payments}</p>
            <p className="text-slate-500 text-xs mt-1">{payments.payments_30d} last 30d</p>
          </div>
          <div className="bg-cream-100 rounded-lg p-4">
            <p className="text-slate-500 text-xs mb-1">Active Subs</p>
            <p className="text-2xl font-bold text-navy-900">{payments.active_subscriptions}</p>
          </div>
        </div>

        {payments.revenue_trend.length > 0 ? (
          <div>
            <p className="text-slate-500 text-sm mb-3">Revenue Trend (30d)</p>
            <div className="h-24 flex items-end gap-1">
              {payments.revenue_trend.map((day, idx) => {
                const max = Math.max(...payments.revenue_trend.map(d => d.amount_usd)) || 1;
                const pct = (day.amount_usd / max) * 100;
                return (
                  <div key={idx} className="flex-1">
                    <div
                      className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:from-green-500 hover:to-green-300"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${day.date}: $${day.amount_usd}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-4">No payment data yet</p>
        )}
      </CardContent>
    </Card>
  </div>
);

export default StoragePaymentsSection;
