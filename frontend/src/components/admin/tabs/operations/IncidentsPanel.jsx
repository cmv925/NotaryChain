import React from 'react';
import { AlertCircle, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';

export const IncidentsPanel = ({ incidents, fetchIncidents, loadingIncidents, exportIncidentPdf, exportingIncidents }) => (
  <Card className="bg-white border-slate-200" data-testid="incidents-panel">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-coral-600" />
          Incidents (7 Days)
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="border-slate-200" onClick={fetchIncidents} disabled={loadingIncidents}>
            <RefreshCw className={`w-4 h-4 ${loadingIncidents ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="bg-coral-500 hover:bg-coral-500" onClick={exportIncidentPdf} disabled={exportingIncidents} data-testid="export-incident-pdf-btn">
            <FileText className="w-4 h-4 mr-1" /> {exportingIncidents ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {incidents ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm">{incidents.summary?.total_incidents || 0} incidents</span>
            {incidents.summary?.resolved > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-coral-500/15 text-coral-600">
                {incidents.summary.resolved} resolved
              </span>
            )}
            {incidents.summary?.ongoing > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 animate-pulse">
                {incidents.summary.ongoing} ongoing
              </span>
            )}
          </div>

          {incidents.incidents?.length > 0 ? (
            <div className="space-y-2">
              {incidents.incidents.map((inc, i) => (
                <div key={i} className={`rounded-xl p-4 border ${inc.status === 'resolved' ? 'bg-cream-100 border-slate-200' : 'bg-red-500/5 border-red-500/20'}`} data-testid={`incident-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${inc.status === 'resolved' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                      <span className="text-navy-900 text-sm font-medium">{inc.service}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${inc.status === 'resolved' ? 'bg-coral-500/15 text-coral-600' : 'bg-red-500/15 text-red-400'}`}>
                        {inc.status}
                      </span>
                    </div>
                    <span className="text-slate-500 text-xs">
                      {inc.duration_minutes != null ? `${inc.duration_minutes} min` : 'ongoing'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Started: {new Date(inc.started_at).toLocaleString()}</span>
                    {inc.ended_at && <span>Ended: {new Date(inc.ended_at).toLocaleString()}</span>}
                  </div>
                  {inc.events?.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-1">
                      {inc.events.slice(0, 3).map((evt, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs">
                          <div className={`w-1.5 h-1.5 rounded-full ${evt.status === 'recovered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-slate-600">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                          <span className={evt.status === 'recovered' ? 'text-coral-600' : 'text-red-400'}>{evt.status}</span>
                          <span className="text-slate-600 truncate">{evt.detail?.slice(0, 60)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-cream-100 rounded-xl border border-slate-200">
              <CheckCircle className="w-8 h-8 text-coral-600 mx-auto mb-2" />
              <p className="text-coral-600 text-sm font-medium">All Clear</p>
              <p className="text-slate-500 text-xs mt-1">No incidents in the last 7 days</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-6">
          <p className="text-slate-500 text-sm">Click refresh to load incident history</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default IncidentsPanel;
