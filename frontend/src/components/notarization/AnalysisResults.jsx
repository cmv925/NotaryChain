import React from 'react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  FileText, ArrowRight, CheckCircle, AlertTriangle,
  XCircle, Shield, Eye,
} from 'lucide-react';

const getStatusIcon = (status) => {
  switch (status) {
    case 'verified':
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    case 'needs_review':
      return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    case 'suspicious':
      return <XCircle className="w-6 h-6 text-red-500" />;
    default:
      return <Eye className="w-6 h-6 text-blue-500" />;
  }
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'high':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'low':
      return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    default:
      return 'text-slate-500 bg-gray-500/10 border-slate-300/30';
  }
};

const OverallStatus = ({ analysisResult }) => (
  <div className={`p-4 rounded-lg border ${
    analysisResult.status === 'verified'
      ? 'bg-green-500/10 border-green-500/30'
      : analysisResult.status === 'needs_review'
      ? 'bg-yellow-500/10 border-yellow-500/30'
      : 'bg-red-500/10 border-red-500/30'
  }`}>
    <div className="flex items-center gap-3 mb-2">
      {getStatusIcon(analysisResult.status)}
      <span className="text-white font-semibold text-lg capitalize">
        {analysisResult.status.replace('_', ' ')}
      </span>
    </div>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-slate-500">Confidence Score:</span>
      <Progress value={analysisResult.confidence_score} className="flex-1 h-2" />
      <span className="text-white font-medium">
        {analysisResult.confidence_score}%
      </span>
    </div>
    <p className="text-slate-500 text-sm">{analysisResult.summary}</p>
  </div>
);

const Discrepancies = ({ items }) => (
  <div className="bg-cream-100 rounded-lg p-4 border border-slate-200">
    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
      <AlertTriangle className="w-5 h-5 text-yellow-500" />
      Findings ({items.length})
    </h3>
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {items.map((item, index) => (
        <div key={index} className={`p-3 rounded border ${getSeverityColor(item.severity)}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium capitalize">
              {item.type.replace('_', ' ')}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded uppercase ${
              item.severity === 'high' ? 'bg-red-500/20 text-red-400' :
              item.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {item.severity}
            </span>
          </div>
          <p className="text-sm opacity-80">{item.description}</p>
          {item.recommendation && (
            <p className="text-xs mt-1 opacity-60">
              Recommendation: {item.recommendation}
            </p>
          )}
        </div>
      ))}
    </div>
  </div>
);

const SignatureAnalysis = ({ data }) => (
  <div className="bg-cream-100 rounded-lg p-4 border border-slate-200" data-testid="signature-analysis">
    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
      <FileText className="w-5 h-5 text-purple-500" />
      Signature Analysis
    </h3>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div className="bg-white rounded p-3">
        <span className="text-slate-500 text-xs">Signatures Found</span>
        <p className="text-white text-lg font-bold">
          {data.signatures_found || 0}
        </p>
      </div>
      <div className="bg-white rounded p-3">
        <span className="text-slate-500 text-xs">Signature Quality</span>
        <p className={`text-lg font-bold capitalize ${
          data.signature_quality === 'clear' ? 'text-green-400' :
          data.signature_quality === 'partial' ? 'text-yellow-400' :
          data.signature_quality === 'unclear' ? 'text-orange-400' :
          'text-red-400'
        }`}>
          {data.signature_quality || 'N/A'}
        </p>
      </div>

      {data.signature_locations?.length > 0 && (
        <div className="col-span-2">
          <span className="text-slate-500 text-xs">Signature Locations</span>
          <ul className="text-white text-sm mt-1 list-disc list-inside">
            {data.signature_locations.map((loc, idx) => (
              <li key={idx}>{loc}</li>
            ))}
          </ul>
        </div>
      )}

      {data.signature_types?.length > 0 && (
        <div className="col-span-2">
          <span className="text-slate-500 text-xs">Signature Types</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {data.signature_types.map((type, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs capitalize">
                {type}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="col-span-2">
        <span className="text-slate-500 text-xs">All Required Signatures Present</span>
        <p className={`font-medium ${
          data.all_required_signatures_present ? 'text-green-400' : 'text-yellow-400'
        }`}>
          {data.all_required_signatures_present ? 'Yes - Ready for notarization' : 'No - Some signatures may be missing'}
        </p>
      </div>

      {data.missing_signatures?.length > 0 && (
        <div className="col-span-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
          <span className="text-yellow-400 text-xs font-medium">Missing Signatures</span>
          <ul className="text-yellow-300 text-sm mt-1 list-disc list-inside">
            {data.missing_signatures.map((sig, idx) => (
              <li key={idx}>{sig}</li>
            ))}
          </ul>
        </div>
      )}

      {data.signature_concerns?.length > 0 && (
        <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded p-3">
          <span className="text-red-400 text-xs font-medium">Signature Concerns</span>
          <ul className="text-red-300 text-sm mt-1 list-disc list-inside">
            {data.signature_concerns.map((concern, idx) => (
              <li key={idx}>{concern}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
);

const KeyInformation = ({ data }) => (
  <div className="bg-cream-100 rounded-lg p-4 border border-slate-200">
    <h3 className="text-white font-semibold mb-3">Key Information Extracted</h3>
    <div className="grid grid-cols-2 gap-3 text-sm">
      {data.names?.length > 0 && (
        <div>
          <span className="text-slate-500">Names:</span>
          <p className="text-white">{data.names.join(', ')}</p>
        </div>
      )}
      {data.dates?.length > 0 && (
        <div>
          <span className="text-slate-500">Dates:</span>
          <p className="text-white">{data.dates.join(', ')}</p>
        </div>
      )}
      {data.addresses?.length > 0 && (
        <div className="col-span-2">
          <span className="text-slate-500">Addresses:</span>
          <p className="text-white">{data.addresses.join('; ')}</p>
        </div>
      )}
      <div>
        <span className="text-slate-500">Signatures Present:</span>
        <p className={data.signatures_present ? 'text-green-400' : 'text-yellow-400'}>
          {data.signatures_present ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  </div>
);

const Recommendations = ({ items }) => (
  <div className="bg-cream-100 rounded-lg p-4 border border-slate-200">
    <h3 className="text-white font-semibold mb-3">Recommendations</h3>
    <ul className="list-disc list-inside text-slate-500 text-sm space-y-1">
      {items.map((rec, index) => (
        <li key={index}>{rec}</li>
      ))}
    </ul>
  </div>
);

export const AnalysisResults = ({ analysisResult, canProceedToStep2, onProceed }) => (
  <div className="mt-6 space-y-4" data-testid="analysis-results">
    <OverallStatus analysisResult={analysisResult} />

    {analysisResult.discrepancies?.length > 0 && (
      <Discrepancies items={analysisResult.discrepancies} />
    )}

    {analysisResult.signature_analysis && (
      <SignatureAnalysis data={analysisResult.signature_analysis} />
    )}

    {analysisResult.key_information && (
      <KeyInformation data={analysisResult.key_information} />
    )}

    {analysisResult.recommendations?.length > 0 && (
      <Recommendations items={analysisResult.recommendations} />
    )}

    {canProceedToStep2 && (
      <Button
        onClick={onProceed}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-4"
        data-testid="proceed-to-step-2-btn"
      >
        <Shield className="w-5 h-5 mr-2" />
        Proceed to Identity Verification
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    )}

    {analysisResult.status === 'suspicious' && (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
        <p className="text-red-400 text-sm">
          This document has been flagged as suspicious. Please contact support for manual review.
        </p>
      </div>
    )}
  </div>
);
