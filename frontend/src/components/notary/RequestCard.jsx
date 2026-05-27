import React from 'react';
import {
  FileText, Eye, CheckCircle, RefreshCw, Video, Award,
  User, Calendar, Clock, Link2,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * Single request row in the notary dashboard list — pending / assigned / completed.
 * Lifted out of NotaryDashboard.jsx for maintainability.
 */
export default function RequestCard({
  request,
  type,
  onViewDetails,
  onAccept,
  onStartSession,
  onComplete,
  onViewCertificate,
  processingAction,
  getPriorityBadge,
  getStatusBadge,
}) {
  const priority = getPriorityBadge(request);

  const borderColor =
    type === 'pending' ? 'hover:border-navy-300/50' :
    type === 'assigned' ? 'hover:border-coral-300/50' :
    'hover:border-green-500/50';

  const iconColor =
    type === 'pending' ? 'text-navy-600' :
    type === 'assigned' ? 'text-coral-500' :
    'text-green-500';

  return (
    <Card
      className={`bg-white border-slate-200 ${borderColor} transition-all`}
      data-testid={`request-${request.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
            <FileText className={`w-6 h-6 ${iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-navy-900 font-semibold truncate">
                    {request.document_name}
                  </h3>
                  <Badge className={`${getStatusBadge(request.status)} text-xs`}>
                    {request.status?.replace('_', ' ')}
                  </Badge>
                  {priority && (
                    <Badge className={`${priority.class} text-xs`}>{priority.label}</Badge>
                  )}
                  {request.biometric_verified && (
                    <Badge className="bg-green-500/20 text-green-400 text-xs">ID Verified</Badge>
                  )}
                </div>
                <p className="text-slate-500 text-sm mt-1 capitalize">
                  {request.document_type?.replace('_', ' ')} • {request.notarization_type}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={onViewDetails}
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-navy-900"
                >
                  <Eye className="w-4 h-4" />
                </Button>

                {type === 'pending' && (
                  <Button
                    onClick={onAccept}
                    disabled={processingAction === request.id}
                    size="sm"
                    className="bg-coral-500 hover:bg-coral-600 text-white"
                    data-testid={`accept-${request.id}`}
                  >
                    {processingAction === request.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>
                )}

                {type === 'assigned' && (
                  <>
                    <Button
                      onClick={onStartSession}
                      disabled={processingAction === request.id}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-navy-900"
                      data-testid={`start-session-${request.id}`}
                    >
                      <Video className="w-4 h-4 mr-1" />
                      {request.status === 'in_progress' ? 'Join' : 'Start'}
                    </Button>
                    {request.status === 'in_progress' && (
                      <Button
                        onClick={onComplete}
                        disabled={processingAction === request.id}
                        size="sm"
                        variant="outline"
                        className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                        data-testid={`complete-${request.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}

                {type === 'completed' && onViewCertificate && (
                  <Button
                    onClick={onViewCertificate}
                    size="sm"
                    variant="outline"
                    className="border-coral-500/50 text-coral-600 hover:bg-coral-500/20"
                  >
                    <Award className="w-4 h-4 mr-1" />
                    Certificate
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {request.signers?.length || 1} signer(s)
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {request.scheduled_time
                  ? new Date(request.scheduled_time).toLocaleDateString()
                  : 'Flexible'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(request.created_at).toLocaleDateString()}
              </span>
              {request.hcs_topic_id && (
                <span className="flex items-center gap-1 text-coral-600">
                  <Link2 className="w-3 h-3" />
                  On-chain
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
