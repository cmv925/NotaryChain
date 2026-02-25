import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import {
  FileText, Calendar, Users, ArrowRight, ArrowLeft,
  Shield, Loader2,
} from 'lucide-react';

const NOTARIZATION_TYPES = [
  { value: 'ron', label: 'Remote Online Notarization (RON)' },
  { value: 'traditional', label: 'In-Person Notarization' },
  { value: 'mobile', label: 'Mobile Notary' },
];

const VerificationSummary = ({ selectedFile, analysisResult, verificationResult }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-green-500" />
        <span className="text-green-400 font-medium">Document Analyzed</span>
      </div>
      <p className="text-gray-300 text-sm">{selectedFile?.name}</p>
      <p className="text-gray-500 text-xs">Confidence: {analysisResult?.confidence_score}%</p>
    </div>
    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-green-500" />
        <span className="text-green-400 font-medium">Identity Verified</span>
      </div>
      <p className="text-gray-300 text-sm">Facial Recognition</p>
      <p className="text-gray-500 text-xs">Confidence: {(verificationResult?.confidence * 100).toFixed(1)}%</p>
    </div>
  </div>
);

const SignersSection = ({ signers, loading, onSignerChange, onAddSigner, onRemoveSigner }) => (
  <div>
    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
      <Users className="w-5 h-5 text-blue-500" />
      Signers
    </h3>
    <div className="space-y-4">
      {signers.map((signer, index) => (
        <div key={index} className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-semibold">Signer {index + 1}</span>
            {signers.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveSigner(index)}
                className="text-red-400 hover:text-red-300 text-sm"
                disabled={loading}
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Full Name"
              value={signer.name}
              onChange={(e) => onSignerChange(index, 'name', e.target.value)}
              className="bg-[#1a2332] border-gray-700 text-white"
              disabled={loading}
              data-testid={`signer-${index}-name`}
            />
            <Input
              type="email"
              placeholder="Email Address"
              value={signer.email}
              onChange={(e) => onSignerChange(index, 'email', e.target.value)}
              className="bg-[#1a2332] border-gray-700 text-white"
              disabled={loading}
              data-testid={`signer-${index}-email`}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        onClick={onAddSigner}
        variant="outline"
        className="w-full border-gray-700 text-gray-300 hover:text-white"
        disabled={loading}
      >
        + Add Another Signer
      </Button>
    </div>
  </div>
);

export const SubmissionStep = ({
  formData,
  selectedFile,
  analysisResult,
  verificationResult,
  loading,
  onBack,
  onSubmit,
  onChange,
  onSignerChange,
  onAddSigner,
  onRemoveSigner,
}) => (
  <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="step-3-card">
    <CardContent className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-500" />
          Step 3: Complete Your Request
        </h2>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <VerificationSummary
        selectedFile={selectedFile}
        analysisResult={analysisResult}
        verificationResult={verificationResult}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Document Details */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Document Details
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="document_name" className="text-white mb-2 block">
                Document Name *
              </Label>
              <Input
                id="document_name"
                name="document_name"
                required
                value={formData.document_name}
                onChange={onChange}
                className="bg-[#0a0f1a] border-gray-700 text-white"
                placeholder="e.g., Property Purchase Agreement"
                disabled={loading}
                data-testid="document-name-input"
              />
            </div>

            <div>
              <Label htmlFor="notarization_type" className="text-white mb-2 block">
                Notarization Type *
              </Label>
              <select
                id="notarization_type"
                name="notarization_type"
                required
                value={formData.notarization_type}
                onChange={onChange}
                className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                disabled={loading}
                data-testid="notarization-type-select"
              >
                {NOTARIZATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Scheduling
          </h3>
          <div>
            <Label htmlFor="scheduled_time" className="text-white mb-2 block">
              Preferred Date & Time (optional)
            </Label>
            <Input
              id="scheduled_time"
              name="scheduled_time"
              type="datetime-local"
              value={formData.scheduled_time}
              onChange={onChange}
              className="bg-[#0a0f1a] border-gray-700 text-white"
              disabled={loading}
              data-testid="scheduled-time-input"
            />
          </div>
        </div>

        {/* Signers */}
        <SignersSection
          signers={formData.signers}
          loading={loading}
          onSignerChange={onSignerChange}
          onAddSigner={onAddSigner}
          onRemoveSigner={onRemoveSigner}
        />

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="text-white mb-2 block">
            Additional Notes
          </Label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={onChange}
            rows={4}
            className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            placeholder="Any special instructions or requirements..."
            disabled={loading}
            data-testid="notes-textarea"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
          data-testid="submit-request-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit Notarization Request
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
      </form>
    </CardContent>
  </Card>
);
